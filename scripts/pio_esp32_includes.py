Import("env")
import os

framework_dir = env.PioPlatform().get_package_dir("framework-arduinoespressif32")
if framework_dir:
    libs_dir = os.path.join(framework_dir, "libraries")
    for lib_name in ("Network", "WiFi", "WiFiClientSecure", "NetworkClientSecure", "HTTPClient", "WebServer", "DNSServer", "ESPmDNS"):
        src_dir = os.path.join(libs_dir, lib_name, "src")
        if os.path.isdir(src_dir):
            env.Append(CPPPATH=[src_dir])
