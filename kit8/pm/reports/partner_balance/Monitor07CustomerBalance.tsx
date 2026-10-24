// Monitor07CustomerBalance - what the customers owe us (route /pm/reports/monitor07/customer). The screen is PartnerBalanceDashboard with the role 'customer'.
import React from 'react';
import PartnerBalanceDashboard from './PartnerBalanceDashboard';

export default function Monitor07CustomerBalance() {
  return <PartnerBalanceDashboard role="customer" />;
}
