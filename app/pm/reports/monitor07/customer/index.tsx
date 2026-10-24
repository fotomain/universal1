import React from 'react';
import { View } from 'react-native';
import { PMTooltipLayer } from '../../../../../kit8/pm/inner/tooltip/PMTooltip';
import Monitor07CustomerBalance from '../../../../../kit8/pm/reports/partner_balance/Monitor07CustomerBalance';

// route: /pm/reports/monitor07/customer - Monitor07CustomerBalance (hamburger menu → Reports → Monitor07 Customer balance)
export default function Monitor07CustomerRoute() {
  return (
    <View style={{ flex: 1 }}>
      <Monitor07CustomerBalance />
      <PMTooltipLayer />
    </View>
  );
}
