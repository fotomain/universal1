import { useSelector } from 'react-redux';
import { checkIsAppAdmin } from './rolePermissions';

export function useIsAppAdmin(): boolean {
  return useSelector((state: any) => checkIsAppAdmin(state));
}
