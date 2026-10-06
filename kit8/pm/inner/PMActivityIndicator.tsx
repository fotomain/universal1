// Deprecated: PMActivityIndicator has been refactored to ActivityIndicatorCircleApp.
// Use ActivityIndicatorCircleApp from kit8/ui/components/activityindicator.
import ActivityIndicatorCircleApp, {
  ActivityIndicatorCircleAppProps,
  ACTIVITY_INDICATOR_CIRCLE_APP_SIZE,
} from '../../ui/components/activityindicator/ActivityIndicatorCircleApp';

export const PM_ACTIVITY_INDICATOR_SIZE = ACTIVITY_INDICATOR_CIRCLE_APP_SIZE;
export type PMActivityIndicatorProps = ActivityIndicatorCircleAppProps;

export const PMActivityIndicator = ActivityIndicatorCircleApp;
export default ActivityIndicatorCircleApp;
