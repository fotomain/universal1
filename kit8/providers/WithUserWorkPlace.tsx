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
type UserWorkPlaceContextType = {
    userWorkPlaceGUID: string | null;
};

const UserWorkPlaceContext = createContext<UserWorkPlaceContextType>({
    userWorkPlaceGUID: null,
});

// -----------------------------
// 🚀 PROVIDER
// -----------------------------
export const WithUserWorkPlace: React.FC<{ children: React.ReactNode }> = ({
                                                                           children,
                                                                       }) => {
    const [userWorkPlaceGUID, setUserWorkPlaceGUID] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const id = await getOrCreateDeviceId();
            setUserWorkPlaceGUID(id);

            console.log("userWorkPlaceGUID IDENTIFIED →", {
                userWorkPlaceGUID: id,
            });
        })();
    }, []);

    if(""===userWorkPlaceGUID) return <></>

    return (
        <UserWorkPlaceContext.Provider value={{ userWorkPlaceGUID }}>
            {children}
        </UserWorkPlaceContext.Provider>
    );
};


export const useUserWorkPlace = () => {
    const context = useContext(UserWorkPlaceContext)
    if (!context) {
        throw new Error("useUserWorkPlace must be used within Provider")
    }
    return context
}


// const { userWorkPlaceGUID } = useUserWorkPlace()





