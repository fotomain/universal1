// Task line plan - the columns of the read-only table (VisualColumn[] of the ReusableTable). One table for ALL the lines of the task:
//   # · Budget item · Genus · Line (role + person / equipment / product) · Period · Coefficient · Qty · Sum for budget · Sum for contract
// The amounts are the root columns of task_line_plan (target = the column), so the footer adds them up per table. Nothing is editable.
import { businessUnitPath } from '../../../../catalog/business_unit/businessUnitModel';
import React from 'react';
import { Text } from 'react-native';
import { rowTitle } from '../../../../catalog/product/crud/productCatalogTools';
import type { VisualColumn } from '../../../../ui/components/table/reusable/reusableTableTypes';
import type { TaskLineCatalogData } from '../finances/taskLineCatalogs';
import { anyResourceTitle } from '../finances/taskLineResource';
import type { TaskLineRow } from '../finances/taskLineModel';
import { pmT } from '../../../i18n/pmT';

export interface PlanColumnsContext {
  data: TaskLineCatalogData;
  /** the lines of the task by rowGUID */
  linesById: Map<string, TaskLineRow>;
  textColor: string;
  mutedColor: string;
}

/** 'Senior developer · Anna Berg' / 'Excavator 20 t · Excavator CAT 320' / 'Laptop' - what the line books (titles are read from the catalogs, never copied) */
export function planLineLabel(data: TaskLineCatalogData, line: TaskLineRow | undefined | null): string {
  const j = line?.rowJSON;
  if (!j) return '';
  const role = j.resourceRoleItem ? rowTitle(data.resourceRole.find((r) => r.rowGUID === j.resourceRoleItem)) : '';
  // a person, an equipment (Time) or a product: the title is looked up by the GUID, so an equipment never shows as an empty product
  const resource = anyResourceTitle(data, j.taskResourceItem);
  return [role, resource].filter(Boolean).join(' · ');
}

/** '2026-10-12 00:00:00' - the day a row stands for (UTC, as it was posted) */
export const planPeriodText = (iso: unknown): string => {
  const d = new Date(String(iso ?? ''));
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 19).replace('T', ' ');
};

const money = (key: string, title: string, width: number, total = true): VisualColumn =>
  ({ key, title: pmT(title), type: 'number', target: key as any, width, editable: false, total, stepper: false } as VisualColumn);

export function buildPlanColumns({ data, linesById, textColor, mutedColor }: PlanColumnsContext): VisualColumn[] {
  const lineOf = (row: { rowParentGUID?: string }) => linesById.get(String(row.rowParentGUID));
  const txt = (s: string, opacity = 1) => <Text numberOfLines={1} style={{ color: opacity === 1 ? textColor : mutedColor, fontSize: 13 }}>{s}</Text>;
  const budgetItemTitle = (row: any) => rowTitle(data.budgetItem.find((b) => b.rowGUID === row.rowJSON?.budgetItemTaskLine)) || String(row.rowJSON?.budgetItemTaskLine ?? '');
  const genusTitle = (row: any) => rowTitle(data.managementGenus.find((g) => g.rowGUID === (row.rowJSON?.taskManagementGenusLine ?? lineOf(row)?.rowParentGUID))) || '';
  // the business unit the day was posted to: kept ON THE POSTED DAY (a later change of the line does not rewrite it)
  const unitTitle = (row: any) => (row.rowJSON?.businessUnitAssigned ? businessUnitPath(data.businessUnit, row.rowJSON.businessUnitAssigned) : '');
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'budgetItem', title: pmT('Budget item'), type: 'custom', width: 180, editable: false, renderCell: (row) => txt(budgetItemTitle(row)), searchText: (row) => budgetItemTitle(row) },
    ...(data.businessUnit.length > 0 ? [{ key: 'businessUnit', title: pmT('Business unit'), type: 'custom', width: 240, editable: false, renderCell: (row) => txt(unitTitle(row)), searchText: (row) => unitTitle(row) } as VisualColumn] : []),
    { key: 'genus', title: pmT('Genus'), type: 'custom', width: 120, editable: false, renderCell: (row) => txt(genusTitle(row)), searchText: (row) => genusTitle(row) },
    { key: 'line', title: pmT('Line'), type: 'custom', width: 260, editable: false, renderCell: (row) => txt(planLineLabel(data, lineOf(row))), searchText: (row) => planLineLabel(data, lineOf(row)) },
    { key: 'period', title: pmT('Period'), type: 'custom', width: 180, editable: false, renderCell: (row) => txt(planPeriodText((row as any).rowPeriodDatetime)), searchText: (row) => planPeriodText((row as any).rowPeriodDatetime) },
    money('rowCoefficient', 'Coefficient', 140, false),
    money('qtyTaskLine', 'Qty', 110),
    money('sumForBudget', 'Sum for budget', 140),
    money('sumForContract', 'Sum for contract', 140),
  ];
}
