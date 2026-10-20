import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PMTooltipLayer } from '../../../../kit8/pm/inner/tooltip/PMTooltip';
import Monitor03Dashboard from '../../../../kit8/pm/reports/monitor03/Monitor03Dashboard';

// route: /pm/reports/monitor03 - Monitor03_ROIHistory (hamburger menu → Reports → Monitor03 ROI history): the ROI of the four kinds over time for one project; ?projectGUID= starts with that project
export default function Monitor03Route() {
  const { projectGUID } = useLocalSearchParams<{ projectGUID?: string }>();
  return (
    <View style={{ flex: 1 }}>
      <Monitor03Dashboard projectGUID={projectGUID || null} />
      <PMTooltipLayer />
    </View>
  );
}
