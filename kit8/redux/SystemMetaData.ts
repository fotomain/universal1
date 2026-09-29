import {mediaPostExample} from "./lib/mediaPostExample";
import {googleDriveCommandExample} from "../google/drive/googleDriveCommandExample";
import {CURRENCY_ENTITY, currenciesTable, currencyExample} from "../catalog/currency/currencyModel";
import {CURRENCY_EXCHANGE_ENTITY, currencyExchangeRateTable} from "../catalog/currency/exchange/currencyExchangeModel";
// MD.
const SystemMetaData:any = {
    // 'uploadToGoogleDriveSession': {
    'googleDriveCommand': {
        tableName: "googleDriveCommandTable",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: googleDriveCommandExample ,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
    // Currency catalog (kit8/catalog/currency): /currency/list + /currency/edit, Supabase Realtime sync
    [CURRENCY_ENTITY]: {
        tableName: currenciesTable,
        itemLabel: "Currency",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: currencyExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
    // Currency exchange rates (kit8/catalog/currency/exchange): /currency/exchange/list + /edit, one rate per
    // currency per day (rowOwnerGUID = currency, rowParentGUID = 'YYYY-MM-DD'), realtime scoped by readParams.match
    [CURRENCY_EXCHANGE_ENTITY]: {
        tableName: currencyExchangeRateTable,
        itemLabel: "Exchange rate",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: { startingDate: "2026-09-29", currencyRatio: 1 },
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
