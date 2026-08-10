import React, { createContext, useContext, useRef, useCallback } from 'react';

type FABListener = (openFabId: string | null) => void;

interface FABContextType {
  registerFAB: (id: string, listener: FABListener) => () => void;
  notifyFABOpen: (id: string) => void;
  notifyFABClose: (id: string) => void;
  closeAllFABs: () => void;
}

const FABContext = createContext<FABContextType | null>(null);

export const FABProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const listenersRef = useRef<Map<string, FABListener>>(new Map());
  const activeFabIdRef = useRef<string | null>(null);

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

  return (
    <FABContext.Provider value={{ registerFAB, notifyFABOpen, notifyFABClose, closeAllFABs }}>
      {children}
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
