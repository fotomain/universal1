import React from 'react';
import ManagementCalendarCRUD from '../../../../../kit8/catalog/management/calendar/ManagementCalendarCRUD';

// route /catalog/management/calendar/list - the calendars (folders tree + table) and the days of the selected one; editing is on, the lock button makes it read-only
export default function ManagementCalendarListScreen() {
  return <ManagementCalendarCRUD />;
}
