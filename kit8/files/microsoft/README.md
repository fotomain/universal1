# kit8/files/microsoft - Microsoft OneDrive as the app sees it

`microsoftStorage.ts` fills in `StorageUi`: the name, the note about the whole-drive permission (Microsoft has no narrower one), the key of the file id in a file row (`oneDriveItemId`), and the warning about the
client secret of the Entra app (`secretWarnings`: none far away, "expires in N days" within 30, "expired on" after; the date is the function secret `MICROSOFT_CLIENT_SECRET_EXPIRES` shown through the status).
The Graph calls are NOT here: `supabase/functions/files-drive/oneDriveProvider.ts`. Facts: `documentation/OneDrive/ONEDRIVE_HOW_IT_WORKS.html`, plan `documentation/FILE_WITH_OneDrive_WBS.html`.
Tests: `__tests__/files/filesStorageProviderUi.test.tsx`, `oneDriveProvider.test.ts`, `filesOneDriveFunction.test.ts`.
