// Monitor07VendorBalance - what we owe the vendors (route /pm/reports/monitor07/vendor). The screen is PartnerBalanceDashboard with the role 'vendor'.
import React from 'react';
import PartnerBalanceDashboard from './PartnerBalanceDashboard';

export default function Monitor07VendorBalance() {
  return <PartnerBalanceDashboard role="vendor" />;
}
