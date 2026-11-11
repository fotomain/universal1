// The ACTIVE organization (userState.userOrganization.rowGUID) for hooks that may run without a redux Provider (some tests): '' = none / not known yet.
import { useContext, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';

const noSubscribe = () => () => {};

export function useActiveOrganizationGUID(): string {
  const redux = useContext(ReactReduxContext);
  return useSyncExternalStore(
    redux ? redux.store.subscribe : noSubscribe,
    () => (redux?.store.getState() as any)?.activeUserState?.userOrganization?.rowGUID || '',
    () => '',
  );
}
