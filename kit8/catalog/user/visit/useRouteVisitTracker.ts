// Counts the screens the signed-in user opens: a route change calls the RPC route_visit_register (+1 on the row of the user and the route).
// Idle while signed out, while the Organization switch numberOfVisitsFunctionalityEnabled is off, and until the organization is read (so a switched-off organization never counts the first screen).
// The database checks the switch again, so a stale client cannot count either. A failed call is only logged: a visit counter must never break a screen.
import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { useMyOrganization } from '../../organization/useMyOrganization';
import { normalizeRoute } from './routeVisitModel';

export function useRouteVisitTracker(): void {
  const pathname = usePathname();
  const { supabase } = useSupabase();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { organizationGUID, loaded, numberOfVisitsEnabled } = useMyOrganization();
  const last = useRef('');
  const ready = isLoggedIn && !!supabase && numberOfVisitsEnabled && (!organizationGUID || loaded);

  useEffect(() => {
    if (!ready) {
      last.current = '';
      return;
    }
    const route = normalizeRoute(pathname);
    if (!route || route === last.current) return;
    last.current = route;
    Promise.resolve((supabase as any).rpc('route_visit_register', { p_route: route }))
      .then((res: any) => {
        if (res?.error) console.warn('route_visit_register:', res.error.message || res.error);
      })
      .catch((e: any) => console.warn('route_visit_register:', e?.message || e));
  }, [ready, pathname, supabase]);
}
