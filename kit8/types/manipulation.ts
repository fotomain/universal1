import { DATA_ORIGIN_TYPE, DataOriginType } from "./origin";

// 1. Add `as const` so TypeScript infers literal string types instead of generic `string`
export const DATA_MANIPULATION_TYPE = {
    YOUTUBE_TO_GOOGLE_DRIVE: "YOUTUBE_TO_GOOGLE_DRIVE",
    YOUTUBE_TO_DOWNLOAD: "YOUTUBE_TO_DOWNLOAD",
    FILE_TO_GOOGLE_DRIVE: "FILE_TO_GOOGLE_DRIVE",
    WEB_PAGE_TO_GOOGLE_DRIVE: "WEB_PAGE_TO_GOOGLE_DRIVE",
} as const;

// 2. Derive the Union Type of the VALUES
export type DataManipulationType = typeof DATA_MANIPULATION_TYPE[keyof typeof DATA_MANIPULATION_TYPE];

// 3. Derive the Union Type of the KEYS
export type DataManipulationTypeKey = keyof typeof DATA_MANIPULATION_TYPE;

// 4. Derive the Type/Interface representing the entire object shape
export type DataManipulationTypeObject = typeof DATA_MANIPULATION_TYPE;

