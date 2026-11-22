#!/usr/bin/env python3
"""Unified AI Studio runtime bridge for `rtk` (Lite Mode) + `microsoft/TokenEconomizer`.

Why this exists:
1. Container resets wipe `/root` and `/usr/local/bin`, while `/app/applet` persists.
   Both tools' binaries, configs, `history.db`, and learned `microskills`/ledger are
   stored inside `<repo>/.agent-state/` and restored offline in milliseconds.
2. Google AI Studio does not automatically fire `.agents/plugins/*/hooks.json`.
   This bridge provides `start`, `run` (`./tools/r <cmd>`), and `end` so every shell
   command automatically runs through `rtk` when applicable AND streams real
   `PostToolUse`/`PostToolUseFailure` + Claude-format JSONL transcripts into
   `TokenEconomizer` (`te-hook --host claude` + `te fold`).
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
STATE_ROOT = ROOT_DIR / ".agent-state"
TE_HOME = STATE_ROOT / "tokeneconomizer"
TRANSCRIPTS_DIR = TE_HOME / "transcripts"
ACTIVE_SESSION_FILE = TE_HOME / "active_session.json"
TE_BIN = TE_HOME / "bin" / "te"
TE_HOOK_BIN = TE_HOME / "bin" / "te-hook"
RTK_CACHE_BIN = STATE_ROOT / "rtk" / "bin" / "rtk"

EXECUTABLE_TOOLS = (
    ROOT_DIR / "tools" / "r",
    ROOT_DIR / "tools" / "rtk.sh",
    ROOT_DIR / "tools" / "te.sh",
    ROOT_DIR / "tools" / "cbm.sh",
    ROOT_DIR / "tools" / "ov.sh",
    ROOT_DIR / "tools" / "agent-bridge.py",
)

NON_RTK_SCRIPTS = frozenset(
    {
        "cbm",
        "cbm:index",
        "rtk",
        "rtk:gain",
        "rtk:setup",
        "te",
        "te:status",
        "te:doctor",
        "te:setup",
        "ov",
        "ov:setup",
        "ov:doctor",
        "ov:server",
        "ov:mcp",
        "vikingbot",
        "r",
        "agent:start",
        "agent:end",
    }
)

RTK_COMMANDS = frozenset(
    {
        "ls",
        "tree",
        "read",
        "smart",
        "git",
        "gh",
        "glab",
        "aws",
        "psql",
        "pnpm",
        "err",
        "test",
        "json",
        "deps",
        "env",
        "find",
        "diff",
        "log",
        "dotnet",
        "docker",
        "kubectl",
        "oc",
        "summary",
        "grep",
        "rg",
        "ast-grep",
        "wget",
        "wc",
        "jest",
        "vitest",
        "ctest",
        "prisma",
        "tsc",
        "ng",
        "next",
        "lint",
        "prettier",
        "format",
        "cargo",
        "npm",
        "npx",
        "curl",
    }
)
SHELL_META_TOKENS = ("&&", "||", ";", "|", ">", "<", "\n", "$(", "`")


def _tool_env() -> dict[str, str]:
    env = os.environ.copy()
    env["TOKENECONOMIZER_HOME"] = str(TE_HOME)
    env["RTK_TELEMETRY_DISABLED"] = "1"
    return env


def ensure_ready() -> None:
    """Restore persistent symlinks, executable bits, and binaries if container reset."""
    for tool_path in EXECUTABLE_TOOLS:
        if tool_path.is_file() and not os.access(tool_path, os.X_OK):
            try:
                tool_path.chmod(tool_path.stat().st_mode | 0o755)
            except OSError:
                pass

    rtk_ok = (
        Path("/usr/local/bin/rtk").is_file()
        and (Path.home() / ".config" / "rtk").is_symlink()
        and (Path.home() / ".local" / "share" / "rtk").is_symlink()
    )
    te_ok = (
        Path("/usr/local/bin/te").is_file()
        and Path("/usr/local/bin/te-hook").is_file()
        and (Path.home() / ".tokeneconomizer").is_symlink()
        and TE_BIN.is_file()
    )
    cbm_ok = Path("/usr/local/bin/codebase-memory-mcp").is_file()
    ov_ok = (
        Path("/usr/local/bin/ov").is_file()
        and Path("/usr/local/bin/openviking-server").is_file()
        and Path("/usr/local/bin/ov-mcp").is_file()
        and Path("/usr/local/bin/ollama").is_file()
        and (Path.home() / ".openviking").is_symlink()
        and (STATE_ROOT / "openviking" / "home" / "ov.conf").is_file()
        and (STATE_ROOT / "openviking" / "ollama" / "bin" / "ollama").is_file()
    )
    if not rtk_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "rtk.sh"), "ensure"], check=True)
    if not te_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "te.sh"), "ensure"], check=True)
    if not cbm_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "ensure"], check=True)
    if not ov_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "ov.sh"), "ensure"], check=True)


def _call_hook(event: str, payload: dict) -> dict:
    if not TE_HOOK_BIN.is_file():
        return {}
    proc = subprocess.run(
        [str(TE_HOOK_BIN), "--host", "claude", "--event", event],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        env=_tool_env(),
        cwd=str(ROOT_DIR),
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        return {}
    try:
        return json.loads(proc.stdout)
    except ValueError:
        return {}


def _append_jsonl(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        for entry in entries:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _read_active_session() -> dict | None:
    if not ACTIVE_SESSION_FILE.is_file():
        return None
    try:
        data = json.loads(ACTIVE_SESSION_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data.get("session_id") and data.get("transcript_path"):
            return data
    except (OSError, ValueError):
        pass
    return None


def _print_hook_messages(resp: dict) -> None:
    if not resp:
        return
    sys_msg = resp.get("systemMessage")
    if isinstance(sys_msg, str) and sys_msg.strip():
        print(f"[TokenEconomizer] {sys_msg.strip()}", file=sys.stderr)
    hook_out = resp.get("hookSpecificOutput")
    if isinstance(hook_out, dict):
        ctx = hook_out.get("additionalContext")
        if isinstance(ctx, str) and ctx.strip():
            print(ctx.strip())


def _recover_openviking_services() -> None:
    if os.environ.get("OV_NO_AUTOSTART") == "1":
        return
    ov_conf = STATE_ROOT / "openviking" / "home" / "ov.conf"
    if not ov_conf.is_file():
        return
    subprocess.run(
        ["bash", str(ROOT_DIR / "tools" / "ov.sh"), "recover"],
        env=_tool_env(),
        cwd=str(ROOT_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def start_session(prompt: str = "AI Studio task", explicit: bool = False) -> dict:
    ensure_ready()
    if explicit:
        _recover_openviking_services()
    existing = _read_active_session()
    if existing:
        age = time.time() - float(existing.get("updated_at", existing.get("started_at", 0)))
        calls = int(existing.get("calls", 0))
        # Explicit `start` folds any prior non-empty session (>60s old); implicit runs fold after 10m idle
        if (explicit and calls > 0 and age > 60) or age >= 600:
            end_session(quiet=True)
        else:
            return existing

    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    sid = f"ais-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    transcript = TRANSCRIPTS_DIR / f"{sid}.jsonl"
    _append_jsonl(
        transcript,
        [{"type": "user", "cwd": str(ROOT_DIR), "message": {"role": "user", "content": prompt}}],
    )
    session = {
        "session_id": sid,
        "transcript_path": str(transcript),
        "started_at": time.time(),
        "updated_at": time.time(),
        "calls": 0,
    }
    ACTIVE_SESSION_FILE.write_text(json.dumps(session, indent=2), encoding="utf-8")

    s_resp = _call_hook(
        "SessionStart",
        {
            "session_id": sid,
            "cwd": str(ROOT_DIR),
            "transcript_path": str(transcript),
            "hook_event_name": "SessionStart",
            "source": "startup",
        },
    )
    _print_hook_messages(s_resp)

    p_resp = _call_hook(
        "UserPromptSubmit",
        {
            "session_id": sid,
            "cwd": str(ROOT_DIR),
            "transcript_path": str(transcript),
            "hook_event_name": "UserPromptSubmit",
            "prompt": prompt,
        },
    )
    _print_hook_messages(p_resp)
    return session


def _rtk_bin() -> str:
    return str(RTK_CACHE_BIN) if RTK_CACHE_BIN.is_file() else "rtk"


def _test_files() -> list[str]:
    files = sorted(str(p.relative_to(ROOT_DIR)) for p in (ROOT_DIR / "tests").glob("*.test.mjs"))
    return files or ["tests/*.test.mjs"]


def _resolve_single_command(toks: list[str]) -> tuple[list[str], str, dict[str, str]]:
    """Map package scripts & biome/oxlint/tsc/test/next commands to native RTK filters.

    Returns (exec_argv, logical_cmd_for_te, extra_env).
    """
    if not toks:
        return toks, "", {}

    if toks[0] == "rtk" and len(toks) > 1:
        toks = toks[1:]

    rtk = _rtk_bin()

    # Unwrap `bun run <script> [extra...]` / `npm run <script> [extra...]`
    if len(toks) >= 3 and toks[0] in ("bun", "npm") and toks[1] == "run":
        script = toks[2]
        rest = toks[3:]
        if script == "typecheck":
            cmd = ["tsc", "--noEmit", *rest]
            return [rtk, *cmd], shlex.join(cmd), {}
        if script == "lint":
            cmd = ["bunx", "biome", "lint", "--max-diagnostics=1000", "app", "components", "features", "lib", *rest]
            return [rtk, "err", *cmd], shlex.join(cmd), {}
        if script == "format":
            cmd = ["bunx", "biome", "format", "--write", "app", "components", "features", "lib", *rest]
            return [rtk, "err", *cmd], shlex.join(cmd), {}
        if script == "lint:ox":
            cmd = ["bunx", "oxlint", "app", "components", "features", "lib", *rest]
            return [rtk, "err", *cmd], shlex.join(cmd), {}
        if script == "test":
            tfiles = rest if rest else _test_files()
            cmd = ["node", "--import", "./tests/ts-loader.mjs", "--test", *tfiles]
            return [rtk, "test", *cmd], shlex.join(cmd), {}
        if script == "build":
            cmd = ["next", "build", "--turbopack", *rest]
            return [rtk, *cmd], shlex.join(cmd), {"NODE_ENV": "production"}
        if script == "check":
            lint_cmd = " ".join(
                shlex.quote(t)
                for t in [rtk, "err", "bunx", "biome", "lint", "--max-diagnostics=1000", "app", "components", "features", "lib"]
            )
            tsc_cmd = f"{shlex.quote(rtk)} tsc --noEmit"
            test_cmd = " ".join(
                shlex.quote(t) for t in [rtk, "test", "node", "--import", "./tests/ts-loader.mjs", "--test", *_test_files()]
            )
            return ["bash", "-lc", f"{lint_cmd} && {tsc_cmd} && {test_cmd}"], "bun run check", {}
        if script == "cbm":
            cmd = ["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "cli", *rest]
            return cmd, shlex.join(toks), {}
        if script == "cbm:index":
            cmd = ["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "index", *rest]
            return cmd, shlex.join(toks), {}
        if script in NON_RTK_SCRIPTS:
            return toks, shlex.join(toks), {}

    # Direct biome / oxlint invocations compress best via `rtk err`
    if toks[:2] in (["bunx", "biome"], ["npx", "biome"]) or toks[0] in ("biome", "oxlint") or toks[:2] in (
        ["bunx", "oxlint"],
        ["npx", "oxlint"],
    ):
        return [rtk, "err", *toks], shlex.join(toks), {}

    if toks[0] in RTK_COMMANDS:
        return [rtk, *toks], shlex.join(toks), {}

    return toks, shlex.join(toks), {}


def _rewrite_for_rtk(args: list[str]) -> tuple[list[str], bool, str, dict[str, str]]:
    """Return (exec_argv, use_shell, logical_command_str, extra_env)."""
    if len(args) == 1 and any(tok in args[0] for tok in SHELL_META_TOKENS):
        raw_cmd = args[0]
        # Rewrite simple `&&`-separated commands safely without touching pipes/subshells
        if all(tok not in raw_cmd for tok in ("|", ";", ">", "<", "$(", "`", "\n", "||")):
            parts = [p.strip() for p in raw_cmd.split("&&") if p.strip()]
            rewritten: list[str] = []
            logical_parts: list[str] = []
            merged_env: dict[str, str] = {}
            for part in parts:
                try:
                    toks = shlex.split(part)
                except ValueError:
                    rewritten.append(part)
                    logical_parts.append(part)
                    continue
                resolved, logical, extra_env = _resolve_single_command(toks)
                merged_env.update(extra_env)
                if resolved[:2] == ["bash", "-lc"] and len(resolved) == 3:
                    rewritten.append(resolved[2])
                else:
                    rewritten.append(shlex.join(resolved))
                logical_parts.append(logical or part)
            return ["bash", "-lc", " && ".join(rewritten)], False, " && ".join(logical_parts), merged_env
        return ["bash", "-lc", raw_cmd], False, raw_cmd, {}

    if args and args[0] == "--raw":
        inner = args[1:]
        return inner, False, shlex.join(inner), {}

    if len(args) == 1 and " " in args[0]:
        try:
            toks = shlex.split(args[0])
            resolved, logical, extra_env = _resolve_single_command(toks)
            return resolved, False, logical, extra_env
        except ValueError:
            pass

    resolved, logical, extra_env = _resolve_single_command(args)
    return resolved, False, logical, extra_env


def run_command(args: list[str]) -> int:
    if not args:
        print("Usage: ./tools/r [--raw] <command...>", file=sys.stderr)
        return 2

    ensure_ready()
    session = _read_active_session() or start_session("Shell session")
    sid = session["session_id"]
    transcript = Path(session["transcript_path"])

    argv, use_shell, logical_cmd, extra_env = _rewrite_for_rtk(args)
    env = _tool_env()
    env.update(extra_env)
    env["TE_SESSION_ID"] = sid

    proc = subprocess.run(argv, shell=use_shell, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
    if proc.stdout:
        sys.stdout.write(proc.stdout)
        sys.stdout.flush()
    if proc.stderr:
        sys.stderr.write(proc.stderr)
        sys.stderr.flush()

    combined = (proc.stdout + ("\n" + proc.stderr if proc.stderr else "")).strip()
    snippet = combined[:4000]
    call_id = f"toolu_{uuid.uuid4().hex[:12]}"
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"

    _append_jsonl(
        transcript,
        [
            {
                "type": "assistant",
                "cwd": str(ROOT_DIR),
                "message": {
                    "id": msg_id,
                    "role": "assistant",
                    "content": [
                        {
                            "type": "tool_use",
                            "id": call_id,
                            "name": "Bash",
                            "input": {"command": logical_cmd},
                        }
                    ],
                },
            },
            {
                "type": "user",
                "cwd": str(ROOT_DIR),
                "message": {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": call_id,
                            "is_error": proc.returncode != 0,
                            "content": snippet if proc.returncode == 0 else f"Exit code {proc.returncode}\n{snippet}",
                        }
                    ],
                },
            },
        ],
    )

    session["calls"] = int(session.get("calls", 0)) + 1
    session["updated_at"] = time.time()
    ACTIVE_SESSION_FILE.write_text(json.dumps(session, indent=2), encoding="utf-8")

    if proc.returncode == 0:
        hook_resp = _call_hook(
            "PostToolUse",
            {
                "session_id": sid,
                "cwd": str(ROOT_DIR),
                "transcript_path": str(transcript),
                "hook_event_name": "PostToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": logical_cmd},
                "tool_response": {"stdout": snippet, "stderr": "", "exit_code": 0},
            },
        )
    else:
        hook_resp = _call_hook(
            "PostToolUseFailure",
            {
                "session_id": sid,
                "cwd": str(ROOT_DIR),
                "transcript_path": str(transcript),
                "hook_event_name": "PostToolUseFailure",
                "tool_name": "Bash",
                "tool_input": {"command": logical_cmd},
                "error": f"Exit code {proc.returncode}\n{snippet}",
            },
        )
    _print_hook_messages(hook_resp)
    return proc.returncode


def end_session(quiet: bool = False) -> None:
    ensure_ready()
    session = _read_active_session()
    if not session:
        if not quiet:
            print("[TokenEconomizer] No active bridge session.")
        return

    sid = session["session_id"]
    transcript = session["transcript_path"]
    _call_hook(
        "Stop",
        {
            "session_id": sid,
            "cwd": str(ROOT_DIR),
            "transcript_path": transcript,
            "hook_event_name": "Stop",
            "stop_hook_active": False,
        },
    )
    _call_hook(
        "SessionEnd",
        {
            "session_id": sid,
            "cwd": str(ROOT_DIR),
            "transcript_path": transcript,
            "hook_event_name": "SessionEnd",
            "reason": "completed",
        },
    )
    fold_proc = subprocess.run(
        [str(TE_BIN), "--host", "claude", "--cwd", str(ROOT_DIR), "fold", "--session", sid, "--verbose"],
        env=_tool_env(),
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
    )
    try:
        ACTIVE_SESSION_FILE.unlink(missing_ok=True)
    except OSError:
        pass

    if not quiet:
        folded = fold_proc.stdout.strip()
        print(f"[TokenEconomizer] Folded session {sid}" + (f": {folded}" if folded else ""))


def check_tools() -> int:
    ensure_ready()
    env = _tool_env()
    checks = [
        ("rtk", [_rtk_bin(), "--version"]),
        ("te", [str(TE_BIN), "--cwd", str(ROOT_DIR), "doctor"]),
        ("cbm", ["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "cli", "list_projects"]),
        ("ov", ["bash", str(ROOT_DIR / "tools" / "ov.sh"), "--version"]),
        ("ollama", ["bash", str(ROOT_DIR / "tools" / "ov.sh"), "ollama", "status"]),
    ]
    failed = 0
    for name, cmd in checks:
        proc = subprocess.run(cmd, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
        status = "ok" if proc.returncode == 0 else f"fail({proc.returncode})"
        first_line = (proc.stdout or proc.stderr or "").strip().splitlines()[:1]
        detail = first_line[0] if first_line else ""
        print(f"[{name}] {status}" + (f" — {detail}" if detail else ""))
        if proc.returncode != 0:
            failed += 1
    perms_ok = all(p.is_file() and os.access(p, os.X_OK) for p in EXECUTABLE_TOOLS)
    print(f"[tools:+x] {'ok' if perms_ok else 'fail'}")
    return 1 if (failed or not perms_ok) else 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: agent-bridge.py <ensure|check|start|run|end> [...]", file=sys.stderr)
        return 2
    action = sys.argv[1]
    if action == "ensure":
        ensure_ready()
        return 0
    if action == "check":
        return check_tools()
    if action == "start":
        prompt = " ".join(sys.argv[2:]).strip() or "AI Studio task"
        sess = start_session(prompt, explicit=True)
        print(f"[TokenEconomizer] Active session: {sess['session_id']} (calls: {sess['calls']})")
        return 0
    if action == "run":
        return run_command(sys.argv[2:])
    if action == "end":
        end_session()
        return 0
    print(f"Unknown action: {action}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
