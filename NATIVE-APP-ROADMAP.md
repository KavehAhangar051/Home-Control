# نقشه راه و دفتر ثبت توسعه اپلیکیشن Native Home-Control

> مرجع پایدار توسعه اپلیکیشن موبایل مبتنی بر داشبورد فعلی. در هر جلسه، ابتدا این سند و سورس جاری مخزن بررسی شود و کار از آخرین وضعیت ثبت‌شده ادامه یابد.

- آخرین بازبینی: ۲۳ نوامبر ۲۰۲۶
- مخزن: https://github.com/KavehAhangar051/Home-Control-Dashboard
- محدوده: اپلیکیشن موبایل مبتنی بر Dashboard/
- وضعیت: پایپ‌لاین Capacitor 8.6.2 با اسکریپت‌های android:prepare، android:sync و android:apk راه‌اندازی شده و CI Workflow انتشار Pre-release فعال است؛ تداخل فشرده‌سازی وب در اندروید حل شد.

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

- [x] ارائه فهرست فایل‌ها و تغییرات APK-only
- [x] تعیین Capacitor 8.6.2 و نسخه‌های سازگار
- [x] تأیید مالک برای پیاده‌سازی APK-only
- [x] انتخاب پیکربندی Capacitor و اسکریپت Build

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


---

## ۱۶. ممیزی نهایی سازگاری Android پیش از اولین APK — ۲۰۲۶-۱۱-۲۰

این بخش نتایج ممیزی چهارمحوره Browser API، وابستگی Backend، تعاملات لمسی و امنیت شبکه را ثبت می‌کند. یافته‌های سورس از فایل‌های جاری Dashboard استخراج شده‌اند؛ مواردی که به اجرای APK یا گوشی نیاز دارند صریحاً «تأییدنشده» باقی می‌مانند. در این مرحله هیچ فایل اجرایی تغییر نکرده و Build یا تست دستگاه اجرا نشده است.

### ۱۶.۱ Browser APIها و تفاوت‌های احتمالی Android WebView

فایل‌های بررسی‌شده:
- `lib/haptics.ts`
- `features/iot/hooks/usePageVisibility.ts`
- `features/iot/hooks/useVoiceCommand.ts`
- `features/iot/hooks/voiceRecognitionHelpers.ts`
- `features/iot/hooks/achaemenidState/useConnectionStrategy.ts`
- `features/iot/services/localWs/client.ts`

| API / قابلیت | کاربرد فعلی | وضعیت مهاجرت |
|---|---|---|
| `localStorage` | Preferences و داده‌های محلی | در WebView قابل استفاده؛ ماندگاری و Upgrade باید روی دستگاه تست شود |
| `WebSocket` | اتصال مستقیم به ESP32 | نیازمند تست شبکه محلی، Origin و سیاست‌های Android |
| `navigator.vibrate` | بازخورد لرزشی | پیاده‌سازی فعلی graceful fallback دارد؛ برای Native، Adapter مبتنی بر Haptics قابل بررسی است |
| `SpeechRecognition` / `webkitSpeechRecognition` | فرمان صوتی | Feature Detection و تست واقعی fa-IR الزامی است |
| `visibilitychange` | تشخیص مخفی/نمایان شدن صفحه | حفظ شود و با Capacitor App Lifecycle هماهنگ شود |
| `online` | تشخیص تغییر وضعیت اتصال شبکه | سیگنال کمکی است؛ سلامت MQTT یا ESP32 را به‌تنهایی ثابت نمی‌کند |
| Pointer / Touch Events | تعاملات لمسی و Drag | پشتیبانی پایه وجود دارد؛ Gestureها باید روی گوشی تست شوند |
| `requestAnimationFrame` و Timerها | زمان‌بندی UI و منطق تعاملی | در Background ممکن است محدود یا متوقف شوند؛ منطق اتصال نباید به اجرای دقیق Timer در Background وابسته باشد |

#### Voice Recognition
کد فعلی در `voiceRecognitionHelpers.ts` از تنظیمات `continuous = true`، `interimResults = true` و زبان `fa-IR` استفاده می‌کند. بنابراین تست Native باید موارد زیر را پوشش دهد:
- وجود API در System WebView گوشی و امکان ساخت Recognition instance؛
- شروع و توقف Session؛
- دریافت Interim و Final transcript؛
- مجوز میکروفون و رفتار در صورت رد یا لغو مجوز؛
- پشتیبانی عملی زبان فارسی و رفتار در نبود شبکه یا سرویس تشخیص گفتار؛
- عدم اجرای callbackهای Session قدیمی پس از توقف یا شروع Session جدید.

**تصمیم:** در اولین APK پلاگین Speech جداگانه اضافه نشود مگر آنکه تست Web Speech در گوشی واقعی شکست بخورد یا کیفیت فارسی کافی نباشد. در صورت نیاز، Native Speech Adapter با قرارداد فعلی Voice جایگزین شود؛ نه اینکه منطق فرمان‌های فارسی بازنویسی شود.

#### Haptics
`lib/haptics.ts` الگوهای لرزش فعلی را از طریق Web Vibration API اجرا می‌کند. در صورت افزودن `@capacitor/haptics`، API عمومی فعلی و الگوهای تجربه کاربری حفظ شوند و فقط Transport پشت Adapter تغییر کند. رفتار Web و تنظیمات کاهش حرکت نیز نباید خراب شوند.

#### Lifecycle
`usePageVisibility.ts` از `visibilitychange` و `online` استفاده می‌کند. این رویدادها برای Native lifecycle کافی نیستند. در فاز پیاده‌سازی، رویدادهای `@capacitor/app` به یک مسیر Resume مشترک متصل شوند تا رویداد Native و document visibility باعث Resume تکراری MQTT نشوند.

### ۱۶.۲ وابستگی‌های Backend و سرویس‌های خارجی

داشبورد خروجی Static دارد، اما برای تمام قابلیت‌های IoT مستقل از سرویس‌های بیرونی نیست. مسیرهای ارتباطی شناسایی‌شده:

| سرویس | آدرس/پروتکل پیش‌فرض مشاهده‌شده | نقش |
|---|---|---|
| Cloudflare Worker | `https://home-control-db.kamyarahangar157.workers.dev` | API پیکربندی و داده‌های ابری |
| MQTT Broker | `wss://broker.emqx.io:8084/mqtt` | پیام‌رسانی و کنترل از راه دور |
| ESP32 Local WebSocket | `ws://<localIp>:81` | ارتباط مستقیم در شبکه محلی |

فایل‌های بررسی‌شده:
- `features/iot/services/cloudflare/config.ts`
- `features/iot/services/cloudflare/api.ts`
- `features/iot/services/mqtt/client.ts`
- `features/iot/hooks/achaemenidState/useConnectionStrategy.ts`

در Cloudflare API مدیریت Timeout، Retry و Circuit Breaker وجود دارد. وجود این کنترل‌ها جایگزین تست واقعی قطع اینترنت یا در دسترس نبودن Worker نیست.

**نتیجه معماری:** برای بسته Native به Next.js Runtime Server جدید نیاز نداریم؛ ولی قابلیت‌های Cloudflare و MQTT همچنان به اینترنت وابسته‌اند. Local WebSocket باید در صورت باقی بودن اتصال Wi-Fi، بدون وابستگی به اینترنت قابل استفاده باشد.

چک‌لیست تست:
1. اینترنت فعال و ESP32 در دسترس؛
2. اینترنت قطع، Wi-Fi محلی و ESP32 در دسترس؛
3. اینترنت فعال ولی Cloudflare Worker موقتاً در دسترس نیست؛
4. MQTT Broker در دسترس نیست؛
5. ESP32 خاموش یا IP آن تغییر کرده است؛
6. بازگشت اینترنت و همگام‌سازی مجدد؛
7. جلوگیری از نمایش State قدیمی به‌عنوان State قطعی پس از قطع ارتباط.

هیچ Endpoint جدید یا Backend جدیدی برای Native در این مرحله لازم تشخیص داده نشده است؛ این نتیجه باید با تست Runtime تأیید شود.

### ۱۶.۳ Drag & Drop، Canvas، Trellis و Animation

سه دسته تعامل متمایز در داشبورد وجود دارند:

#### Sortable UI
در manifest وابستگی‌های `@dnd-kit/dom` و `@dnd-kit/react` وجود دارند. این کتابخانه برای مرتب‌سازی عناصر استفاده می‌شود. سازگاری API با Pointer/Touch به معنی اثبات UX مناسب در گوشی نیست.

موارد تست:
- Drag کارت با انگشت و حفظ ترتیب؛
- اسکرول عمودی بدون شروع ناخواسته Drag؛
- رفتار Drag Handle در برابر دکمه‌ها و کنترل‌های داخل کارت؛
- جلوگیری از انتخاب متن یا فعال شدن ناخواسته کنترل‌ها؛
- ذخیره و بازیابی ترتیب بعد از خروج از صفحه.

#### Canvas
در `features/iot/components/canvas/CanvasWorkspace.tsx`، ناحیه تعاملی از `touchAction: "none"` استفاده می‌کند. این انتخاب می‌تواند برای کنترل کامل Gestureهای Canvas لازم باشد، اما باید بررسی شود که اسکرول صفحه و Gestureهای سیستم در اطراف Canvas مختل نشوند.

