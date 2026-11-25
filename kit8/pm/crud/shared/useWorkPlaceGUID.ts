// The work place of the signed-in user (device / browser: kit8/providers/WithUserWorkPlace) for the dashboard settings tables.
// null until the provider has read / made it (a few ms after the start): the settings are neither read nor saved before that.
import { useUserWorkPlace } from '../../../providers/WithUserWorkPlace';

export function usePMWorkPlaceGUID(): string | null {
  const { userWorkPlaceGUID } = useUserWorkPlace();
  return userWorkPlaceGUID || null;
}
