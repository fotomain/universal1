import React from 'react';
import { router } from 'expo-router';
import CreateInitialProgramData from '../../kit8/initial/data/code/CreateInitialProgramData';

// route /system/initialdata - System settings > Create initial data: the list of the initial program data (the permission matrix, genus, budget items, calendars ...) with a check box near each;
// Create writes what the database does not have yet (documentation/INITIAL_DATA_WBS.html). The first run of the application opens the same screen by itself (InitialDataGate in app/_layout.tsx).
export default function InitialDataRoute() {
  return <CreateInitialProgramData onClose={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} />;
}
