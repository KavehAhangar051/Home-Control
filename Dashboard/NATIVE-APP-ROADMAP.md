# نقشه راه و دفتر ثبت توسعه اپلیکیشن Native Home-Control

> مرجع پایدار توسعه اپلیکیشن موبایل مبتنی بر داشبورد فعلی. در هر جلسه، ابتدا این سند و سورس جاری مخزن بررسی شود و کار از آخرین وضعیت ثبت‌شده ادامه یابد.

- آخرین بازبینی: ۲۰ نوامبر ۲۰۲۶
- مخزن: https://github.com/KavehAhangar051/Home-Control
- محدوده: اپلیکیشن موبایل مبتنی بر Dashboard/
- وضعیت: ممیزی و برنامه‌ریزی؛ Capacitor هنوز نصب نشده است.

---

## ۱. تصمیم‌های قطعی مالک پروژه

| موضوع | تصمیم |
|---|---|
| پلتفرم | ابتدا Android، سپس iOS |
| تجربه کاربری | ظاهر فعلی داشبورد با بهینه‌سازی موبایل |
| فناوری Native | Capacitor |
| کد UI و منطق | کد فعلی Next.js / React |
| State | Zustand فعلی |
| ارتباط IoT | حفظ MQTT و WebSocket فعلی مگر ضرورت فنی اثبات شود |
| Package manager | حفظ Bun و lockfile فعلی |
| دستگاه تست | مالک پروژه گوشی Android واقعی دارد |
| تغییر فایل | پیش از هر تغییر در فایل‌های موجود، مسیر، شرح تغییر و دلیل فنی اعلام و تأیید صریح گرفته شود |
| Git | پس از تأیید و اعمال تغییرات، Commit و Push؛ از Pull استفاده نشود |

### اصل معماری

یک کدبیس مشترک برای Web و Mobile؛ بدون بازنویسی داشبورد در React Native یا Flutter. Ionic UI نیز فعلاً جزو برنامه نیست.

~~~text
Dashboard (Next.js + React + TypeScript)
  ├── UI / Components / Features
  ├── Zustand stores
  ├── MQTT.js
  ├── Local ESP32 WebSocket
  └── Browser-compatible services
             |
             v
       Static Web Build
             |
             v
       Capacitor Runtime
          /       \
      Android     iOS
~~~

---

## ۲. وضعیت واقعی داشبورد در زمان ممیزی

اطلاعات این بخش از سورس مخزن خوانده شده‌اند. در صورت تغییر سورس باید دوباره بررسی شوند.

### ۲.۱ فناوری‌ها

منبع: [Dashboard/package.json](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/package.json)

| فناوری | مقدار ثبت‌شده در package.json |
|---|---|
| Next.js | `^16.4.6` |
| React / React DOM | `^19.2.1` |
| TypeScript | `^7.0.2` |
| Tailwind CSS | `4.3.5` |
| Zustand | `^5.0.13` |
| MQTT.js | `^5.15.1` |
| Motion | `^14.0.0` |
| Bun | `1.4.4` در packageManager |

این‌ها مقادیر manifest هستند، نه الزاماً نسخه دقیق resolve شده در lockfile. برای نسخه دقیق نصب‌شده باید bun.lock بررسی شود. در manifest بررسی‌شده، پکیج‌های Capacitor وجود نداشتند.

### ۲.۲ اسکریپت‌های موجود

