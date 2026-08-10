import React, { createContext, useContext, useEffect, useState } from "react";
import * as Crypto from 'expo-crypto';
const uuid = Crypto.randomUUID
import AsyncStorage from "@react-native-async-storage/async-storage";

// -----------------------------
// 📦 STORAGE
// -----------------------------
const Storage = {
    async get(key: string) {
        try {
            return await AsyncStorage.getItem(key);
        } catch {
            return null;
        }
    },

    async set(key: string, value: string) {
        try {
            await AsyncStorage.setItem(key, value);
        } catch {}
    },
};

// -----------------------------
// 🧠 DEVICE ID
// -----------------------------
async function getOrCreateDeviceId(): Promise<string> {
    let id = await Storage.get("workPlaceGUID");

    if (!id) {
        id = uuid()
        await Storage.set("workPlaceGUID", id);
    } else {
        // RESET
        // await Storage.set("workPlaceGUID", uuid());
    }

    return id;
}

// -----------------------------
// 🌐 CONTEXT
// -----------------------------
type WorkPlaceContextType = {
    workPlaceGUID: string | null;
};

const WorkPlaceContext = createContext<WorkPlaceContextType>({
    workPlaceGUID: null,
});

// -----------------------------
// 🚀 PROVIDER
// -----------------------------
export const WithWorkPlace: React.FC<{ children: React.ReactNode }> = ({
                                                                           children,
                                                                       }) => {
    const [workPlaceGUID, setWorkPlaceGUID] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const id = await getOrCreateDeviceId();
            setWorkPlaceGUID(id);

            console.log("workPlaceGUID IDENTIFIED →", {
                workPlaceGUID: id,
            });
        })();
    }, []);

    if(""===workPlaceGUID) return <></>

    return (
        <WorkPlaceContext.Provider value={{ workPlaceGUID }}>
            {children}
        </WorkPlaceContext.Provider>
    );
};


export const useWorkPlace = () => {
    const context = useContext(WorkPlaceContext)
    if (!context) {
        throw new Error("useWorkPlace must be used within Provider")
    }
    return context
}


// const { workPlaceGUID } = useWorkPlace()





