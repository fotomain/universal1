import { createSlice } from "@reduxjs/toolkit";


const initialState = {
    entityDataFromServer: [],
    lastCreatedData: null,
    lastUpdatedData: null,
    lastDeletedData: null,

    isCreating: false,
    isReading: false,
    isUpdating: false,
    isDeleting: false,

    createSuccesfull: 0,
    readSuccesfull: 0,
    updateSuccesfull: 0,
    deleteSuccesfull: 0,

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
                state.createSuccesfull = -1;
            },
            createOneSuccess: (state, action) => {
                state.lastCreatedData = action.payload;
                state.isCreating = false;
                state.createSuccesfull = 1;
                state.crudMoment = Date.now();
            },
            createOneFailure: (state, action) => {
                state.isCreating = false;
                state.createSuccesfull = 0;
                state.createErrorData = action.payload;
            },

            // ===== READ
            readData: (state) => {
                state.isReading = true;
                state.readSuccesfull = -1;

            },
            readDataSuccess: (state, action) => {
                state.entityDataFromServer = action.payload;
                state.isReading = false;
                state.readSuccesfull = 1;
                state.crudMoment = Date.now();
            },
            readDataFailure: (state, action) => {
                state.isReading = false;
                state.readSuccesfull = 0;
                state.readErrorData = action.payload;
            },

            // ===== UPDATE
            updateOne: (state) => {
                //anatomy2-optimistic crud
                // state.isUpdating = true;
                // state.updateSuccesfull = -1;
            },
            updateOneSuccess: (state, action) => {
                //anatomy2-optimistic crud
                // state.lastUpdatedData = action.payload;
                // state.isUpdating = false;
                // state.updateSuccesfull = 1;
                // state.crudMoment = Date.now();
            },
            updateOneFailure: (state, action) => {
                state.isUpdating = false;
                state.updateSuccesfull = 0;
                state.updateErrorData = action.payload;
            },

            // ===== DELETE
            deleteOne: (state) => {
                state.isDeleting = true;
                state.deleteSuccesfull = -1;
            },
            deleteOneSuccess: (state, action) => {
                state.lastDeletedData = action.payload;
                state.isDeleting = false;
                state.deleteSuccesfull = 1;
                state.crudMoment = Date.now();
            },
            deleteOneFailure: (state, action) => {
                state.isDeleting = false;
                state.deleteSuccesfull = 0;
                state.deleteErrorData = action.payload;
            },
            
            // ===== READ ONE (themeStore-ticket-step1)
            readOne: (state, action?: any) => {
                state.isReading = true;
                state.readSuccesfull = -1;
            },
            readOneSuccess: (state, action) => {
                state.lastCreatedData = action.payload;
                state.isReading = false;
                state.readSuccesfull = 1;
                state.crudMoment = Date.now();
            },
            readOneFailure: (state, action) => {
                state.isReading = false;
                state.readSuccesfull = 0;
                state.readErrorData = action.payload;
            },

            // ===== CLEAR
            clearData: () => {
                return initialState;
            },
        },
    });


