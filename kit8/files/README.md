# kit8/files - file attachments (Google Drive, way C)

Design: `documentation/FILE_ATTACHMENT_WBS.html` (v7) · Google facts and the live tests: `documentation/Goolge/GOOGLE_DRIVE_HOW_IT_WORKS.html` · server: `supabase/functions/files-drive` · SQL: PART 49.

One Google account per organization (the administrator connects it once); the Edge Function keeps its token, refreshes it by itself and does every Drive call. The app never holds a Google token.
A file is a row of `mediaPostTable` with `rowJSON.fileSourceKind`; a post outside a project is the author's only (see PART 49).

## What is built (first full slice)
| piece | file |
|---|---|
| pure model: kinds, sizes, chunks (256 KB multiples), project switch, sentences | `fileModel.ts` |
| calls to the function and the `files_` RPCs, the whole upload (session -> chunks straight to Google -> finish by `uploadId`) | `filesDriveApi.ts` |
| hooks: list, may-change, Drive state, actions (plain React state + a change counter, no provider needed) | `useFiles.ts` |
| file picker (web input / expo-document-picker) | `pickFiles.ts` |
| the tab **Files** after Payments in the Finances view of a task: list, Add file, Add link, drop (web), View, Edit, Delete | `PMTaskFilesPanel.tsx` (mounted in `kit8/pm/view/task/finances/PMProjectTaskInputCRUD.tsx`) |
| the same panel with `scope` = `project` / `organization` (Project settings -> Files -> buttons **Project files** / **Organization files**); Replace (new version, S4), Versions list, Move (project / organization, S7), document type chips in Edit (S5) | `PMTaskFilesPanel.tsx` |
| Project settings -> **Files**: the switch `filesFunctionalityEnabled` + the Google Drive block (state, Connect / Reconnect / Disconnect, Run cleanup, storage used (S8), **Check files** + Repair = the health check S1); also in Organization edit -> Projects -> Settings | `kit8/pm/view/project/settings/PMProjectFilesTab.tsx`, `FilesDriveBlock.tsx` |

## Rules
- A tab and the Add actions exist only while the project switch is not false and the screen is no picker. Add / Edit / Delete show only for a holder of `projectMediaPostManager` (task scope), asked with `files_authorize`; every member reads.
- View never gives a Google link: the function signs a 10 minute link and streams the file (`Range` works). A link row opens its own address.
- Delete is permanent (the window says so) and works by the function: the row goes, the Drive file is queued and deleted at once; the database also queues the files of a deleted task / project / organization.
- Phase 1 reads a file into memory (a phone) and refuses more than 100 MB (`MAX_UPLOAD_BYTES`); chunks of 4 MB go straight to Google.
- A browser may not be able to read the answer of the LAST chunk (no CORS header): the upload finishes by the `uploadId` property the function wrote into the file.

## Not built yet (plan sections 9-11)
A dashboard of its own for the document scope, the tree column, viewers inside the app (View opens the signed link in a new tab/window: the browser shows pdf / image / text / audio / video itself), drag reorder (the RPC `files_reorder` exists),
phone upload queue (S9), recording attach (S10), template files (S11).

## Tests
`__tests__/files` (function with an in-memory Google + database, model, upload flow) · `__tests__/pm/view/task/payments/paymentsTabUi.test.tsx` (the Files tab) · Docker `tests/55_files.sql`, `56_files_rows.sql`, `57_files_more.sql`.
