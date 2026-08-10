import React, { createContext, useContext } from "react";
import { useMD3 } from "./lib/useMd3";

const MD3Context = createContext(false);

export function MD3Provider({ children }: { children: React.ReactNode }) {
    const ready = useMD3();

    if (!ready) return null;

    return (
        <MD3Context.Provider value={ready}>
            {children}
        </MD3Context.Provider>
    );
}

export function useMD3Ready() {
    const context = useContext(MD3Context);
    if (!context) {
        throw new Error("useMD3Ready must be used within MD3Context.Provider");
    }
    return context;
}
