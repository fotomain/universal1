import {createSlice} from "@reduxjs/toolkit";


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
            createOneSuccess: (state, action) => {
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
                state.entityDataFromServer = action.payload;
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
            updateOneSuccess: (state, action) => {
                //anatomy2-optimistic crud
                // state.lastUpdatedData = action.payload;
                // state.isUpdating = false;
                // state.updateSuccessful = 1;
                // state.crudMoment = Date.now();
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

            // ===== CLEAR
            clearData: () => {
                return initialState;
            },
        },
    });


