// The app's Redux store for code that is not a React component (commands, gesture callbacks,
// share helpers) and for components that may be rendered without a <Provider> (unit tests).
// WithState.tsx sets it once the store is created.

import React from 'react';
import { ReactReduxContext } from 'react-redux';

let appStore: any = null;

export function setAppStore(store: any) {
  appStore = store;
}

export function getAppStore(): any {
  return appStore;
}

/** Dispatch from anywhere; a no-op until the store exists (tests). */
export function appDispatch(action: any) {
  try {
    appStore?.dispatch?.(action);
  } catch (e) {
    console.warn('appDispatch failed', e);
  }
}

/** uxuiState of the store (undefined before the store exists). */
export function getUxuiState(): any {
  try {
    return appStore?.getState?.()?.uxuiState;
  } catch {
    return undefined;
  }
}

const noSubscribe = () => () => {};

/**
 * useSelector that also works without a <Provider> (returns selector(undefined) then):
 * PM components are unit-tested without the Redux store.
 */
export function useSafeSelector<T>(selector: (state: any) => T): T {
  const ctx = React.useContext(ReactReduxContext as any) as any;
  const store = ctx?.store ?? appStore;
  const get = () => selector(store ? store.getState() : undefined);
  return React.useSyncExternalStore(store ? store.subscribe : noSubscribe, get, get);
}

/** dispatch of the nearest <Provider> / the app store; a no-op without a store. */
export function useSafeDispatch(): (action: any) => void {
  const ctx = React.useContext(ReactReduxContext as any) as any;
  const store = ctx?.store ?? appStore;
  return React.useCallback((action: any) => store?.dispatch?.(action), [store]);
}
