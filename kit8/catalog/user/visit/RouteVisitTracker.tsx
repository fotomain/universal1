// Mounted once in app/_layout.tsx: runs useRouteVisitTracker, draws nothing.
import { useRouteVisitTracker } from './useRouteVisitTracker';

export default function RouteVisitTracker(): null {
  useRouteVisitTracker();
  return null;
}
