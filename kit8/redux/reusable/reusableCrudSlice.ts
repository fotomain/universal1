import {createSlice} from "@reduxjs/toolkit";
import {applyRealtimeChangeToList, rowIdOf, upsertRow} from "./realtimeRows";

/** Supabase Realtime state of an entity (startRealtime / stopRealtime, see reusableRootSaga). */
export type RealtimeStatus = "idle" | "subscribing" | "subscribed" | "error";


const initialState = {
    entityDataFromServer: [],
    lastCreatedData: null,
    lastUpdatedData: null,
    lastDeletedData: null,

    isCreating: false,
    isReading: false,
    isUpdating: false,
    isDeleting: false,

    createSuccessful: 0,
    readSuccessful: 0,
    updateSuccessful: 0,
    deleteSuccessful: 0,

    createErrorData: "",
    readErrorData: "",
    updateErrorData: "",
    deleteErrorData: "",

    crudMoment: 0,

    // Supabase Realtime (another browser / device changed the table -> the list follows)
    realtimeStatus: "idle" as RealtimeStatus,
    realtimeError: "",
    lastRealtimeEvent: null as null | { eventType: string; rowGUID?: string; at: number },
};

export const reusableCrudSlice = (name: string) =>
    createSlice({
        name,
        initialState,
        reducers: {
            // ===== UPSERT
            upsertOne: (state, action) => {
                //create and update functions
            },
            // ===== CREATE
            createOne: (state, action) => {
                state.isCreating = true;
                state.createSuccessful = -1;
            },
            createOneSuccess: (state:any, action) => {
                state.lastCreatedData = action.payload;
                state.isCreating = false;
                state.createSuccessful = 1;
                state.crudMoment = Date.now();
                if (action.payload) {
                    const list = Array.isArray(state.entityDataFromServer) ? [...state.entityDataFromServer] : [];
                    const idToFind = action.payload.rowGUID || action.payload.id;
                    const exists = list.some((item: any) => (item.rowGUID || item.id) === idToFind);
                    if (!exists) {
                        list.push(action.payload);
                        list.sort((a: any, b: any) => {
                            const orderA = Number(a?.orderInList ?? a?.rowJSON?.orderInList ?? 0);
                            const orderB = Number(b?.orderInList ?? b?.rowJSON?.orderInList ?? 0);
                            return orderA - orderB;
                        });
                        state.entityDataFromServer = list;
                    }
                }
            },
            createOneFailure: (state, action) => {
                state.isCreating = false;
                state.createSuccessful = 0;
                state.createErrorData = action.payload;
            },

            // ===== READ
            readData: (state) => {
                state.isReading = true;
                state.readSuccessful = -1;

            },
            readDataSuccess: (state, action) => {
                state.entityDataFromServer = action.payload.data;
                state.isReading = false;
                state.readSuccessful = 1;
                state.crudMoment = Date.now();
            },
            readDataFailure: (state, action) => {
                state.isReading = false;
                state.readSuccessful = 0;
                state.readErrorData = action.payload;
            },

            // ===== FILTER ALL (Opportunistic Search)
            filterAll: (state, action?: any) => {
                state.isReading = true;
            },
            filterAllSuccess: (state, action) => {
                state.entityDataFromServer = action.payload;
                state.isReading = false;
                state.readSuccessful = 1;
                state.crudMoment = Date.now();
            },

            // ===== UPDATE
            updateOne: (state) => {
                //anatomy2-optimistic crud
                // state.isUpdating = true;
                // state.updateSuccessful = -1;
            },
            updateOneSuccess: (state: any, action) => {
                //anatomy2-optimistic crud: the list was changed before the request; the server row
                // (if the saga sends it) replaces the matching list item, so both agree again
                const row = action?.payload?.lastUpdatedData;
                if (row && rowIdOf(row) && Array.isArray(state.entityDataFromServer)
                    && state.entityDataFromServer.some((r: any) => rowIdOf(r) === rowIdOf(row))) {
                    state.entityDataFromServer = upsertRow(state.entityDataFromServer, row);
                    state.lastUpdatedData = row;
                    state.crudMoment = Date.now();
                }
            },
            updateOneFailure: (state, action) => {
                state.isUpdating = false;
                state.updateSuccessful = 0;
                state.updateErrorData = action.payload;
            },

            // ===== DELETE
            deleteOne: (state) => {
                state.isDeleting = true;
                state.deleteSuccessful = -1;
            },
            deleteOneSuccess: (state, action) => {
                state.lastDeletedData = action.payload;
                state.isDeleting = false;
                state.deleteSuccessful = 1;
                state.crudMoment = Date.now();
                if (action.payload && Array.isArray(state.entityDataFromServer)) {
                    const deletedId = action.payload.rowGUID || action.payload.id;
                    state.entityDataFromServer = state.entityDataFromServer.filter(
                        (item: any) => (item.rowGUID || item.id) !== deletedId
                    );
                }
            },
            deleteOneFailure: (state, action) => {
                state.isDeleting = false;
                state.deleteSuccessful = 0;
                state.deleteErrorData = action.payload;
            },

            // ===== READ ONE (themeStore-ticket-step1)
            readOne: (state, action?: any) => {
                state.isReading = true;
                state.readSuccessful = -1;
            },
            readOneSuccess: (state, action) => {
                state.lastCreatedData = action.payload;
                state.isReading = false;
                state.readSuccessful = 1;
                state.crudMoment = Date.now();
            },
            readOneFailure: (state, action) => {
                state.isReading = false;
                state.readSuccessful = 0;
                state.readErrorData = action.payload;
            },

            // ===== REALTIME (Supabase postgres_changes via reusableRootSaga)
            /** payload: { filter?: 'col=eq.value', readParams?: readData payload used for the catch-up refresh } */
            startRealtime: (state: any, _action: { payload?: { filter?: string; readParams?: any } | undefined }) => {
                state.realtimeStatus = "subscribing";
                state.realtimeError = "";
            },
            stopRealtime: (state: any) => {
                state.realtimeStatus = "idle";
            },
            realtimeStatusChanged: (state: any, action: { payload: { status: string; error?: string } }) => {
                const s = action.payload?.status;
                if (s === "SUBSCRIBED") state.realtimeStatus = "subscribed";
                else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") state.realtimeStatus = "error";
                else if (s === "CLOSED") state.realtimeStatus = "idle";
                state.realtimeError = action.payload?.error || "";
            },
            /** one row changed in the database (any client): INSERT / UPDATE upsert, DELETE remove */
            applyRealtimeChange: (state: any, action: { payload: any }) => {
                const change = action.payload;
                state.entityDataFromServer = applyRealtimeChangeToList(state.entityDataFromServer, change);
                state.lastRealtimeEvent = {
                    eventType: change?.eventType,
                    rowGUID: rowIdOf(change?.new) || rowIdOf(change?.old),
                    at: Date.now(),
                };
                state.crudMoment = Date.now();
            },

            // ===== CLEAR
            clearData: () => {
                return initialState;
            },
        },
    });


