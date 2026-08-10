import React, { createContext, useContext, useEffect, useState } from "react"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { SystemMetaData } from "../redux/SystemMetaData"

interface SupabaseContextType {
  supabase: SupabaseClient;
  updateSupabaseConfig: (newConfig: { url: string; key: string }) => void;
}

const SupabaseContext = createContext<SupabaseContextType | null>(null)

let supabaseClientInstance: SupabaseClient | null = null;

// themeStore-ticket-step2: supabaseOnUpdateTrigger exported function
export const supabaseOnUpdateTrigger = (params: {
  supabase: SupabaseClient;
  tableForTrigger: string;
  callbackForTrigger: (payload: any) => void;
}) => {
  const { supabase, tableForTrigger, callbackForTrigger } = params;
  const channel = supabase
    .channel(`public:${tableForTrigger}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: tableForTrigger,
      },
      (payload: any) => {
        if (callbackForTrigger) {
          callbackForTrigger(payload);
        }
      }
    )
    .subscribe();

  return channel;
};

const WithSupabase = (props: any) => {
  const { children, initialConfig } = props
  const [supabase, setSupabase] = useState<SupabaseClient>(() => {
    if (!supabaseClientInstance) {
      supabaseClientInstance = createClient(initialConfig.url, initialConfig.key);
    }
    return supabaseClientInstance;
  });

  const updateSupabaseConfig = (newConfig: { url: string; key: string }) => {
    supabaseClientInstance = createClient(newConfig.url, newConfig.key);
    setSupabase(supabaseClientInstance);
  }

  // themeStore-ticket-step2: call supabaseOnUpdateTrigger inside supabase provider
  useEffect(() => {
    const tableForTrigger = SystemMetaData?.themeStore?.tableName || "themeStoreTable";
    const callbackForTrigger = (payload: any) => {
      console.log("themeStore-ticket-step2: OnUpdate trigger fired for:", tableForTrigger, payload);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabaseThemeStoreUpdate', { detail: payload }));
      }
    };

    const channel = supabaseOnUpdateTrigger({
      supabase,
      tableForTrigger,
      callbackForTrigger,
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  const value: SupabaseContextType = { supabase, updateSupabaseConfig }

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
}

export const useSupabase = (): SupabaseContextType => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider")
  }
  return context
}

export default WithSupabase

