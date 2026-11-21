#!/usr/bin/env python3
"""Persistent AI Studio runtime bridge for `rtk` (Lite Mode).

1. Container resets wipe `/root` and `/usr/local/bin`, while `/app/applet` persists.
   RTK's binary, Lite Mode config, and `history.db` live in `<repo>/.agent-state/rtk`
   and are restored via symlinks in milliseconds before every command.
2. Fresh GitHub imports automatically re-download the pinned `rtk` binary and
   reuse the committed Lite Mode config, pipeline, and history database.
"""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
STATE_ROOT = ROOT_DIR / ".agent-state" / "rtk"
RTK_CACHE_BIN = STATE_ROOT / "bin" / "rtk"
RTK_CFG_DIR = STATE_ROOT / "config"
RTK_DATA_DIR = STATE_ROOT / "data"

EXECUTABLE_TOOLS = (
    ROOT_DIR / "tools" / "r",
    ROOT_DIR / "tools" / "rtk.sh",
    ROOT_DIR / "tools" / "cbm.sh",
    ROOT_DIR / "tools" / "rtk-bridge.py",
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


CONTAINER_MARKER = Path("/tmp/.rtk_container_initialized")
CBM_CACHE_BIN = ROOT_DIR / ".agent-state" / "cbm" / "bin" / "codebase-memory-mcp"
CBM_CONTAINER_MARKER = Path("/tmp/.cbm_container_initialized")


def _tool_env() -> dict[str, str]:
    env = os.environ.copy()
    env["RTK_TELEMETRY_DISABLED"] = "1"
    return env


def _checkpoint_sqlite() -> None:
    for db_name in ("history.db", "recall.db"):
        db_path = RTK_DATA_DIR / db_name
        wal_path = RTK_DATA_DIR / f"{db_name}-wal"
        if db_path.is_file() and wal_path.is_file() and wal_path.stat().st_size > 0:
            try:
                import sqlite3

                with sqlite3.connect(str(db_path), timeout=1.0) as conn:
                    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            except Exception:
                pass


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
        and CONTAINER_MARKER.is_file()
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
    argv, _ = _rewrite_for_rtk(args)
    proc = subprocess.run(argv, env=_tool_env(), cwd=str(ROOT_DIR))
    _checkpoint_sqlite()
    return proc.returncode


def check_tools() -> int:
    ensure_ready()
    _checkpoint_sqlite()
    env = _tool_env()
    rtk = _rtk_bin()
    checks = [
        ("rtk:version", [rtk, "--version"]),
        ("rtk:pipeline", [rtk, "pipeline", "show"]),
        ("rtk:gain", [rtk, "gain"]),
        ("cbm:version", [str(CBM_CACHE_BIN), "--version"]),
        ("cbm:projects", ["bash", str(ROOT_DIR / "tools" / "cbm.sh"), "cli", "list_projects"]),
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

    links_ok = (
        (Path.home() / ".config" / "rtk").is_symlink()
        and (Path.home() / ".local" / "share" / "rtk").is_symlink()
        and Path("/usr/local/bin/rtk").exists()
        and (RTK_CFG_DIR / "config.toml").is_file()
    )
    print(f"[rtk:persistence] {'ok' if links_ok else 'fail'}")
    cbm_persist_ok = (
        Path("/usr/local/bin/codebase-memory-mcp").exists()
        and (Path.home() / ".cache" / "codebase-memory-mcp" / "app-applet.db").is_file()
        and (ROOT_DIR / ".codebase-memory" / "graph.db.zst").is_file()
    )
    print(f"[cbm:persistence] {'ok' if cbm_persist_ok else 'fail'}")
    perms_ok = all(p.is_file() and os.access(p, os.X_OK) for p in EXECUTABLE_TOOLS)
    print(f"[tools:+x] {'ok' if perms_ok else 'fail'}")
    return 1 if (failed or not links_ok or not cbm_persist_ok or not perms_ok) else 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: rtk-bridge.py <ensure|check|run> [...]", file=sys.stderr)
        return 2
    action = sys.argv[1]
    if action == "ensure":
        ensure_ready()
        return 0
    if action == "check":
        return check_tools()
    if action == "run":
        return run_command(sys.argv[2:])
    print(f"Unknown action: {action}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
