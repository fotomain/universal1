import {reusableCrudSlice} from "../reusable/reusableCrudSlice";
import {reusableRootSaga} from "../reusable/reusableRootSaga";


export const buildEntities = (SystemMetaData: any) => {
    const reducers: any = {};
    const sagas: any[] = [];

    Object.keys(SystemMetaData).forEach((entityKey) => {
        const meta = SystemMetaData[entityKey];

        // 🔹 create slice
        const slice = reusableCrudSlice(entityKey);

        // 🔹 attach to metadata (IMPORTANT)
        meta.actions = slice.actions;

        // 🔹 reducer
        reducers[entityKey] = slice.reducer;

        // 🔹 saga
        sagas.push(
            reusableRootSaga({
                tableName: meta.tableName,
                actions: slice.actions,
                afterCreateOneSuccess: meta.afterCreateOneSuccess,
                doBefore: meta.doBefore,
                doAfter: meta.doAfter,
            })
        );
    });

    return { reducers, sagas };
};