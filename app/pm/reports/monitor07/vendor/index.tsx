import React from 'react';
import { View } from 'react-native';
import { PMTooltipLayer } from '../../../../../kit8/pm/inner/tooltip/PMTooltip';
import Monitor07VendorBalance from '../../../../../kit8/pm/reports/partner_balance/Monitor07VendorBalance';

// route: /pm/reports/monitor07/vendor - Monitor07VendorBalance (hamburger menu → Reports → Monitor07 Vendor balance)
export default function Monitor07VendorRoute() {
  return (
    <View style={{ flex: 1 }}>
      <Monitor07VendorBalance />
      <PMTooltipLayer />
    </View>
  );
}
