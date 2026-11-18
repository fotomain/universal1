import React from 'react';
import { View } from 'react-native';
import { PMTooltipLayer } from '../../../../kit8/pm/inner/tooltip/PMTooltip';
import Monitor08Dashboard from '../../../../kit8/pm/reports/consolidation/Monitor08Dashboard';

// route: /pm/reports/monitor08 - Monitor08 Consolidation (hamburger menu → Reports → Monitor08 Consolidation): the money of all the projects in the consolidation currency of the organization
export default function Monitor08Route() {
  return (
    <View style={{ flex: 1 }}>
      <Monitor08Dashboard />
      <PMTooltipLayer />
    </View>
  );
}
