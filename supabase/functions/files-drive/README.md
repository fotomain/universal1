# files-drive (Edge Function) - the one place that talks to Google Drive

Way C of `documentation/FILE_ATTACHMENT_WBS.html` (sections 3, 4, 13): the administrator of an organization connects ONE Google account; this function keeps the account's
refresh token (encrypted), refreshes the one hour access token by itself, checks the caller and does every Drive call with the narrow scope `drive.file`.
Members never sign in to Google. Facts about Drive: `documentation/Goolge/GOOGLE_DRIVE_HOW_IT_WORKS.html` (live test of 2026-11-11, 12 of 13 PASS).

## Status: first full slice (2026-11-11)
Built: connect (`connect_start` + the Google redirect), `status`, `upload_session` (resumable, `Origin` passed on, folder chain with marks, folders cached in `files_folder_table`, a pending upload),
`upload_finish` (finds the file by its `uploadId`, the database verifies and registers it: `files_add`), `download_url` + signed `download` with `Range`, `delete_file` (row + queue + cleanup at once),
`cleanup` (the queue, bottom-up; after an organization delete the token is revoked and forgotten; the pg_cron tick uses `x-files-cleanup-secret`), `disconnect`; token cache + auto refresh + `needsReconnect`.
Every action starts with `files_authorize` (the caller's JWT): `projectMediaPostManager` for files of a project / task, `projectFileManager` for the organization / documents / the connection, members read.
Also built: `replace_session` / `replace_finish` (new version, the old revision kept), `move`, `health` / `health_repair`, the storage limit in `upload_session`. Not yet: copy, template files (plan section 11).

## Files
`handler.ts` (pure logic, Jest-tested with an in-memory Google: `__tests__/files`) · `googleDrive.ts` (REST calls) · `token.ts` (refresh) · `crypto.ts` (AES-GCM, HMAC) · `index.ts` (Deno wiring).
SQL: PART 49 first slice - `files_google_connection_table` (no client can read it) and `files_connection_status()`; Docker `tests/55_files.sql`.

## Secrets and deploy (do it yourself)
```bash
supabase secrets set GOOGLE_DRIVE_CLIENT_ID=<client id of "Files Drive (Edge Function)">
supabase secrets set GOOGLE_DRIVE_CLIENT_SECRET=<its client secret>
supabase secrets set FILES_TOKEN_KEY=$(openssl rand -base64 32)
supabase secrets set FILES_URL_SECRET=$(openssl rand -base64 32)
supabase secrets set FILES_APP_RETURN_URL=https://<your app url>/user/files
supabase functions deploy files-drive --project-ref <project ref>
```

## JWT check (a decision for the owner)
By default Supabase's gateway rejects every request without an `Authorization: Bearer <JWT>` header (HTTP 401, checked 2026-11-11 on the deployed function). That is fine for the app's POST calls, but **Google's redirect** (`GET ?code&state` after the consent page) and a **`<video src>` / `<img src>`** (`GET ?sig=...`) send no header, so Connect and viewing would fail. Two ways:
1. Deploy with `--no-verify-jwt`: the gateway lets every request through and the function checks itself - the Supabase JWT (`auth.getUser`) for every POST, the HMAC-signed state (10 minutes) for the Google redirect, the HMAC-signed link (10 minutes) for a download. Anyone can then call the url, but only a valid JWT, state or signature gets anything.
2. Keep the JWT check and change the design: the Google redirect lands on a page of the app (which has the user's session) and that page calls the function with `code` + `state`; viewing files uses a fetch with the header and a blob url (no `Range` seeking for large video).
The plan assumes 1.
Google redirect (already registered): `https://<project>.supabase.co/functions/v1/files-drive`. Keep `FILES_TOKEN_KEY` safe: without it the stored refresh tokens cannot be read (reconnect fixes that).

## Actions (POST, JSON, `Authorization: Bearer <Supabase access token>`; the organization is the one the database says)
`connect_start` -> `{ url }` (open it) · `status` -> `{ state, accountEmail, rootFolderUrl, cleanup }` · `upload_session { scope: organization|project|task|stage|document, guid, projectGUID, name, mime, size }` -> `{ sessionUrl, uploadId, path }`
· `upload_finish { uploadId, file: { title, ... } }` -> `{ file }` · `download_url { postGUID }` -> `{ url }` (valid 10 minutes, `GET` with `Range`) · `delete_file { postGUID }` · `cleanup` (holder of `projectFileManager`, or the secret header) · `disconnect`.
`GET ?code&state` is the Google redirect; `GET ?org&file&exp&sig` is the signed download.

## The pg_cron tick (optional, start3)
`files_cleanup_tick` calls `files_cleanup_poke()` every minute; it posts to this function with the header `x-files-cleanup-secret` when waiting lines exist. Needs pg_net and, once:
```sql
ALTER DATABASE postgres SET app.settings.files_function_url = 'https://<project>.supabase.co/functions/v1/files-drive';
ALTER DATABASE postgres SET app.settings.files_cleanup_secret = '<the same value as the function secret FILES_CLEANUP_SECRET>';
```
Without it the delete of a file / task works anyway through `delete_file` and the Run cleanup button.

## Second spike (F0b)
`documentation/Goolge/f0/`: `f0b_trash_folder.sh` (folder trash / delete with `drive.file`), `f0b_cors_test.html` (a browser PUT to the session url), `f0b_stream_test.sh` (a 200 MB download through the function, timed).


## Storage providers (OD1, 2026-11-11)
`handler.ts` and `token.ts` talk ONLY to the `StorageProvider` interface of `provider.ts` (sign-in url / code exchange / refresh / revoke, root + folders, items, upload and update sessions, media, versions, move, delete). `googleProvider.ts` is the Google Drive adapter (the code that was inside the handler, moved with no change of behaviour; `googleDrive.ts` = its REST calls). The handler gets the adapter from `deps.providers.googleDrive` (default: built from `fetchFn`); a refresh answer that carries a NEW refresh token (a storage that rotates it, OneDrive) is stored through `deps.saveRefreshToken`. OneDrive = `oneDriveProvider.ts` (task OD2, `documentation/FILE_WITH_OneDrive_WBS.html`). Tests: `__tests__/files/storageProvider.test.ts` (the adapter's rules, the token cache with a rotating stub, the handler with a stub provider) + the unchanged `filesDriveFunction.test.ts`.

## Microsoft OneDrive (OD2 + OD3, 2026-11-11)
`oneDriveProvider.ts` = the Microsoft Graph adapter (delegated `Files.ReadWrite offline_access User.Read`; upload session on a folder with `conflictBehavior=rename`; update session on an item id = a new version; permanentDelete takes a folder with content in one call; download through
`@microsoft.graph.downloadUrl` with Range; the refresh token ROTATES - `token.ts` stores the new one through `deps.saveRefreshToken`; Retry-After of a 429 is waited for; "ours" = the item lies under kit8root of the connected account). The handler resolves the storage PER REQUEST:
`files_authorize` returns `provider` (project setting / organization default) for upload_session; the pending upload, the file row (`fileStorageProvider`) and the queue line carry it; connect_start / status / disconnect / health take `provider` in the body (status `all` = both);
the consent `state` names the storage; a signed download link of a OneDrive file also signs `prov` and `ct` (the content type the browser should get when OneDrive answers octet-stream). Secrets: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` (default common),
`MICROSOFT_CLIENT_SECRET_EXPIRES` (YYYY-MM-DD, shown as a warning 30 days before). The Web redirect uri of the Entra app = the url of this function. Connection tables: `files_google_connection_table`, `files_onedrive_connection_table`.
Tests: `oneDriveProvider.test.ts` (adapter + `filesGraphTestKit.ts`, an in-memory Graph), `filesOneDriveFunction.test.ts` (the handler with OneDrive and Google side by side), `storageProvider.test.ts`, Docker `tests/58_files_onedrive.sql`.

## The scope chat (SQL PART 50, 2026-11-11)
`files_authorize` answers for the scope `chat` (guid = the theme) with `chatKind` (`user` | `task`), `chatRefGUID` (the user guid of Main / the task guid) and `maxBytes` (the organization limit of a chat attachment). `chainFor` makes `chat/user/<userGUID>/theme/<themeGUID>/files` or `chat/task/<taskGUID>/theme/<themeGUID>/files`; the folder key is `chat:<themeGUID>`; `upload_session` refuses a size above `maxBytes` (413, code `chatFileTooBig`) before a session opens. REDEPLOY the function after this change.
