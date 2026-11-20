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
        "bun",
        "bunx",
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
    """Restore persistent symlinks and binaries in milliseconds if container reset."""
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
    if not rtk_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "rtk.sh"), "ensure"], check=True)
    if not te_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "te.sh"), "ensure"], check=True)
    if not cbm_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "ensure"], check=True)


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


def start_session(prompt: str = "AI Studio task") -> dict:
    ensure_ready()
    existing = _read_active_session()
    if existing:
        age = time.time() - float(existing.get("updated_at", existing.get("started_at", 0)))
        if age < 1800:
            return existing
        end_session(quiet=True)

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


def _rewrite_for_rtk(args: list[str]) -> tuple[list[str], bool, str]:
    """Return (exec_argv, use_shell, logical_command_str)."""
    if len(args) == 1 and any(tok in args[0] for tok in SHELL_META_TOKENS):
        raw_cmd = args[0]
        # Rewrite simple `&&`-separated commands safely without touching pipes/subshells
        if all(tok not in raw_cmd for tok in ("|", ";", ">", "<", "$(", "`", "\n", "||")):
            parts = [p.strip() for p in raw_cmd.split("&&") if p.strip()]
            rewritten: list[str] = []
            for part in parts:
                try:
                    toks = shlex.split(part)
                except ValueError:
                    rewritten.append(part)
                    continue
                if toks and toks[0] in RTK_COMMANDS:
                    rewritten.append(shlex.join(["rtk", *toks]))
                else:
                    rewritten.append(part)
            return ["bash", "-lc", " && ".join(rewritten)], False, raw_cmd
        return ["bash", "-lc", raw_cmd], False, raw_cmd

    if args and args[0] == "--raw":
        inner = args[1:]
        return inner, False, shlex.join(inner)

    if args and args[0] in RTK_COMMANDS:
        rtk_bin = str(RTK_CACHE_BIN) if RTK_CACHE_BIN.is_file() else "rtk"
        return [rtk_bin, *args], False, shlex.join(args)

    return args, False, shlex.join(args)


def run_command(args: list[str]) -> int:
    if not args:
        print("Usage: ./tools/r [--raw] <command...>", file=sys.stderr)
        return 2

    ensure_ready()
    session = _read_active_session() or start_session("Shell session")
    sid = session["session_id"]
    transcript = Path(session["transcript_path"])

    argv, use_shell, logical_cmd = _rewrite_for_rtk(args)
    env = _tool_env()
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


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: agent-bridge.py <ensure|start|run|end> [...]", file=sys.stderr)
        return 2
    action = sys.argv[1]
    if action == "ensure":
        ensure_ready()
        return 0
    if action == "start":
        prompt = " ".join(sys.argv[2:]).strip() or "AI Studio task"
        sess = start_session(prompt)
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
