Import("env")
import os

project_dir = env.subst("$PROJECT_DIR")
include_dir = os.path.join(project_dir, "include")
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
    os.path.join(include_dir, "WiFi"),
    os.path.join(include_dir, "NetworkCore"),
    os.path.join(include_dir, "NetworkClientSecure"),
    os.path.join(include_dir, "ESP_NOW"),
]
env.AppendUnique(CPPPATH=[p for p in local_includes if os.path.isdir(p)])

framework_dir = env.PioPlatform().get_package_dir("framework-arduinoespressif32")
if framework_dir:
    libs_dir = os.path.join(framework_dir, "libraries")
    for lib_name in ("Network", "WiFi", "WiFiClientSecure", "NetworkClientSecure", "HTTPClient", "WebServer", "DNSServer", "ESPmDNS"):
        src_dir = os.path.join(libs_dir, lib_name, "src")
        if os.path.isdir(src_dir):
            env.Append(CPPPATH=[src_dir])
