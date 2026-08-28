import {mediaPostExample} from "./lib/mediaPostExample";
import {uploadToGoogleDrivePostExample} from "./lib/uploadToGoogleDrivePostExample";
// MD.
const SystemMetaData:any = {
    // 'uploadToGoogleDriveSession': {
    'uploadToGoogleDriveData': {
        tableName: "uploadToGoogleDriveSessionTable",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: uploadToGoogleDrivePostExample ,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
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
            rowOwnerGUID: "",
            rowGUID: "",
            rowJSON: { isDark: false },
        },
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    }


}

export {SystemMetaData}
