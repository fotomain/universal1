import storage from "redux-persist/lib/storage";
import { persistReducer, persistStore } from "redux-persist";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import { buildEntities } from "./lib/buildEntities";
import { SystemMetaData } from "./SystemMetaData";
import activeUserReducer from "./activeUserSlice";
import uxuiReducer from "./uxuiSlice";
import userThemeReducer from "./userThemeSlice";

const storePrepared: any = (params: any) => {
  const sagaDbAdapters = createSagaMiddleware({
    context: {
      dbAdapters: params.dbAdapters,
    },
  });

  // BUILD EVERYTHING HERE
  const { reducers, sagas } = buildEntities(SystemMetaData);

  console.log("sagas[0].actions", sagas[0]);

  const appVersion = "ver-14";
  const persistConfig = {
    key: "root" + appVersion,
    storage,
    whitelist: ["activeUserState", "userState", "uxuiState", "systemState", "mediaPostState", "userTheme"], // activeUserState persisted
  };

  const rootReducer = combineReducers({
    ...reducers,
    activeUserState: activeUserReducer, //this display state
    uxuiState: uxuiReducer, //interface dynamics between devices
    userTheme: userThemeReducer, //colors++ between devices
  });

  const persistedReducer = persistReducer(persistConfig, rootReducer);

  const storeLocal = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
        },
      }).concat(sagaDbAdapters),
  });

  const persistor: any = persistStore(storeLocal);

  sagas.forEach((sagaFn: any) => {
    sagaDbAdapters.run(sagaFn);
  });

  return { storeLocal, persistor };
};

export { storePrepared };
