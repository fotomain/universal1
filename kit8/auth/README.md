# kit8/auth - sign in, sign out, session

One folder per sign-in way; each holds its pure logic, its hook and its screen component together.
Routes stay in `app/user/…` (signin, forgotpassword, userprofile, …) and import from here.

| Folder | What is in it |
|---|---|
| `otp/` | Email one-time code / magic link sign-in: `emailOtp.ts` (pure Supabase calls, redirect parsing), `useEmailOtpSignIn.ts`, `SignInWithEmailOtp.tsx`, `EmailConfirmationWayRadio.tsx`; `email-templates/confirm-signup.html`, `magic-link.html` (pasted into the Supabase dashboard, they contain `{{ .Token }}`) |
| `password/` | "Forgot password": `passwordReset.ts`, `usePasswordReset.ts`, `ForgotPassword.tsx`; `email-templates/reset-password.html` |
| `google/` | Google sign-in: `useAuth.ts` (+ `.web` / `.native` / `.android`: `useAuthWithGoogle`), `SignInWithGoogleButton.tsx`, `auto_refresh_token/loginWithGoogleTokenAutoRefresh.ts` (mobile tokens through `server/auth-server.mjs`) |
| `microsoft/` | Microsoft sign-in (Supabase provider azure): `microsoftOAuth.ts`, `useAuthWithMicrosoft.ts`, `SignInWithMicrosoftButton.tsx`; README there has the Azure + Supabase setup |
| `session/` | shared by all ways: `useAuthRedirectHandler.ts` (email link / recovery deep links, mounted in `app/_layout.tsx`), `oauthRedirect.ts` (session from the url an OAuth browser tab returns), `signinDeepLink.ts` (the return link `<scheme>://signin` of a sign-in is sent to the screen `/user/signin` by `app/+native-intent.ts`; without it the 404 page shows), `useAppSignOut.ts`, `autoRefreshTokens.ts` (idle token renewal loop), `loginWithSupabaseTokenAutoRefresh.ts` (web session renewal, used by `kit8/supabase/supabase.ts` and `WithSupabase`) |
| `user/` | `userTableLogin.ts`: after sign-in the `userTable` row, the organization and the Person are made by SQL (`organization_ensure_user`, `person_ensure_user`) |

Rules
- A new sign-in way (Microsoft, Apple …) gets its own folder with the same shape; what two ways share goes to `session/`.
- `session/` imports `otp/` and `password/` only for URL parsing (`useAuthRedirectHandler`); `otp/` and `password/` import the redirect publishers from `session/`. Do not import a screen component from `session/`.
- Tests mirror the folders: `__tests__/auth/{otp,password,user}`.
- **One sign-in at a time** (`app/user/signin/index.tsx`): `busy` = Google loading OR Microsoft loading OR the email code being sent / verified (`SignInWithEmailOtp` reports it through `onBusyChange`) OR the password sign-in running. While `busy`, every other button and input of the screen is disabled (the Google / Microsoft buttons, the email form through its `disabled` prop, the password inputs, Sign in, Forgot password, the mode toggle). Tests: `__tests__/auth/signinBusy.test.tsx`, `__tests__/auth/otp/signInWithEmailOtpDisabled.test.tsx`.


## Supabase URL Configuration (Authentication -> URL Configuration) - REQUIRED for every sign-in

A sign-in on the web sends `redirectTo = <origin of the page>/user/signin` (Google: `google/useAuth.web.ts`, Microsoft: `microsoft/useAuthWithMicrosoft.ts`; the e-mail link and the password reset use `<origin>/...` too). Supabase accepts a `redirectTo` ONLY when it matches the **Redirect URLs** list; otherwise it silently falls back to the **Site URL** - with a Site URL of `http://localhost:8081` the user came back from Google to a dead `localhost:8081/#access_token=...` page ("refused to connect", 2026-11-26). `*` matches one label (no `.` or `/`), `**` matches anything.

| Setting | Value |
|---|---|
| **Site URL** | `https://project-budget-management.expo.app` (the production site: the fallback must never be localhost) |
| Redirect URLs | `http://localhost:*/**` (any local port: `npm run web` = 8088, 8081, 8089 ...) |
| | `http://127.0.0.1:*/**` |
| | `https://*.expo.app/**` (every EAS web deploy: `<slug>.expo.app` and the preview `<slug>--<id>.expo.app`) |
| | `projectbudgetmanagement://**` (appPM80 native sign-in = `extra.authScheme`) |
| | `myapp://**` (the older apps) |

A custom domain for a site needs its own `https://<domain>/**` line. After a change nothing is redeployed: it is a Supabase setting only.
