# kit8/files - file attachments (Google Drive and Microsoft OneDrive)

## Layout (refactored 2026-11-11)
| Folder | What is in it |
|---|---|
| `common/` | EVERYTHING the two storages share: the model (`fileModel.ts`), the calls to the function and the `files_` RPCs (`filesDriveApi.ts`), the hooks (`useFiles.ts`), the picker, the Files panel + table, the viewer, the radio set, the connection block, and the registry of the storages (`storageTypes.ts` = the shape a storage fills in, `storageProviders.ts` = the list in radio order + `storageUiOf(provider)` + `fileItemIdOf(row)`). The common code never tests for a storage by name: it asks the registry. |
| `google/` | what is Google's only (`googleStorage.ts`): the name, the note under its connection block, the key of its file id in a file row (`googleDriveFileId`), no warnings. |
| `microsoft/` | what is Microsoft's only (`microsoftStorage.ts`): the name, the whole-drive permission note, the key of its file id (`oneDriveItemId`), the warning about the client secret near its expiry (`secretWarnings`, `daysUntil`). |

A third storage = one new folder with its `StorageUi` + one line in `common/storageProviders.ts` (and its adapter in the Edge Function, `supabase/functions/files-drive`). The Edge Function keeps its own layout (`provider.ts`, `googleProvider.ts`, `oneDriveProvider.ts`).
Routes: `app/files/view` (the viewer), `app/user/files` (the page the consent comes back to).


Design: `documentation/FILE_ATTACHMENT_WBS.html` (v7) · Google facts and the live tests: `documentation/Goolge/GOOGLE_DRIVE_HOW_IT_WORKS.html` · server: `supabase/functions/files-drive` · SQL: PART 49.

One Google account per organization (the administrator connects it once); the Edge Function keeps its token, refreshes it by itself and does every Drive call. The app never holds a Google token.
A file is a row of `mediaPostTable` with `rowJSON.fileSourceKind`; a post outside a project is the author's only (see PART 49).

## What is built (first full slice)
| piece | file |
|---|---|
| pure model: kinds, sizes, chunks (256 KB multiples), project switch, sentences | `common/fileModel.ts` |
| calls to the function and the `files_` RPCs, the whole upload (session -> chunks straight to Google -> finish by `uploadId`) | `common/filesDriveApi.ts` |
| hooks: list, may-change, Drive state, actions (plain React state + a change counter, no provider needed) | `common/useFiles.ts` |
| file picker (web input / expo-document-picker) | `common/pickFiles.ts` |
| the LIST of the panel: a `ReusableTable` in **local rows mode** (`localRows`, `readOnly`, no selection / row menu / CRUD panel / own search) with the columns Kind icon · Name · Size · Actions (history, open, replace, move, edit, delete - `custom` cells holding `PMIconButton`s) · Details (document type, paper place, version) | `common/FilesTable.tsx` |
| the tab **Files** after Payments in the Finances view of a task: **search by name**, the table, Add file, Add link, drop (web), View, Edit, Delete | `common/PMTaskFilesPanel.tsx` (mounted in `kit8/pm/view/task/finances/PMProjectTaskInputCRUD.tsx`) |
| the same panel with `scope` = `project` / `organization` (Project settings -> Files -> buttons **Project files** / **Organization files**); Replace (new version, S4), Versions list, Move (project / organization, S7), document type chips in Edit (S5) | `common/PMTaskFilesPanel.tsx` |
| Project settings -> **Files**: the switch `filesFunctionalityEnabled` + the Google Drive block (state, Connect / Reconnect / Disconnect, Run cleanup, storage used (S8), **Check files** + Repair = the health check S1); also in Organization edit -> Projects -> Settings | `kit8/pm/view/project/settings/PMProjectFilesTab.tsx`, `common/FilesDriveBlock.tsx` |

## The list and the search
- The rows come from the RPC `files_list` (`useFilesList`) and every change is an RPC, so the table is a read only VIEW of them: `localRows` (no Supabase table / redux entity / realtime of its own; the panel re-reads after every action through `bumpFiles`), `readOnly`, the row menu and the table's own search are off. The action buttons are `custom` cells because the actions are not table edits (Replace = upload, Move = another scope, Edit = a form, Delete = ask + function). Row test ids: `<testID>-table-row-<guid>`, buttons `<testID>-view|replace|move|edit|delete|versions-button-<guid>`.
- The **search field** (`<testID>-search`, a `TextInputApp` with its Clear x) shows above the table while the scope has files. `filterFilesByName` (`common/fileModel.ts`): case-insensitive substring, live, of the name the user sees, of the original file name (a renamed file) and of the title - or the address while it has no title - of a link; the order is kept. Nothing matches: the text `No files match "..."` (`<testID>-no-match`) replaces the table. The column headers of Name / Details also sort and filter (table feature).
- The older versions of a file (history button) show in a block under the table, one file at a time.

