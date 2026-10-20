import React from 'react';
import { View } from 'react-native';
import { PMTooltipLayer } from '../../../../kit8/pm/inner/tooltip/PMTooltip';
import Monitor02Dashboard from '../../../../kit8/pm/reports/monitor02/Monitor02Dashboard';

// route: /pm/reports/monitor02 - Monitor02_ROINow (hamburger menu → Reports → Monitor02 ROI now): the ROI of the four kinds per project (and per task) as the data stands now
export default function Monitor02Route() {
  return (
    <View style={{ flex: 1 }}>
      <Monitor02Dashboard />
      <PMTooltipLayer />
    </View>
  );
}
