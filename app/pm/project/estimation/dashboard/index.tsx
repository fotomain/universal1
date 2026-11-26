import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import EstimationDashboard from '../../../../../kit8/pm/estimation/EstimationDashboard';
import RecordingSignInGate from '../../../../../kit8/ui/components/media/common/RecordingSignInGate';

const ROUTE = '/pm/project/estimation/dashboard';

// the Estimation dashboard of a project (?projectGUID=...; without it the project selected in the project dashboard). Design: documentation/ESTIMATION/dashboard/claude/ESTIMATION_DASHBOARD_WBS.html
// SIGNED-IN users only: a guest sees the Sign in card and comes back here (with ?projectGUID) after the sign in
export default function EstimationDashboardScreen() {
  const params = useLocalSearchParams<{ projectGUID?: string }>();
  const guid = typeof params?.projectGUID === 'string' && params.projectGUID ? params.projectGUID : null;
  const returnTo = guid ? `${ROUTE}?projectGUID=${encodeURIComponent(guid)}` : ROUTE;
  return (
    <RecordingSignInGate kind="estimation" returnTo={returnTo}>
      <EstimationDashboard />
    </RecordingSignInGate>
  );
}