## Rules
- A tab and the Add actions exist only while the project switch is not false and the screen is no picker. Add / Edit / Delete show only for a holder of `projectMediaPostManager` (task scope), asked with `files_authorize`; every member reads.
- View never gives a Google link: the function signs a 10 minute link and streams the file (`Range` works). A link row opens its own address.
- Delete is permanent (the window says so) and works by the function: the row goes, the Drive file is queued and deleted at once; the database also queues the files of a deleted task / project / organization.
- Phase 1 reads a file into memory (a phone) and refuses more than 100 MB (`MAX_UPLOAD_BYTES`); chunks of 5 MiB (`UPLOAD_CHUNK_BYTES` = 20 x 256 KiB = 16 x 320 KiB, so the SAME size is valid for Google and for OneDrive) go straight to the storage.
- A browser may not be able to read the answer of the LAST chunk (no CORS header): the upload finishes by the `uploadId` property the function wrote into the file.

## Not built yet (plan sections 9-11)
A dashboard of its own for the document scope, the tree column, viewers inside the app (View opens the signed link in a new tab/window: the browser shows pdf / image / text / audio / video itself), drag reorder (the RPC `files_reorder` exists),
phone upload queue (S9), recording attach (S10), template files (S11).

## Tests
`__tests__/files` (function with an in-memory Google + database, model + `filterFilesByName`, upload flow; `filesPanelList.test.tsx` + `filesPanelTestKit.tsx` = the table, the actions and the search) · `__tests__/pm/view/task/payments/paymentsTabUi.test.tsx` (the Files tab) · Docker `tests/55_files.sql`, `56_files_rows.sql`, `57_files_more.sql`.


## Two storages: Google Drive and Microsoft OneDrive (OD1-OD6, 2026-11-11)
Plan and facts: `documentation/FILE_WITH_OneDrive_WBS.html`, `documentation/OneDrive/ONEDRIVE_HOW_IT_WORKS.html` (spike OD0). The setting **`organizationFilesStorageProvider`** (`googleDrive` | `oneDrive`, a missing value = googleDrive; `organizationTable.rowJSON`) is ONE storage for ALL projects of the organization (it also decides the organization, document and chat files):
**Organization edit -> Files** (`common/OrganizationFilesTab.tsx`): the radio set `FilesStorageProviderRadio` (a storage the server has no client id for is disabled with its hint; saved with the Save button of the form, only the administrator changes it)
and the connection block of the CHOSEN storage (`FilesDriveBlock provider=...`: state, account, Connect / Reconnect / Disconnect, storage used, Check files, the Microsoft client secret expiry warning, the whole-drive permission note), one line for the other
storage, and the button **Organization files**. A change in an organization WITH files asks first ("N files stay in X. New files will be stored in Y."); nothing is moved. SQL `files_provider_of_scope` reads only this key (the first version's per-project key
`projectFilesStorageProvider` and its Organization default are no longer read: a project that had OneDrive chosen now follows the organization). **Project settings -> Files** (`PMProjectFilesTab`) keeps only the per-project switch
`filesFunctionalityEnabled` + the button Project files; the Files panel of a task gets the storage of the organization (`useOrganizationFilesProvider`).
Every file row says its storage (`rowJSON.fileStorageProvider`, missing = googleDrive; OneDrive keys `oneDriveItemId / FolderId / RelativePath / WebUrl`); View, Replace, Move, Delete and the cleanup always use the storage of the ROW. The Files panel gets `provider` (the storage of the scope),
reads that storage's status, and tags a file of the other storage in its Details only while the list is mixed. The upload is the same for both (5 MiB fragments, no token on the session url, 202 or 308 = send the next fragment); the app reads the driveItem of the last answer and sends its `id` as `itemId`
to `upload_finish` / `replace_finish` (OneDrive verifies folder + size; Google ignores it). Tests: `__tests__/files/filesStorageProviderUi.test.tsx`, `filesModelAndApi.test.ts` (OneDrive section).
