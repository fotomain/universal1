import React from 'react';
import BIMToProjectImport from '../../../../kit8/pm/bim/import/BIMToProjectImport';

// route: /pm/bim/import (?projectGUID=<project> to import into that project; without it the importer offers BIM example 1)
export default function BimImportRoute() {
  return <BIMToProjectImport />;
}