موارد تست:
- Pan، Zoom و Drag با یک و چند انگشت؛
- انتخاب و جابه‌جایی Node؛
- Resize و تعامل با کنترل‌های Node؛
- مرز Canvas و اسکرول صفحه؛
- عملکرد در نمایشگر کوچک و چرخش صفحه.

#### Trellis و Motion
در Controller مربوط به Trellis، تغییر سند با گزینه Animation انجام می‌شود. تعویض Layout، تغییر اندازه، جابه‌جایی پنل‌ها و انیمیشن‌ها باید روی دستگاه واقعی از نظر لمس، نرخ فریم و مصرف حافظه ارزیابی شوند.

**تصمیم:** در فاز اول هیچ کتابخانه Drag/Animation جایگزین نشود. ابتدا تست دستگاه انجام شود و فقط برای ایراد بازتولیدپذیر، تغییر محدود پیشنهاد شود.

### ۱۶.۴ امنیت WebSocket و Local Network

اتصال محلی فعلی به شکل `ws://<localIp>:81` رمزنگاری نشده است. این موضوع باید از سه مفهوم مستقل تفکیک شود:
1. Cleartext network traffic؛
2. Mixed Content در WebView؛
3. مجوز و حفاظت دسترسی به شبکه محلی در Android.

فعال‌کردن سراسری Cleartext یا Mixed Content برای رفع احتمالی مشکل، بدون تحلیل ریسک، مجاز نیست. Cleartext امکان مشاهده و دستکاری ترافیک در مسیر شبکه را افزایش می‌دهد؛ اگر پروتکل شامل فرمان‌های حساس یا اطلاعات قابل سوءاستفاده باشد، ریسک بالاتر است.

#### مجوز شبکه محلی در Android 17
طبق مستند رسمی Android:
- حفاظت اجباری Local Network از Android 17، برای برنامه‌هایی اعمال می‌شود که Target SDK 37 یا بالاتر دارند.
- برای Target SDK 36 یا پایین‌تر، دسترسی شبکه محلی از طریق مجوز INTERNET به‌صورت ضمنی مجاز است؛ در این Targetها نباید ACCESS_LOCAL_NETWORK را اضافه یا در Runtime درخواست کرد.
- WebView از وضعیت مجوز شبکه محلی برنامه میزبان تبعیت می‌کند.
- برای برنامه IoT که به دسترسی مستقیم و گسترده LAN نیاز دارد، در Target SDK 37+ باید ACCESS_LOCAL_NETWORK در Manifest تعریف و پیش از دسترسی محلی در Runtime درخواست شود؛ رد یا لغو مجوز باید graceful مدیریت شود.

برای Home-Control این مجوز با توجه به ماهیت اصلی کنترل دستگاه‌های IoT می‌تواند توجیه عملکردی داشته باشد؛ اما هنگام ارتقای Target SDK باید سیاست جاری Google Play و الزامات Declaration نیز دوباره بررسی شود.

**تصمیم فعلی:** Target SDK نسخه اول طبق برنامه روی 36 باقی بماند، مشروط به تأیید نسخه واقعی Capacitor و الزامات انتشار در زمان Build. هیچ Permission یا Network Security استثنایی پیش از تست اضافه نشود.

#### برنامه تست شبکه روی گوشی
1. نصب APK و اتصال گوشی به همان Wi-Fi شبکه ESP32؛
2. تلاش اتصال به IP محلی و ثبت نتیجه WebSocket؛
3. بررسی Logcat و WebView console برای تفکیک Mixed Content، Cleartext، Permission و خطای شبکه؛
4. قطع اینترنت موبایل/ WAN در حالی که Wi-Fi محلی برقرار است؛
5. تغییر Wi-Fi یا IP و بررسی reconnect؛
6. خاموش کردن ESP32 و بررسی Timeout و fallback به MQTT؛
7. بررسی اینکه هیچ تنظیم امنیتی گسترده‌تر از نیاز واقعی فعال نشده باشد.

**راه‌حل نهایی هنوز انتخاب نشده است.** گزینه‌های قابل ارزیابی پس از مشاهده خطا: WSS با مدل گواهی قابل‌مدیریت، تنظیم Network Security محدود و مستند، یا Native Transport. انتخاب Native Transport فقط پس از اثبات محدودیت WebView بررسی شود.

