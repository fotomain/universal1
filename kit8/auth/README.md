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
