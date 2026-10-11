import React from 'react';
import DistributionTypeCRUD from '../../../../kit8/catalog/distribution/DistributionTypeCRUD';

// read-only by default (noCrud), like the management genus; the lock button in the header turns editing on
export default function DistributionListScreen() {
  return <DistributionTypeCRUD />;
}
