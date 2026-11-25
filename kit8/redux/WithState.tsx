import React from "react";
import { Provider } from "react-redux";
import { useRouter } from "expo-router";

// @ts-ignore
import { PersistGate } from 'redux-persist/integration/react';

import { useSQLNative } from "../providers/WithSQLiteNative";
import { useSupabase } from "../providers/WithSupabase";
import { useUserWorkPlace } from "../providers/WithUserWorkPlace";
import { storePrepared } from "./storePrepared";
import { setAppStore } from "./storeRef";

const WithState = (props: any) => {
    const router = useRouter();

    const sqLiteAdapter: any = useSQLNative();
    if (sqLiteAdapter === null) {
        return <></>;
    }

    const supabaseAdapter = useSupabase();
    const userWorkPlaceAdapter = useUserWorkPlace();

    if (!userWorkPlaceAdapter || userWorkPlaceAdapter.userWorkPlaceGUID === null) {
        return <></>;
    }

    const dbAdapters = { userWorkPlaceAdapter, router, supabaseAdapter, sqLiteAdapter };
    // console.log("██████████ dbAdapters0", dbAdapters);

    const storeReady: any = storePrepared({ dbAdapters });
    setAppStore(storeReady.storeLocal); // non-React access (kit8/redux/storeRef.ts)

    return (
        <Provider store={storeReady.storeLocal}>
            <PersistGate loading={null} persistor={storeReady.persistor}>
                {props.children}
            </PersistGate>
        </Provider>
    );
};

export default WithState;