- `bun run build`: Next.js production build با Turbopack
- `bun run typecheck`: TypeScript بدون emit
- `bun run lint`: Biome lint
- `bun run test`: تست‌های Node در tests/*.test.mjs
- `bun run check`: lint، typecheck و test
- `bun run clean`: پاک کردن .next، out و tsconfig.tsbuildinfo

هیچ‌یک از این فرمان‌ها هنگام ممیزی این سند اجرا نشده‌اند.

### ۲.۳ Next.js و Static Export

منابع:
- [next.config.ts](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/next.config.ts)
- [app/page.tsx](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/app/page.tsx)
- [app/layout.tsx](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/app/layout.tsx)

یافته‌های تأییدشده:

1. پروژه از Next.js App Router استفاده می‌کند.
2. app/page.tsx ورودی داشبورد را از DashboardClientEntry بارگذاری می‌کند.
3. در حالت عادی production، مقدار output برابر `export` است.
4. اگر `DISABLE_HMR === "true"` باشد، output برابر undefined می‌شود؛ بنابراین این متغیر نباید در Build موبایل فعال باشد.
5. اگر `GITHUB_PAGES === "true"` باشد، basePath و assetPrefix مخصوص GitHub Pages فعال می‌شوند. Build موبایل باید بدون این حالت تولید شود.
6. images.unoptimized فعال است.
7. app/layout.tsx از چند فونت next/font/google و یک فونت محلی next/font/local استفاده می‌کند. Build واقعی باید از نظر دسترسی شبکه هنگام دریافت فونت‌ها و بسته‌بندی assetها بررسی شود.
8. Root layout زبان فارسی، جهت RTL و viewportFit: cover را تنظیم می‌کند.

**وضعیت:** ساختار برای Static Export امیدوارکننده است؛ سازگاری کامل تا اجرای Build و اجرای خروجی در Capacitor تأیید نشده است.

### ۲.۴ فایل‌های کلیدی

| فایل | نقش |
|---|---|
| Dashboard/next.config.ts | تنظیمات Next.js و Static Export |
| Dashboard/app/page.tsx | ورودی صفحه اصلی |
| Dashboard/app/layout.tsx | Root layout، فونت‌ها، RTL و metadata |
| Dashboard/features/dashboard/components/layout/DashboardClientEntry.tsx | ورودی Client داشبورد |
| Dashboard/features/iot/hooks/useIoTStore.ts | Zustand IoT store |
| Dashboard/features/iot/hooks/usePreferencesStore.ts | تنظیمات محلی و Persist |
| Dashboard/features/iot/services/mqtt/client.ts | تنظیمات و client MQTT |
| Dashboard/features/iot/services/mqtt/init.ts | راه‌اندازی و مدیریت پیام‌های MQTT |
| Dashboard/features/iot/services/mqttService.ts | Exportهای سرویس MQTT |
| Dashboard/features/iot/hooks/usePageVisibility.ts | مدیریت visibility و resume مرورگر |
| Dashboard/features/iot/hooks/achaemenidState/useConnectionStrategy.ts | استراتژی Local WebSocket در Native |
| Dashboard/features/iot/services/localWs/client.ts | نگهداری و dispatch اتصال Local WebSocket |
| Dashboard/features/iot/hooks/useVoiceCommand.ts | Hook فرمان صوتی |
| Dashboard/features/iot/hooks/voiceRecognitionHelpers.ts | منطق session تشخیص گفتار |
| Dashboard/lib/haptics.ts | بازخورد لرزشی مبتنی بر Web Vibration API |
| Dashboard/features/iot/services/configBackupService.ts | Export/Import پشتیبان تنظیمات |
| Dashboard/features/iot/components/workflows/workflowStorage.ts | ذخیره‌سازی Workflowها |
| Dashboard/ARCHITECTURE.md | راهنمای معماری و قواعد مهندسی |
| Dashboard/docs/TECHNOLOGY-ROADMAP.md | جهت‌گیری فنی و درس‌های مهندسی |

---

## ۳. ارتباط با ESP32 و وضعیت IoT

مهاجرت نباید باعث تغییر بی‌دلیل پروتکل ESP32 شود.

### ۳.۱ MQTT

فایل‌ها:
- [mqtt/client.ts](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/features/iot/services/mqtt/client.ts)
- [mqtt/init.ts](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/features/iot/services/mqtt/init.ts)

یافته‌های سورس:
- MQTT.js استفاده می‌شود.
- تنظیمات Broker از IoT store و در صورت نیاز Local Storage خوانده می‌شود.
- Broker پیش‌فرض: `wss://broker.emqx.io:8084/mqtt`
- base topic پیش‌فرض: `KamyarIoT/Achaemenid`
- QoSهای 0، 1 و 2 پشتیبانی می‌شوند؛ پیش‌فرض 1 است.
- پیام فرمان می‌تواند payload باینری داشته باشد.
- در init.ts صف محدود و batch برای State و Telemetry وجود دارد؛ سقف پیش‌فرض صف 256 است.

**تصمیم:** MQTT.js حفظ شود و اتصال، reconnect، دریافت پیام و انتشار فرمان روی گوشی واقعی تست شود.

### ۳.۲ Local WebSocket مستقیم ESP32

فایل‌ها:
- [useConnectionStrategy.ts](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/features/iot/hooks/achaemenidState/useConnectionStrategy.ts)
- [localWs/client.ts](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/features/iot/services/localWs/client.ts)

یافته‌های تأییدشده:
- createLocalWebSocketController به‌صورت dependency-injected پیاده‌سازی شده است.
- توضیح کد آن را برای Capacitor Native builds معرفی می‌کند.
- تشخیص Native به‌صورت پیش‌فرض با window.Capacitor?.isNative انجام می‌شود.
- در محیط غیر Native اتصال Local WebSocket اجرا نمی‌شود.
- URL اتصال: `ws://<localIp>:81`
- پس از اتصال، فرمان get_state ارسال می‌شود.
- پیام‌های state_sync، وضعیت پین‌ها، تایمرها، مقادیر آنالوگ و رزولوشن PWM را همگام می‌کنند.
- در زمان قطع اتصال، وضعیت Local خاموش می‌شود و مسیر MQTT fallback می‌شود.
- reconnect با exponential backoff محدود و full jitter انجام می‌شود.
- هنگام cleanup، handlerها حذف و WebSocket بسته می‌شود.

وجود Controller به معنی اثبات کارکرد آن در Android WebView نیست؛ تست گوشی واقعی الزامی است.

### ۳.۳ ریسک شبکه و امنیت

اتصال Local فعلی از ws:// استفاده می‌کند و رمزنگاری نشده است.

موارد مستقل برای آزمایش:
1. Mixed Content در WebView با توجه به Origin محلی Capacitor.
2. سیاست Cleartext و Network Security Configuration اندروید.
3. دسترسی اپ به شبکه Wi-Fi محلی.
4. رفتار WebSocket در نسخه Android و WebView گوشی.
5. تغییر IP یا Wi-Fi و reconnect.
6. timeout و خطا در صورت خاموش بودن ESP32.

از فعال کردن Cleartext سراسری یا Mixed Content برای نسخه انتشار، بدون بررسی امنیتی و تست محدود، خودداری شود.

برای Target SDK 37 / Android 17 به بالا، دسترسی شبکه محلی به مجوز runtime جدید ACCESS_LOCAL_NETWORK وابسته می‌شود. طبق مستند Android این الزام برای target SDK 36 یا پایین‌تر اعمال نمی‌شود. هنگام افزایش Target SDK باید مجوز و UX درخواست آن طراحی شود.

منابع رسمی:
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Android Cleartext Communication Risks](https://developer.android.com/privacy-and-security/risks/cleartext-communications)
- [Android Local Network Permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Capacitor Configuration](https://capacitorjs.com/docs/config)

**هیچ راه‌حل امنیتی برای WebSocket انتخاب یا پیاده‌سازی نشده است.** تصمیم نهایی پس از تست عملی و ارزیابی WSS، تنظیمات محدود Network Security و در صورت لزوم Native transport گرفته شود.

---

## ۴. قابلیت‌های نیازمند Native Adapter یا تست

### ۴.۱ Lifecycle

فایل: features/iot/hooks/usePageVisibility.ts

در حال حاضر visibilitychange و online مدیریت می‌شوند و هنگام بازگشت صفحه notifyMqttResume() اجرا می‌شود.

پیشنهاد:
- از پلاگین رسمی @capacitor/app برای App State و lifecycle واقعی Native استفاده شود.
- یک Lifecycle Adapter کوچک ساخته شود.
- منطق موجود MQTT resume دوباره‌نویسی نشود؛ رویداد Native به مسیر موجود متصل شود.
- فرض نشود WebSocket یا MQTT در Background حتماً زنده می‌ماند.
- پس از بازگشت، اتصال و State دستگاه با ESP32 همگام شود.

### ۴.۲ Haptics

فایل: Dashboard/lib/haptics.ts

کد فعلی navigator.vibrate را استفاده می‌کند و در دستگاه فاقد API بدون خطا کنار می‌رود.

پیشنهاد:
- در Native از @capacitor/haptics استفاده شود.
- API فعلی triggerHaptic حفظ و پیاده‌سازی پشت آن Adapter شود.
- تنظیم کاربر، الگوهای فعلی و Reduced Motion رعایت شوند.
- رفتار Web تغییر نکند.

### ۴.۳ Voice Recognition

فایل‌ها:
- features/iot/hooks/useVoiceCommand.ts
- features/iot/hooks/voiceRecognitionHelpers.ts

یافته‌ها:
- کد از SpeechRecognition یا webkitSpeechRecognition استفاده می‌کند.
- زبان fa-IR است.
- continuous و interimResults فعال هستند.
- session controller مستقل و generation-based stale callback guard وجود دارد.
- اگر API در مرورگر نباشد، قابلیت با پیام عدم پشتیبانی متوقف می‌شود.

پیشنهاد:
- API فعلی پشت Voice Adapter قرار گیرد.
- پلاگین Native پس از مقایسه API، مجوزها، پشتیبانی فارسی و رفتار offline/online انتخاب شود.
- توقف، نتیجه نهایی، خطا و callbackهای session حفظ شوند.
- تشخیص فارسی روی گوشی واقعی آزمایش شود.

هیچ پلاگین Voice در این مرحله انتخاب قطعی نشده است.

### ۴.۴ Storage و انتقال تنظیمات

یافته‌ها:
- Preferences store از Zustand persist و Local Storage استفاده می‌کند.
- کلید Preferences: home-control-preferences-v1
- Workflow storage key: iot_workflows_studio_v1
- تنظیمات MQTT می‌توانند با کلیدهای mqtt_broker_url، mqtt_base_topic و mqtt_qos ذخیره شوند.
- URL مربوط به Cloudflare Worker با cloudflare_worker_url ذخیره می‌شود.
- configBackupService.ts از schema برابر home-control-backup-v1 استفاده می‌کند و قابلیت Restore دارد.

تصمیم:
- در فاز اول Storage فعلی بی‌دلیل تعویض نشود.
- نصب نسخه جدید Native نباید داده‌ها را پاک کند.
- تغییر Capacitor app origin یا مسیر ذخیره‌سازی فقط با برنامه مهاجرت داده انجام شود.
- برای داده حساس، Secure Storage بررسی شود؛ Local Storage محل مناسبی برای secret حساس نیست.
- انتقال اطلاعات Chrome به اپ Native خودکار فرض نشود؛ Backup/Restore موجود بررسی شود.

### ۴.۵ UI موبایل

داشبورد Mobile Navigation از جمله MobileDockNav دارد. موارد تست:
- Safe Area بالا و پایین
- Status Bar و Navigation Bar
- کیبورد مجازی و viewport
- Android Back Button
- لمس و drag/drop
- اسکرول و ارتفاع صفحه
- چرخش صفحه
- فونت فارسی و RTL
- Motion و Reduced Motion
- Splash Screen و بازگشت از Background

---

## ۵. Capacitor و ابزارهای توسعه

### ۵.۱ نسخه هدف

نسخه مبنا: Capacitor 8 پایدار.

در زمان ثبت سند، GitHub Releases نسخه 8.6.2 را آخرین نسخه شاخه 8 نشان می‌دهد. نسخه 9 در وضعیت Release Candidate بوده و برای اولین پیاده‌سازی انتخاب نمی‌شود.

قبل از نصب واقعی، آخرین نسخه پایدار و هماهنگی نسخه تمام پکیج‌های @capacitor/* دوباره بررسی شود. Core، CLI، Android و پلاگین‌ها باید Major سازگار داشته باشند.

منابع:
- [Capacitor v8 Documentation](https://capacitorjs.com/docs)
- [Capacitor Releases](https://github.com/ionic-team/capacitor/releases)

### ۵.۲ محیط پیشنهادی

| ابزار | مقدار/نیاز |
|---|---|
| Node.js | حداقل رسمی Capacitor 8: نسخه 22 یا بالاتر؛ نسخه 24 LTS به‌عنوان محیط استاندارد پیشنهادی پروژه |
| Package manager | Bun موجود پروژه |
| Android Studio | حداقل 2025.2.1 برای Capacitor 8 |
| Android SDK | API 24+ برای پشتیبانی دستگاه؛ SDK پایدار API 36 در مستندات فعلی |
| گوشی واقعی | موجود؛ برای تست Native و شبکه محلی |
| Xcode | حداقل 26 برای فاز iOS |
| macOS | برای Build محلی iOS ضروری |

منابع:
- [Capacitor Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Capacitor iOS](https://capacitorjs.com/docs/ios)

### ۵.۳ ساختار پوشه پیشنهادی

این ساختار هنوز ایجاد نشده و صرفاً پیشنهاد معماری است:

~~~text
Home-Control/
├── Hardware/
├── Database/
└── Dashboard/
    ├── app/
    ├── components/
    ├── features/
    ├── lib/
    ├── android/                 # پس از افزودن Android platform
    ├── ios/                     # فاز دوم
    ├── capacitor.config.ts
    ├── package.json
    ├── bun.lock
    └── out/                     # Static Build؛ نباید در Git commit شود
~~~

پروژه Native درون Dashboard نگه داشته می‌شود تا یک کدبیس و یک مخزن حفظ شود. قبل از ایجاد پوشه‌ها، .gitignore بررسی شود.

### ۵.۴ تنظیم Build

Build موبایل باید:
- در Production اجرا شود.
- Static Export را فعال نگه دارد.
- GITHUB_PAGES فعال نباشد.
- DISABLE_HMR=true تنظیم نشده باشد.
- خروجی out/ تولید کند.
- در Capacitor، webDir به out اشاره کند.

فرمان فعلی وب در package.json برابر bun run build است. اسکریپت جداگانه Native هنوز اضافه نشده است.

Build واقعی باید ثابت کند:
1. out/index.html تولید می‌شود.
2. فایل‌های _next و assetها درست resolve می‌شوند.
3. فونت‌ها و CSS در حالت محلی قابل بارگذاری‌اند.
4. مسیرهای صفحه در WebView درست کار می‌کنند.
5. importها در SSR یا زمان اجرای Web API خطا ایجاد نمی‌کنند.

---

## ۶. استراتژی Update اپلیکیشن

دو نوع Update مستقل‌اند:

### ۶.۱ Native/Binary Update

تغییرات زیر معمولاً Build و انتشار نسخه جدید Native می‌خواهند:
- افزودن یا حذف پلاگین Native
- تغییر Kotlin/Java یا Swift
- تغییر Permissionها و Manifest
- تغییر تنظیمات Native
- تغییر نسخه یا ساختار Native runtime

برای توزیع از Google Play، مسیر استاندارد به‌روزرسانی Binary از طریق Google Play است.

### ۶.۲ Web Asset Update / OTA

از نظر فنی راهکارهایی برای دریافت Bundleهای HTML/CSS/JavaScript وجود دارند:
- [Capawesome Live Update](https://capawesome.io/docs/plugins/live-update/)
- [Ionic Appflow Live Updates](https://ionic.io/docs/appflow/deploy/deploy-live-update)

اما امکان فنی به معنی مجاز بودن هر نوع تغییر از راه دور نیست.

سیاست فروشگاه‌ها باید پیش از انتخاب OTA بررسی شود:
- Google Play درباره self-update و دانلود کد اجرایی محدودیت دارد. JavaScript در WebView از منظر interpreter استثناهای مشخصی دارد، اما کد بارگذاری‌شده نباید موجب نقض سیاست‌ها شود.
- Apple App Review Guideline 2.5.2 دانلود/اجرای کدی را که قابلیت‌ها یا عملکرد اپ را تغییر می‌دهد محدود می‌کند.

سیاست محافظه‌کارانه:
1. در نسخه اول OTA نصب نشود.
2. ابتدا انتشار Native و نسخه‌بندی تثبیت شود.
3. پس از بررسی سیاست توزیع واقعی، OTA برای تغییرات سازگار و مجاز Web assets ارزیابی شود.
4. Bundle نسخه‌بندی، اعتبارسنجی و Rollback داشته باشد.
5. تغییر Native با OTA جایگزین نشود.
6. Update در میانه کنترل دستگاه یا ارتباط حساس باعث Reload ناخواسته WebView نشود.

منابع رسمی:
- [Google Play Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/16559646)
- [Google Play App Updates](https://developer.android.com/google/play/app-updates)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Capawesome Live Update README](https://github.com/capawesome-team/capacitor-plugins/blob/main/packages/live-update/README.md)

---

## ۷. نقشه راه مرحله‌به‌مرحله

### فاز ۰ — ممیزی و آماده‌سازی (مرحله فعلی)

- [x] تصمیم پلتفرم: Android سپس iOS
- [x] تصمیم UI: ظاهر مشترک با بهینه‌سازی موبایل
- [x] بررسی اولیه Next.js، React و Static Export
- [x] بررسی اولیه MQTT و Local WebSocket
- [x] شناسایی نیاز Lifecycle، Voice و Haptics
- [x] شناسایی Storageهای مهم
- [x] تأیید موجود بودن گوشی Android واقعی
- [x] ایجاد این سند به‌عنوان دفتر ثبت پروژه
- [ ] تکمیل ممیزی وابستگی‌های Browser API و مسیرهای صفحه
- [ ] بررسی .gitignore برای Native folders و خروجی Build
- [ ] اجرای Baseline دست‌نخورده Build، typecheck، lint و test
- [ ] بررسی فونت‌های Google در Build واقعی
- [ ] بررسی پوشش تست Local WebSocket controller

### فاز ۱ — تعیین تکلیف ریسک‌های فنی

- [ ] طراحی تست ws://<ESP32-IP>:81 در WebView
- [ ] آزمایش Cleartext و Mixed Content روی گوشی
- [ ] ثبت نسخه Android و System WebView گوشی
- [ ] آزمایش MQTT روی Wi-Fi محلی و اینترنت موبایل
- [ ] بررسی reconnect و state synchronization پس از Background/Foreground
- [ ] انتخاب Native Voice با پشتیبانی فارسی
- [ ] تعیین نیاز Storage و انتقال Backup
- [ ] تصمیم درباره مجوز شبکه محلی بر اساس Target SDK

### فاز ۲ — آماده‌سازی تغییرات و تأیید مالک

قبل از تغییر هر فایل موجود، فهرست دقیق فایل‌ها، تغییرات و دلیل فنی به مالک اعلام شود و تأیید صریح گرفته شود.

- [ ] ارائه فهرست فایل‌های نیازمند تغییر
- [ ] ارائه فهرست پکیج‌های موردنیاز با نسخه‌های سازگار
- [ ] ارائه طرح capacitor.config.ts
- [ ] ارائه طرح اسکریپت Build موبایل
- [ ] دریافت تأیید مالک

### فاز ۳ — افزودن Capacitor و Android

پس از تأیید:
- [ ] نصب پکیج‌های Capacitor 8 با Bun
- [ ] ایجاد capacitor.config.ts
- [ ] تنظیم App ID و App Name نهایی
- [ ] تنظیم webDir: "out"
- [ ] اضافه کردن Android platform
- [ ] بررسی فایل‌های Native تولیدشده
- [ ] Static Build و سپس cap sync
- [ ] باز کردن پروژه در Android Studio
- [ ] ساخت Debug APK و نصب روی گوشی

### فاز ۴ — تست گوشی واقعی

- [ ] نصب تازه و اولین اجرا
- [ ] باز شدن صفحات اصلی
- [ ] نمایش فارسی، RTL و فونت‌ها
- [ ] Safe Area و Status Bar
- [ ] Android Back Button
- [ ] کیبورد مجازی
- [ ] اتصال Wi-Fi محلی
- [ ] اتصال Local WebSocket به ESP32
- [ ] دریافت State Sync کامل
- [ ] ارسال فرمان و دریافت ACK/State
- [ ] قطع و وصل Wi-Fi
- [ ] خاموش و روشن کردن ESP32
- [ ] قطع اینترنت در حالی که LAN برقرار است
- [ ] قطع LAN و بررسی fallback به MQTT
- [ ] Background و بازگشت به اپ
- [ ] بستن اجباری و اجرای مجدد
- [ ] حفظ تنظیمات پس از بستن اپ
- [ ] تست فرمان صوتی فارسی
- [ ] تست Haptics
- [ ] بررسی مصرف باتری و پایداری طولانی‌مدت

### فاز ۵ — تثبیت Android و انتشار

- [ ] رفع خطاهای بحرانی
- [ ] اجرای تست‌های رگرسیون
- [ ] ثبت نسخه و Build number
- [ ] ساخت Signed APK برای توزیع مستقیم یا تست
- [ ] ساخت AAB برای Google Play در صورت انتخاب این کانال
- [ ] نگهداری امن کلید امضا و Backup
- [ ] مستندسازی Release و Rollback
- [ ] تصمیم درباره OTA پس از بررسی سیاست فروشگاه

### فاز ۶ — iOS

- [ ] بررسی Mac و Xcode 26+
- [ ] افزودن iOS platform
- [ ] بررسی ATS و Local Network در iOS
- [ ] بررسی مجوز Microphone و Speech Recognition
- [ ] بررسی Haptics و App Lifecycle
- [ ] تست روی iPhone واقعی
- [ ] آماده‌سازی App Store release

---

## ۸. تست‌ها و کیفیت فعلی پروژه

راهنما: [Dashboard/ARCHITECTURE.md](https://github.com/KavehAhangar051/Home-Control/blob/main/Dashboard/ARCHITECTURE.md)

در مستندات معماری، نتیجه ثبت‌شده قبلی تست‌ها 69 از 71 بوده و دو انتظار مرتبط با MQTT binary frame برای بررسی باقی مانده‌اند. این عدد نتیجه اجرای جدید در تاریخ این سند نیست و باید پیش از مهاجرت دوباره Baseline گرفته شود.

در ممیزی اولیه، تست‌های Controller شناسایی نشده بودند؛ بررسی کامل‌تر در بخش ۱۴.۵ نشان داد تست‌های Unit/Contract برای Controller وجود دارند. شکاف اصلی، تست Integration/Device در Android WebView است.

قواعد:
- تست‌های موجود حذف یا برای سبز شدن مصنوعی ضعیف نشوند.
- خطاهای قبلی MQTT از خطاهای جدید Native جدا ثبت شوند.
- تست‌های Node مکمل تست گوشی واقعی هستند.
- مالک پروژه تست دستی UI و دستگاه را انجام می‌دهد و نتیجه را گزارش می‌کند.

---

## ۹. قواعد کار با مخزن و تأیید تغییرات

1. پیش از هر تغییر در فایل‌های موجود، مسیر فایل و شرح دقیق تغییر اعلام شود.
2. تا زمان تأیید مالک، فایل‌های موجود تغییر نکنند.
3. نصب یا حذف پکیج نیز پیش از اجرا اعلام و تأیید شود.
4. تغییر Hardware، پروتکل ESP32 یا رفتار MQTT بدون ضرورت اثبات‌شده انجام نشود.
5. از Git Pull استفاده نشود.
6. پس از تأیید و انجام تغییرات، Commit و Push انجام شود.
7. پس از هر مرحله، نتیجه تست، Commit و فایل‌های تغییرکرده ثبت شوند.
8. خروجی Build مانند out/ نباید ناخواسته وارد Git شود.
9. این سند پس از هر تصمیم معماری، تغییر مهم، تست دستگاه یا Release به‌روزرسانی شود.
10. وضعیت‌ها صادقانه ثبت شوند: «بررسی سورس»، «Build شده»، «روی گوشی تست شده» و «منتشر شده» معانی متفاوت دارند.

---

## ۱۰. وضعیت فعلی در یک نگاه

| مورد | وضعیت در زمان ایجاد سند |
|---|---|
| تصمیم معماری | قطعی |
| انتخاب Capacitor 8 | پیشنهادی؛ نصب نشده |
| ممیزی اولیه سورس | انجام شده |
| Static Build واقعی | انجام نشده |
| نصب Capacitor | انجام نشده |
| Android project | ایجاد نشده |
| APK | ساخته نشده |
| تست گوشی واقعی | هنوز انجام نشده؛ گوشی موجود است |
| تست MQTT در WebView | انجام نشده |
| تست Local WebSocket در WebView | انجام نشده |
| انتخاب Native Voice plugin | انجام نشده |
| Native Haptics | انجام نشده |
| OTA | بررسی معماری؛ انتخاب نشده |
| iOS | فاز آینده |
| تغییر فایل‌های موجود | انجام نشده |

### نزدیک‌ترین کار بعدی

1. ممیزی نهایی وابستگی‌های Browser API و مسیرهای Build.
2. اجرای Baseline دست‌نخورده پروژه، در صورت فراهم بودن محیط اجرا.
3. طراحی تست Android برای Local WebSocket و MQTT.
4. ارائه فهرست فایل‌ها و پکیج‌های موردنیاز برای تأیید مالک.
5. فقط پس از تأیید، نصب Capacitor و ساخت اولین APK.

---

## ۱۱. منابع رسمی

### Capacitor
- [Capacitor Documentation v8](https://capacitorjs.com/docs)
- [Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Android](https://capacitorjs.com/docs/android)
- [iOS](https://capacitorjs.com/docs/ios)
- [App Plugin](https://capacitorjs.com/docs/apis/app)
- [Haptics Plugin](https://capacitorjs.com/docs/apis/haptics)
- [Capacitor Releases](https://github.com/ionic-team/capacitor/releases)

### Next.js
- [Static Exports](https://nextjs.org/docs/app/guides/static-exports)

### Android
- [Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Cleartext Communication Risks](https://developer.android.com/privacy-and-security/risks/cleartext-communications)
- [Local Network Permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Google Play App Updates](https://developer.android.com/google/play/app-updates)
- [Google Play Device and Network Abuse Policy](https://support.google.com/googleplay/android-developer/answer/16559646)

### Apple
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

---

## ۱۲. تاریخچه تغییرات این سند

| تاریخ | تغییر |
|---|---|
| ۲۰۲۶-۱۱-۲۰ | ایجاد سند اولیه؛ ثبت تصمیم‌های معماری، یافته‌های ممیزی، ریسک‌ها، منابع، نقشه راه و وضعیت شروع پروژه |


---

## ۱۳. اصلاحیه ممیزی وب و شبکه محلی — ۲۰۲۶-۱۱-۲۰

این بخش، جزئیات فنی نسخه‌های ابزار و ارتباط WebSocket محلی را بر اساس مستندات رسمی بررسی‌شده در ۲۰ نوامبر ۲۰۲۶ دقیق‌تر می‌کند.

### ۱۳.۱ نسخه واقعی Capacitor

- نسخه پایدار شاخه 8 در زمان این بررسی: **8.6.2**؛ تگ **latest** در npm نیز 8.6.2 است.
- نسخه 9.0.0-rc.0 در وضعیت Release Candidate قرار دارد و برای شروع پروژه انتخاب نمی‌شود.
- بنابراین تصمیم فعلی همچنان Capacitor 8.6.2 است؛ هنگام نصب باید نسخه‌های **@capacitor/core**، **@capacitor/cli**، **@capacitor/android** و پلاگین‌ها با هم تطبیق داده شوند.
- Node.js 22+ و Android Studio 2025.2.1+ حداقل‌های مستندشده Capacitor 8 هستند؛ Android SDK API 24+ لازم است و API 36 آخرین SDK پایدار معرفی‌شده در راهنمای محیط Capacitor است.

منابع:
- [npm: @capacitor/core versions](https://www.npmjs.com/package/@capacitor/core)
- [Capacitor GitHub Releases](https://github.com/ionic-team/capacitor/releases)
- [Capacitor Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)

### ۱۳.۲ اصلاح دقیق Mixed Content برای WebSocket محلی

راهنمای جدید Chrome درباره Local Network Access (LNA) یک نکته مهم دارد:

- **ws://** از یک صفحه **https://**، وقتی Host به‌صورت قابل تشخیص یک IP خصوصی literal مانند **192.168.1.100**، loopback، **localhost** یا hostname با پسوند **.local** باشد، از Mixed Content blocking مستثنا می‌شود.
- این استثنا به معنی دسترسی آزاد نیست؛ اتصال همچنان مشمول کنترل Local Network Access است.
- اگر مقصد با hostname سفارشی غیر **.local** معرفی شود، راهنمای Chrome استفاده از **wss://** را توصیه می‌کند.
- در WebSocket، آرگومان دوم سازنده فقط subprotocol است؛ نباید گزینه‌ای مانند **{ targetAddressSpace: 'local' }** به آن داده شود.
- راهنمای Chrome توصیه می‌کند اولین درخواست نیازمند مجوز در پاسخ به اقدام صریح کاربر انجام شود، نه به‌صورت خودکار هنگام بارگذاری صفحه؛ خطاهای اتصال نیز باید به پیام قابل‌فهم برای کاربر تبدیل شوند.

**نتیجه برای Home-Control:** آدرس Local WebSocket فعلی **ws://<localIp>:81** اگر **localIp** واقعاً IP خصوصی literal باشد، از نظر Mixed Content مسیر امیدوارکننده‌ای دارد؛ اما هنوز سازگاری آن در Android System WebView و Capacitor اثبات نشده است. اتصال باید روی گوشی واقعی تست شود. اگر نسخه WebView/سیاست Native رفتار متفاوتی داشته باشد، نتیجه تست ملاک خواهد بود.

منبع:
- [Chrome: Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)

### ۱۳.۳ Android 17 و دسترسی شبکه محلی

مستند رسمی Android اکنون صریحاً مشخص می‌کند:

- محدودیت Local Network Protections از Android 17 (API 37) برای برنامه‌هایی که Target SDK آن‌ها 37 یا بالاتر است، اعمال می‌شود.
- در این حالت، دسترسی به آدرس‌های شبکه محلی نیازمند مجوز runtime به نام **ACCESS_LOCAL_NETWORK** است.
- ارتباط‌های ایجادشده از Android WebView، وضعیت مجوز شبکه محلی اپ میزبان را به ارث می‌برند.
- برای Target SDK 36 یا پایین‌تر، دسترسی محلی با مجوز عادی **INTERNET** به‌طور ضمنی مجاز است؛ مستند Android می‌گوید در این سطح نباید **ACCESS_LOCAL_NETWORK** را به Manifest اضافه یا در runtime درخواست کرد.
- برای اپ IoT مانند Home-Control که مستقیماً به IP دستگاه ESP32 متصل می‌شود، در صورت ارتقای Target SDK به 37+ باید مسیر درخواست مجوز، توضیح دلیل نیاز، رد مجوز و لغو مجوز طراحی شود.

**تصمیم فعلی:** Target SDK اولیه 36 باقی می‌ماند. در فاز اول، مجوز **ACCESS_LOCAL_NETWORK** اضافه نمی‌شود. ارتقای آینده به 37+ یک کار مستقل و اجباری در نقشه راه خواهد بود؛ قبل از آن باید UX و کد Native مجوز پیاده‌سازی و آزمایش شود.

منبع:
- [Android Developers: Local network permission](https://developer.android.com/privacy-and-security/local-network-permission)

### ۱۳.۴ اصلاح برنامه تست Local WebSocket

موارد زیر به تست‌های الزامی اضافه می‌شوند:

1. اتصال از Origin پیش‌فرض Capacitor (**https://localhost**) به IP خصوصی واقعی ESP32 با **ws://**.
2. بررسی اینکه درخواست اتصال اولیه در صورت نیاز به مجوز، از مسیر اقدام کاربر انجام شود.
3. ثبت نسخه Android و نسخه Android System WebView دستگاه تست.
4. بررسی رفتار در Target SDK 36؛ بدون افزودن مجوز Android 17.
5. طراحی و تست جداگانه مجوز **ACCESS_LOCAL_NETWORK** برای Target SDK 37+؛ این مورد در فاز ارتقای Target SDK اجرا می‌شود.
6. تست خطای ESP32 خاموش، IP اشتباه، گوشی روی Wi-Fi دیگر، قطع و وصل شبکه و برگشت اپ از Background.
7. عدم فعال‌سازی عمومی Cleartext یا Mixed Content به‌عنوان راه‌حل پیش‌فرض.

### ۱۳.۵ وضعیت این اصلاحیه

| مورد | وضعیت |
|---|---|
| Capacitor 8.6.2 | نسخه پایدار تأییدشده در زمان بررسی |
| Capacitor 9 RC | برای شروع انتخاب نمی‌شود |
| WebSocket با IP خصوصی literal | از نظر Mixed Content در راهنمای Chrome مستثنا؛ نیازمند تست WebView و LNA |
| Android Target SDK 36 | مجوز **ACCESS_LOCAL_NETWORK** لازم نیست |
| Android Target SDK 37+ | مجوز runtime **ACCESS_LOCAL_NETWORK** لازم است |
| پیاده‌سازی مجوز Native | انجام نشده |
| تست گوشی واقعی | هنوز انجام نشده |


> این فایل منبع حقیقت پروژه Native است. هرگاه وضعیت واقعی سورس با این سند اختلاف داشت، سورس فعلی ملاک است و سند باید اصلاح شود.

---

## ۱۴. ممیزی عمیق Lifecycle، Voice، Storage و تست‌ها — ۲۰۲۶-۱۱-۲۰

این بخش بر اساس بررسی مستقیم فایل‌های جاری main و مستندات رسمی Capacitor، Chromium، Android و MDN اضافه شده است. هیچ فایل اجرایی پروژه در این مرحله تغییر نکرده است.

### ۱۴.۱ چرخه عمر MQTT و Local WebSocket

فایل‌های بررسی‌شده:
- features/iot/hooks/usePageVisibility.ts
- features/iot/hooks/achaemenidState/useConnectionStrategy.ts
- features/iot/services/mqtt/init.ts

یافته‌های قطعی:
- usePageVisibility رویدادهای visibilitychange و online را گوش می‌کند.
- هنگام بازگشت صفحه، notifyMqttResume() اجرا می‌شود.
- هنگام مخفی شدن صفحه، publishPresence(false) اجرا می‌شود.
- notifyMqttResume() در صورت قطع MQTT، reconnect را آغاز می‌کند؛ در صورت اتصال فعال، فریم‌های Presence و Sync Request را منتشر می‌کند. این عملیات با حداقل فاصله ۳ ثانیه throttle می‌شود.
- Local WebSocket در useConnectionStrategy ساخته می‌شود و فقط در صورت تشخیص window.Capacitor?.isNative اتصال می‌گیرد.
- Local WebSocket بعد از onopen فقط یک get_state می‌فرستد؛ heartbeat، ping/pong کاربردی یا بررسی سلامت دوره‌ای در Controller مشاهده نشد.
- هنگام onclose، وضعیت Local خاموش می‌شود و Reconnect با Full Jitter انجام می‌شود.
- در مسیر فعلی، رویداد Native Resume به‌صورت مستقیم به Controller مربوط به Local WebSocket متصل نیست.

**ریسک معماری:** اگر WebView هنگام Background اتصال را به‌طور تمیز نبندد اما مسیر TCP/WebSocket دیگر قابل استفاده نباشد، صرفاً تکیه بر onclose ممکن است تشخیص خرابی را به تأخیر بیندازد. همچنین Timerها در Background ممکن است محدود یا متوقف شوند. این مورد یک ریسک قابل‌آزمایش است، نه باگ اثبات‌شده.

**پیشنهاد:**
1. از @capacitor/app برای رویدادهای Native استفاده شود.
2. یک Lifecycle Adapter واحد، رویدادهای Native و Web visibilitychange را به یک مسیر Resume تبدیل کند تا MQTT دوبار Resume نشود.
3. در Resume، وضعیت اتصال Local بررسی شود؛ اگر socket باز نیست، اتصال مجدد انجام شود.
4. پس از اتصال مجدد، get_state ارسال شود و تا دریافت Snapshot معتبر، UI وضعیت محلی را قطعی فرض نکند.
5. در صورت نیاز، heartbeat سبک با پشتیبانی Firmware طراحی شود؛ heartbeat جدید بدون بررسی Firmware/پروتکل اضافه نشود.
6. تست Background طولانی، خاموش شدن ESP32، تغییر Wi-Fi، قطع شبکه و بازگشت اپ روی گوشی واقعی انجام شود.

منابع:
- [Capacitor App API](https://capacitorjs.com/docs/apis/app)
- [Android Activity Lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)

### ۱۴.۲ وضعیت Web Speech API در Android WebView

بررسی دقیق‌تر Chromium یک اصلاح مهم نسبت به فرض اولیه ایجاد می‌کند:

- سورس فعلی Chromium برای Android WebView تصریح می‌کند که Web Speech Recognition API پشتیبانی می‌شود.
- همان سورس تصریح می‌کند که Web Speech Synthesis API پشتیبانی نمی‌شود.
- قابلیت On-device Speech Recognition جدید، طبق داده سازگاری MDN، در Android و WebView پشتیبانی نمی‌شود.
- بنابراین نباید گفت SpeechRecognition در تمام Android WebViewها قطعاً وجود ندارد؛ در عین حال نباید وجود و عملکرد آن را روی تمام نسخه‌ها و سازندگان دستگاه تضمین کرد.
- کد فعلی Home-Control از SpeechRecognition یا webkitSpeechRecognition استفاده می‌کند و زبان را fa-IR قرار می‌دهد؛ قابلیت تشخیص محلی یا مدیریت Language Pack در کد فعلی وجود ندارد.
- در صورت استفاده از موتور تشخیص گفتار مبتنی بر سرویس، دسترسی شبکه و موجود بودن سرویس/زبان فارسی روی دستگاه می‌تواند مؤثر باشد.

**نتیجه:** در فاز اول، Native Speech Plugin به‌عنوان الزام قطعی انتخاب نمی‌شود. ابتدا API در WebView گوشی واقعی Feature Detect و زبان فارسی تست شود. اگر Recognition کار کرد، همان Adapter وب حفظ شود؛ اگر API غایب یا عملکرد فارسی نامطلوب بود، یک Native Speech Adapter مستقل بررسی شود.

### ۱۴.۳ مجوز Microphone در Capacitor Android

- WebView برای دسترسی به میکروفون، درخواست Permission را از طریق WebChromeClient.onPermissionRequest مطرح می‌کند.
- سورس جاری Capacitor Android در BridgeWebChromeClient درخواست AUDIO_CAPTURE را به مجوزهای MODIFY_AUDIO_SETTINGS و RECORD_AUDIO نگاشت می‌کند و نتیجه مجوز را به WebView برمی‌گرداند.
- بنابراین Capacitor مسیر پایه مدیریت Permission میکروفون را در Bridge خود دارد؛ با این حال باید Manifest نسخه ساخته‌شده، Prompt واقعی و رد/قبول مجوز روی دستگاه آزمایش شود.
- مجوز باید در لحظه‌ای درخواست شود که کاربر قابلیت Voice را فعال می‌کند؛ نباید هنگام اولین اجرای اپ بدون نیاز درخواست شود.
- سیاست حریم خصوصی باید روشن کند که موتور تشخیص ممکن است صدا را برای پردازش به سرویس شبکه‌ای ارسال کند.

منابع:
- [Capacitor BridgeWebChromeClient](https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java)
- [Android WebChromeClient Permission Request](https://developer.android.com/reference/android/webkit/WebChromeClient)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Chromium Android WebView implementation](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/lib/aw_main_delegate.cc)

### ۱۴.۴ Storage و مهاجرت داده

فایل‌های بررسی‌شده:
- features/iot/hooks/usePreferencesStore.ts
- features/iot/components/workflows/workflowStorage.ts
- features/iot/services/configBackupService.ts

یافته‌ها:
- Zustand Preferences با persist و createJSONStorage در window.localStorage ذخیره می‌شود.
- Workflowها کلید مستقل iot_workflows_studio_v1 دارند.
- Backup/Restore علاوه بر ESP config، تنظیمات ظاهری، Trellis layouts و Workflowها را بازیابی می‌کند.
- Backup از مسیرهای موجود می‌تواند بخشی از راهکار انتقال بین Web و Native باشد؛ اما نباید فرض شود تمام Local Storage به‌طور خودکار در اولین نصب اپ در دسترس است.
- Capacitor Preferences در Android از SharedPreferences و در iOS از UserDefaults استفاده می‌کند. مستندات رسمی، migrate() آن را برای مهاجرت از Capacitor 2 Storage معرفی می‌کنند؛ این API به معنی انتقال خودکار کلیدهای دلخواه window.localStorage پروژه Home-Control نیست.

**تصمیم پیشنهادی:**
1. برای اولین نسخه، Storage فعلی را حفظ کنیم تا داده‌های موجود و کد فعلی کمترین تغییر را داشته باشند.
2. در صورت انتخاب Preferences در نسخه بعد، مهاجرت دستی و idempotent برای کلیدهای مشخص طراحی شود.
3. ابتدا مقدار قدیمی خوانده و اعتبارسنجی شود؛ سپس مقدار جدید نوشته و دوباره خوانده/تأیید شود؛ فقط پس از موفقیت، حذف نسخه قدیمی در نظر گرفته شود.
4. Restore از Backup و Upgrade نسخه Native جداگانه تست شوند.
5. اطلاعات حساس یا Credentialها در Local Storage یا Preferences بدون ارزیابی امنیتی ذخیره نشوند؛ برای Secretها Secure Storage مناسب بررسی شود.

منابع:
- [Capacitor Preferences API](https://capacitorjs.com/docs/apis/preferences)

### ۱۴.۵ پوشش تست واقعی در Repository

بررسی کامل پوشه Dashboard/tests نشان داد که ادعای «نبود تست Controller اصلی Local WebSocket» در بخش ۸ این سند دقیق نبود و باید اصلاح شود.

تست‌های موجود:
- legacy-seams.test.mjs تست می‌کند که خارج از Native هیچ WebSocket ساخته نشود.
- همان فایل Handshake، ارسال get_state، دریافت state_sync، به‌روزرسانی Pin، fallback، Jitter reconnect و cleanup را تست می‌کند.
- همان فایل تست Session تشخیص گفتار، استخراج Transcript، خطای مجوز، restart و جلوگیری از stale callback را دارد.
- safety-net.test.mjs مسیر ارسال فرمان از Local WebSocket و fallback به MQTT و همچنین Listenerهای Local State را تست می‌کند.
- domain-contracts.test.mjs منطق معنایی اجرای فرمان‌های صوتی فارسی و Workflowها را تست می‌کند.

**اصلاح متن بخش ۸:** تست‌های Unit/Contract برای Local WebSocket و Voice وجود دارند؛ شکاف اصلی، تست Integration/Device در Android WebView است، نه فقدان کامل تست Controller.

مواردی که هنوز در تست‌های مشاهده‌شده پوشش صریح ندارند یا باید بررسی تکمیلی شوند:
- Native App pause/resume و هم‌زمانی رویدادهای App و document visibility.
- WebSocket نیمه‌باز/نیمه‌مرده پس از Background.
- عدم ایجاد دو اتصال هنگام Resume و تغییر localIp.
- بازیابی Storage واقعی پس از نصب/ارتقای APK.
- Voice Recognition واقعی fa-IR روی System WebView و مجوز میکروفون.
- رفتار واقعی MQTT و ESP32 روی شبکه Wi-Fi گوشی.

### ۱۴.۶ وضعیت به‌روزشده تصمیم‌ها

| موضوع | تصمیم فعلی |
|---|---|
| Lifecycle | افزودن Adapter مبتنی بر Capacitor App در فاز پیاده‌سازی؛ هنوز کدنویسی نشده |
| Local WebSocket | حفظ Controller؛ تکمیل Resume و تست Device |
| MQTT Resume | حفظ notifyMqttResume()؛ جلوگیری از اجرای تکراری |
| Web Speech Recognition | ابتدا Feature Detect و تست فارسی در WebView |
| Native Speech | فقط در صورت شکست تست Web Speech |
| Microphone permission | مسیر Bridge Capacitor وجود دارد؛ تست Manifest و Prompt لازم |
| Storage | حفظ Local Storage در نسخه اول |
| Preferences migration | مهاجرت دستی در صورت نیاز آتی |
| Unit tests | بخشی از تست‌های پایه موجودند |
| Device tests | هنوز اجرا نشده |


---

## ۱۵. ممیزی Build، Static Export و Package Manager — ۲۰۲۶-۱۱-۲۰

این بخش از روی فایل‌های واقعی package.json، bun.lock و next.config.ts در شاخه main و مستندات رسمی جاری Next.js، Capacitor و Bun تهیه شده است. هیچ فایل اجرایی یا تنظیمات پروژه تغییر نکرده است.

### ۱۵.۱ وضعیت واقعی ابزارها در Dashboard

مقادیر فعلی مخزن:
- Next.js: محدوده نسخه در package.json برابر ^16.4.6
- React و React DOM: محدوده ^19.2.1
- Bun: نسخه اعلام‌شده در packageManager برابر 1.4.4
- Lockfile: bun.lock با lockfileVersion 2
- Build: NODE_ENV=production next build --turbopack
- Typecheck: tsc --noEmit
- Tests: node --import ./tests/ts-loader.mjs --test tests/*.test.mjs
- Check: ترکیب lint، typecheck و test
- Next static export: در production به‌صورت پیش‌فرض فعال است؛ در dev server غیرفعال می‌شود.

### ۱۵.۲ نتیجه مهم: خروجی Capacitor باید از out تغذیه شود

در next.config.ts:
- در Build غیر Development، مقدار output برابر export است؛ مگر اینکه DISABLE_HMR=true باشد.
- خروجی استاندارد Next.js static export در پوشه out قرار می‌گیرد.
- images.unoptimized از قبل فعال است؛ بنابراین وابستگی به Next Image Optimization server در این تنظیمات دیده نمی‌شود.
- در حالت GITHUB_PAGES=true، basePath و assetPrefix به /Home-Control-Dashboard تغییر می‌کنند و trailingSlash فعال می‌شود.

**تصمیم پیشنهادی برای Capacitor:**
- webDir در capacitor.config.ts باید out باشد؛ Capacitor انتظار دارد webDir شامل index.html نهایی باشد.
- Build موبایل باید با DISABLE_HMR خاموش و بدون GITHUB_PAGES=true اجرا شود تا مسیر فایل‌ها از ریشه بسته Native بارگذاری شود، نه زیرمسیر GitHub Pages.
- قبل از اجرای cap sync باید وجود out/index.html و assetهای _next بررسی شود.
- خروجی native باید از همان Build ثابت و قابل تکرار ساخته شود؛ Build dev server یا HMR برای بسته نهایی استفاده نشود.
- appStartPath یا basePath سفارشی در فاز اول لازم نیست، مگر اینکه تست واقعی مسیرها خلاف آن را نشان دهد.

منابع:
- [Next.js App Router Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [Capacitor Configuration: webDir](https://capacitorjs.com/docs/config)
- [Capacitor: Add to an existing web app](https://capacitorjs.com/docs/getting-started)

### ۱۵.۳ محدودیت‌های Static Export که باید در ممیزی نهایی پوشش داده شوند

مستند رسمی Next.js تأیید می‌کند که Static Export برای قابلیت‌های متکی به سرور محدودیت دارد. مواردی مانند Server Actions، Route Handlers متکی به Request، Cookies، Headers، Proxy، Redirects، Rewrites، ISR و Dynamic Routes بدون پارامترهای قابل تولید در زمان Build پشتیبانی نمی‌شوند.

در سورس فعلی، App Router بررسی‌شده ساده است و next.config.ts هم output: export را فعال می‌کند؛ این نشانه مثبت است، اما جایگزین بررسی همه routeها و وابستگی‌های runtime نیست.

موارد لازم:
1. جست‌وجوی نهایی تمام Route Handlerها، Server Actions و dynamic APIs در کل Dashboard.
2. تأیید اینکه تمام مسیرهای موردنیاز اپ در زمان Build قابل تولید هستند.
3. بررسی اینکه هیچ قابلیت حیاتی به سرور Next.js یا API Route داخلی متکی نیست.
4. اجرای واقعی Build و بررسی محتویات out، نه اتکا به تنظیمات config به‌تنهایی.

منبع:
- [Next.js Static Export: Supported and Unsupported Features](https://nextjs.org/docs/app/guides/static-exports)

### ۱۵.۴ Bun و Lifecycle Scriptها: اصلاح برداشت قبلی

مستند رسمی Bun می‌گوید Bun برخلاف npm به‌طور پیش‌فرض lifecycle script دلخواه dependencyها را اجرا نمی‌کند؛ فقط بسته‌های مورد اعتماد در allowlist داخلی یا trustedDependencies اجرا می‌شوند. این رفتار مستقل از هشدار npm 12 است.

**نتیجه برای Home-Control:**
- صرف استفاده از Bun به معنی مشکل قطعی نصب Capacitor نیست.
- پس از افزودن Capacitor و پلاگین‌ها باید packageها و اسکریپت‌های نصب آن‌ها بررسی شوند.
- trustedDependencies نباید به‌صورت حدسی و گسترده تنظیم شود؛ فقط packageهایی که واقعاً به lifecycle script نیاز دارند، پس از بررسی مستندات و خروجی نصب مجاز شوند.
- بعد از نصب، bun install --frozen-lockfile باید در محیط پاک و CI قابل تکرار باشد.
- برای نسخه‌های Capacitor CLI که پشتیبانی می‌کنند، npx cap doctor نیز اجرا شود؛ چون مستند فعلی Capacitor به‌طور مشخص آن را برای تشخیص install scriptهای مسدودشده در npm 12 معرفی می‌کند. این دستور جایگزین بررسی رفتار Bun نیست.

منابع:
- [Bun Lifecycle Scripts](https://bun.sh/docs/pm/lifecycle)
- [Bun Install and Frozen Lockfile](https://bun.sh/docs/pm/cli/install)
- [Capacitor Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)

### ۱۵.۵ ترتیب Build و Sync پیشنهادی

پس از تأیید فاز پیاده‌سازی، ترتیب قابل تکرار باید چنین باشد:

1. نصب نسخه‌های هم‌تراز Capacitor Core، CLI و Android با Bun و ثبت bun.lock.
2. ساخت Next.js با تنظیمات production static export.
3. بررسی وجود out/index.html و مسیرهای asset.
4. اجرای Capacitor sync برای کپی کردن out به پلتفرم Native.
5. اجرای تست Android روی گوشی فیزیکی.
6. پس از پایدار شدن Android، افزودن پلتفرم iOS روی محیط macOS/Xcode و اجرای همان Build/Sync.
7. اجرای مجدد Checkهای Dashboard پس از هر تغییر وابستگی.

این مراحل نقشه پیشنهادی‌اند و هنوز اجرا نشده‌اند.

### ۱۵.۶ وضعیت این ممیزی

| مورد | وضعیت |
|---|---|
| Next.js output export | از config تأیید شد |
| پوشه خروجی out | خروجی پیش‌فرض مستند Next.js؛ باید در Build واقعی تأیید شود |
| images.unoptimized | در config فعال است |
| GitHub Pages basePath | شرطی و وابسته به GITHUB_PAGES |
| Capacitor webDir=out | تصمیم پیشنهادی؛ config هنوز ساخته نشده |
| Static Export compatibility | ساختار اولیه مناسب؛ ممیزی کامل runtime باقی است |
| Bun 1.4.4 و bun.lock | از package.json و lockfile تأیید شد |
| Lifecycle scripts | نیازمند بررسی dependencyهای Native پس از انتخاب نسخه |
| Build و cap sync | هنوز اجرا نشده |
