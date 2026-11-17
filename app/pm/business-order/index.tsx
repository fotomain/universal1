import React, { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PM80BusinessOrderSettings from '../../../apps/appPM80/home/businessOrder/PM80BusinessOrderSettings';
import { parseSelectionParam } from '../../../apps/appPM80/home/businessOrder/businessOrderModel';

// route /pm/business-order?projects=all|<id>,<id>&returnTo=/home - the setup of the "Business order" of the PM80 home
// (the app bar's Back button goes to returnTo = Home)
export default function BusinessOrderScreen() {
  const params = useLocalSearchParams<{ projects?: string }>();
  const selection = useMemo(() => parseSelectionParam(params.projects), [params.projects]);
  return <PM80BusinessOrderSettings selection={selection} />;
}
