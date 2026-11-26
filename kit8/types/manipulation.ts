// 1. Add `as const` so TypeScript infers literal string types instead of generic `string`
export const DATA_MANIPULATION_TYPE = {
    YOUTUBE_TO_GOOGLE_DRIVE: "YOUTUBE_TO_GOOGLE_DRIVE",
    YOUTUBE_TO_DOWNLOAD: "YOUTUBE_TO_DOWNLOAD",
    FILE_TO_GOOGLE_DRIVE: "FILE_TO_GOOGLE_DRIVE",
    WEB_PAGE_TO_GOOGLE_DRIVE: "WEB_PAGE_TO_GOOGLE_DRIVE",
    // the post is only kept as it is: the data is not downloaded and not copied anywhere (last, so the first option of every origin stays the same)
    NO_DATA_MANIPULATION: "NO_DATA_MANIPULATION",
} as const;

// 2. Derive the Union Type of the VALUES
export type DataManipulationType = typeof DATA_MANIPULATION_TYPE[keyof typeof DATA_MANIPULATION_TYPE];

// 3. Derive the Union Type of the KEYS
export type DataManipulationTypeKey = keyof typeof DATA_MANIPULATION_TYPE;

// 4. Derive the Type/Interface representing the entire object shape
export type DataManipulationTypeObject = typeof DATA_MANIPULATION_TYPE;

