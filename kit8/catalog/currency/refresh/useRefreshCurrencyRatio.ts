// Currency list: "Refresh rates" for all currencies and for one line. Shows the result in the snackbar;
// the open rate lists follow by Supabase Realtime.
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { supabase } from '../../../supabase/supabase';
import { CURRENCY_ENTITY } from '../currencyModel';
import { currencyRefreshMessage, refreshCurrencyRatio } from './refreshCurrencyRatio';
import { uploadAllDataFromDate } from './uploadAllDataFromDate';

export const REFRESH_ALL = '*';

export function useRefreshCurrencyRatio() {
  const dispatch = useDispatch();
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const isLoggedIn = useSelector(selectIsLoggedIn);
  /** REFRESH_ALL, a currency rowGUID, or null = idle */
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(async (currencyGUID?: string) => {
    if (busy) return;
    if (!isLoggedIn) {
      dispatch(showSnackbar({ message: 'Sign in to refresh the exchange rates.' }));
      return;
    }
    const list = currencyGUID ? currencies.filter((c) => c.rowGUID === currencyGUID) : currencies.filter((c) => c?.rowJSON?.isActive !== false);
    setBusy(currencyGUID ?? REFRESH_ALL);
    try {
      const result = await refreshCurrencyRatio({ currencies: list, supabase });
      dispatch(showSnackbar({ message: currencyRefreshMessage(result), duration: 7000 }));
    } catch (e: any) {
      dispatch(showSnackbar({ message: `Rates were not refreshed: ${e?.message || e}` }));
    } finally {
      setBusy(null);
    }
  }, [busy, currencies, dispatch, isLoggedIn]);

  /** "Upload all data from a date" of a card: every missing day from the date to today, for all the currencies (crosses) */
  const uploadFrom = useCallback(async (currencyGUID: string, fromDate: string): Promise<boolean> => {
    if (busy) return false;
    if (!isLoggedIn) {
      dispatch(showSnackbar({ message: 'Sign in to upload the exchange rates.' }));
      return false;
    }
    setBusy(currencyGUID);
    try {
      const result = await uploadAllDataFromDate({ currencyGUID, fromDate, currencies, supabase });
      dispatch(showSnackbar({ message: currencyRefreshMessage(result), duration: 9000 }));
      return true;
    } catch (e: any) {
      dispatch(showSnackbar({ message: `Rates were not uploaded: ${e?.message || e}` }));
      return false;
    } finally {
      setBusy(null);
    }
  }, [busy, currencies, dispatch, isLoggedIn]);

  return { busy, refreshAll: () => run(), refreshOne: (currencyGUID: string) => run(currencyGUID), uploadFrom };
}
