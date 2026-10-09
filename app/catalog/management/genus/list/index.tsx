import React from 'react';
import ManagementGenusDashboardCRUD from '../../../../../kit8/catalog/management/genus/ManagementGenusDashboardCRUD';

// read-only by default (noCrud); the lock button in the header turns editing on
export default function ManagementGenusListScreen() {
  return <ManagementGenusDashboardCRUD />;
}
