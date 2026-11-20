Import("env")

import datetime
import hashlib
import json
import os
import shutil


def _sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _export_prebuilt_firmware(source, target, env):
    pio_env = env.subst("$PIOENV")
    project_dir = env.subst("$PROJECT_DIR")
    out_dir = os.path.join(project_dir, "firmware", "prebuilt", pio_env)
    os.makedirs(out_dir, exist_ok=True)

    board = env.BoardConfig()
    mcu = board.get("build.mcu", "esp32")
    flash_mode = env.subst("${__get_board_flash_mode(__env__)}") or board.get("build.flash_mode", "dio")
    flash_freq = env.subst("${__get_board_f_image(__env__)}") or "40m"
    flash_size = board.get("upload.flash_size", "4MB")
    app_offset = env.subst("$ESP32_APP_OFFSET") or board.get("upload.offset_address", "0x10000")

    images = []

    # 1. Copy all extra flash images (bootloader.bin @ 0x1000, partitions.bin @ 0x8000, boot_app0.bin @ 0xe000)
    for offset, raw_src in env.get("FLASH_EXTRA_IMAGES", []):
        src_path = env.subst(raw_src)
        if not os.path.isfile(src_path):
            print("[Prebuilt] Warning: missing extra image %s (%s)" % (offset, src_path))
            continue
        filename = os.path.basename(src_path)
        dst_path = os.path.join(out_dir, filename)
        shutil.copy2(src_path, dst_path)
        images.append({
            "offset": str(offset),
            "file": filename,
            "size": os.path.getsize(dst_path),
            "sha256": _sha256_file(dst_path),
        })

    # 2. Copy main compiled application binary (firmware.bin @ 0x10000)
    app_src = str(target[0]) if target else env.subst("$BUILD_DIR/${PROGNAME}.bin")
    app_filename = "firmware.bin"
    app_dst = os.path.join(out_dir, app_filename)
    shutil.copy2(app_src, app_dst)
    app_sha = _sha256_file(app_dst)
    app_size = os.path.getsize(app_dst)
    images.append({
        "offset": str(app_offset),
        "file": app_filename,
        "size": app_size,
        "sha256": app_sha,
    })

    # 3. Write flash manifest for zero-compile verified flashing
    manifest = {
        "schema_version": 1,
        "env": pio_env,
        "mcu": mcu,
        "flash_mode": flash_mode,
        "flash_freq": flash_freq,
        "flash_size": flash_size,
        "built_at_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "images": images,
    }
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2)
        mf.write("\n")

    print(
        "[Prebuilt] Exported %d images to firmware/prebuilt/%s (firmware.bin: %d B, sha256:%s)"
        % (len(images), pio_env, app_size, app_sha[:12])
    )


env.AddPostAction("$BUILD_DIR/${PROGNAME}.bin", _export_prebuilt_firmware)
