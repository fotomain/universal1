import {call, getContext, put, select, takeEvery, takeLatest} from "redux-saga/effects";
import {SystemMetaData} from "../SystemMetaData";
import {updateNestedJSONField} from "../lib/updateNestedJSONField";
import {showSnackbar} from "../uxuiSlice";


export const reusableRootSaga = (p: any) => {
    const {tableName, actions, doBefore, doAfter} = p

    function* readAll(action: any) {
        try {
            const { paginationSize, originationCurrentPage, readAllFilter, orderBy = "orderInList", ascending = true } =
            action.payload || {};

            const entityObject = SystemMetaData[action.type.replace("/readData", "")]

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

            let query = supabase
                .from(tableName)
                .select("*")
                .order(orderBy || "orderInList", { ascending: ascending !== false })
                //TODO!!! .match({...matchData})

            if (readAllFilter) {
                query = query.or(
                    `rowJSON->>mediaPostTitle.ilike.%${readAllFilter}%,rowJSON->>mediaPostDescription.ilike.%${readAllFilter}%,rowJSON->>mediaPostOrigin.ilike.%${readAllFilter}%,rowJSON->>originUrl.ilike.%${readAllFilter}%,rowJSON->>firstName.ilike.%${readAllFilter}%,rowJSON->>lastName.ilike.%${readAllFilter}%,rowJSON->>mediaPostFirstName.ilike.%${readAllFilter}%,rowJSON->>mediaPostLastName.ilike.%${readAllFilter}%,rowJSON->>raciFirstName.ilike.%${readAllFilter}%,rowJSON->>raciLastName.ilike.%${readAllFilter}%,rowJSON->>raciEmail.ilike.%${readAllFilter}%,rowJSON->>email.ilike.%${readAllFilter}%`
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
            .eq("rowGUID", action.payload.rowGUID)
            .eq("rowOwnerGUID", action.payload.rowOwnerGUID)
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
                    .eq("rowGUID", action.payload.rowGUID)
                    .eq("rowOwnerGUID", action.payload.rowOwnerGUID)
            );

            let jsonToUpdate = readData.rowJSON
            // console.log("jsonToUpdate00",jsonToUpdate)

            jsonToUpdate = {...jsonToUpdate,...action.payload.rowJSON}

            const {data:updateData, error:updateError} = yield call(() =>
                supabase.from(tableName)
                    .update({
                        rowJSON: jsonToUpdate,
                    })
                    .eq("rowGUID", action.payload.rowGUID)
                    .eq("rowOwnerGUID", action.payload.rowOwnerGUID)
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
            const {rowGUID, field, value} = action.payload;

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
                        .select("rowJSON")
                        .eq("rowGUID", rowGUID)
                        .single()
                );

                if (readError) throw readError;

                // dY" 2. SAFE MERGE (preserve all fields)
                const prevJSON = existingRow?.rowJSON || {};

                let updatedJSON = {...prevJSON}

                if(undefined===prevJSON[field]) {
                    const retUpdate = updateNestedJSONField(prevJSON, field, value)
                    if("single"===retUpdate.type){
                        updatedJSON=retUpdate.updatedObject
                    } else {
                            console.log("Error 20260430-114248176 field "+field+" has retUpdate.type="+retUpdate.type+" in JDON"+JSON.stringify(existingRow));
                            throw new Error("Error 20260430-114248176 field "+field+" has retUpdate.type="+retUpdate.type+" in JDON"+JSON.stringify(existingRow));
                    }

                } else {
                    updatedJSON = {
                        ...updatedJSON,
                        [field]: value,
                    };
                }

                updatePayload = { rowJSON: updatedJSON };
            }

            // dY" 3. UPDATE
            console.log("updateOneFieldOfJson0 - updatePayload", updatePayload)
            const {data, error} = yield call(() =>
                supabase
                    .from(tableName)
                    .update(updatePayload)
                    .eq("rowGUID", rowGUID)
                    .select()
                    .single()
            );

            if (error) throw error;

            yield put(
                actions.updateOneSuccess({
                    lastUpdatedData: data,
                    updateSuccessful: 1,
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
            const {rowGUID} = action.payload;

            // console.log("deleteOne rowGUID",rowGUID)

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

            const {data, error} = yield call(() =>
                supabase
                    .from(tableName)
                    .delete()
                    .eq("rowGUID", rowGUID)
                    .select()
            );

            if (error) throw error;

            const deletedRecord = (data && data[0]) ? data[0] : action.payload;
            yield put(actions.deleteOneSuccess(deletedRecord));
            yield put(
                showSnackbar({
                    message: "Post successfully deleted",
                    actionLabel: "Undo",
                    undoDeleteData: deletedRecord,
                    entityName: tableName.replace("Table", "") || "mediaPostReusable",
                })
            );
        } catch (e) {
            yield put(actions.deleteOneFailure(e));
        }
    }

    // █████████████████████████████ readOne (themeStore-ticket-step1)
    function* readOne(action: any) {
        try {
            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase;
            const { rowOwnerGUID, rowGUID } = action.payload || {};
            let query = supabase.from(tableName).select("*");
            if (rowOwnerGUID) {
                query = query.eq("rowOwnerGUID", rowOwnerGUID);
            }
            if (rowGUID) {
                query = query.eq("rowGUID", rowGUID);
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

    // █████████████████████████████ filterAll (Opportunistic Search)
    function* filterAll(action: any) {
        try {
            const filterText = action.payload?.filterText ?? (typeof action.payload === 'string' ? action.payload : "");

            // 1. Opportunistic search in Redux state
            // @ts-ignore
            const sliceState: any = yield select((state: any) => state[tableName] || {});
            const reduxStateData = sliceState?.entityDataFromServer || [];

            let filteredData = reduxStateData;
            if (filterText && filterText.trim() !== "") {
                const lowerText = filterText.toLowerCase().trim();
                const isRaciTable = String(tableName).toLowerCase().includes("raci");
                const isPostsTable = String(tableName).toLowerCase().includes("post") || String(tableName).toLowerCase().includes("media");

                filteredData = reduxStateData.filter((item: any) => {
                    const json = item?.rowJSON || item || {};
                    const title = String(json.mediaPostTitle || item.title || "").toLowerCase();
                    const description = String(json.mediaPostDescription || item.description || "").toLowerCase();
                    const firstName = String(json.raciFirstName || json.firstName || json.mediaPostFirstName || item.firstName || "").toLowerCase();
                    const lastName = String(json.raciLastName || json.lastName || json.mediaPostLastName || item.lastName || "").toLowerCase();
                    const fullName = `${firstName} ${lastName}`.trim();
                    const mediaPostOrigin = String(json.mediaPostOrigin || json.originUrl || json.origin || json.url || json.mediaPostURL || item.originUrl || "").toLowerCase();
                    const email = String(json.raciEmail || json.email || item.email || "").toLowerCase();

                    if (isRaciTable) {
                        return (
                            (firstName.length > 0 && firstName.includes(lowerText)) ||
                            (lastName.length > 0 && lastName.includes(lowerText)) ||
                            (fullName.length > 0 && fullName.includes(lowerText)) ||
                            (email.length > 0 && email.includes(lowerText))
                        );
                    }

                    if (isPostsTable) {
                        return (
                            title.includes(lowerText) ||
                            description.includes(lowerText) ||
                            (mediaPostOrigin.length > 0 && mediaPostOrigin.includes(lowerText)) ||
                            (firstName.length > 0 && firstName.includes(lowerText)) ||
                            (lastName.length > 0 && lastName.includes(lowerText)) ||
                            (fullName.length > 0 && fullName.includes(lowerText))
                        );
                    }

                    return (
                        title.includes(lowerText) ||
                        description.includes(lowerText) ||
                        (mediaPostOrigin.length > 0 && mediaPostOrigin.includes(lowerText)) ||
                        (firstName.length > 0 && firstName.includes(lowerText)) ||
                        (lastName.length > 0 && lastName.includes(lowerText)) ||
                        (fullName.length > 0 && fullName.includes(lowerText)) ||
                        (email.length > 0 && email.includes(lowerText))
                    );
                });
            }

            // Immediately dispatch filterAllSuccess to update state opportunistically
            if (actions.filterAllSuccess) {
                yield put(actions.filterAllSuccess(filteredData));
            } else {
                yield put(actions.readDataSuccess(filteredData));
            }

            // 2. When filterAll finished -> Run saga readAll from database with {filterText: string}
            // @ts-ignore
            const dbAdapters: any = yield getContext("dbAdapters");
            const supabase: any = dbAdapters?.supabaseAdapter?.supabase;

            if (supabase) {
                let query = supabase
                    .from(tableName)
                    .select("*")
                    .order("orderInList", { ascending: true });

                if (filterText && filterText.trim() !== "") {
                    query = query.or(
                        `rowJSON->>mediaPostTitle.ilike.%${filterText}%,rowJSON->>mediaPostDescription.ilike.%${filterText}%,rowJSON->>mediaPostOrigin.ilike.%${filterText}%,rowJSON->>originUrl.ilike.%${filterText}%,rowJSON->>firstName.ilike.%${filterText}%,rowJSON->>lastName.ilike.%${filterText}%,rowJSON->>mediaPostFirstName.ilike.%${filterText}%,rowJSON->>mediaPostLastName.ilike.%${filterText}%,rowJSON->>raciFirstName.ilike.%${filterText}%,rowJSON->>raciLastName.ilike.%${filterText}%,rowJSON->>raciEmail.ilike.%${filterText}%,rowJSON->>email.ilike.%${filterText}%`
                    );
                }

                const { data: dbResultData, error } = yield call(() => query);

                if (!error && dbResultData) {
                    // 3. Compare: if read result data <> redux state data: Update redux state
                    const dbJson = JSON.stringify(dbResultData);
                    const reduxJson = JSON.stringify(reduxStateData);

                    if (dbJson !== reduxJson) {
                        console.log("filterAll: DB result data <> redux state data -> Updating Redux state");
                        yield put(actions.readDataSuccess(dbResultData));
                    }
                }
            }
        } catch (e: any) {
            console.log("filterAll saga error", e);
        }
    }

    return function* reusableSagas() {
        yield takeLatest(actions.readData, readAll);
        if (actions.filterAll) {
            yield takeLatest(actions.filterAll, filterAll);
        }
        yield takeEvery(actions.readOne, readOne);
        yield takeEvery(actions.createOne, createOne);
        yield takeEvery(actions.updateOne, updateOneFieldOfJson);
        yield takeEvery(actions.deleteOne, deleteOne);
        yield takeEvery(actions.upsertOne, upsertOne);
    };
};
