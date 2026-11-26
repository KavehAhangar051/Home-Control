Import("env")
import os

project_dir = env.subst("$PROJECT_DIR")
include_dir = os.path.join(project_dir, "include")
framework_dir = env.PioPlatform().get_package_dir("framework-arduinoespressif32")
is_core3 = ("core3" in env.get("PIOENV", "")) or (
    bool(framework_dir) and os.path.isdir(os.path.join(framework_dir, "libraries", "Network"))
)

local_includes = [
    include_dir,
    os.path.join(include_dir, "Core"),
    os.path.join(include_dir, "Core", "Async"),
    os.path.join(include_dir, "Core", "Error"),
    os.path.join(include_dir, "Network"),
    os.path.join(include_dir, "Network", "WiFi"),
    os.path.join(include_dir, "Network", "HTTP"),
    os.path.join(include_dir, "Timer"),
    os.path.join(include_dir, "Utilities"),
    os.path.join(include_dir, "Events"),
    os.path.join(include_dir, "Optimization"),
    os.path.join(include_dir, "AsyncTCP"),
    os.path.join(include_dir, "AsyncMqttClient"),
    os.path.join(include_dir, "ArduinoWebsockets"),
    os.path.join(include_dir, "ESP_NOW"),
]
if is_core3:
    local_includes.extend([
        os.path.join(include_dir, "WiFi"),
        os.path.join(include_dir, "NetworkCore"),
        os.path.join(include_dir, "NetworkClientSecure"),
    ])

env.AppendUnique(CPPPATH=[p for p in local_includes if os.path.isdir(p)])

if framework_dir:
    libs_dir = os.path.join(framework_dir, "libraries")
    for lib_name in ("Network", "WiFi", "WiFiClientSecure", "NetworkClientSecure", "HTTPClient", "WebServer", "DNSServer", "ESPmDNS"):
        src_dir = os.path.join(libs_dir, lib_name, "src")
        if os.path.isdir(src_dir):
            env.Append(CPPPATH=[src_dir])
