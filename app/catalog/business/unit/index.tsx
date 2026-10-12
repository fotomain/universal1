import React from 'react';
import BusinessUnitCRUD from '../../../../kit8/catalog/business_unit/BusinessUnitCRUD';

// route /catalog/business/unit - the business units (tree of all units + table); editing is on, the lock button in the header makes it read-only
export default function BusinessUnitScreen() {
  return <BusinessUnitCRUD />;
}
