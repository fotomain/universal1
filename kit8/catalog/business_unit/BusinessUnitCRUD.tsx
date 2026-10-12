// BusinessUnitCRUD - the business units: the tree of ALL units (any depth) beside a table of the picked unit's sub-units ("All" = every unit).
// CatalogTreeReusableCRUD does the work; this file gives it the unit table: Unit · Code · CFR (select from the cfrTypeTable enumeration, optional) ·
// Effective CFR (grey: own, else the nearest ancestor's) · Path · Active · Description. A unit with a CFR that contradicts the lines posted on it is refused by SQL.
// Route: /catalog/business/unit (drawer: Catalogs > Business units) · SQL: kit8/sql/start/start_sql_structure.sql PART 18
import React, { useCallback, useMemo } from 'react';
import { Text } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import CatalogTreeReusableCRUD from '../../ui/components/tree/CatalogTreeReusableCRUD';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import type { DefRow } from '../product/productModel';
import { BUSINESS_UNIT_TABLE, businessUnitNodes, businessUnitPath, effectiveCfr } from './businessUnitModel';
import { cfrTypeOptions, cfrTypeTitle } from './cfrTypeModel';
import { useBusinessUnitData } from './useBusinessUnitData';

export interface BusinessUnitCRUDProps {
  /** false (default): full CRUD, true: read-only catalog */
  noCrud?: boolean;
}

export default function BusinessUnitCRUD({ noCrud = false }: BusinessUnitCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useBusinessUnitData(true);
  const { rows, cfrRows } = data;
  const nodes = useMemo(() => businessUnitNodes(rows), [rows]);
  const cfrOptions = useMemo(() => cfrTypeOptions(cfrRows), [cfrRows]);

  const columns = useCallback(({ rows: all }: { rows: DefRow<any>[]; noCrud: boolean }): VisualColumn[] => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: 'Business unit', type: 'text', width: 240 },
    { key: 'code', title: 'Code', type: 'text', width: 110 },
    { key: 'cfrAssigned', title: 'CFR', type: 'select', width: 170, allowEmpty: true, placeholder: 'Inherited', options: cfrOptions },
    {
      key: 'effectiveCfr', title: 'Effective CFR', type: 'custom', width: 170, editable: false,
      renderCell: (row) => {
        const eff = effectiveCfr(all, row.rowGUID);
        const own = !!row.rowJSON?.cfrAssigned;
        return <Text numberOfLines={1} testID={`business-unit-effective-${row.rowGUID}`} style={{ color: c.text, opacity: own ? 0.9 : 0.55, fontSize: 13 }}>{eff ? `${cfrTypeTitle(cfrRows, eff)}${own ? '' : ' (inherited)'}` : '-'}</Text>;
      },
      searchText: (row) => cfrTypeTitle(cfrRows, effectiveCfr(all, row.rowGUID)),
    },
    {
      key: 'path', title: 'Path', type: 'custom', width: 380, editable: false,
      renderCell: (row) => <Text numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{businessUnitPath(all, row.rowParentGUID)}</Text>,
      searchText: (row) => businessUnitPath(all, row.rowGUID),
    },
    { key: 'isActive', title: 'Active', type: 'boolean', width: 80 },
    { key: 'description', title: 'Description', type: 'text', width: 320 },
  ], [cfrOptions, cfrRows, c.text]);

  return (
    <CatalogTreeReusableCRUD
      def={BUSINESS_UNIT_TABLE}
      data={data}
      nodes={nodes}
      columns={columns}
      title="Business units"
      icon="account_tree"
      testID="business-unit"
      allLabel="All business units"
      noCrud={noCrud}
      deleteHint="A unit with sub-units, or one used by a project, a line or a contract, is not deleted: deactivate it instead."
      setupHint="Run kit8/sql/start/start_sql_structure.sql (PART 18) in the Supabase SQL editor and sign in."
    />
  );
}