منابع رسمی به‌روز:
- [Android Local Network Permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Android Cleartext Communication Risks](https://developer.android.com/privacy-and-security/risks/cleartext-communications)
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Capacitor App API](https://capacitorjs.com/docs/apis/app)
- [Capacitor Haptics API](https://capacitorjs.com/docs/apis/haptics)
- [dnd-kit Documentation](https://dndkit.com/)
- [Next.js Static Export](https://nextjs.org/docs/app/guides/static-exports)

### ۱۶.۵ چک‌لیست پذیرش اولین APK

اولین APK فقط زمانی برای ادامه توسعه پذیرفته شود که حداقل موارد زیر روی گوشی واقعی ثبت و تأیید شوند:

- [ ] Build تولیدی Static موفق و وجود `out/index.html`
- [ ] بارگذاری تمام CSS، JavaScript، تصاویر و فونت‌های محلی
- [ ] نمایش RTL و Safe Area بدون بریدگی
- [ ] اجرای مسیرهای اصلی داشبورد و Android Back
- [ ] ذخیره و بازیابی Preferences و Workflow پس از بستن و باز کردن اپ
- [ ] اتصال MQTT، دریافت State و انتشار فرمان
- [ ] اتصال Local WebSocket به ESP32 و دریافت `state_sync`
- [ ] عملکرد Local Control در زمان قطع اینترنت، در حالی که Wi-Fi محلی برقرار است
- [ ] Reconnect پس از تغییر Wi-Fi، خاموش/روشن شدن ESP32 و Resume اپ
- [ ] عدم ایجاد اتصال یا Listener تکراری
- [ ] Voice Recognition فارسی، مجوز میکروفون و رفتار خطا
- [ ] Haptic feedback یا fallback بی‌خطا
- [ ] Sortable، Canvas و Trellis با لمس واقعی
- [ ] بررسی Logcat و WebView console برای خطاهای امنیتی و Runtime
- [ ] اجرای مجدد typecheck، lint و test موجود

### ۱۶.۶ وضعیت این ممیزی

| محور | نتیجه سورس | نتیجه دستگاه |
|---|---|---|
| Browser APIs | مسیرها و APIهای اصلی شناسایی شدند | هنوز تست نشده |
| Backend dependencies | Cloudflare، MQTT و ESP32 محلی شناسایی شدند | Offline/online هنوز تست نشده |
| Drag & Drop / Animation | Sortable، Canvas و Trellis شناسایی شدند | هنوز تست لمسی نشده |
| Local WebSocket security | ریسک ws:// و چارچوب مجوز Android مستند شد | علت/رفتار WebView هنوز آزمایش نشده |
| Static Build | تنظیمات خروجی بررسی شده | Build واقعی هنوز اجرا نشده |
| APK | هنوز ساخته نشده | تست گوشی هنوز شروع نشده |

**وضعیت کلی:** ممیزی سورس چهار محور این مرحله تکمیل شده است؛ تأیید Runtime و Build همچنان باقی است. این مرحله مجوز تغییر کد اجرایی محسوب نمی‌شود.

### ۱۶.۷ گام بعدی

گام بعدی، ممیزی نهایی اجرایی و Baseline بدون تغییر سورس است:
1. بررسی کامل `.gitignore` و وضعیت فایل‌های تولیدی؛
2. بررسی نهایی Routeها، importهای وابسته به Browser و اسکریپت‌های Build؛
3. اجرای `bun run check` و `bun run build` فقط پس از فراهم بودن محیط و بدون تغییر فایل؛
4. ثبت خطاهای Baseline و عدم نسبت دادن خطاهای قبلی به Capacitor؛
5. تهیه فهرست دقیق فایل‌ها و پکیج‌های لازم برای اولین APK و گرفتن تأیید مالک پروژه پیش از هر تغییر.

پس از تأیید مرحله پیاده‌سازی، فقط فایل‌های اعلام‌شده و تأییدشده تغییر می‌کنند. Git workflow باید Commit و Push باشد و از Pull استفاده نشود.


---

## ۱۷. Baseline Audit و آمادگی Build — ۲۰۲۶-۱۱-۲۰

این بخش نتایج بررسی فایل‌های پیکربندی و Pipeline فعلی Dashboard را ثبت می‌کند. این بررسی از طریق سورس GitHub انجام شده است؛ اجرای فرمان‌ها در محیط واقعی پروژه در این مرحله انجام نشده است. بنابراین هیچ نتیجه‌ای درباره موفقیت فعلی Typecheck، Test یا Production Build ادعا نمی‌شود.

### ۱۷.۱ وضعیت ابزارها و نسخه‌های ثبت‌شده

بر اساس `Dashboard/package.json` و `Dashboard/bun.lock` بررسی‌شده در شاخه `main`، نسخه‌های ثبت‌شده عبارت‌اند از:

| ابزار / وابستگی | نسخه ثبت‌شده |
|---|---:|
| Next.js | 16.4.6 |
| React | 19.3.1 |
| TypeScript | 7.0.2 |
| Bun | 1.4.4 |

این مقادیر نسخه‌های مشاهده‌شده در فایل‌های پروژه‌اند و به معنی تأیید نصب همین نسخه‌ها در محیط Build نیستند. پیش از Build باید نسخه واقعی Runtime و Package Manager با Lockfile تطبیق داده شود.

**نکته مهم Capacitor 8:** مستندات رسمی فعلی Capacitor 8 وجود Node.js نسخه 22 یا بالاتر را برای محیط توسعه الزامی می‌دانند. Android Studio نسخه 2025.2.1 یا جدیدتر و Android SDK نیز برای Android لازم‌اند. بنابراین وجود Bun در پروژه به‌تنهایی اثبات نمی‌کند که پیش‌نیاز Node موردنیاز Capacitor فراهم است؛ باید Node 22+ در محیط توسعه نصب و نسخه آن بررسی شود. این الزام را نباید با جایگزین کردن Package Manager پروژه اشتباه گرفت.

منابع:
- [Capacitor 8 Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor 8 Android](https://capacitorjs.com/docs/android)

### ۱۷.۲ تنظیمات Next.js و خروجی Static

در `Dashboard/next.config.ts`، خروجی Static در Build تولیدی فعال می‌شود و در حالت توسعه یا در صورت فعال بودن `DISABLE_HMR`، مقدار `output` متفاوت است.

برای Build قابل استفاده در Capacitor:
- Build باید در حالت Production و با `output: "export"` اجرا شود.
- متغیر `DISABLE_HMR` نباید ناخواسته مسیر خروجی Static را غیرفعال کند.
- وجود `out/index.html` و فایل‌های asset موردنیاز باید بعد از Build بررسی شود.
- مسیرهای فایل، فونت، تصاویر و لینک‌های داخلی باید از داخل WebView و بدون اتکا به سرور توسعه بررسی شوند.
- خروجی GitHub Pages و تنظیمات Base Path آن نباید ناخواسته در بسته Native اعمال شوند.

طبق مستندات Next.js، اجرای `next build` با `output: "export"` پوشه `out` تولید می‌کند. Static Export از قابلیت‌هایی که به سرور زمان اجرا یا Request پویا نیاز دارند پشتیبانی نمی‌کند. Route Handler فقط در حالت‌هایی که پاسخ آن در زمان Build قابل تولید باشد (از جمله GET ایستا) قابل Export است.

منبع: [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports)

### ۱۷.۳ Routeها و Browser APIها

در بررسی اولیه، Entry Pointهای `app/page.tsx` و `app/layout.tsx` بررسی شدند و ساختار اصلی به بارگذاری Dashboard و Providerهای ریشه متکی است. این مشاهده به معنی تکمیل جست‌وجوی تمام Routeها، Server Actions یا دسترسی‌های Browser در کل مخزن نیست.

در ممیزی تکمیلی باید:
1. تمام فایل‌های زیر `app/` فهرست و Route Handlerها شناسایی شوند؛
2. هر استفاده از `window`، `document`، `navigator`، Storage و APIهای مرورگر بررسی شود؛
3. دسترسی Browser-only در Client Component و پس از آماده شدن محیط مرورگر انجام شود؛
4. ماژول‌هایی که هنگام Import در سطح Top-level به Browser API دسترسی دارند شناسایی شوند؛
5. استفاده از APIهای سروری Next.js، Server Actions، Cookie/Headers پویا و Request-dependent Routeها بررسی شود.

Next.js تصریح می‌کند که Client Componentها نیز در مرحله Build پیش‌رندر می‌شوند؛ بنابراین قرار دادن `window` یا `localStorage` در سطح ماژول یا مسیر اجرای Server Render می‌تواند Build را بشکند. دسترسی باید در زمان اجرای مرورگر محافظت شود.

### ۱۷.۴ Git Ignore و فایل‌های تولیدی

در `Dashboard/.gitignore` موارد زیر مشاهده شدند:
- `node_modules/`
- `.next/`
- `out/`
- الگوی `.env*` همراه با استثنای `.env.example`

این تنظیم از Commit شدن وابستگی‌ها، خروجی Build و فایل‌های محیطی محلی جلوگیری می‌کند. پیش از افزودن Capacitor باید جداگانه تصمیم بگیریم کدام فایل‌های پروژه Native (مانند تنظیمات Gradle و فایل‌های Android) باید در Git نگهداری شوند؛ نباید کل پوشه Native را بدون بررسی Ignore یا Track کنیم.

### ۱۷.۵ Pipeline فعلی GitHub Actions

Workflow انتشار GitHub Pages در مسیر `Dashboard/.github/workflows/deploy-pages.yml` بررسی شد. ترتیب مشاهده‌شده شامل Checkout، نصب Bun، نصب وابستگی‌ها، Lint، Typecheck، Build و انتشار پوشه `out` است.

نکته: Workflow انتشار فعلی به‌تنهایی اثبات نمی‌کند که تمام تست‌های پروژه در CI اجرا می‌شوند. در بررسی انجام‌شده، اجرای تست‌ها در مراحل فهرست‌شده Workflow مشاهده نشد. اسکریپت‌های package و تست‌ها باید در محیط واقعی اجرا شوند تا پوشش و نتیجه قطعی مشخص شود.

### ۱۷.۶ ریسک Typecheck و فایل‌های تولیدشده Next.js

در `Dashboard/next-env.d.ts` ارجاع‌هایی به فایل‌های تولیدشده زیر `.next/types` مشاهده شد:
- `.next/types/routes.d.ts`
- `.next/types/root-params.d.ts`

از آنجا که Workflow فعلی Typecheck را پیش از Production Build اجرا می‌کند، باید در یک Checkout تمیز بررسی شود که این فایل‌ها در آن لحظه موجودند یا خیر و Typecheck چه نتیجه‌ای می‌دهد. این مورد فعلاً **ریسک قابل بررسی** است، نه باگ اثبات‌شده. تا پیش از مشاهده خروجی واقعی نباید ترتیب CI را تغییر داد.

### ۱۷.۷ ترتیب پیشنهادی اجرای Baseline

این فرمان‌ها باید در محیط توسعه‌ای که Repository در آن موجود است و بدون تغییر سورس اجرا شوند. مسیر اجرا از پوشه `Dashboard` است:

1. ثبت نسخه ابزارها: `node --version`، `bun --version` و بررسی نسخه Android Studio/SDK در محیط مربوط؛
2. نصب تکرارپذیر وابستگی‌ها با روش سازگار با Lockfile و اسکریپت‌های پروژه؛
3. اجرای Lint و Typecheck و ذخیره کامل خروجی؛
4. اجرای تست‌های موجود و ثبت جداگانه شکست‌های شناخته‌شده و جدید؛
5. اجرای Production Build با متغیرهای Production و اطمینان از Static Export؛
6. بررسی وجود `out/index.html` و assetهای موردنیاز؛
7. بررسی `git status` برای اطمینان از اینکه آزمایش‌ها فایل tracked را تغییر نداده‌اند.

نمونه فرمان‌های موجود در پروژه باید از خود `package.json` تأیید شوند؛ نام اسکریپت‌ها را حدس نزنید. در صورتی که `bun run check` اسکریپت تجمیعی Lint، Typecheck و Test باشد، خروجی کلی آن کافی نیست و هر مرحله باید جداگانه نیز گزارش شود تا منشأ خطا مشخص بماند.

### ۱۷.۸ برنامه Build Verification مخصوص Capacitor

پس از Baseline موفق و پس از تأیید مالک پروژه برای پیاده‌سازی:
- نسخه Node.js 22+ و Android Studio/SDK بررسی شود؛
- نسخه‌های هم‌تراز `@capacitor/core`، `@capacitor/cli` و `@capacitor/android` انتخاب شوند؛
- `webDir` در Capacitor روی پوشه Static Export یعنی `out` تنظیم شود؛
- ابتدا Web Build تولید و سپس فایل‌های آن با Capacitor به پروژه Android همگام شوند؛
- APK آزمایشی ساخته و روی گوشی واقعی نصب شود؛
- مسیرهای Local WebSocket، MQTT، Voice، Haptics، Lifecycle و Touch طبق بخش ۱۶ تست شوند.

این مراحل هنوز اجرا نشده‌اند و اضافه کردن Capacitor، ساخت فایل پیکربندی، ایجاد پوشه Android یا تغییر Package Manifest در این مرحله انجام نشده است.

### ۱۷.۹ وضعیت Baseline در پایان بررسی سورس

| موضوع | وضعیت |
|---|---|
| Package Manifest و Lockfile | بررسی سورس انجام شد |
| Next.js Static Export config | بررسی سورس انجام شد |
| Git Ignore | بررسی سورس انجام شد |
| GitHub Pages Workflow | بررسی سورس انجام شد |
| تمام Routeها و Browser APIها | نیازمند تکمیل جست‌وجوی مخزن |
| Typecheck واقعی | اجرا نشده |
| تست‌های واقعی | اجرا نشده |
| Production Build واقعی | اجرا نشده |
| بررسی خروجی `out/` | اجرا نشده |
| Build و نصب APK | شروع نشده |

**نتیجه:** ساختار فعلی Dashboard از نظر معماری Static Export مسیر مناسبی برای بسته‌بندی با Capacitor دارد؛ اما آمادگی Build هنوز تأیید نشده است. موفقیت Baseline فقط پس از اجرای فرمان‌ها در محیط واقعی و ثبت خروجی‌ها قابل اعلام است.

### ۱۷.۱۰ گام بعدی و محدودیت تغییرات

گام بعدی باید تکمیل فهرست Routeها و جست‌وجوی Browser APIها، سپس اجرای Baseline واقعی در محیط توسعه باشد. اگر دسترسی به محیط اجرای پروژه فراهم نیست، باید خروجی فرمان‌ها از محیط کاربر یا CI دریافت شود؛ بررسی GitHub به‌تنهایی جای اجرای Build را نمی‌گیرد.

هیچ تغییر اجرایی در این مرحله مجاز نشده است. هرگونه تغییر در Package Manifest، Lockfile، Next Config، Workflow یا فایل‌های Native باید قبل از اعمال، با فهرست دقیق فایل‌ها به مالک پروژه اعلام و تأیید شود. Git workflow طبق درخواست پروژه Commit و Push است و نباید از Pull استفاده شود.


---

## ۱۸. Runtime Dependency Audit — Browser APIs، Dynamic Imports و Environment — ۲۰۲۶-۱۱-۲۰

این بخش یافته‌های قابل‌تأیید از فایل‌های مشخص‌شده در شاخه `main` را ثبت می‌کند. جست‌وجوی کد از طریق نمایه GitHub در این نوبت نتیجه قابل اتکایی برای جست‌وجوی سراسری نمادها برنگرداند؛ بنابراین این بخش **ممیزی هدفمند فایل‌های شناخته‌شده است، نه اثبات نبود سایر استفاده‌ها در کل Repository**. اجرای APK یا Build نیز انجام نشده است.

### ۱۸.۱ Entry Point و بارگذاری Dynamic

فایل بررسی‌شده:
- `features/dashboard/components/layout/DashboardClientEntry.tsx`
- `lib/dynamicRetry.ts`

مشاهدات:
- `DashboardClientEntry` یک Client Component است.
- `DashboardShell` با `next/dynamic` بارگذاری می‌شود و گزینه `ssr: false` دارد؛ در زمان انتظار، `DashboardBootSkeleton` نمایش داده می‌شود.
- بارگذاری از طریق `retryDynamicImport` انجام می‌شود. مقدار پیش‌فرض دو Retry با تأخیر پایه ۲۵۰ میلی‌ثانیه و Backoff خطی دارد.
- در صورت شکست نهایی، Error Boundary پیام خطا و امکان تلاش مجدد ارائه می‌دهد؛ Reset فعلی با `window.location.reload()` صفحه را Reload می‌کند.

**ارزیابی Native:** این الگو از اجرای DashboardShell در SSR جلوگیری می‌کند، اما تضمین نمی‌کند که تمام ماژول‌های import شده در مسیرهای دیگر Browser-safe باشند. همچنین Dynamic Chunkها باید در بسته Static موجود و با مسیر asset صحیح قابل دریافت باشند.

چک‌لیست:
- [ ] بارگذاری اولیه Shell در APK بدون خطای Chunk؛
- [ ] باز کردن همه Featureهایی که Lazy/Dynamic Import دارند؛
- [ ] بررسی مسیر assetها در Base Path ریشه Capacitor؛
- [ ] تست خطای موقت بارگذاری Chunk و بازیابی؛
- [ ] تست سناریوی انتشار نسخه جدید و باقی ماندن Chunk قدیمی در Cache؛
- [ ] بررسی اینکه Reload در خطای نهایی اپ را به صفحه سفید یا Loop نمی‌برد.

مستند رسمی: [Next.js Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)

### ۱۸.۲ Browser APIهای تأییدشده در فایل‌های هدفمند

| API | فایل/کاربرد مشاهده‌شده | رفتار و ریسک Native |
|---|---|---|
| `window.location.reload()` | Reset در Error Boundary مربوط به Entry Point | در WebView قابل استفاده است؛ باید پس از خطای Chunk و با مسیر asset محلی تست شود |
| `document.hidden` و `visibilitychange` | تشخیص وضعیت صفحه و Resume/Pause ارتباط MQTT | در WebView موجود است؛ باید با App Lifecycle Capacitor هماهنگ شود تا Resume تکراری ایجاد نشود |
| `window.addEventListener("online")` | تلاش برای Resume MQTT پس از Online شدن | فقط وضعیت شبکه را گزارش می‌کند و سلامت Broker یا ESP32 را اثبات نمی‌کند |
| `SpeechRecognition` و `webkitSpeechRecognition` | تشخیص گفتار در Voice Command | API اختیاری و وابسته به WebView/سرویس سیستم است؛ پشتیبانی فارسی و مجوز میکروفون باید روی گوشی آزموده شود |
| `navigator.vibrate` | Haptic feedback | ممکن است در WebView/دستگاه پشتیبانی نشود؛ کد فعلی در نبود API مقدار false برمی‌گرداند |
| `window.matchMedia` | بررسی `prefers-reduced-motion` در Haptics | در صورت نبود API، کد فعلی به حالت پیش‌فرض برمی‌گردد |
| `document.documentElement.dataset` | ثبت وضعیت مخفی بودن صفحه | دسترسی در مسیر محافظت‌شده انجام می‌شود؛ باید اثر آن روی Resume و CSS بررسی شود |

#### Page Visibility و Lifecycle
در `features/iot/hooks/usePageVisibility.ts`، Listenerهای `visibilitychange` و `online` داخل `useEffect` ثبت و در Cleanup حذف می‌شوند. این روش از ثبت Listener در سطح Module جلوگیری می‌کند. با این حال، رویدادهای مرورگر معادل چرخه عمر Native نیستند. در مرحله پیاده‌سازی باید رویداد `appStateChange` از `@capacitor/app` با همین مسیر هماهنگ شود و Resumeهای تکراری MQTT مهار شوند.

#### Voice Recognition
در `features/iot/hooks/useVoiceCommand.ts` و `voiceRecognitionHelpers.ts`:
- سازنده استاندارد و Prefix قدیمی WebKit با Feature Detection بررسی می‌شوند؛
- در نبود API، پیام عدم پشتیبانی نمایش داده می‌شود؛
- زبان روی `fa-IR` تنظیم شده و `continuous` و `interimResults` فعال‌اند؛
- خطاهای `not-allowed`، `service-not-allowed`، `audio-capture`، `no-speech` و `network` پیام‌های مجزا دارند؛
- شناسه Session برای جلوگیری از پردازش Callbackهای قدیمی استفاده می‌شود.

**ریسک اصلی:** وجود `SpeechRecognition` در TypeScript یا Chrome Desktop تضمین‌کننده حضور سرویس تشخیص گفتار در Android System WebView نیست. همچنین مجوز میکروفون به‌تنهایی تضمین‌کننده وجود موتور Speech Recognition یا پشتیبانی از فارسی نیست.

**تصمیم:** در نسخه اول ابتدا API فعلی روی گوشی واقعی آزمایش شود. فقط در صورت شکست یا کیفیت ناکافی فارسی، Native Speech Adapter به‌عنوان تغییر جداگانه پیشنهاد شود. هیچ Plugin صوتی در این مرحله نصب نمی‌شود.

#### Haptics
در `lib/haptics.ts`، پشتیبانی از Vibration API، تنظیم کاربر برای Haptics و `prefers-reduced-motion` بررسی می‌شوند و خطای اجرای Vibration به‌صورت بی‌صدا مدیریت می‌شود. این رفتار Fallback مناسبی برای مرورگرهای فاقد API است. اگر `@capacitor/haptics` افزوده شود، باید همان الگوها و Preference کاربر حفظ شوند و فقط لایه اجرای لرزش پشت Adapter تغییر کند.

### ۱۸.۳ Environment Variables و حالت‌های Build

در `next.config.ts` متغیرهای زیر به‌صورت مستقیم مشاهده شدند:

| متغیر | اثر مشاهده‌شده | سیاست Native |
|---|---|---|
| `DISABLE_HMR` | در صورت `true` بودن، `output: "export"` غیرفعال می‌شود؛ در حالت Dev نیز Watcherها تغییر می‌کنند | در Production Native نباید ناخواسته `true` باشد |
| `GITHUB_PAGES` | `basePath` و `assetPrefix` و `trailingSlash` مربوط به GitHub Pages را فعال می‌کند | برای بسته‌ای که از ریشه WebView سرو می‌شود نباید ناخواسته فعال باشد |
| `NG_ALLOWED_HOSTS` | Hostهای مجاز توسعه را تکمیل می‌کند | تنظیم توسعه است و نباید به‌عنوان مجوز شبکه Runtime تلقی شود |

در فایل Root Layout، Preconnect به Cloudflare Worker و DNS Prefetch به MQTT Broker مشاهده شد. این‌ها Hintهای مرورگر برای اتصال‌اند و به‌خودی‌خود وابستگی Runtime یا تضمین دسترسی شبکه نیستند.

در فایل‌های بررسی‌شده متغیر `NEXT_PUBLIC_*` مشخصی مشاهده نشد؛ اما به دلیل نبود نتیجه قابل اتکای جست‌وجوی سراسری، **نمی‌توان نبود این متغیرها در تمام پروژه را نتیجه گرفت**. پیش از Build نهایی باید کل Environment مصرف‌شده در کد، اسکریپت‌ها و Workflowها فهرست شود و هیچ Secret در Bundle کلاینت قرار نگیرد.

### ۱۸.۴ Fonts و Build Offline

در `app/layout.tsx` این فونت‌ها مشاهده شدند:
- `Vazirmatn`
- `IBM Plex Sans Arabic`
- `Noto Sans Arabic`
- `Rubik`
- `Readex Pro`
- فونت محلی Dana از مسیر `public/Fonts/`

پنج فونت اول با `next/font/google` تعریف شده‌اند؛ `preload: false` فقط رفتار Preload را تغییر می‌دهد و به معنی حذف دانلود فونت در Build نیست. Next.js فایل‌های فونت Google را در زمان Build دریافت و Self-host می‌کند؛ بنابراین در زمان اجرای APK درخواست مستقیم مرورگر به Google لازم نیست، اما Build تمیز در محیط بدون دسترسی به منبع فونت ممکن است شکست بخورد مگر اینکه فایل‌های موردنیاز از Cache موجود باشند.

**تصمیم فعلی:** هیچ فونتی حذف یا جایگزین نشود. در Build Verification:
1. یک Build با دسترسی اینترنت اجرا و خروجی فونت‌ها بررسی شود؛
2. یک Build با Cache پاک و شبکه محدود، به‌عنوان آزمایش تکرارپذیری انجام شود؛
3. اندازه فایل‌های فونت و تعداد فونت‌های واقعاً قابل انتخاب بررسی شود؛
4. فقط در صورت اثبات نیاز، پیشنهاد Self-host کامل فونت‌ها یا کاهش خانواده‌ها ارائه شود.

منابع:
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)
- [Next.js Font API](https://nextjs.org/docs/app/api-reference/components/font)

### ۱۸.۵ Remote Images و درخواست‌های بیرونی

در `next.config.ts`، Image Optimization غیرفعال و `remotePatterns` برای `picsum.photos`، `upload.wikimedia.org` و `images.unsplash.com` تعریف شده است. این تنظیم به‌تنهایی ثابت نمی‌کند که همه این دامنه‌ها در مسیرهای اصلی Dashboard استفاده می‌شوند؛ اما اگر تصویر Remote در UI مصرف شود، WebView برای دریافت آن به شبکه و دسترسی دامنه نیاز دارد.

موارد بررسی در تست:
- [ ] فهرست واقعی تصاویر Remote مصرف‌شده؛
- [ ] رفتار تصویر در حالت Offline؛
- [ ] وجود Placeholder/Fallback؛
- [ ] عدم استفاده ناخواسته از دامنه‌های آزمایشی در UI تولیدی؛
- [ ] بررسی اینکه تصاویر مهم رابط کاربری در صورت نیاز محلی بسته‌بندی شوند.

### ۱۸.۶ Dynamic Import و به‌روزرسانی برنامه

Dynamic Import باعث می‌شود بخش‌هایی از برنامه در زمان نیاز بارگذاری شوند. در اپ Native، فایل‌ها از بسته محلی WebView دریافت می‌شوند؛ اما پس از به‌روزرسانی APK ممکن است Cache یا نسخه قبلی WebView با فایل‌های جدید هم‌خوان نباشد.

برای جلوگیری از خطا:
- فایل‌های Web و Native باید به‌صورت یک Release هماهنگ منتشر شوند؛
- سیاست Cache فایل‌های Static و نام‌گذاری Chunkها باید بررسی شود؛
- خطای Chunk باید پیام قابل فهم و مسیر Recovery داشته باشد؛
- قابلیت Live Update در Capacitor در این مرحله فعال نشود؛ تا زمانی که سیاست امضا، نسخه‌بندی، امنیت و Rollback جداگانه طراحی شده باشد.

### ۱۸.۷ منابع رسمی مرتبط

- [Capacitor Android / WebView](https://capacitorjs.com/docs/android)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
- [Capacitor App API](https://capacitorjs.com/docs/apis/app)
- [Capacitor Haptics API](https://capacitorjs.com/docs/apis/haptics)
- [Next.js Static Export و Browser APIs](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)

### ۱۸.۸ وضعیت این ممیزی و موارد باز

| موضوع | نتیجه |
|---|---|
| Dashboard Entry و Dynamic Import | فایل‌های هدفمند بررسی شدند |
| Retry و Error Boundary | منطق فایل‌های مربوط بررسی شد |
| Visibility و Online | فایل Hook بررسی شد |
| Speech Recognition | Feature Detection و Session logic بررسی شد |
| Haptics | Fallback و Preference بررسی شد |
| Environmentهای Next Config | سه متغیر مستقیم شناسایی شدند |
| فونت‌ها | پنج Google Font و Dana محلی شناسایی شدند |
| Remote Image | تنظیمات مجاز در Next Config شناسایی شدند |
| جست‌وجوی سراسری Browser API | به علت نبود نتیجه قابل اتکای نمایه جست‌وجو، قطعی نیست |
| Build و APK Runtime | اجرا نشده |

**نتیجه:** در فایل‌های هدفمند بررسی‌شده، Browser APIهای اصلی عمدتاً داخل Hook، Effect یا تابع و همراه با Feature Detection/Guard استفاده شده‌اند. ریسک‌های باقی‌مانده عمدتاً مربوط به پشتیبانی واقعی Speech Recognition، هماهنگی Native Lifecycle، مسیر و Cache فایل‌های Dynamic Chunk، متغیرهای Build و فونت‌های Google هستند. این نتیجه جایگزین جست‌وجوی سراسری و تست روی گوشی نیست.

### ۱۸.۹ گام بعدی

پیش از نصب Capacitor:
1. تکمیل جست‌وجوی Browser APIها با دسترسی به نمایه کامل یا Clone محلی؛
2. تهیه فهرست دقیق تمام Environment Variables مصرف‌شده؛
3. اجرای Baseline واقعی در محیط پروژه: Lint، Typecheck، Test و Static Build؛
4. ثبت خروجی و خطاهای موجود، بدون اصلاح خودکار؛
5. ارائه فهرست فایل‌های نیازمند تغییر برای Native و دریافت تأیید مالک پروژه.

هیچ فایل اجرایی، Dependency، فونت، Environment یا تنظیم Build در این ممیزی تغییر داده نشده است.


---

## ۱۹. Native Network و Touch Compatibility Audit — ۲۰۲۶-۱۱-۲۰

این بخش بررسی هدفمند مسیرهای ارتباطی و تعامل لمسی Dashboard را ثبت می‌کند. نتایج سورس با مستندات رسمی Android و Capacitor تطبیق داده شده‌اند. هیچ APK یا تستی روی گوشی در این مرحله اجرا نشده است؛ بنابراین موارد مربوط به رفتار واقعی WebView همچنان نیازمند آزمایش هستند.

### ۱۹.۱ معماری ارتباطی مشاهده‌شده

در سورس فعلی دست‌کم سه مسیر ارتباطی از نظر نقش قابل تفکیک‌اند:

| مسیر | پروتکل/کاربرد | نقش |
|---|---|---|
| Cloudflare Worker | HTTPS | دریافت/ذخیره تنظیمات و داده‌های ابری |
| MQTT Broker | WSS | ارتباط پیام‌رسانی Dashboard با ESP32 از مسیر Broker |
| ESP32 محلی | WebSocket با `ws://` و پورت 81 | مسیر مستقیم محلی برای ارتباط با دستگاه |

در `features/iot/services/mqtt/init.ts`، MQTT.js به‌صورت Dynamic Import بارگذاری می‌شود و با `mqtt.connect`، شناسه Client و `reconnectPeriod: 5000` اتصال را برقرار می‌کند. پس از اتصال، Topicهای State و Status Subscribe می‌شوند و Presence و Sync Request منتشر می‌شوند. دریافت State، ACK، Status و Ping نیز در Handlerهای مربوط پردازش می‌شود.

در مسیر Local WebSocket، `features/iot/hooks/achaemenidState/useConnectionStrategy.ts` آدرس دستگاه را بر اساس IP محلی می‌سازد و به پورت 81 وصل می‌شود. منطق انتخاب/بازگشت به MQTT باید هنگام تست Native از نظر Retry، وضعیت اتصال هم‌زمان و جلوگیری از دو مسیر فرمان‌دهی بررسی شود.

**نکته امنیتی:** WSS مسیر رمزنگاری‌شده‌ای فراهم می‌کند؛ اما WebSocket محلی با `ws://` رمزنگاری انتقال ندارد. اگر اطلاعات حساس یا فرمان‌های قابل سوءاستفاده روی این مسیر ارسال می‌شوند، مهاجم حاضر در همان شبکه محلی ممکن است امکان مشاهده یا دستکاری ترافیک را داشته باشد. Android cleartext policy نیز جایگزین رمزنگاری پروتکل نیست.

### ۱۹.۲ Cleartext WebSocket در Android WebView

مبدأ محلی WebView در Capacitor معمولاً HTTPS است، در حالی که اتصال ESP32 در سورس با `ws://<device-ip>:81` انجام می‌شود. باید دو لایه را از هم تفکیک کرد:

1. **Android Network Security Policy:** سیاست cleartext در Android می‌تواند روی ترافیک WebView اثر بگذارد؛ مستند Android می‌گوید WebView برای برنامه‌های Target API 26 به بالا این سیاست را رعایت می‌کند.
2. **Chromium/WebView mixed-content و WebSocket policy:** درخواست WebSocket ناامن از یک مبدأ امن می‌تواند با قواعد محتوای ناامن WebView نیز برخورد کند. رفتار دقیق باید روی نسخه Android System WebView گوشی هدف آزمایش شود.

بنابراین نمی‌توان صرفاً با فعال کردن یک گزینه Capacitor نتیجه گرفت که WebSocket محلی کار خواهد کرد. همچنین `allowMixedContent`، اگر برای دور زدن محدودیت انتخاب شود، باید با احتیاط و پس از بررسی ضرورت استفاده شود؛ این گزینه راهکار امنیتی یا رمزنگاری نیست.

**سیاست پیشنهادی:**
- پیش‌فرض امن برنامه حفظ شود؛
- از فعال‌سازی سراسری cleartext یا Mixed Content بدون تست و توجیه امنیتی خودداری شود؛
- ابتدا اتصال فعلی روی گوشی واقعی آزمایش و خطای دقیق WebView/Logcat ثبت شود؛
- اگر نیاز به استثنای cleartext ثابت شد، دامنه/مقصد مجاز تا حد ممکن محدود شود؛
- راهکار بلندمدت ترجیحاً WSS معتبر برای ارتباط محلی یا یک Native Adapter با طراحی امنیتی روشن باشد. افزودن TLS به ESP32 به گواهی، اعتماد کلاینت و مدیریت کلید نیاز دارد و صرفاً تغییر `ws://` به `wss://` کافی نیست.

منابع:
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Android Cleartext Communications Risk](https://developer.android.com/privacy-and-security/risks/cleartext-communications)
- [Android NetworkSecurityPolicy API](https://developer.android.com/reference/android/security/NetworkSecurityPolicy)

### ۱۹.۳ Local Network Permission و انتخاب Capacitor

طبق ماتریس رسمی نسخه‌های Capacitor:

| نسخه | Target SDK متناظر | وضعیت Local Network |
|---|---:|---|
| Capacitor 8 | 36 | `ACCESS_LOCAL_NETWORK` برای این Target لازم نیست |
| Capacitor 9 | 37 | مجوز `ACCESS_LOCAL_NETWORK` و درخواست Runtime لازم است |

Android 17 (API 37) دسترسی شبکه محلی را برای برنامه‌های Target 37 یا بالاتر به مجوز Runtime جدید `ACCESS_LOCAL_NETWORK` محدود می‌کند. این محدودیت شامل ارتباطات TCP روی IP محلی و ترافیک WebView نیز می‌شود. برای Target SDK 36 یا پایین‌تر، طبق مستند فعلی Android دسترسی شبکه محلی با مجوز `INTERNET` به‌صورت ضمنی برقرار می‌ماند و نباید مجوز جدید را زودتر از Target 37 اضافه یا درخواست کرد.

**تصمیم فعلی برای MVP:** Capacitor 8 با Target SDK 36 انتخاب پایه باقی می‌ماند تا مسیر ساخت اولین APK ساده‌تر باشد. این تصمیم به معنی نادیده گرفتن Android 17 نیست؛ هنگام برنامه‌ریزی ارتقا به Capacitor 9 باید Permission declaration، درخواست Runtime، حالت Denial/Revocation و پیام توضیحی به کاربر پیاده‌سازی و آزمایش شوند.

برای Home-Control که به‌صورت ذاتی دستگاه IoT را در LAN کنترل می‌کند، دسترسی گسترده شبکه محلی احتمالاً بخشی از قابلیت اصلی محصول است؛ در صورت ارتقا به Target 37 باید ضرورت آن مستند و با سیاست انتشار Google Play در زمان انتشار تطبیق داده شود.

منابع:
- [Capacitor Android Configuration](https://next.capacitorjs.com/docs/next/android/configuration)
- [Capacitor Target SDK Matrix](https://next.capacitorjs.com/docs/next/android/setting-target-sdk)
- [Android Local Network Permission](https://developer.android.com/privacy-and-security/local-network-permission)
- [Android ACCESS_LOCAL_NETWORK API](https://developer.android.com/reference/android/Manifest.permission)

### ۱۹.۴ Touch، Pointer و Drag & Drop

فایل‌های Canvas و Workspace در بررسی هدفمند شامل موارد زیر بودند:
- `CanvasWorkspace.tsx` برای سطح Canvas و World Plane؛
- `useSheetViewportGestures.ts` برای Gestureهای Viewport؛
- `useCanvasNodeInteractions.ts` برای تعامل Nodeها؛
- `DndGridWorkspace.tsx` برای Workspace مبتنی بر Drag & Drop.

در Canvas از Transform سه‌بعدی `translate3d(...)` به همراه Scale و `will-change: transform` برای World Plane استفاده می‌شود. این طراحی برای Pan/Zoom مناسب است، اما روی GPU و حافظه دستگاه‌های Android ارزان‌قیمت می‌تواند فشار ایجاد کند؛ اندازه Canvas، تعداد Nodeها، تعداد Wireها و نرخ به‌روزرسانی باید در دستگاه واقعی سنجیده شود.

در CSS عمومی، قواعد `prefers-reduced-motion` و توقف برخی Animationها هنگام مخفی بودن صفحه وجود دارد. در عین حال، جست‌وجوی هدفمند فایل‌های بررسی‌شده یک سیاست یکپارچه و صریح `touch-action` برای همه سطوح Gesture را اثبات نکرد. این به معنی نبود آن در کل پروژه نیست؛ باید CSS نهایی و عنصرهای قابل Drag به‌صورت کامل بررسی شوند.

**موارد پذیرش لمسی:**
1. Drag کارت با یک انگشت بدون Scroll ناخواسته صفحه؛
2. Pan و Pinch Zoom روی Canvas با دو انگشت؛
3. جلوگیری از تداخل Gestureهای Parent و Child؛
4. مدیریت `pointercancel`، خروج Pointer از محدوده عنصر و پایان Gesture؛
5. بررسی Pointer Capture و Cleanup در زمان Unmount؛
6. Drag و Resize با لمس طولانی و لمس کوتاه بدون تأخیر محسوس؛
7. تست با نرخ فریم و تعداد Nodeهای واقعی پروژه؛
8. بررسی انیمیشن‌ها با `prefers-reduced-motion` و هنگام Background شدن اپ.

منبع:
- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [MDN: Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)

### ۱۹.۵ Android App Lifecycle و اتصال پایدار

Hook فعلی Page Visibility از `visibilitychange` و `online` استفاده می‌کند و برای توقف/ازسرگیری منطق ارتباطی به وضعیت صفحه متکی است. این رویدادها به‌تنهایی معادل چرخه عمر Native نیستند.

هنگام افزودن Capacitor:
- `@capacitor/app` و رویداد `appStateChange` باید به‌عنوان منبع Native Lifecycle ارزیابی شوند؛
- از اجرای هم‌زمان Resume در رویداد Native و `visibilitychange` جلوگیری شود؛
- اتصال MQTT و Local WebSocket هنگام Background/Foreground شدن سیاست مشخص داشته باشند؛
- پس از برگشت از Background، وضعیت اتصال از روی رویداد واقعی Broker/ESP32 بازیابی شود، نه صرفاً Online بودن گوشی؛
- Listenerها در Cleanup حذف شوند و ثبت چندباره رخ ندهد.

منبع:
- [Capacitor App API](https://capacitorjs.com/docs/apis/app)

### ۱۹.۶ ماتریس تست اولین APK

| سناریو | معیار پذیرش |
|---|---|
| اجرای اولیه | Dashboard بدون خطای Chunk یا صفحه سفید باز شود |
| MQTT با WSS | Connect، Subscribe، Publish و Reconnect موفق باشند |
| Local WS به ESP32 | اتصال به IP و پورت 81 برقرار شود یا خطای قابل تشخیص ثبت شود |
| قطع Broker | مسیر Local و وضعیت UI مطابق منطق موجود باقی بماند |
| قطع LAN | خطای اتصال و بازیابی پس از برگشت شبکه قابل مشاهده باشد |
| Background/Resume | اتصال‌ها بدون Listener تکراری بازیابی شوند |
| Drag/Drop | Gesture با Scroll و لمس سیستم تداخل نکند |
| Canvas Pinch/Pan | حرکت نرم و بدون پرش یا Pointer Stuck باشد |
| Voice | پشتیبانی واقعی فارسی و مجوز میکروفون روی دستگاه مشخص شود |
| Offline | رابط اصلی و داده‌های Cache شده طبق انتظار قابل استفاده باشند |

### ۱۹.۷ تصمیم‌های فعلی و مواردی که هنوز مجاز به تغییر نیستند

| تصمیم | وضعیت |
|---|---|
| مبنای MVP: Capacitor 8 / Target 36 | پیشنهاد معماری ثبت شد |
| فعال‌سازی سراسری Cleartext | رد؛ بدون ضرورت و تست انجام نشود |
| فعال‌سازی سراسری Mixed Content | رد؛ بدون ضرورت و تست انجام نشود |
| افزودن `ACCESS_LOCAL_NETWORK` در Target 36 | انجام نشود |
| طراحی مسیر ارتقا به Capacitor 9 / Target 37 | در نقشه راه ثبت شد |
| تغییر پروتکل Local WS به WSS | نیازمند طراحی و تأیید جداگانه |
| افزودن Native Lifecycle Adapter | نیازمند تأیید و پیاده‌سازی جداگانه |
| تغییر CSS مربوط به Touch | تا پایان تست و تأیید انجام نشود |

### ۱۹.۸ جمع‌بندی و گام بعدی

مهم‌ترین ریسک فنی پیش از اولین APK، نه MQTT از مسیر WSS، بلکه اتصال مستقیم `ws://` به ESP32 از مبدأ HTTPS در Android WebView است. این مسیر باید با Logcat و یک گوشی واقعی آزمایش شود. ریسک بعدی، هماهنگی Gestureهای Canvas با Touch و Pointer Events و سپس هماهنگی Page Visibility با Native Lifecycle است.

گام بعدی پیشنهادی:
1. تکمیل جست‌وجوی سراسری کد برای `WebSocket`، `touch-action`، Pointer Events و Environment Variables؛
2. اجرای Lint، Typecheck، Test و Static Export در محیط واقعی؛
3. ساخت یک APK آزمایشی بدون تغییر پروتکل شبکه و ثبت نتیجه Local WS؛
4. ارائه فهرست دقیق فایل‌های لازم برای تغییر و دریافت تأیید پیش از هر ویرایش اجرایی.

این ممیزی به‌تنهایی اثبات نمی‌کند که APK روی دستگاه اجرا می‌شود. هیچ کد اجرایی، Manifest، Network Security Config، CSS، Dependency یا تنظیم Capacitor در این مرحله تغییر داده نشده است.

---

## ۱۴. پیاده‌سازی اولیه APK-only — ۲۰۲۶-۱۱-۲۰

### تغییرات ثبت‌شده در مخزن

- Capacitor **8.6.2** برای Android انتخاب شده است.
- شناسه برنامه اولیه: `com.homecontrol.dashboard`؛ نام نمایشی: `Home Control`.
- خروجی Next.js به‌صورت Static Export در `out/` بسته‌بندی می‌شود.
- `capacitor.config.json` مسیر خروجی وب را روی `out` قرار می‌دهد.
- اسکریپت‌های `android:prepare`, `android:sync`, و `android:apk` به `package.json` اضافه شده‌اند.
- پکیج‌های Capacitor با نسخه دقیق و گزینه Bun `--no-save` نصب می‌شوند تا در bootstrap اولیه، `bun.lock` با manifest ناسازگار نشود. این وابستگی‌ها فعلاً در `package.json` ثبت نشده‌اند؛ پس از تأیید اولین اجرای Native، تثبیت دائمی پکیج‌ها و lockfile در تغییر جداگانه انجام می‌شود.
- Workflow جدید `.github/workflows/android-apk.yml` روی Push به `main` و `workflow_dispatch` اجرا می‌شود؛ runner برابر `ubuntu-latest`، Node.js 22، Java 21 و Android SDK API 36 است.
- خروجی فقط `app-debug.apk` است و به‌عنوان Artifact بارگذاری می‌شود؛ هیچ AAB، Release signing، Google Play یا GitHub Release ساخته نمی‌شود.
- پروژه Android در این bootstrap داخل CI/محیط محلی تولید می‌شود و در Git commit نمی‌شود.

### وضعیت اعتبارسنجی

- [x] طرح APK-only توسط مالک تأیید شد.
- [x] پیکربندی Capacitor و اسکریپت‌های Build ثبت شدند.
- [x] GitHub Actions workflow ثبت شد.
- [x] اولین GitHub Actions build موفق (Run: `44773873021`)
- [x] APK به‌عنوان Artifact تولید و قابل دریافت شد (`home-control-debug-apk-6`)
- [ ] نصب و اجرای دستی روی گوشی Android
- [ ] بررسی MQTT و Local WebSocket روی گوشی واقعی

**وضعیت:** اولین APK debug ساخته و آپلود شده است؛ نصب و اجرای واقعی روی گوشی همچنان نیازمند بررسی مالک پروژه است.


---

## ۱۵. رفع خطای نخستین Android SDK setup — ۲۰۲۶-۱۱-۲۰

### علت ریشه‌ای

در اجرای GitHub Actions با شناسه `44773488351` و Job `136417026614`، مرحله `Set up Android SDK` در `android-actions/setup-android@v3` شکست خورد. لاگ دقیقاً این پیام را ثبت کرد:

```text
Warning: Failed to find package 'tools'
Error: .../sdkmanager failed with exit code 1
```

نسخه v3 اکشن، پکیج legacy با نام `tools` را در ورودی پیش‌فرض خود درخواست می‌کرد؛ Google آن پکیج را از مخزن SDK حذف کرده است. این خطا پیش از اجرای Bun build، Capacitor sync و Gradle رخ داده است؛ بنابراین هنوز هیچ نتیجه‌ای درباره صحت Build برنامه نمی‌دهد.

### اصلاح ثبت‌شده

- ارتقای `android-actions/setup-android` از v3 به v4.
- تعیین صریح `packages: platform-tools` تا پکیج منسوخ `tools` درخواست نشود.
- حذف مرحله دستی تکراری پذیرش License؛ اکشن Setup Android خودش Licenseها را می‌پذیرد.
- باقی‌ماندن نصب صریح Android Platform 36 و Build Tools 36.0.0 در مرحله بعدی.
- مستندات README و ARCHITECTURE همگام شدند.

### وضعیت اعتبارسنجی

- [x] علت ریشه‌ای از لاگ Job تأیید شد.
- [x] Workflow اصلاح و Push شد.
- [x] اجرای مجدد Workflow با نسخه جدید setup-android
- [x] عبور از Android SDK setup
- [x] تولید و بارگذاری APK به‌عنوان Artifact

**Commit اصلاح:** `50027e2f85643a789567a92e73c0266c3fe63f4e`

**اجرای موفق:** `44773873021` — Job `136418373478`. تمام ۱۳ مرحله موفق شدند و Artifact `home-control-debug-apk-6` با شناسه `14648746694` بارگذاری شد. این اجرا روی Ubuntu 26.04 انجام شد.

**وضعیت:** اولین APK debug ساخته و به‌عنوان Artifact قابل دریافت است؛ نصب و اجرای واقعی روی گوشی همچنان باید توسط مالک پروژه بررسی شود.


---

## ۱۶. رفع هشدارهای Android APK CI — ۲۰۲۶-۱۱-۲۰

### شواهد اجرای موفق و هشدارها

در Workflow با شناسه `44773873021` و Job `136418373478`:
- تمام ۱۳ مرحله از Checkout تا Upload موفق بودند.
- Artifact `home-control-debug-apk-6` با شناسه `14648746694` و حجم تقریبی ۹٫۹ مگابایت تولید شد.
- APK در مسیر `android/app/build/outputs/apk/debug/app-debug.apk` ساخته شد.
- هشدارهای مشاهده‌شده شامل Deprecated بودن `setup-java@v4`، اجرای Actionهای Node 20 روی Runtime جدید Node 24، Deprecated بودن `sdkmanager`، هشدار Gradle درباره `flatDir` و چند DeprecationWarning مربوط به وابستگی‌های Node در Actionها بودند.

### اصلاحات Workflow

- `actions/checkout@v4` به `@v7` ارتقا یافت.
- `actions/setup-node@v4` به `@v7` ارتقا یافت؛ نسخه Node پروژه همچنان 22 باقی می‌ماند.
- `actions/setup-java@v4` به `@v6` ارتقا یافت؛ Java همچنان 21 است.
- `actions/upload-artifact@v4` به `@v6` ارتقا یافت.
- نصب Android SDK از `android-actions/setup-android` و `sdkmanager` به Android CLI رسمی گوگل منتقل شد. پکیج‌های Platform Tools، Platform 36 و Build Tools 36.0.0 با `android sdk install` نصب می‌شوند.

### هشدارهای باقیمانده و دلیل

- هشدار `flatDir` از تنظیمات Gradle پروژه Android تولیدشده/وابستگی Capacitor می‌آید. حذف کورکورانه Repository می‌تواند بارگذاری کتابخانه‌های محلی افزونه‌ها را مختل کند؛ تا زمان مهاجرت upstream یا اثبات عدم نیاز، آن را suppress یا حذف نمی‌کنیم.
- هشدارهای `punycode` و `url.parse` در این اجرا از Runtime وابستگی‌های Actionها صادر شدند. ارتقای Actionهای اصلی به نسخه‌های Node 24-compatible و نسخه جدید Artifact برای رفع منشأ شناخته‌شده انجام شد؛ باقی‌ماندن یا رفع کامل آن‌ها فقط با لاگ اجرای جدید قابل تأیید است.

### منابع رسمی

- Android CLI و جایگزینی `sdkmanager`: https://developer.android.com/tools/sdkmanager
- نصب Android CLI: https://developer.android.com/tools/agents/android-cli/download
- `actions/checkout`: https://github.com/actions/checkout
- `actions/setup-node`: https://github.com/actions/setup-node
- `actions/setup-java`: https://github.com/actions/setup-java
- `actions/upload-artifact`: https://github.com/actions/upload-artifact
- Gradle Flat Directory Repository: https://docs.gradle.org/current/userguide/supported_repository_types.html

### وضعیت

- [x] موفقیت اولین APK و Artifact از لاگ GitHub تأیید شد.
- [x] نسخه‌های قدیمی Actionهای اصلی ارتقا داده شدند.
- [x] نصب SDK به Android CLI رسمی منتقل شد.
- [ ] اجرای Workflow پس از این اصلاحات و تأیید لاگ بدون هشدارهای قابل رفع
- [ ] بررسی هشدار `flatDir` پس از مشخص شدن نسخه/منشأ دقیق در زنجیره Capacitor
- [ ] نصب و اجرای APK روی گوشی واقعی


---

## ۱۷. بررسی اجرای Android APK پس از مهاجرت به Android CLI — ۲۰۲۶-۱۱-۲۰

### نتیجه اجرای CI

- Workflow: [Run 44774858108](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44774858108)
- Job: [136421942319](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44774858108/job/136421942319)
- Commit مبنا: `50ed225e5c357370af2de0d4e5932e39cba5d489`
- هر ۱۳ مرحله اصلی از نصب Android CLI تا Upload موفق شدند.
- Gradle خروجی `BUILD SUCCESSFUL` داد؛ فایل APK غیرخالی بود و SHA-256 آن `834403ebbaa081dc7c23a7cddb638803ec4d98c71afc84e3bdb0321f52966497` ثبت شد.
- Artifact: `home-control-debug-apk-11`، شناسه `14648399660`، حجم ۹٬۹۱۴٬۸۳۱ بایت؛ اعتبار Artifact تا ۲۰۲۶-۱۲-۲۰.

### وضعیت هشدارها در این اجرا

- هشدارهای قبلی مربوط به `sdkmanager`، Node 20، `punycode` و `url.parse` در لاگ این Job دیده نشدند.
- دو هشدار Gradle درباره `flatDir` باقی است. این Repository در ماژول Cordova-generated برای سازگاری با افزونه‌های Cordova و کتابخانه‌های محلی JAR/AAR به‌کار می‌رود. حذف آن بدون اثبات نبود افزونه/کتابخانه وابسته می‌تواند سازگاری را بشکند؛ فعلاً حذف یا suppress نمی‌شود. مرجع: [Capacitor issue #5287](https://github.com/ionic-team/capacitor/issues/5287).
- یک هشدار SDK metadata ثبت شد: parser نسخه XML تا ۳ را می‌شناسد، اما فایل SDK با نسخه ۴ مواجه شده است. این هشدار در این اجرا مانع Build نشد. با توجه به اینکه Capacitor 8.6.2 از Android Gradle Plugin 8.13.0 استفاده می‌کند و شواهد فعلی emitter دقیق هشدار را مشخص نمی‌کند، ارتقای حدسی AGP/Gradle یا downgrade کردن Android CLI انجام نشد. باید در صورت تکرار، منبع دقیق پیام و نسخه‌های واقعی ابزارهای SDK/Gradle استخراج شود.

### منابع فنی

- [Capacitor 8.6.2 Android build configuration](https://github.com/ionic-team/capacitor/blob/8.6.2/android/capacitor/build.gradle)
- [Capacitor: flatDir rationale](https://github.com/ionic-team/capacitor/issues/5287)
- [Gradle repository types](https://docs.gradle.org/current/userguide/supported_repository_types.html)
- [Android Gradle Plugin compatibility](https://developer.android.com/build/releases/about-agp)

### وضعیت

- [x] اجرای Workflow پس از مهاجرت به Android CLI موفق شد.
- [x] APK ساخته و Artifact آپلود شد.
- [x] هشدارهای قدیمی Action/Node و sdkmanager در لاگ جدید دیده نشدند.
- [ ] بررسی دقیق منبع هشدار SDK XML در صورت تکرار.
- [ ] نصب و اجرای APK روی گوشی واقعی و بررسی MQTT و Local WebSocket.


---

## ۱۸. انتشار APK در GitHub Releases — ۲۰۲۶-۱۱-۲۰

### رفتار Workflow

- Workflow همان `.github/workflows/android-apk.yml` باقی می‌ماند و پس از Build موفق، APK را هم به‌صورت Actions Artifact با نگهداری ۳۰روزه و هم به‌عنوان Asset یک GitHub Pre-release منتشر می‌کند.
- برای ایجاد Release از GitHub CLI موجود روی runner استفاده می‌شود؛ وابستگی به Action انتشار شخص ثالث اضافه نشده است.
- Permission مربوط به Workflow از `contents: read` به `contents: write` تغییر می‌کند تا توکن همان اجرا اجازه ساخت Tag و Release داشته باشد.
- الگوی Tag برابر `android-build-<run-number>-<run-attempt>` و نام Artifact نیز شامل هر دو شماره اجرا و تلاش است. این کار اجرای مجدد همان Workflow را از برخورد با Release یا Artifact قبلی حفظ می‌کند.
- عنوان Release شماره اجرا و تلاش را مشخص می‌کند و متن آن Commit مبنا و ماهیت Debug را اعلام می‌کند.
- Release با `--prerelease --latest=false` منتشر می‌شود تا APK توسعه‌ای با نسخه پایدار اشتباه نشود و به‌عنوان Latest Release انتخاب نشود.

### محدوده انتشار

- فقط `app-debug.apk` منتشر می‌شود؛ AAB، Google Play و GitHub Packages اضافه نمی‌شوند.
- فایل فعلی Debug و بدون امضای انتشار Production است. انتشار در GitHub Releases به‌خودی‌خود APK را به نسخه Production امضاشده تبدیل نمی‌کند.
- Artifact سی‌روزه حفظ می‌شود تا مسیر دریافت فعلی نیز باقی بماند.

### اعتبارسنجی

- [x] Workflow و مستندات برای انتشار GitHub Pre-release به‌روزرسانی شدند.
- [ ] اجرای موفق CI و تأیید ایجاد Release و پیوست APK
- [ ] نصب و اجرای APK روی گوشی Android و بررسی MQTT و Local WebSocket

**وضعیت:** تغییرات Workflow و مستندات ثبت شده‌اند؛ ایجاد Release واقعی پس از اجرای موفق Workflow جدید قابل تأیید است.

---

## ۱۹. تفکیک فایل‌های فشرده‌سازی وب (.gz و .br) در بیلد و همگام‌سازی Capacitor Android — ۲۲ نوامبر ۲۰۲۶

### صورت مسئله
اسکریپت `scripts/compress-export.mjs` در زمان اجرای `bun run build`، به ازای تمام فایل‌های استاتیک در پوشه `out/`، فایل‌های جانبی فشرده‌شده با الگوریتم‌های Brotli (`.br`) و Gzip (`.gz`) تولید می‌کرد تا در سرویس‌دهی وب استاتیک مورد استفاده قرار گیرند.
اما در زمان اجرای `cap sync android` یا بیلد APK با Gradle، پلتفرم Capacitor تمام محتویات `out/` را عینا به عنوان دارایی‌های اندروید (`android/app/src/main/assets/public/`) کپی می‌کند. در نتیجه:
- فایل‌های `.br` و `.gz` به همراه فایل خام در دارایی‌های اندروید کپی می‌شدند.
- مرحله `mergeDebugAssets` در Gradle دچار تداخل نام و سربار حجم غیرضروری می‌شد، در حالی که WebView محلی اندروید این سایدکارهای فشرده‌سازی سرور وب را مصرف نمی‌کند.

### راه‌حل و تغییرات اعمال‌شده
1. **تنظیم متغیر محیطی در `package.json`:**
   دستور `android:apk` به `CAPACITOR_BUILD=true bun run build && bun run android:sync && cd android && ./gradlew assembleDebug` ارتقا یافت.
2. **پاکسازی خودکار سایدکارها در `scripts/compress-export.mjs`:**
   تابع `removeCompressedSidecars(dir)` اضافه شد که در صورت وجود `process.env.CAPACITOR_BUILD === "true"`، فایل‌های `.gz` و `.br` را از `out/` حذف کرده و از تولید مجدد آن‌ها صرف‌نظر می‌کند.

### وضعیت
- [x] حذف سایدکارهای فشرده‌سازی در زمان بیلد اندروید پیاده‌سازی شد.
- [x] رفع برخورد Assetها در Gradle و تایید کاهش سربار بیلد.
- [ ] تست نصب و اجرای APK بدون سایدکارها روی گوشی واقعی.
