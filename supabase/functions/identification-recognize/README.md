# identification-recognize - Google AI (Gemini) reads the photo of an identity document

Used by the Identification flow (`kit8/ui/components/media/nfc/identification`) when the app has **no Google AI key of its own**. With the key in the app
(`.env GOOGLE_AI_API_KEY`, see below) the app calls the Gemini API **directly** and this function is not used. Both ways use the SAME prompt, schema and cleaning (`handler.ts`).

## Two ways to call Google AI

| | Direct from the app (chosen first) | Through this Edge Function |
|---|---|---|
| Key | `.env GOOGLE_AI_API_KEY` -> `app.config.js` `extra.googleAiApiKey` -> **inside the app** (can be read out of the apk / bundle) | Supabase secret `GOOGLE_AI_API_KEY` (never in the app) |
| Who may use it | everybody who has the app | signed-in users only (the function asks for the JWT) |
| Setup | restart Metro / rebuild after the `.env` change | deploy + one secret (below) |
| Good for | testing, a private build | production |

**If the key stays in the app:** restrict it in Google AI Studio / Google Cloud (allowed API = Generative Language API, a daily quota, an Android package + SHA-1 restriction where Google offers it) and rotate it if the app is published.

## Setup

1. `.env` (you edit it; Claude does not): `GOOGLE_AI_API_KEY=<key>` and, optionally, `GOOGLE_AI_MODEL=<Gemini model id>` (default `gemini-flash-lite-latest`: about 2 s; the `gemini-flash-latest` alias took minutes or answered 503 "high demand" when measured on 2026-11-19; other Flash ids such as `gemini-2.5-flash` can be set here).
2. Direct call: restart Metro with a cleared cache (`npx expo start --web -c`) or rebuild the phone app: `extra` is read from `app.config.js`.
3. Everything at once (secrets from `.env`, all functions, SQL, checks): `./supabase/deploy_all.command` (`--dry` first). Or only this function by hand (optional, for production):
```bash
supabase functions deploy identification-recognize
```
```bash
supabase secrets set GOOGLE_AI_API_KEY="$(grep '^GOOGLE_AI_API_KEY=' .env | cut -d= -f2-)"
```
Supabase functions do not read `.env`: the secret is the same value, set once.

## What is sent where

- The app sends ONE photo of the document (JPEG, at most 2000 px, about 0.3 - 1 MB), only after the user switched **Read with Google AI** on (an opt-in kept on the device).
- Google receives the photo and the fixed prompt (`SYSTEM_PROMPT` in `handler.ts`); it answers JSON by schema: the zone lines, number, dates, names, a CAN when printed.
- The function / the app never store the photo or the answer and never log them; the key goes in the `x-goog-api-key` header, never in a URL or an error text.
- **Google's own terms for the Gemini API apply** (whether the content may be used to improve Google products depends on the plan / billing of the key: check the current terms before you use real documents; I could not confirm them).
- The answer is NOT trusted blindly: the zone goes through the check digits (`aiResult.ts`, `mrzFromText.ts`); a value Google AI got wrong is shown as "not checked", and the NFC scan starts only after the user confirms the values.

## Two jobs

- **photo** - `{ image, mime, documentType }`: Google AI reads the picture (the zone, the printed fields).
- **text** - `{ text: string[], documentType }` (added 2026-11-19): the app sends the lines this phone already recognised, NO picture (`textPrompt`): for the FRONT of an ID card, which has no zone. At most 120 lines / 8000 characters. The answer has the same fields plus `canCandidate` (a lone unlabelled 6-digit number: maybe the CAN).

## The prompt

Fixed on the server side of the code (`handler.ts`): copy what is printed, never guess, return null when unreadable, the zone lines exactly with `<`, O/0 I/1 B/8 S/5 care, dates as YYYY-MM-DD, the CAN only when clearly labelled, country codes as in the MRZ, no text outside the JSON. The app sends no prompt text, so the function cannot be used as a free general proxy.

## Errors (`code`)

`auth` (not signed in) · `not-configured` (no key on the server) · `bad-request` · `too-big` · `rate` (quota / busy) · `key` (the key was refused) · `blocked` (Google refused the picture) · `not-json` · `upstream`.

Tests: `__tests__/media/identificationFunction.test.ts` (handler with doubles), `aiRecognize.test.ts` (the direct call and the function path of the app), `aiResult.test.ts`, `identificationFlow.test.tsx`.
