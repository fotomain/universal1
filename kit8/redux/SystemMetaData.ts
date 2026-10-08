import {mediaPostExample} from "./lib/mediaPostExample";
import {googleDriveCommandExample} from "../google/drive/googleDriveCommandExample";
import {CURRENCY_ENTITY, currenciesTable, currencyExample} from "../catalog/currency/currencyModel";
import {CURRENCY_EXCHANGE_ENTITY, currencyExchangeRateTable} from "../catalog/currency/exchange/currencyExchangeModel";
import {KANBAN_STAGE_ENTITY, kanbanStageTable, kanbanStageExample} from "../catalog/kanbanstage/kanbanStageModel";
import {PERSON_ENTITY, personsTable, personExample} from "../catalog/person/personModel";
import {PARTNER_ENTITY, partnersTable, partnerExample} from "../catalog/partner/partnerModel";
import {CONTRACT_ENTITY, contractsTable, emptyContract} from "../catalog/contract/contractModel";
import {ORGANIZATION_ENTITY, organizationTable, organizationExample} from "../catalog/organization/organizationModel";
import {COUNTRY_ENTITY, countryTable, emptyCountry} from "../catalog/country/countryModel";
import {DEPARTAMENT_ENTITY, departamentTable, emptyDepartament} from "../catalog/departament/departamentModel";
import {PROJECT_ENTITY} from "../catalog/project/projectCatalogModel";
import {PROJECT_KANBAN_STAGE_ENTITY, PROJECT_TASK_KANBAN_STATE_ENTITY, projectKanbanStageTable, projectTaskKanbanStateTable, projectTable} from "../pm/model/constants";
import {ROLE_ENTITY, rolesTable, emptyRole} from "../catalog/role/roleModel";
import {USER_ROLE_ENTITY, userRolesTable, emptyUserRole} from "../catalog/userrole/userRoleModel";
import {checkIsAppAdmin} from "../catalog/role/rolePermissions";
import {productSystemMetaData} from "../catalog/product/productMetaData";
import {TASK_EXPENSE_INPUT_ENTITY, taskExpenseInputTable, emptyTaskExpenseInput} from "../ui/components/table/reusable/example/taskExpenseInputModel";

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
    // Kanban stage catalog (kit8/catalog/kanbanstage): /kanbanstage/list + /kanbanstage/edit, the default stages
    // copied into a project's Kanban (kanban_stage_table, rowOwnerGUID = 'kanbanStageCatalog'), Supabase Realtime sync
    [KANBAN_STAGE_ENTITY]: {
        tableName: kanbanStageTable,
        itemLabel: "Kanban stage",
        // actions - see meta.actions = slice.actions;
        updateValidator: () => {
        },
        defaultData: kanbanStageExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p:any)=>{},
    },
    // TableExample2 (kit8/ui/components/table/reusable): expense lines of a task - person GUID + contract GUID + hours,
    // rowOwnerGUID = project, rowParentGUID = task, Supabase Realtime sync. Route /demo/reusabletable
    [TASK_EXPENSE_INPUT_ENTITY]: {
        tableName: taskExpenseInputTable,
        itemLabel: "Expense",
        updateValidator: () => {},
        defaultData: emptyTaskExpenseInput(),
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Product catalog (kit8/catalog/product, "W1 V3 ER DESCRIPTORS PLAN"): 17 tables - measureUnit, descriptorGenus,
    // descriptorValue, descriptorMode, descriptorDestination, descriptorPlan, productType, productFolder, product,
    // propertyValue, variant, variantValue, productPackaging, productSeries, productBarcode, priceType, productPrice.
    // Screen /catalog/product/dashboard, SQL kit8/sql/init/create_product_tables.sql, Supabase Realtime sync
    ...productSystemMetaData(),
    // Person catalog (kit8/catalog/person): /person/list + /person/edit, Supabase Realtime sync
    [PERSON_ENTITY]: {
        tableName: personsTable,
        itemLabel: "Person",
        updateValidator: () => {},
        defaultData: personExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Partner catalog (kit8/catalog/partner): /partner/list + /partner/edit, Supabase Realtime sync
    [PARTNER_ENTITY]: {
        tableName: partnersTable,
        itemLabel: "Partner",
        updateValidator: () => {},
        defaultData: partnerExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Contract catalog (kit8/catalog/contract): embedded in PersonEdit / PartnerEdit, Supabase Realtime sync
    [CONTRACT_ENTITY]: {
        tableName: contractsTable,
        itemLabel: "Contract",
        updateValidator: () => {},
        defaultData: emptyContract('partner'),
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Organization catalog (kit8/catalog/organization): /catalog/organization, Supabase Realtime sync
    [ORGANIZATION_ENTITY]: {
        tableName: organizationTable,
        itemLabel: "Organization",
        updateValidator: (action: any, state: any) => {
            const userEmail = state?.activeUserState?.activeUserEmail;
            const createdByUser = action?.payload?.rowJSON?.createdByUser;
            if (userEmail && createdByUser && userEmail.toLowerCase() !== createdByUser.toLowerCase()) {
                throw new Error(`Only the creator (${createdByUser}) has permission to edit this organization.`);
            }
        },
        defaultData: organizationExample,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Country catalog (kit8/catalog/country): /catalog/country, Supabase Realtime sync
    [COUNTRY_ENTITY]: {
        tableName: countryTable,
        itemLabel: "Country",
        updateValidator: (action: any, state: any) => {
            if (state && !checkIsAppAdmin(state)) {
                throw new Error("Only roleAppAdmin can modify countries.");
            }
        },
        defaultData: emptyCountry(),
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Role catalog (kit8/catalog/role): /catalog/role/list, roleAppAdmin only
    [ROLE_ENTITY]: {
        tableName: rolesTable,
        itemLabel: "Role",
        updateValidator: (action: any, state: any) => {
            if (state && !checkIsAppAdmin(state)) {
                throw new Error("Only roleAppAdmin can modify roles.");
            }
        },
        defaultData: emptyRole(),
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // User Role entity (kit8/catalog/userrole): /user/roles/list, roleAppAdmin only
    [USER_ROLE_ENTITY]: {
        tableName: userRolesTable,
        itemLabel: "User Role",
        updateValidator: (action: any, state: any) => {
            if (state && !checkIsAppAdmin(state)) {
                throw new Error("Only roleAppAdmin can modify user roles.");
            }
        },
        defaultData: emptyUserRole(),
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Departament catalog (kit8/catalog/departament): TabDepartaments in Organization, Supabase Realtime sync
    [DEPARTAMENT_ENTITY]: {
        tableName: departamentTable,
        itemLabel: "Departament",
        updateValidator: () => {},
        defaultData: emptyDepartament().rowJSON,
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Project catalog (kit8/catalog/project): /catalog/project, Supabase Realtime sync
    [PROJECT_ENTITY]: {
        tableName: projectTable,
        itemLabel: "Project",
        updateValidator: () => {},
        defaultData: {
            rowKind: "project",
            name: "New Project",
            durationDays: 0,
        },
        prepareCreateApi: (p: any) => {
            const item = p.action.payload || {};
            const rowGUID = item.rowGUID || item.id || "";
            return {
                newItem: {
                    ...item,
                    rowGUID,
                    treePath: rowGUID ? rowGUID.toLowerCase().replace(/-/g, "_") : undefined,
                    rowProgress: item.rowProgress ?? 0,
                },
            };
        },
        prepareReadApi: (p: any) => {},
    },
    // Project Task Kanban State (project_task_kanban_state_table): TabKanban in Project Settings, Supabase Realtime sync
    [PROJECT_TASK_KANBAN_STATE_ENTITY]: {
        tableName: projectTaskKanbanStateTable,
        itemLabel: "Task Kanban State",
        updateValidator: () => {},
        defaultData: { stageGUID: "", kanbanStageProgressPercent: 0 },
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
    },
    // Project Kanban Stage (project_kanban_stage_table): TabKanban in Project Settings, Supabase Realtime sync
    [PROJECT_KANBAN_STAGE_ENTITY]: {
        tableName: projectKanbanStageTable,
        itemLabel: "Project Kanban Stage",
        updateValidator: () => {},
        defaultData: { stageName: "New Stage", stageColor: "#3b82f6", wipLimit: 0 },
        prepareCreateApi: (p: any) => {
            return { newItem: p.action.payload };
        },
        prepareReadApi: (p: any) => {},
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
