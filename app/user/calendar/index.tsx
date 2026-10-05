import React from 'react';
import UserCalendarScreen from '../../../kit8/catalog/user/calendar/UserCalendarScreen';

// route: /user/calendar   (?new=event|task|birthday · ?eventGUID=<uuid> · ?date=YYYY-MM-DD)
export default function UserCalendarRoute() {
  return <UserCalendarScreen />;
}
