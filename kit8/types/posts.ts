
// ✅ Works with direct string constant lookup:

import {DataManipulationType} from "./manipulation";
import {DataOriginType} from "./origin";
export * from "./dataManipulationVariants";

export type MediaPostJSONType = {
    dataManipulationName: DataManipulationType;
    dataOriginName: DataOriginType;
    [key: string]: any;
};

export const genericMediaPostSQLite = {
    orderInList: "number",
    rowGUID: "string",
    rowOwnerGUID: "string",
    rowJSON: "json",
} as const;


export const genericMediaPostSupabase = {
    orderInList: "number",
    rowGUID: "string",
    rowOwnerGUID: "string",
    rowJSON: "json",
} as const;

export type SchemaTypeMap = {
    string: string;
    number: number;
    json: MediaPostJSONType;
};

export type MediaPostSQLiteType = {
    [K in keyof typeof genericMediaPostSQLite]:
    SchemaTypeMap[typeof genericMediaPostSQLite[K]];
};

export type MediaPostSupabaseType = {
    [K in keyof typeof genericMediaPostSupabase]:
    SchemaTypeMap[typeof genericMediaPostSupabase[K]];
};