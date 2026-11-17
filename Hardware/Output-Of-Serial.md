==========================================
  Achaemenid IoT Node - Modular Async
==========================================
[INFO]::[Hardware/src/main.cpp:33]:[System] Hardware timer started at 1ms resolution.     
[INFO]::[Hardware/src/setup/NetworkStorage.cpp:116]:[NetworkStorage] Stored WiFi network 1 - SSID: '-'
[INFO]::[Hardware/src/setup/NetworkStorage.cpp:132]:[NetworkStorage] [DEBUG] Stored MQTT Config - Host: 'broker.emqx.io', Port: 1883, Topic: 'KamyarIoT/Achaemenid', QOS: 0
[INFO]::[Hardware/src/setup/NetworkStorage.cpp:139]:[NetworkStorage] Loaded 1 WiFi networks and MQTT config from NVS
[INFO]::[Hardware/src/main.cpp:48]:[System] Found 1 saved WiFi networks in NVS
[INFO]::[Hardware/src/main.cpp:59]:[System] Restored MQTT settings from NVS (Host: broker.emqx.io)
[INFO]::[Hardware/src/main.cpp:66]:[System] Setup completed. Starting Async Boot Sequence...
[INFO]::[Hardware/lib/AchaemenidBootManager/src/BootManager.cpp:221]:[Boot] Booting up... 
Loading config from NVS immediately.
[SegStorage] Loaded 5 segments from NVS (offline fallback)
[INFO]::[Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:52]:[PinManager] Added segment 'iszmn6e' on pin 2 (Type: output)
[INFO]::[Hardware/lib/PinManager/src/state/PinStateManager.cpp:31]:[PinManager] 'iszmn6e' 
(pin 2) -> OFF
[INFO]::[Hardware/lib/ConfigApplier/ConfigApplier.cpp:30]:[ConfigApplier] Pin 2 registered (id=iszmn6e, value=0)
[INFO]::[Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:52]:[PinManager] Added segment 'ocpa1hl' on pin 14 (Type: output)
[INFO]::[Hardware/lib/PinManager/src/state/PinStateManager.cpp:31]:[PinManager] 'ocpa1hl' 
(pin 14) -> OFF
[INFO]::[Hardware/lib/ConfigApplier/ConfigApplier.cpp:30]:[ConfigApplier] Pin 14 registered (id=ocpa1hl, value=0)
[INFO]::[Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:52]:[PinManager] Added segment '7xhkvz2' on pin 4 (Type: output)
[INFO]::[Hardware/lib/PinManager/src/state/PinStateManager.cpp:31]:[PinManager] '7xhkvz2' 
(pin 4) -> OFF
[INFO]::[Hardware/lib/ConfigApplier/ConfigApplier.cpp:30]:[ConfigApplier] Pin 4 registered (id=7xhkvz2, value=0)
[INFO]::[Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:52]:[PinManager] Added segment '48ef3dw' on pin 5 (Type: input)
[INFO]::[Hardware/lib/ConfigApplier/ConfigApplier.cpp:30]:[ConfigApplier] Pin 5 registered (id=48ef3dw, value=0)
[INFO]::[Hardware/lib/PinManager/src/core/PinManager_Setup.cpp:52]:[PinManager] Added segment 'y0stih7' on pin 19 (Type: input)
[INFO]::[Hardware/lib/ConfigApplier/ConfigApplier.cpp:30]:[ConfigApplier] Pin 19 registered (id=y0stih7, value=0)
[INFO]::[Hardware/lib/ConfigApplier/ConfigApplier.cpp:36]:[ConfigApplier] Applied 5 GPIO segments.
========= Pin Manager Status =========
  Active pins: 5 / 16
  [0] id=iszmn6e  type=output pin=2  state=OFF  autoOff=0s
  [1] id=ocpa1hl  type=output pin=14  state=OFF  autoOff=0s
  [2] id=7xhkvz2  type=output pin=4  state=OFF  autoOff=0s
  [3] id=48ef3dw  type=input pin=5  state=ON  autoOff=0s
  [4] id=y0stih7  type=input pin=19  state=ON  autoOff=0s
======================================
==========================================
  Instant Boot — Config loaded from NVS
==========================================
[INFO]::[Hardware/src/Events/EventHandlers.cpp:148]:[Event] Config loaded with 5 pins.
[INFO]::[Hardware/src/setup/NetworkStorage.cpp:92]:Network configuration saved to NVS (Preferences)
[INFO]::[Hardware/lib/AchaemenidBootManager/src/BootManager.cpp:240]:[BootManager] Starting WiFi connection (using configured APs)...
[INFO]::[Hardware/lib/AchaemenidNetwork/AchaemenidNetwork.cpp:23]:[AchaemenidNetwork] Async connection to added SSIDs...
Guru Meditation Error: Core  1 panic'ed (Unhandled debug exception). 
Debug exception reason: Stack canary watchpoint triggered (loopTask)
Core  1 register dump:
PC      : 0x40091faa  PS      : 0x00060036  A0      : 0x80091f1c  A1      : 0x3ffb0330  
A2      : 0x3ffb4a14  A3      : 0x00000000  A4      : 0x3ffb49f8  A5      : 0x00000000    
A6      : 0x00060a20  A7      : 0x00000001  A8      : 0x3ffb4ad4  A9      : 0xbaad5678    
A10     : 0x3ffb0000  A11     : 0x3ffb4a0c  A12     : 0xfffffffe  A13     : 0xfffffffd    
A14     : 0x00060020  A15     : 0x00000001  SAR     : 0x00000019  EXCCAUSE: 0x00000001
EXCVADDR: 0x00000000  LBEG    : 0x4008a8b0  LEND    : 0x4008a8bb  LCOUNT  : 0x00000000


Backtrace: 0x40091fa7:0x3ffb0330 0x40091f19:0x3ffb0360 0x40084970:0x3ffb0380 0x40084985:0x3ffb03b0 0x400849ae:0x3ffb03d0 0x400922c5:0x3ffb03f0 0x400eec81:0x3ffb0410 0x400eed90:0x3ffb0440 0x401069b5:0x3ffb0470 0x4010669d:0x3ffb0540 0x400f7f43:0x3ffb0560 0x400f6ec7:0x3ffb0580 0x400f11fa:0x3ffb05a0 0x40166a5f:0x3ffb05e0 0x400d7ea8:0x3ffb0620 0x400d8106:0x3ffb07d0 0x400d69da:0x3ffb08b0 0x4008152d:0x3ffb08d0 0x400df75d:0x3ffb0c40 0x400d5d7e:0x3ffb20b0 0x400e4f32:0x3ffb2290




ELF file SHA256: dab4514bb274d93a

Rebooting...
ets Jul 29 2019 12:21:46

rst:0xc (SW_CPU_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
configsip: 0, SPIWP:0xee
clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00
mode:DIO, clock div:2
load:0x3fff0030,len:1184
load:0x40078000,len:13232
load:0x40080400,len:3028
entry 0x400805e4