import {mediaPostExample} from "./lib/mediaPostExample";

const SystemMetaData:any = {
    'mediaPostReusable': {
        tableName: "mediaPostTable",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: mediaPostExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
    'mediaPostArchive': {
        tableName: "mediaPostTableArchive",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: mediaPostExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
    "raciMember": {
        tableName: "raciMemberTable",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: mediaPostExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
    // themeStore-ticket-step1: themeStore Redux entity metadata for themeStoreTable
    "themeStore": {
        tableName: "themeStoreTable",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {},
        defaultData: {
            mediaPostOwnerGUID: "",
            mediaPostGUID: "",
            mediaPostJSON: { isDark: false },
        },
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    }


}

export {SystemMetaData}