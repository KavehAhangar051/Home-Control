Import("env")

import json
import os


def _resolve_prebuilt_dir(env):
    project_dir = env.subst("$PROJECT_DIR")
    rel_dir = env.GetProjectOption("custom_prebuilt_dir", "firmware/prebuilt/esp32dev")
    return os.path.normpath(os.path.join(project_dir, rel_dir))


def _find_esptool_path(env):
    platform = env.PioPlatform()
    packages = getattr(platform, "packages", {}) or {}

    # Core v2: tool-esptoolpy/esptool.py
    if "tool-esptoolpy" in packages:
        pkg_py = platform.get_package_dir("tool-esptoolpy")
        if pkg_py:
            esptool_py = os.path.join(pkg_py, "esptool.py")
            if os.path.isfile(esptool_py):
                return esptool_py

    # Core v3: tool-esptool (native executable or esptool.py)
    if "tool-esptool" in packages:
        pkg_bin = platform.get_package_dir("tool-esptool")
        if pkg_bin:
            for candidate in ("esptool.exe", "esptool", "esptool.py"):
                full = os.path.join(pkg_bin, candidate)
                if os.path.isfile(full):
                    return full

    return ""


def _autodetect_port(source, target, env):
    env.AutodetectUploadPort()


def _print_prebuilt_status(source, target, env):
    prebuilt_dir = _resolve_prebuilt_dir(env)
    manifest_path = os.path.join(prebuilt_dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        print("[Prebuilt] Missing manifest at %s - run `pio run -e esp32dev` to build." % manifest_path)
        return
    with open(manifest_path, "r", encoding="utf-8") as mf:
        m = json.load(mf)
    app = next((i for i in m.get("images", []) if i.get("file") == "firmware.bin"), None)
    app_info = ("%d B, sha256:%s" % (app["size"], app["sha256"][:12])) if app else "n/a"
    print(
        "[Prebuilt Ready] Env: %s | Built: %s | firmware.bin: %s"
        % (m.get("env", "esp32dev"), m.get("built_at_utc", "unknown"), app_info)
    )
    print("[Prebuilt Ready] Zero-compile mode active. Click Upload (->) to flash directly to ESP32 (NVS preserved).")


prebuilt_dir = _resolve_prebuilt_dir(env)
esptool_path = _find_esptool_path(env)
flasher_script = os.path.normpath(os.path.join(env.subst("$PROJECT_DIR"), "scripts", "flash_prebuilt.py"))

env.Replace(
    PREBUILT_DIR=prebuilt_dir,
    PREBUILT_FLASHER=flasher_script,
    PREBUILT_ESPTOOL=esptool_path,
    UPLOADCMD=(
        '"$PYTHONEXE" "$PREBUILT_FLASHER" '
        '--dir "$PREBUILT_DIR" '
        '--port "$UPLOAD_PORT" '
        '--baud "$UPLOAD_SPEED" '
        '--esptool "$PREBUILT_ESPTOOL"'
    ),
    SIZEPRINTCMD=env.VerboseAction(_print_prebuilt_status, "Checking prebuilt firmware status"),
)

# Run serial port auto-detection immediately before UPLOADCMD (custom protocol skips BeforeUpload)
env.AddPreAction("upload", env.VerboseAction(_autodetect_port, "Looking for ESP32 upload port..."))

# Extra PlatformIO Project Task for ultra-fast app-only flashing (0x10000 only)
env.AddCustomTarget(
    name="upload_app_only",
    dependencies=None,
    actions=[
        env.VerboseAction(_autodetect_port, "Looking for ESP32 upload port..."),
        env.VerboseAction(
            '"$PYTHONEXE" "$PREBUILT_FLASHER" '
            '--dir "$PREBUILT_DIR" '
            '--port "$UPLOAD_PORT" '
            '--baud "$UPLOAD_SPEED" '
            '--esptool "$PREBUILT_ESPTOOL" '
            '--app-only',
            "Fast flashing prebuilt firmware.bin @ 0x10000",
        ),
    ],
    title="Upload App Only (Prebuilt Fast)",
    description="Flash only firmware.bin @ 0x10000 without re-flashing bootloader/partitions (zero compile)",
)
