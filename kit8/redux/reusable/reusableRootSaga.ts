import {call, cancel, cancelled, fork, getContext, put, select, take, takeEvery, takeLatest} from "redux-saga/effects";
import {createSupabaseTableChannel} from "./createSupabaseTableChannel";
import {SystemMetaData} from "../SystemMetaData";
import {updateNestedJSONField} from "../lib/updateNestedJSONField";
import {showSnackbar} from "../uxuiSlice";
import {scopeRealtimeChange} from "./realtimeRows";

/** Supabase / PostgREST error -> short user message (23505 = unique index, e.g. one rate per currency per day). */
export const dbErrorMessage = (e: any): string => {
    if (e?.code === "23505") return "it already exists (duplicate)";
    if (e?.code === "23514") return "a value is not allowed (check constraint)";
    if (e?.code === "42501" || /row-level security/i.test(String(e?.message || ""))) return "not allowed - please sign in";
    return String(e?.message || e || "unknown error");
};

export const reusableRootSaga = (p: any) => {
    const {tableName, actions, doBefore, doAfter, afterCreateOneSuccess} = p
    /** SystemMetaData key of the entity (redux state key, snackbar Undo target); older callers: derived from the table */
    const entityKey: string = p.entityKey || tableName.replace("Table", "")
    /** "Post", "Currency", ... for user messages */
    const itemLabel: string = p.itemLabel || "Post"

    function* readAll(action: any) {
        try {
            // defaults: first page of 1000 rows (catalogs, realtime catch-up reads send no paging)
            // match: column equality scope, e.g. { rowOwnerGUID: currencyGUID } (the rates of ONE currency)
            const { paginationSize = 1000, originationCurrentPage = 0, readAllFilter, orderBy = "orderInList", ascending = true, match } =
            action.payload || {};

            const entityObject = SystemMetaData[action.type.replace("/readData", "")]

            if(doBefore){
                doBefore(action)
            }

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

            let query = supabase
                .from(tableName)
                .select("*")
                .order(orderBy || "orderInList", { ascending: ascending !== false })

            if (match && typeof match === "object" && Object.keys(match).length > 0) {
                query = query.match(match);
            }

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

            if(doAfter){
                doAfter({action,data})
            }

            yield put(actions.readDataSuccess({data,action}));
        } catch (e: any) {
            yield put(actions.readDataFailure(e?.message));
        }
    }

    // █████████████████████████████ doAfterCreateOneSuccess
    function* doAfterCreateOneSuccess(action: any) {
        // console.log("doAfterCreateOneSuccess1", action);
        if (afterCreateOneSuccess) {
            // console.log("doAfterCreateOneSuccess2", action);
            try {
                if (typeof afterCreateOneSuccess === 'function') {
                    yield call(afterCreateOneSuccess, action);
                }
            } catch (err) {
                console.error("Error in entity afterCreateOneSuccess:", err);
            }
        }
        const actionCallback = action?.payload?.afterCreateOneSuccess;
        if (typeof actionCallback === 'function') {
            try {
                yield call(actionCallback, action);
            } catch (err) {
                console.error("Error in action afterCreateOneSuccess callback:", err);
            }
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
            .maybeSingle()
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
                    .eq("rowGUID", action.payload.rowGUID)
                    .eq("rowOwnerGUID", action.payload.rowOwnerGUID)
                    .maybeSingle()
            );

            let jsonToUpdate = readData?.rowJSON || {}
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
                    .maybeSingle()
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
            let newItem: any = null;
            if (entityObject?.prepareCreateApi) {
                // @ts-ignore
                let ret = yield entityObject.prepareCreateApi({ action, userState, workPlaceAdapter });
                newItem = ret.newItem;
            } else {
                newItem = action.payload;
            }

            // Strip callback/non-column fields before DB insert
            const { afterCreateOneSuccess: actionAfterSuccess, ...dbItem } = newItem || {};

            console.log("onCreateRow0 newItem", dbItem);

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase;

            const { data, error } = yield call(() =>
                supabase.from(tableName).insert(dbItem).select()
            );

            console.log("createOne0 data", data);
            console.log("createOne0 error", error);

            if (error) throw error;

            const createdRow = (data && data[0]) ? data[0] : dbItem;
            yield put(actions.createOneSuccess({
                createdData: createdRow,
                ...createdRow,
                action,
                afterCreateOneSuccess: actionAfterSuccess || action?.payload?.afterCreateOneSuccess,
            }));
        } catch (e: any) {
            console.log("createOneFailure0 data, error", e)
            yield put(actions.createOneFailure(e?.message || e));
            yield put(showSnackbar({message: `${itemLabel} was not saved: ${dbErrorMessage(e)}`}));
        }
    }

    function* updateOneFieldOfJson(action: any) {

        console.log("updateOneFieldOfJson0", action)

        try {
            // columns: root columns to set too, e.g. { rowParentGUID: '2026-09-29' } (only the whitelisted ones)
            const {rowGUID, field, value, rowJSON, orderInList, columns} = action.payload || {};

            // @ts-ignore
            const supabase: any = (yield getContext("dbAdapters")).supabaseAdapter.supabase

            let updatePayload: any = {};

            // Check if it's a root level field without rowJSON
            if (field === "orderInList" || (orderInList !== undefined && field === undefined && rowJSON === undefined)) {
                updatePayload = { orderInList: value !== undefined ? value : orderInList };
            } else if (rowJSON !== undefined) {
                // 1. READ current JSON
                const {data: existingRow, error: readError} = yield call(() =>
                    supabase
                        .from(tableName)
                        .select("rowJSON")
                        .eq("rowGUID", rowGUID)
                        .maybeSingle()
                );

                if (readError) throw readError;

                // 2. MERGE rowJSON (preserve existing fields and apply new fields)
                const prevJSON = existingRow?.rowJSON || {};
                const updatedJSON = {
                    ...prevJSON,
                    ...rowJSON,
                };
                updatePayload = { rowJSON: updatedJSON };
                if (orderInList !== undefined) {
                    updatePayload.orderInList = orderInList;
                }
            } else if (field !== undefined) {
                // 1. READ current JSON
                const {data: existingRow, error: readError} = yield call(() =>
                    supabase
                        .from(tableName)
                        .select("rowJSON")
                        .eq("rowGUID", rowGUID)
                        .maybeSingle()
                );

                if (readError) throw readError;

                // 2. SAFE MERGE (preserve all fields)
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

            if (columns && typeof columns === "object") {
                for (const col of ["rowParentGUID", "orderInList"]) {
                    if (columns[col] !== undefined) updatePayload[col] = columns[col];
                }
            }

            // dY" 3. UPDATE
            console.log("updateOneFieldOfJson0 - updatePayload", updatePayload)
            const {data, error} = yield call(() =>
                supabase
                    .from(tableName)
                    .update(updatePayload)
                    .eq("rowGUID", rowGUID)
                    .select()
                    .maybeSingle()
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
            yield put(showSnackbar({message: `${itemLabel} was not saved: ${dbErrorMessage(e)}`}));
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
                    message: `${itemLabel} successfully deleted`,
                    actionLabel: "Undo",
                    undoDeleteData: deletedRecord,
                    // SystemMetaData key (not the table name): Undo re-creates the row in THIS entity
                    entityName: entityKey || "mediaPostReusable",
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
            const { data, error } = yield call(() => query.maybeSingle());
            if (error) {
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
            const sliceState: any = yield select((state: any) => state[entityKey] || state[tableName] || {});
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

    // █████████████████████████████ realtime (Supabase postgres_changes -> list, any browser / device)
    // startRealtime({ filter?, readParams? }) opens ONE channel for the table; every row change is applied
    // with applyRealtimeChange. On every SUBSCRIBED (first connect and reconnects) a catch-up readData runs,
    // so changes made while the socket was down are not lost. stopRealtime (or a new start) closes it.
    function* realtimeWorker(action: any): Generator<any, void, any> {
        const {filter, readParams} = action.payload || {};
        // scoped list (readParams.match): changes of other owners are ignored, rows moved out are removed
        const match = readParams?.match;
        const dbAdapters: any = yield getContext("dbAdapters");
        const supabase: any = dbAdapters?.supabaseAdapter?.supabase;
        if (!supabase?.channel) {
            yield put(actions.realtimeStatusChanged({status: "CHANNEL_ERROR", error: "Supabase realtime is not available"}));
            return;
        }
        const chan: any = yield call(createSupabaseTableChannel, supabase, {
            table: tableName,
            filter,
            channelName: `reusable:${entityKey}:${tableName}:${filter || "all"}:${Date.now()}`,
        });
        try {
            while (true) {
                const msg: any = yield take(chan);
                if (msg.kind === "status") {
                    yield put(actions.realtimeStatusChanged({status: msg.status, error: msg.error}));
                    if (msg.status === "SUBSCRIBED") {
                        yield put(actions.readData({paginationSize: 1000, originationCurrentPage: 0, ...(readParams || {})}));
                    }
                } else if (msg.kind === "change" && msg.payload?.table === tableName) {
                    const change = scopeRealtimeChange(msg.payload, match);
                    if (change) yield put(actions.applyRealtimeChange(change));
                }
            }
        } finally {
            chan.close();
            if (yield cancelled()) {
                yield put(actions.realtimeStatusChanged({status: "CLOSED"}));
            }
        }
    }

    function* realtimeWatcher(): Generator<any, void, any> {
        let task: any = null;
        while (true) {
            const action: any = yield take([actions.startRealtime.type, actions.stopRealtime.type]);
            if (task) {
                yield cancel(task);
                task = null;
            }
            if (action.type === actions.startRealtime.type) {
                task = yield fork(realtimeWorker, action);
            }
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
        yield takeEvery(actions.createOneSuccess, doAfterCreateOneSuccess);
        if (actions.startRealtime) {
            yield fork(realtimeWatcher);
        }
    };
};
