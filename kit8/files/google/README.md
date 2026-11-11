# kit8/files/google - Google Drive as the app sees it

`googleStorage.ts` fills in `StorageUi` (see `../common/storageTypes.ts`): the name, the note under the connection block, the key of the file id in a file row, and no warnings of its own.
The Google calls are NOT here: they are in the Edge Function (`supabase/functions/files-drive/googleProvider.ts`, scope `drive.file` only). Facts: `documentation/Goolge/GOOGLE_DRIVE_HOW_IT_WORKS.html`.
Tests: `__tests__/files/filesStorageProviderUi.test.tsx` (the registry), `filesDriveFunction.test.ts` (the function with a fake Google).
