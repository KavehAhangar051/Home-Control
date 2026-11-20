#!/usr/bin/env python3
"""
Verified zero-compile ESP32 prebuilt firmware flasher.
Reads firmware/prebuilt/<env>/manifest.json, validates SHA256 checksums,
and invokes esptool to flash only bootloader, partition table, boot_app0,
and application binary (preserving the NVS partition 0x9000..0xdfff untouched).
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def build_esptool_prefix(esptool_path):
    if esptool_path and os.path.isfile(esptool_path):
        if esptool_path.lower().endswith(".py"):
            return [sys.executable, esptool_path]
        return [esptool_path]
    return [sys.executable, "-m", "esptool"]


def main():
    parser = argparse.ArgumentParser(description="Flash prebuilt ESP32 firmware without compiling.")
    parser.add_argument("--dir", required=True, help="Directory containing manifest.json and .bin files")
    parser.add_argument("--port", default="", help="Serial upload port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", default="460800", help="Serial flash baud rate")
    parser.add_argument("--esptool", default="", help="Path to esptool.py or esptool executable")
    parser.add_argument("--app-only", action="store_true", help="Flash only firmware.bin @ app offset")
    parser.add_argument("--dry-run", action="store_true", help="Verify checksums and print esptool command without flashing")
    args = parser.parse_args()

    manifest_path = os.path.join(args.dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        sys.stderr.write(
            "[Prebuilt Flash] ERROR: manifest.json not found at %s\n"
            "Run `pio run -e esp32dev` first to build and export prebuilt binaries.\n"
            % manifest_path
        )
        return 1

    with open(manifest_path, "r", encoding="utf-8") as mf:
        manifest = json.load(mf)

    images = manifest.get("images", [])
    if args.app_only:
        images = [img for img in images if img.get("file") == "firmware.bin"]

    if not images:
        sys.stderr.write("[Prebuilt Flash] ERROR: No flashable images in %s\n" % manifest_path)
        return 1

    verified = []
    for img in images:
        img_path = os.path.join(args.dir, img["file"])
        if not os.path.isfile(img_path):
            sys.stderr.write("[Prebuilt Flash] ERROR: Missing binary %s\n" % img_path)
            return 1
        actual_sha = sha256_file(img_path)
        expected_sha = img.get("sha256", "")
        if expected_sha and actual_sha != expected_sha:
            sys.stderr.write(
                "[Prebuilt Flash] ERROR: SHA256 mismatch for %s (expected %s, got %s)\n"
                % (img["file"], expected_sha[:12], actual_sha[:12])
            )
            return 1
        verified.append((str(img["offset"]), img_path, img["file"], actual_sha[:12]))

    if not args.port and not args.dry_run:
        sys.stderr.write(
            "[Prebuilt Flash] ERROR: No ESP32 serial port detected.\n"
            "Connect your ESP32 board via USB (or set `upload_port` in platformio.ini) and click Upload again.\n"
        )
        return 2

    port_arg = args.port or "<AUTO_PORT>"
    prefix = build_esptool_prefix(args.esptool)
    is_v5_native = bool(args.esptool) and not args.esptool.lower().endswith(".py")
    cmd = prefix + [
        "--chip", str(manifest.get("mcu", "esp32")),
        "--port", port_arg,
        "--baud", str(args.baud or "460800"),
        "--before", "default-reset" if is_v5_native else "default_reset",
        "--after", "hard-reset" if is_v5_native else "hard_reset",
        "write-flash" if is_v5_native else "write_flash",
        "-z",
        "--flash-mode" if is_v5_native else "--flash_mode", str(manifest.get("flash_mode", "dio")),
        "--flash-freq" if is_v5_native else "--flash_freq", str(manifest.get("flash_freq", "40m")),
        "--flash-size" if is_v5_native else "--flash_size", str(manifest.get("flash_size", "4MB")),
    ]

    mode_label = "APP-ONLY (0x10000)" if args.app_only else "FULL (NVS preserved)"
    print(
        "[Prebuilt Flash] Mode: %s | Env: %s | Built: %s | Port: %s @ %s baud"
        % (mode_label, manifest.get("env", "esp32dev"), manifest.get("built_at_utc", "unknown"), port_arg, args.baud)
    )
    for offset, img_path, filename, short_sha in verified:
        print("  -> %-8s %s (sha256:%s)" % (offset, filename, short_sha))
        cmd.extend([offset, img_path])

    if args.dry_run:
        print("[Prebuilt Flash] DRY-RUN CMD: " + " ".join(cmd))
        return 0

    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
