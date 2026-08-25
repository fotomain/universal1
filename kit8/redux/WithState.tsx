import React from "react";
import { Provider } from "react-redux";
import { useRouter } from "expo-router";

// @ts-ignore
import { PersistGate } from 'redux-persist/integration/react';

import { useSQLNative } from "../providers/WithSQLiteNative";
import { useSupabase } from "../providers/WithSupabase";
import { useWorkPlace } from "../providers/WithWorkPlace";
import { storePrepared } from "./storePrepared";

const WithState = (props: any) => {
    const router = useRouter();

    const sqLiteAdapter: any = useSQLNative();
    if (sqLiteAdapter === null) {
        return <></>;
    }

    const supabaseAdapter = useSupabase();
    const workPlaceAdapter = useWorkPlace();

    if (!workPlaceAdapter || workPlaceAdapter.workPlaceGUID === null) {
        return <></>;
    }

    const dbAdapters = { workPlaceAdapter, router, supabaseAdapter, sqLiteAdapter };
    console.log("██████████ dbAdapters0", dbAdapters);

    const storeReady: any = storePrepared({ dbAdapters });

    return (
        <Provider store={storeReady.storeLocal}>
            <PersistGate loading={null} persistor={storeReady.persistor}>
                {props.children}
            </PersistGate>
        </Provider>
    );
};

export default WithState;