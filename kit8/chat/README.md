# kit8/chat - the chat (BUILT 2026-11-11)

Design and the owner's decisions: `documentation/CHAT_WBS.html`. SQL: PART 50 (`kit8/sql/start`). Docker test `kit8/docker/tests/59_chat.sql`. Routes: `app/chat` (`/chat` = the list, `/chat/theme?themeGUID=...|taskGUID=...` = one theme).

## The model
`chatObject` (a user = **Main**, or ONE task) -> `chatTheme` -> messages; the members of a theme are `chatMembersTable` rows. Tables (universal schema, `rowGUID` / `rowJSON`): `chatObjectTable`, `chatThemeTable`, `chatMembersTable`, `chatMessagesTable`.
A client only READS them (RLS: the themes where the user has a member row; a task chat of a project with `chatFunctionalityEnabled = false` is hidden, nothing deleted). Every write is a `chat_` RPC (`chatApi.ts`).

| Scenario | How |
|---|---|
| Main + a theme of the user | Drawer **Chat** -> `ChatListScreen` -> **New theme** (`ChatNewThemeWindow`: Title, Description, Message, members - may be none) = `chat_theme_create` |
| The chat of a task | Task menu -> Create based on this -> **Chat**, or the icon **Go to Chat** of the task CRUD toolbar = `chat_task_ensure(task)`: the first call makes it, later calls open it; a NEW browser window on the web, a route on a phone (`useOpenTaskChat`, `chatNavigation.ts`) |
| Title / description of a task chat | NEVER copied: title = `projectInnerPrefix` + a space + the task text (`chat_task_title`, `chatTaskTitle`), description = the task `notes`; the theme view reads the task row live (`useChatTaskLive`, realtime) |
| The cursor | `ChatMessageInput` focuses its field when the theme opens and after every send |

## Members (owner's answers, 2026-11-11)
- A task chat: the members are the **users of the Time lines of the task (RACI column, every item)** and they follow the Time lines AUTOMATICALLY: statement triggers on `task_line_table` (`trg_task_line_chat_*` -> `chat_task_sync_members`), also at every `chat_task_ensure`. The creator is the owner. A member from the RACI is removed by changing the RACI, not by hand.
- Add a member: the owner of the theme, a project manager or an administrator (`chat_member_add`). **Exclude a member: ONLY a project manager or an administrator** (`chat_member_remove`, `chat_can_manage`); the owner stays; nobody leaves by himself.
- Who can be picked: the ACTIVE members of the organization (`chat_member_candidates`).

## Files = the file attachments (kit8/files), scope `chat`
A file belongs to the THEME (a row of `mediaPostTable`, `fileSourceKind = chat`); a message keeps a REFERENCE `{ fileGUID, url, name, size, mime }` where `url` is the viewer (`/files/view?post=<guid>`, `fileViewerUrl`). The same file is attached many times without a copy (the input lists the files of the theme). Name, size and type of a reference are taken from the file row by the database.
Storage folder: **`chat/user/<userGUID>/theme/<themeGUID>/files`** (Main) and **`chat/task/<taskGUID>/theme/<themeGUID>/files`** (a task chat) - `chainFor` of `supabase/functions/files-drive/handler.ts`. The storage is the one of the project (task chat) or the organization default (Main). Who changes a file: the uploader, the owner of the theme, a project manager, an administrator (`chat_file_manage_check`). Deleting a message keeps its files; deleting a file leaves the references ("file deleted").
Limit: `organizationTable.rowJSON.maximumChatAttachmentFileSize` (MB, whole number 1..100, default 10); checked by the app, by the function (before a session opens) and by `files_add`. Changed only by a project manager or an administrator, through `chat_set_max_attachment_size` (Organization edit -> tab **Chat**, `OrganizationChatSection`).

## Links
A message holds text and/or separate links (`rowJSON.urls`) and/or files. A url inside the text is found when it is shown (`splitTextWithLinks`). Only http(s) and an address of this app are links (`isSafeLink`; the database checks again). Web: a new browser window; phone: a route (own address) or the system browser (`openChatLink`).

## Realtime and the red number
Redux entities `chatObjectReusable / chatThemeReusable / chatMemberReusable / chatMessageReusable` (`chatMetaData.ts`, registered in `SystemMetaData`) + `useRealtimeEntity`: the open theme is a scoped list of messages; theme and member rows are the signal to read the RPCs `chat_theme_list` / `chat_unread_counts` again (`useChatLiveSignal`). `ChatBadge` sits in `ApplicationBarApp` right before the three dots menu; it exists only while something is unread. A theme is marked read (`chat_mark_read`: `lastReadAt` = the newest message time of the server) while the screen is focused and the window visible. A message made by the client has its own id, so the echo and the realtime row are one message.

## Settings
Project settings -> **Chat** (`PMProjectChatTab`): `chatFunctionalityEnabled` (TRUE by default; also an organization default); Main tab: `projectInnerPrefix` (4 letters, empty = the first 4 letters of the name). Organization edit -> **Chat**: the attachment limit.

## Not built
Push notifications / mails when the app is closed; seen-by, reactions, replies, search in messages; a chat tab in the task window; several themes in a task chat (the tables allow them); an administrator reading chats he is not in. A user who is added to the RACI before his first login joins at the next `chat_task_ensure` (the trigger knows only existing users).

## Tests
`__tests__/chat` (model, SQL scans, RPC calls, the pieces of the screens: red number, message, input with the cursor / Enter / attach limit / links) · `__tests__/files/filesDriveFunction.test.ts` (chat chain, limit) · Docker `tests/59_chat.sql` (117 checks: visibility, Main, members rules, RACI sync, unread, project switch, files scope, deletes).

## Read-only project (2026-11-12)
The chat of a task of a READ-ONLY project (`project_table.rowJSON.projectIsReadonly`, SQL PART 51, `kit8/pm/README.md`) is only read: no new task chat (`chat_task_ensure` of a task without a chat is refused), no message / edit / delete (trigger `zz_project_readonly` on `chatMessagesTable`), no member added or excluded (`project_readonly_check_theme` in `chat_member_add / _remove`), no file. The read mark (`chat_mark_read`) still works. `chat_theme_list` returns `projectIsReadonly`; `useChatTaskLive` reads it live from the project row; `ChatThemeScreen` shows the text `chat-theme-readonly` instead of the input and passes `readOnly` to `ChatMessageBubble` / `ChatMembersWindow`. The Main chat of a user has no project and is never closed.
