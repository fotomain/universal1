
import {call, getContext, put, select, takeEvery, takeLatest} from "redux-saga/effects";
import {SystemMetaData} from "../SystemMetaData";
import {updateNestedJSONField} from "../lib/updateNestedJSONField";


export const reusableRootSaga = (p: any) => {
    const {tableName, actions, doBefore, doArter} = p

    function* readAll(action: any) {
        try {
            const {paginationSize, originationCurrentPage, readAllFilter} =
            action.payload || {};


            const entityObject = SystemMetaData[action.type.replace("/readData", "")]

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

            let query = supabase
                .from(tableName)
                .select("*")
                .order("orderInList", { ascending: true })
                //TODO!!! .match({...matchData})

            if (readAllFilter) {
                query = query.ilike(
                    "mediaPostJSON->>mediaPostTitle",
                    `%${readAllFilter}%`
                );
            }

            const {data, error} = yield call(() =>
                query.range(
                    originationCurrentPage * paginationSize,
                    (originationCurrentPage + 1) * paginationSize - 1
                )
            );

            console.log("readAll data", data)

            if (error) throw error;

            yield put(actions.readDataSuccess(data));
        } catch (e: any) {
            yield put(actions.readDataFailure(e?.message));
        }
    }

    // █████████████████████████████ upsertOne
    function* upsertOne(action: any) {

        // @ts-ignore
        const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

        const {data:readData, error:readError} = yield call(() =>
            supabase.from(tableName).select("*")
            .eq("mediaPostGUID", action.payload.mediaPostGUID)
            .eq("mediaPostOwnerGUID", action.payload.mediaPostOwnerGUID)
            .single()
        );

        // console.log("upsertOne0 data ", readData)
        // console.log("upsertOne0 read ", readError)

        if(null === readData){
            const entityObject = SystemMetaData[action.type.replace("/upsertOne", "")]
            yield put(entityObject.actions.createOne(action.payload));
        } else {
            const {data:readData, error:readError} = yield call(() =>
                supabase.from(tableName)
                    .select('*')
                    .single()
                    .eq("mediaPostGUID", action.payload.mediaPostGUID)
                    .eq("mediaPostOwnerGUID", action.payload.mediaPostOwnerGUID)
            );

            let jsonToUpdate = readData.mediaPostJSON
            // console.log("jsonToUpdate00",jsonToUpdate)

            jsonToUpdate = {...jsonToUpdate,...action.payload.mediaPostJSON}

            const {data:updateData, error:updateError} = yield call(() =>
                supabase.from(tableName)
                    .update({
                        mediaPostJSON: jsonToUpdate,
                    })
                    .eq("mediaPostGUID", action.payload.mediaPostGUID)
                    .eq("mediaPostOwnerGUID", action.payload.mediaPostOwnerGUID)
                    .select()
                    .single()
            );

            // console.log("upsertOne0 data ", updateData)

            if(updateError) {
                console.log("upsertOne0 data ", updateData)
                console.log("upsertOne0 error ", updateError)
                return
            }

            return {updateData}

        }

    }

    // █████████████████████████████ createOne
    function* createOne(action: any) {
        console.log("onCreateRow0 action", action)

        try {
            const entityObject = SystemMetaData[action.type.replace("/createOne", "")]

            // @ts-ignore
            const userState: any = yield select((state: any) => state.userState);
            let errorText = "createOneFailure userIsBad for createOne " + JSON.stringify(userState)

            // @ts-ignore
            const dbAdapters: any = yield getContext("dbAdapters")
            const workPlaceAdapter=dbAdapters.workPlaceAdapter;

            // console.log("dbAdapters00",dbAdapters)
            let newItem:any = null
            if(entityObject?.prepareCreateApi) {
                // @ts-ignore
                let ret = yield entityObject.prepareCreateApi({action, userState, workPlaceAdapter})
                newItem = ret.newItem
            }else{
                newItem = action.payload
            }

            console.log("onCreateRow0 newItem", newItem)

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase


            const {data, error} = yield call(() =>
                supabase.from(tableName).insert(newItem).select()
            );

            console.log("createOne0 data", data)
            console.log("createOne0 error", error)

            if (error) throw error;

            yield put(actions.createOneSuccess(data[0]));
        } catch (e) {
            console.log("createOneFailure0 data, error", e)
            yield put(actions.createOneFailure(e));
        }
    }

    function* updateOneFieldOfJson(action: any) {

        console.log("updateOneFieldOfJson0", action)

        try {
            const {mediaPostGUID, field, value} = action.payload;

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase
            
            let updatePayload: any = {};

            // Check if it's a root level field
            if (field === "orderInList") {
                updatePayload = { [field]: value };
            } else {
                // dY" 1. READ current JSON
                const {data: existingRow, error: readError} = yield call(() =>
                    supabase
                        .from(tableName)
                        .select("mediaPostJSON")
                        .eq("mediaPostGUID", mediaPostGUID)
                        .single()
                );

                if (readError) throw readError;

                // dY" 2. SAFE MERGE (preserve all fields)
                const prevJSON = existingRow?.mediaPostJSON || {};

                let updatedJSON = {...prevJSON}

                if(undefined===prevJSON[field]) {
                    const retUpdage = updateNestedJSONField(prevJSON, field, value)
                    if("single"===retUpdage.type){
                        updatedJSON=retUpdage.updatedObject
                    } else {
                            console.log("Error 20260430-114248176 field "+field+" has retUpdage.type="+retUpdage.type+" in JDON"+JSON.stringify(existingRow));
                            throw new Error("Error 20260430-114248176 field "+field+" has retUpdage.type="+retUpdage.type+" in JDON"+JSON.stringify(existingRow));
                    }

                } else {
                    updatedJSON = {
                        ...updatedJSON,
                        [field]: value,
                    };
                }
                
                updatePayload = { mediaPostJSON: updatedJSON };
            }

            // dY" 3. UPDATE
            console.log("updateOneFieldOfJson0 - updatePayload", updatePayload)
            const {data, error} = yield call(() =>
                supabase
                    .from(tableName)
                    .update(updatePayload)
                    .eq("mediaPostGUID", mediaPostGUID)
                    .select()
                    .single()
            );

            if (error) throw error;

            yield put(
                actions.updateOneSuccess({
                    lastUpdatedData: data,
                    updateSuccesfull: 1,
                })
            );
        } catch (e: any) {
            console.log("updateOneFieldOfJson0 - updateOneFailure", e)
            yield put(
                actions.updateOneFailure({
                    updateErrorData: e?.message || e,
                })
            );
        }
    }

    function* deleteOne(action: any) {
        try {
            const {mediaPostGUID} = action.payload;

            // console.log("deleteOne mediaPostGUID",mediaPostGUID)

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

            const {data, error} = yield call(() =>
                supabase
                    .from(tableName)
                    .delete()
                    .eq("mediaPostGUID", mediaPostGUID)
                    .select()
            );

            if (error) throw error;

            yield put(actions.deleteOneSuccess(data[0]));
        } catch (e) {
            yield put(actions.deleteOneFailure(e));
        }
    }

    // █████████████████████████████ readOne (themeStore-ticket-step1)
    function* readOne(action: any) {
        try {
            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase;
            const { mediaPostOwnerGUID, mediaPostGUID } = action.payload || {};
            let query = supabase.from(tableName).select("*");
            if (mediaPostOwnerGUID) {
                query = query.eq("mediaPostOwnerGUID", mediaPostOwnerGUID);
            }
            if (mediaPostGUID) {
                query = query.eq("mediaPostGUID", mediaPostGUID);
            }
            const { data, error } = yield call(() => query.single());
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            const singleData = data || null;
            yield put(actions.readOneSuccess(singleData));
            return singleData;
        } catch (e: any) {
            console.log("readOne error for " + tableName, e);
            yield put(actions.readOneFailure(e?.message || e));
        }
    }

    return function* reusableSagas() {
        yield takeLatest(actions.readData, readAll);
        yield takeEvery(actions.readOne, readOne);
        yield takeEvery(actions.createOne, createOne);
        yield takeEvery(actions.updateOne, updateOneFieldOfJson);
        yield takeEvery(actions.deleteOne, deleteOne);
        yield takeEvery(actions.upsertOne, upsertOne);
    };
};
