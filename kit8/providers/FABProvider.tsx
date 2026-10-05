// FABProvider - the app's floating action buttons.
//
// 1. Only one FAB speed dial is open at a time (registerFAB / notifyFABOpen / notifyFABClose / closeAllFABs).
// 2. CONTEXT COMMANDS of the main FAB (FabMain = FABAppComponent in app/_layout.tsx): the screen that is
//    open publishes its commands - the same CRUD commands as its toolbars / right-click menu - with
//
//        useFABContextActions('pm-dashboard', actions)      // actions: FABContextAction[] | null
//
//    and the main FAB shows them instead of its default actions. The last screen that published wins;
//    when it unmounts (or passes null) the previous one / the defaults come back.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type FABListener = (openFabId: string | null) => void;

/** One command of the main FAB (same shape as FABAppAction). */
export interface FABContextAction {
  icon: string;
  label: string;
  onPress: () => void;
  /** mini FAB color (e.g. red for delete) */
  color?: string;
  testID?: string;
}

interface FABContextType {
  registerFAB: (id: string, listener: FABListener) => () => void;
  notifyFABOpen: (id: string) => void;
  notifyFABClose: (id: string) => void;
  closeAllFABs: () => void;
  /** publish (actions) / withdraw (null) the context commands of a screen */
  setFABContextActions: (id: string, actions: FABContextAction[] | null) => void;
}

const FABContext = createContext<FABContextType | null>(null);
/** separate context: only the main FAB re-renders when the commands change */
const FABActionsContext = createContext<FABContextAction[] | null>(null);

export const FABProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const listenersRef = useRef<Map<string, FABListener>>(new Map());
  const activeFabIdRef = useRef<string | null>(null);
  /** publishers in mount order: the last one is shown */
  const contextsRef = useRef<{ id: string; actions: FABContextAction[] }[]>([]);
  const [contextActions, setContextActions] = useState<FABContextAction[] | null>(null);

  const registerFAB = useCallback((id: string, listener: FABListener) => {
    listenersRef.current.set(id, listener);
    return () => {
      listenersRef.current.delete(id);
      if (activeFabIdRef.current === id) {
        activeFabIdRef.current = null;
      }
    };
  }, []);

  const notifyFABOpen = useCallback((id: string) => {
    const previousId = activeFabIdRef.current;
    activeFabIdRef.current = id;

    // Close the previously open FAB if it's different
    if (previousId && previousId !== id) {
      const prevListener = listenersRef.current.get(previousId);
      if (prevListener) {
        prevListener(id);
      }
    }
  }, []);

  const notifyFABClose = useCallback((id: string) => {
    if (activeFabIdRef.current === id) {
      activeFabIdRef.current = null;
    }
  }, []);

  const closeAllFABs = useCallback(() => {
    const activeId = activeFabIdRef.current;
    if (activeId) {
      activeFabIdRef.current = null;
      const listener = listenersRef.current.get(activeId);
      if (listener) {
        listener(null);
      }
    }
  }, []);

  const setFABContextActions = useCallback((id: string, actions: FABContextAction[] | null) => {
    const list = contextsRef.current;
    const i = list.findIndex((c) => c.id === id);
    if (actions && actions.length) {
      if (i >= 0) list[i].actions = actions;
      else list.push({ id, actions });
    } else if (i >= 0) list.splice(i, 1);
    setContextActions(list.length ? list[list.length - 1].actions : null);
  }, []);

  const api = useMemo(
    () => ({ registerFAB, notifyFABOpen, notifyFABClose, closeAllFABs, setFABContextActions }),
    [registerFAB, notifyFABOpen, notifyFABClose, closeAllFABs, setFABContextActions]
  );

  return (
    <FABContext.Provider value={api}>
      <FABActionsContext.Provider value={contextActions}>{children}</FABActionsContext.Provider>
    </FABContext.Provider>
  );
};

export const useFAB = () => {
  const context = useContext(FABContext);
  if (!context) {
    throw new Error('useFAB must be used within a FABProvider');
  }
  return context;
};

/** Context commands published by the open screen (null = none: the main FAB shows its defaults). */
export const useFABCurrentContextActions = () => useContext(FABActionsContext);

/**
 * Publishes the commands of this screen to the main FAB while the component is mounted.
 * Pass a MEMOIZED array (useMemo) - every new array is published again. Safe without a FABProvider (tests).
 */
export function useFABContextActions(id: string, actions: FABContextAction[] | null | undefined) {
  const api = useContext(FABContext);
  const set = api?.setFABContextActions;
  useEffect(() => {
    if (!set) return;
    set(id, actions && actions.length ? actions : null);
  }, [set, id, actions]);
  useEffect(() => {
    if (!set) return;
    return () => set(id, null);
  }, [set, id]);
}
