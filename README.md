# LowBlock

LowBlock is a bilingual football score-prediction application for the web, Telegram Mini Apps, and Bale Mini Apps. Predictions have no monetary value and are not betting.

## Local development

1. Run `pnpm install`.
2. Copy `.env.example` to `.env.local` and configure MongoDB and the required secrets.
3. Run `pnpm dev`.
4. Import/synchronize the current season with `pnpm sync:season`.
5. Validate imported data with `pnpm data:check`.

Use `pnpm lint && pnpm test && pnpm build` before publishing.

## One user across web, Telegram, and Bale

The `users` collection remains the canonical account store. Predictions, leaderboard data, avatars, and profile settings always reference its `_id`. Messenger accounts are stored separately in `externalIdentities`:

- `(provider, providerUserId)` is unique, so one Telegram or Bale identity cannot control two LowBlock accounts.
- `(userId, provider)` is unique, so one LowBlock account cannot accidentally link two identities from the same messenger.
- Telegram/Bale usernames are profile metadata only. They are never used to guess whether two people are the same person.
- Raw Mini App launch data is validated on the server using the bot token, a timing-safe HMAC comparison, and a short replay window.
- Bot tokens never enter the browser.

On first launch, a Mini App user chooses one of two explicit paths:

1. Create a new LowBlock account associated with that verified messenger identity.
2. Enter an existing LowBlock username/password and link the verified identity to that account.

Returning users are signed into the canonical LowBlock account automatically. A browser session that opens an unlinked Mini App can also link that verified identity to the already signed-in account. Platform-created accounts can set a password later from Profile if they also want normal website login.

Profile includes a **Connected accounts** control center. It shows Telegram and Bale connection status, opens configured Mini App deep links, disconnects identities only when another sign-in method remains, and provides an explicit duplicate-account merge flow. Merging requires both a currently signed platform launch and the destination LowBlock username/password. Predictions and all messenger identities move in one MongoDB transaction; if both accounts predicted the same match, the destination account's prediction is retained.

## Telegram Mini App setup

1. Create or select a bot in Telegram's `@BotFather`.
2. Configure the production HTTPS Vercel URL as the bot's Mini App/menu-button URL.
3. Set `TELEGRAM_BOT_TOKEN` in Vercel for Preview and Production as appropriate.
4. Redeploy. The official Telegram WebApp SDK is loaded by the root layout.

Telegram sends `window.Telegram.WebApp.initData`. LowBlock sends that untouched value to `/api/auth/mini-app`; it does not trust `initDataUnsafe`. Validation follows the official [Telegram Mini Apps authorization specification](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

## Bale Mini App setup

1. Create or select a bot using Bale's `@Bot_Father` and configure the production HTTPS URL as its web app.
2. Set `BALE_BOT_TOKEN` in Vercel.
3. If Bale's current developer panel requires an explicit WebApp SDK script, set the exact documented URL as `NEXT_PUBLIC_BALE_WEBAPP_SCRIPT_URL`. Otherwise leave it empty when the host injects `window.Bale.WebApp`.
4. Redeploy and test from the real Bale client, not only a desktop browser.

Bale's public Mini App documentation is less complete than Telegram's. This project isolates Bale behind its own adapter and token while validating the Telegram-compatible signed `initData` envelope currently exposed as `window.Bale.WebApp.initData`. Confirm the SDK URL and signing contract shown in the Bale developer panel before production launch; do not weaken or bypass validation if Bale changes that contract.

## Required production configuration

```dotenv
MONGODB_URI=...
SESSION_SECRET=...
NEXT_PUBLIC_APP_URL=https://your-domain.example
TELEGRAM_BOT_TOKEN=...
BALE_BOT_TOKEN=...
MINI_APP_AUTH_MAX_AGE_SECONDS=600
NEXT_PUBLIC_TELEGRAM_MINI_APP_URL=https://t.me/your_bot/your_app
NEXT_PUBLIC_BALE_MINI_APP_URL=...
```

Run `ensureIndexes()` during season sync/deployment initialization so the identity and session uniqueness constraints exist. Configure Vercel Preview with test bot tokens and Production with production bot tokens; never expose either token through a `NEXT_PUBLIC_` variable.

## Security and release checklist

- Both Mini Apps must use HTTPS.
- Restrict bot/web-app domains in each platform's bot settings.
- Keep the validation replay window short (the default is 10 minutes).
- Test create, existing-account link, returning sign-in, duplicate-account merge, safe disconnection, wrong password, tampered payload, and expired payload on both platforms.
- Publish this feature to `develop` first. Merge `develop` into `main` only after real-client acceptance testing.
