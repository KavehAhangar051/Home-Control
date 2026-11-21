#!/usr/bin/env python3
"""Unified AI Studio runtime bridge for `rtk` (Lite Mode) + `microsoft/TokenEconomizer` + `cbm` + `pio`.

1. Container resets wipe `/root` and `/usr/local/bin`, while `/app/applet` persists.
   All 4 tools' binaries/bundles, configs, `history.db`, and learned `microskills`/ledger
   are stored inside `<repo>/.agent-state/` (and `.codebase-memory/`) and restored offline in milliseconds.
2. Fresh GitHub imports automatically re-install binaries/bundles via `tools/*.sh` and
   preserve committed `rtk` Lite config/history, `cbm` graph artifact, and `te` learned memory.
3. Streams real `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`,
   `Stop`, `SessionEnd` + Claude-format JSONL transcripts into `TokenEconomizer` (`te-hook` + `te fold`).
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

RTK_STATE_ROOT = STATE_ROOT / "rtk"
RTK_CACHE_BIN = RTK_STATE_ROOT / "bin" / "rtk"
RTK_CFG_DIR = RTK_STATE_ROOT / "config"
RTK_DATA_DIR = RTK_STATE_ROOT / "data"
RTK_CONTAINER_MARKER = Path("/tmp/.rtk_container_initialized")

CBM_CACHE_BIN = STATE_ROOT / "cbm" / "bin" / "codebase-memory-mcp"
CBM_CONTAINER_MARKER = Path("/tmp/.cbm_container_initialized")

PIO_STATE_ROOT = STATE_ROOT / "platformio"
PIO_BIN = PIO_STATE_ROOT / "penv" / "bin" / "pio"
PIO_CONTAINER_MARKER = Path("/tmp/.pio_container_initialized")

TE_HOME = STATE_ROOT / "tokeneconomizer"
TRANSCRIPTS_DIR = TE_HOME / "transcripts"
ACTIVE_SESSION_FILE = TE_HOME / "active_session.json"
TE_BIN = TE_HOME / "bin" / "te"
TE_HOOK_BIN = TE_HOME / "bin" / "te-hook"
TE_CONTAINER_MARKER = Path("/tmp/.te_container_initialized")

EXECUTABLE_TOOLS = (
    ROOT_DIR / "tools" / "r",
    ROOT_DIR / "tools" / "rtk.sh",
    ROOT_DIR / "tools" / "cbm.sh",
    ROOT_DIR / "tools" / "pio.sh",
    ROOT_DIR / "tools" / "te.sh",
    ROOT_DIR / "tools" / "agent-bridge.py",
)

NON_RTK_SCRIPTS = frozenset(
    {
        "r",
        "rtk",
        "rtk:gain",
        "rtk:setup",
        "rtk:ensure",
        "cbm",
        "cbm:index",
        "cbm:setup",
        "cbm:ensure",
        "pio",
        "pio:setup",
        "pio:ensure",
        "pio:test",
        "pio:build",
        "te",
        "te:status",
        "te:doctor",
        "te:setup",
        "te:ensure",
        "agent:start",
        "agent:end",
        "tools:check",
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
    env["RTK_TELEMETRY_DISABLED"] = "1"
    env["PLATFORMIO_CORE_DIR"] = str(PIO_STATE_ROOT)
    env["TOKENECONOMIZER_HOME"] = str(TE_HOME)
    return env


def _checkpoint_sqlite_dir(directory: Path) -> None:
    if not directory.is_dir():
        return
    for wal_path in directory.rglob("*.db-wal"):
        if wal_path.stat().st_size == 0:
            continue
        db_path = wal_path.with_name(wal_path.name[:-4])
        if db_path.is_file():
            try:
                import sqlite3

                with sqlite3.connect(str(db_path), timeout=1.0) as conn:
                    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            except Exception:
                pass


def _checkpoint_all_sqlite() -> None:
    _checkpoint_sqlite_dir(RTK_DATA_DIR)
    _checkpoint_sqlite_dir(TE_HOME)


def ensure_ready() -> None:
    for tool_path in EXECUTABLE_TOOLS:
        if tool_path.is_file() and not os.access(tool_path, os.X_OK):
            try:
                tool_path.chmod(tool_path.stat().st_mode | 0o755)
            except OSError:
                pass

    rtk_ok = (
        RTK_CACHE_BIN.is_file()
        and Path("/usr/local/bin/rtk").is_file()
        and (Path.home() / ".config" / "rtk").is_symlink()
        and (Path.home() / ".local" / "share" / "rtk").is_symlink()
        and RTK_CONTAINER_MARKER.is_file()
    )
    if not rtk_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "rtk.sh"), "ensure"], check=True)

    cbm_ok = (
        CBM_CACHE_BIN.is_file()
        and Path("/usr/local/bin/codebase-memory-mcp").is_file()
        and (Path.home() / ".cache" / "codebase-memory-mcp" / "app-applet.db").is_file()
        and CBM_CONTAINER_MARKER.is_file()
    )
    if not cbm_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "ensure"], check=True)

    pio_ok = (
        PIO_BIN.is_file()
        and Path("/usr/local/bin/pio").is_file()
        and (Path.home() / ".platformio").is_symlink()
        and PIO_CONTAINER_MARKER.is_file()
    )
    if not pio_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "pio.sh"), "ensure"], check=True)

    te_ok = (
        TE_BIN.is_file()
        and TE_HOOK_BIN.is_file()
        and Path("/usr/local/bin/te").is_file()
        and Path("/usr/local/bin/te-hook").is_file()
        and (Path.home() / ".tokeneconomizer").is_symlink()
        and TE_CONTAINER_MARKER.is_file()
    )
    if not te_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "te.sh"), "ensure"], check=True)


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


def start_session(prompt: str = "AI Studio task", explicit: bool = False) -> dict:
    ensure_ready()
    existing = _read_active_session()
    if existing:
        age = time.time() - float(existing.get("updated_at", existing.get("started_at", 0)))
        calls = int(existing.get("calls", 0))
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
    _checkpoint_all_sqlite()
    return session


def _rtk_bin() -> str:
    if RTK_CACHE_BIN.is_file():
        return str(RTK_CACHE_BIN)
    return "rtk"


def _resolve_single_command(toks: list[str]) -> tuple[list[str], str]:
    if not toks:
        return toks, ""
    rtk = _rtk_bin()
    if toks[0] == "rtk" or toks[0].endswith("/rtk"):
        return [rtk, *toks[1:]], shlex.join(toks)
    if toks[0] in ("bun", "npm") and len(toks) >= 3 and toks[1] == "run":
        script = toks[2]
        rest = toks[3:]
        if script in NON_RTK_SCRIPTS:
            return toks, shlex.join(toks)
        if script in ("lint", "typecheck"):
            return [rtk, "tsc", "--noEmit", *rest], shlex.join(toks)
        if script == "build":
            return [rtk, "npm", "run", "build", *rest], shlex.join(toks)
        if script == "test":
            return [rtk, "test", *rest], shlex.join(toks)
        return [rtk, "npm", "run", script, *rest], shlex.join(toks)
    if toks[0] == "npx" and len(toks) >= 2 and toks[1] == "tsc":
        return [rtk, "tsc", *toks[2:]], shlex.join(toks)
    if toks[0] in RTK_COMMANDS:
        return [rtk, *toks], shlex.join(toks)
    return toks, shlex.join(toks)


def _rewrite_for_rtk(args: list[str]) -> tuple[list[str], str]:
    if len(args) == 1 and any(tok in args[0] for tok in SHELL_META_TOKENS):
        raw_cmd = args[0]
        if all(tok not in raw_cmd for tok in ("|", ";", ">", "<", "$(", "`", "\n", "||")):
            parts = [p.strip() for p in raw_cmd.split("&&") if p.strip()]
            rewritten: list[str] = []
            logical_parts: list[str] = []
            for part in parts:
                try:
                    toks = shlex.split(part)
                except ValueError:
                    rewritten.append(part)
                    logical_parts.append(part)
                    continue
                resolved, logical = _resolve_single_command(toks)
                rewritten.append(shlex.join(resolved))
                logical_parts.append(logical or part)
            return ["bash", "-lc", " && ".join(rewritten)], " && ".join(logical_parts)
        return ["bash", "-lc", raw_cmd], raw_cmd

    if args and args[0] == "--raw":
        inner = args[1:]
        return inner, shlex.join(inner)

    if len(args) == 1 and " " in args[0]:
        try:
            toks = shlex.split(args[0])
            return _resolve_single_command(toks)
        except ValueError:
            pass

    return _resolve_single_command(args)


def run_command(args: list[str]) -> int:
    if not args:
        print("Usage: ./tools/r [--raw] <command...>", file=sys.stderr)
        return 2
    ensure_ready()
    session = _read_active_session() or start_session("Shell session")
    sid = session["session_id"]
    transcript = Path(session["transcript_path"])

    argv, logical_cmd = _rewrite_for_rtk(args)
    env = _tool_env()
    env["TE_SESSION_ID"] = sid

    proc = subprocess.run(argv, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
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
    _checkpoint_all_sqlite()
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
    _checkpoint_all_sqlite()
    if not quiet:
        folded = fold_proc.stdout.strip()
        print(f"[TokenEconomizer] Folded session {sid}" + (f": {folded}" if folded else ""))


def check_tools() -> int:
    ensure_ready()
    _checkpoint_all_sqlite()
    env = _tool_env()
    rtk = _rtk_bin()
    checks = [
        ("rtk:version", [rtk, "--version"]),
        ("rtk:pipeline", [rtk, "pipeline", "show"]),
        ("rtk:gain", [rtk, "gain"]),
        ("cbm:version", [str(CBM_CACHE_BIN), "--version"]),
        ("cbm:projects", ["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "cli", "list_projects"]),
        ("pio:version", [str(PIO_BIN), "--version"]),
        ("te:doctor", [str(TE_BIN), "--cwd", str(ROOT_DIR), "doctor"]),
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

    rtk_persist_ok = (
        (Path.home() / ".config" / "rtk").is_symlink()
        and (Path.home() / ".local" / "share" / "rtk").is_symlink()
        and Path("/usr/local/bin/rtk").exists()
        and (RTK_CFG_DIR / "config.toml").is_file()
    )
    print(f"[rtk:persistence] {'ok' if rtk_persist_ok else 'fail'}")
    cbm_persist_ok = (
        Path("/usr/local/bin/codebase-memory-mcp").exists()
        and (Path.home() / ".cache" / "codebase-memory-mcp" / "app-applet.db").is_file()
        and (ROOT_DIR / ".codebase-memory" / "graph.db.zst").is_file()
    )
    print(f"[cbm:persistence] {'ok' if cbm_persist_ok else 'fail'}")
    pio_persist_ok = (
        Path("/usr/local/bin/pio").exists()
        and (Path.home() / ".platformio").is_symlink()
        and (PIO_STATE_ROOT / "platforms").is_dir()
    )
    print(f"[pio:persistence] {'ok' if pio_persist_ok else 'fail'}")
    te_persist_ok = (
        Path("/usr/local/bin/te").exists()
        and Path("/usr/local/bin/te-hook").exists()
        and (Path.home() / ".tokeneconomizer").is_symlink()
        and (TE_HOME / "plugin" / "lib" / "tokeneconomizer" / "plugin" / "hook.py").is_file()
    )
    print(f"[te:persistence] {'ok' if te_persist_ok else 'fail'}")
    perms_ok = all(p.is_file() and os.access(p, os.X_OK) for p in EXECUTABLE_TOOLS)
    print(f"[tools:+x] {'ok' if perms_ok else 'fail'}")
    return 1 if (failed or not rtk_persist_ok or not cbm_persist_ok or not pio_persist_ok or not te_persist_ok or not perms_ok) else 0


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
