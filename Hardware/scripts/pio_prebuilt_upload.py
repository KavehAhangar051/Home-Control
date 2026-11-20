Import("env")

import os
import shutil

from SCons.Script import COMMAND_LINE_TARGETS

# Pre-build hook for zero-compile prebuilt flash environments.
# Appending "nobuild" BEFORE espressif32/builder/main.py runs skips BuildProgram()
# completely (zero C++ compilation, zero linking, zero LDF scanning).
if "nobuild" not in COMMAND_LINE_TARGETS:
    COMMAND_LINE_TARGETS.append("nobuild")

project_dir = env.subst("$PROJECT_DIR")
rel_dir = env.GetProjectOption("custom_prebuilt_dir", "firmware/prebuilt/esp32dev")
prebuilt_dir = os.path.normpath(os.path.join(project_dir, rel_dir))
prebuilt_bin = os.path.join(prebuilt_dir, "firmware.bin")

build_dir = env.subst("$BUILD_DIR")
os.makedirs(build_dir, exist_ok=True)

# Stage prebuilt firmware.bin into $BUILD_DIR so PlatformIO's upload target dependency exists
staged_bin = os.path.join(build_dir, "firmware.bin")
if os.path.isfile(prebuilt_bin):
    if not os.path.isfile(staged_bin) or os.path.getmtime(prebuilt_bin) > os.path.getmtime(staged_bin):
        shutil.copy2(prebuilt_bin, staged_bin)

# Ensure placeholder firmware.elf exists so clicking Build (check icon) cleanly invokes
# our custom SIZEPRINTCMD prebuilt status report instead of failing on missing .elf.
staged_elf = os.path.join(build_dir, "firmware.elf")
if not os.path.isfile(staged_elf):
    with open(staged_elf, "wb"):
        pass
