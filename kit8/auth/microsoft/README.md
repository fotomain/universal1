# kit8/auth/microsoft - Sign in with Microsoft

Supabase OAuth provider **azure**. Files: `microsoftOAuth.ts` (provider name, scope, arguments; pure), `useAuthWithMicrosoft.ts` (hook: `{ loading, error, signIn }`), `SignInWithMicrosoftButton.tsx` (look of the Google button, logo drawn with Views). Mounted in `app/user/signin/index.tsx` under the Google button; the text is `screens.signInWithMicrosoft` (English; other languages fall back).

How it works
- web: `signInWithOAuth({ provider: 'azure', options: { redirectTo: <origin>/user/signin, scopes: 'email' } })`; supabase-js reads the `?code=` when the page comes back.
- iOS / Android: the same way as Google on native: `skipBrowserRedirect`, `WebBrowser.openAuthSessionAsync` to `myapp://signin`, then `session/oauthRedirect.ts` (`sessionFromOAuthRedirect`) makes the session.
- The user is not kept in this hook: the session raises SIGNED_IN, and the Sign in screen reacts to it (its Google hook hears every provider). `userTableLogin` then makes the `userTable` row / organization / Person as for any sign-in.

Setup (by hand, once; done 2026-11-11 for the project `expo-w1-project`)
1. Azure portal (a free Azure account makes the "Default Directory" that App registrations needs) > Microsoft Entra ID > App registrations > New registration. Supported accounts: **Any Entra ID Tenant + Personal Microsoft accounts**. Redirect URI (Web): `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Certificates & secrets > New client secret. Copy the **Value** at once (it is shown only until the page is left). It expires (24 months chosen): make a new one before that date, paste it in Supabase.
3. Supabase > Authentication > Sign In / Providers > Azure: client id = Application (client) ID, secret = the Value, Azure Tenant URL = `https://login.microsoftonline.com/common`.
4. Supabase > Authentication > URL Configuration > Redirect URLs must hold the web origin with a wildcard (`http://localhost:8088/**`, the deployed site `…/**`) and, for the native apps, `myapp://**` (the scheme of `redirectTo` above, listed in `app.config.js`).

Problems
- "Unsupported provider: provider is not enabled": the Azure provider is off in Supabase.
- Signed in but no email / "Error getting user email from external provider": Azure sends no email. Entra ID > the app > Token configuration > add the optional claim `email` (ID token).
- Users of work / school tenants may be refused consent until the app has a verified publisher (Azure warning on the app page); personal Microsoft accounts are fine.
- Tests: `__tests__/auth/microsoft`, `__tests__/auth/session/oauthRedirect.test.ts`. Not tested: the real round trip with Microsoft (needs a browser and an account).
