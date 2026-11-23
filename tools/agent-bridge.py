#!/usr/bin/env python3
"""Unified AI Studio runtime bridge for `rtk` (Lite Mode).

Why this exists:
Container resets wipe `/root` and `/usr/local/bin`, while `/app/applet` persists.
`rtk` binary, config, and `history.db` are stored inside `<repo>/.agent-state/rtk`
and restored offline in milliseconds. This bridge provides `ensure`, `check`, and
`run` (`./tools/r <cmd>`) so shell commands automatically map through native `rtk`
filters when applicable.
"""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
STATE_ROOT = ROOT_DIR / ".agent-state"
RTK_CACHE_BIN = STATE_ROOT / "rtk" / "bin" / "rtk"

EXECUTABLE_TOOLS = (
    ROOT_DIR / "tools" / "r",
    ROOT_DIR / "tools" / "rtk.sh",
    ROOT_DIR / "tools" / "agent-bridge.py",
)

NON_RTK_SCRIPTS = frozenset(
    {
        "rtk",
        "rtk:gain",
        "rtk:setup",
        "r",
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
    return env


def ensure_ready() -> None:
    """Restore persistent symlinks, executable bits, and rtk binary if container reset."""
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
    if not rtk_ok:
        subprocess.run(["bash", str(ROOT_DIR / "tools" / "rtk.sh"), "ensure"], check=True)


def _rtk_bin() -> str:
    return str(RTK_CACHE_BIN) if RTK_CACHE_BIN.is_file() else "rtk"


def _test_files() -> list[str]:
    files = sorted(str(p.relative_to(ROOT_DIR)) for p in (ROOT_DIR / "tests").glob("*.test.mjs"))
    return files or ["tests/*.test.mjs"]


def _resolve_single_command(toks: list[str]) -> tuple[list[str], dict[str, str]]:
    """Map package scripts & biome/oxlint/tsc/test/next commands to native RTK filters."""
    if not toks:
        return toks, {}

    if toks[0] == "rtk" and len(toks) > 1:
        toks = toks[1:]

    rtk = _rtk_bin()

    # Unwrap `bun run <script> [extra...]` / `npm run <script> [extra...]`
    if len(toks) >= 3 and toks[0] in ("bun", "npm") and toks[1] == "run":
        script = toks[2]
        rest = toks[3:]
        if script == "typecheck":
            return [rtk, "tsc", "--noEmit", *rest], {}
        if script == "lint":
            return [rtk, "err", "bunx", "biome", "lint", "--max-diagnostics=1000", "app", "components", "features", "lib", *rest], {}
        if script == "format":
            return [rtk, "err", "bunx", "biome", "format", "--write", "app", "components", "features", "lib", *rest], {}
        if script == "lint:ox":
            return [rtk, "err", "bunx", "oxlint", "app", "components", "features", "lib", *rest], {}
        if script == "test":
            tfiles = rest if rest else _test_files()
            return [rtk, "test", "node", "--import", "./tests/ts-loader.mjs", "--test", *tfiles], {}
        if script == "build":
            return [rtk, "next", "build", "--turbopack", *rest], {"NODE_ENV": "production"}
        if script == "check":
            lint_cmd = " ".join(
                shlex.quote(t)
                for t in [rtk, "err", "bunx", "biome", "lint", "--max-diagnostics=1000", "app", "components", "features", "lib"]
            )
            tsc_cmd = f"{shlex.quote(rtk)} tsc --noEmit"
            test_cmd = " ".join(
                shlex.quote(t) for t in [rtk, "test", "node", "--import", "./tests/ts-loader.mjs", "--test", *_test_files()]
            )
            return ["bash", "-lc", f"{lint_cmd} && {tsc_cmd} && {test_cmd}"], {}
        if script in NON_RTK_SCRIPTS:
            return toks, {}

    # Direct biome / oxlint invocations compress best via `rtk err`
    if (
        toks[:2] in (["bunx", "biome"], ["npx", "biome"], ["bunx", "oxlint"], ["npx", "oxlint"])
        or toks[0] in ("biome", "oxlint")
    ):
        return [rtk, "err", *toks], {}

    if toks[0] in RTK_COMMANDS:
        return [rtk, *toks], {}

    return toks, {}


def _rewrite_for_rtk(args: list[str]) -> tuple[list[str], dict[str, str]]:
    """Return (exec_argv, extra_env)."""
    if len(args) == 1 and any(tok in args[0] for tok in SHELL_META_TOKENS):
        raw_cmd = args[0]
        # Rewrite simple `&&`-separated commands safely without touching pipes/subshells
        if all(tok not in raw_cmd for tok in ("|", ";", ">", "<", "$(", "`", "\n", "||")):
            parts = [p.strip() for p in raw_cmd.split("&&") if p.strip()]
            rewritten: list[str] = []
            merged_env: dict[str, str] = {}
            for part in parts:
                try:
                    toks = shlex.split(part)
                except ValueError:
                    rewritten.append(part)
                    continue
                resolved, extra_env = _resolve_single_command(toks)
                merged_env.update(extra_env)
                if resolved[:2] == ["bash", "-lc"] and len(resolved) == 3:
                    rewritten.append(resolved[2])
                else:
                    rewritten.append(shlex.join(resolved))
            return ["bash", "-lc", " && ".join(rewritten)], merged_env
        return ["bash", "-lc", raw_cmd], {}

    if args and args[0] == "--raw":
        return args[1:], {}

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
    argv, extra_env = _rewrite_for_rtk(args)
    env = _tool_env()
    env.update(extra_env)

    proc = subprocess.run(argv, env=env, cwd=str(ROOT_DIR))
    return proc.returncode


def check_tools() -> int:
    ensure_ready()
    env = _tool_env()
    proc = subprocess.run([_rtk_bin(), "--version"], env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
    status = "ok" if proc.returncode == 0 else f"fail({proc.returncode})"
    first_line = (proc.stdout or proc.stderr or "").strip().splitlines()[:1]
    detail = first_line[0] if first_line else ""
    print(f"[rtk] {status}" + (f" — {detail}" if detail else ""))
    perms_ok = all(p.is_file() and os.access(p, os.X_OK) for p in EXECUTABLE_TOOLS)
    print(f"[tools:+x] {'ok' if perms_ok else 'fail'}")
    return 1 if (proc.returncode != 0 or not perms_ok) else 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: agent-bridge.py <ensure|check|run> [...]", file=sys.stderr)
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
