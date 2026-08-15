# پیش‌بین

پلتفرم فارسی و امتیازی پیش‌بینی نتایج فوتبال پنج لیگ بزرگ اروپا؛ بدون شرط‌بندی و بدون ارزش مالی امتیازها.

## اجرا

1. `pnpm install`
2. `.env.example` را به `.env.local` کپی و `MONGODB_URI`، `REDIS_URL`، `RABBITMQ_URL`، `SESSION_SECRET` و `CRON_SECRET` را تنظیم کنید.
3. `pnpm dev`
4. برای ساخت ایندکس‌ها و وارد کردن فصل: `pnpm sync:season`
5. بررسی داده: `pnpm data:check`

MongoDB منبع حقیقت است؛ Redis برای cache/rate-limit و RabbitMQ برای jobهای sync و scoring استفاده می‌شوند. کلاینت Transfermarkt فقط صفحات عمومی را با cache، timeout، فاصله‌ی درخواست و تشخیص challenge می‌خواند و هرگز bypass انجام نمی‌دهد.

هر matchweek یک round است. `visibleRoundFixtures` با gap پیش‌فرض ۴۸ ساعت، بازی‌های بیش از این فاصله از anchor همان دور را کنار می‌گذارد و مقدار آن قابل تنظیم است.

امتیازدهی: دقیق ۱۰، برنده و تفاضل گل ۷، نتیجه ۵، مشارکت ۲ و بدون پیش‌بینی صفر. `pnpm lint && pnpm test && pnpm build` برای بررسی نهایی استفاده می‌شود.
