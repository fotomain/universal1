// Departament catalog - table + row shape + tree hierarchy + validation
//   SQL: public."departamentTable" (kit8/sql/init/done/create_departament_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = organizationTable.rowGUID (the owning organization) ·
//   rowParentGUID = parent departament rowGUID | 'empty' (hierarchy as a tree) ·
//   orderInList · rowJSON = DepartamentRowJSON · created_at / updated_at

import type { CardItem } from '../../ui/components/list/web/lib/types';

/** Supabase table name (SQL: departamentTable). */
export const departamentTable = 'departamentTable';
/** SystemMetaData / redux entity key. */
export const DEPARTAMENT_ENTITY = 'departamentReusable';

export const DEPARTAMENT_ROUTES = {
  list: '/catalog/departament',
  edit: '/catalog/departament/edit',
} as const;

export interface DepartamentRowJSON {
  /** Department name, e.g. "Operations", "Engineering", "Frontend Team" */
  departmentName: string;
  /** Short department code, e.g. "ENG", "OPS", "HR" */
  departmentCode?: string;
  /** Description or notes */
  description?: string;
  /** Head of department / Manager (personTable rowGUID) */
  headPersonGUID?: string | null;
  /** Cached name of head person for quick display */
  headPersonName?: string | null;
  /** Active status */
  isActive: boolean;
}

export interface DepartamentRow {
  rowGUID: string;
  /** Organization that owns this department */
  rowOwnerGUID: string;
  /** Parent department rowGUID for hierarchy, or 'empty' for top-level */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: DepartamentRowJSON;
  created_at?: string;
  updated_at?: string;
}

export interface TreeDepartamentNode {
  row: DepartamentRow;
  depth: number;
  children: TreeDepartamentNode[];
}

export const emptyDepartament = (ownerOrganizationGUID = ''): { rowOwnerGUID: string; rowParentGUID: string; rowJSON: DepartamentRowJSON } => ({
  rowOwnerGUID: ownerOrganizationGUID,
  rowParentGUID: 'empty',
  rowJSON: {
    departmentName: '',
    departmentCode: '',
    description: '',
    headPersonGUID: null,
    headPersonName: null,
    isActive: true,
  },
});

/** Normalizes department row values before persisting */
export function normalizeDepartament(raw: Partial<DepartamentRowJSON>): DepartamentRowJSON {
  const name = (raw.departmentName || '').trim();
  const code = (raw.departmentCode || '').trim().toUpperCase();
  const desc = (raw.description || '').trim();
  const headGUID = raw.headPersonGUID ? raw.headPersonGUID.trim() : null;
  const headName = raw.headPersonName ? raw.headPersonName.trim() : null;
  const isActive = raw.isActive !== false;

  return {
    departmentName: name,
    ...(code ? { departmentCode: code } : {}),
    ...(desc ? { description: desc } : {}),
    headPersonGUID: headGUID || null,
    headPersonName: headName || null,
    isActive,
  };
}

export type DepartamentErrors = Partial<Record<keyof DepartamentRowJSON | 'rowOwnerGUID' | 'rowParentGUID', string>>;

/** Validates departament */
export function validateDepartament(
  raw: Partial<DepartamentRowJSON>,
  rowOwnerGUID?: string,
  rowGUID?: string,
  rowParentGUID?: string,
  existingRows?: DepartamentRow[]
): { valid: boolean; errors: DepartamentErrors } {
  const errors: DepartamentErrors = {};
  const name = (raw.departmentName || '').trim();

  if (!name) {
    errors.departmentName = 'Department name is required';
  } else if (name.length < 2) {
    errors.departmentName = 'Department name must be at least 2 characters';
  }

  if (rowOwnerGUID !== undefined && !rowOwnerGUID.trim()) {
    errors.rowOwnerGUID = 'Organization is required';
  }

  // Prevent cycle in hierarchy
  if (rowGUID && rowParentGUID && rowParentGUID !== 'empty' && existingRows) {
    if (rowGUID === rowParentGUID) {
      errors.rowParentGUID = 'A department cannot be its own parent';
    } else if (!canSelectParentDepartament(rowParentGUID, rowGUID, existingRows)) {
      errors.rowParentGUID = 'Circular hierarchy detected (cannot select a descendant as parent)';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Check if targetParentGUID can be chosen as parent for currentGUID without creating a cycle */
export function canSelectParentDepartament(
  targetParentGUID: string,
  currentGUID: string,
  rows: DepartamentRow[]
): boolean {
  if (targetParentGUID === currentGUID) return false;
  const descendantSet = getDescendantGUIDs(currentGUID, rows);
  return !descendantSet.has(targetParentGUID);
}

/** Returns a Set of all descendant GUIDs under currentGUID */
export function getDescendantGUIDs(currentGUID: string, rows: DepartamentRow[]): Set<string> {
  const descendants = new Set<string>();
  const childrenMap = new Map<string, string[]>();

  for (const r of rows) {
    const parent = r.rowParentGUID || 'empty';
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(r.rowGUID);
  }

  const queue = [...(childrenMap.get(currentGUID) || [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (!descendants.has(next)) {
      descendants.add(next);
      const kids = childrenMap.get(next) || [];
      queue.push(...kids);
    }
  }

  return descendants;
}

/** Builds hierarchical tree nodes from flat list of departments */
export function buildDepartamentTree(rows: DepartamentRow[]): TreeDepartamentNode[] {
  const idMap = new Map<string, DepartamentRow>();
  const childrenMap = new Map<string, DepartamentRow[]>();

  for (const r of rows) {
    idMap.set(r.rowGUID, r);
    const parent = r.rowParentGUID && r.rowParentGUID !== 'empty' ? r.rowParentGUID : 'root';
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(r);
  }

  // Sort children by orderInList
  childrenMap.forEach((list) => {
    list.sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  });

  function createNode(row: DepartamentRow, depth: number): TreeDepartamentNode {
    const kids = childrenMap.get(row.rowGUID) || [];
    return {
      row,
      depth,
      children: kids.map((k) => createNode(k, depth + 1)),
    };
  }

  const rootRows = childrenMap.get('root') || [];
  return rootRows.map((r) => createNode(r, 0));
}

/** Flattens the tree into depth-first hierarchy list with depth and hasChildren */
export function flattenDepartamentTree(
  rows: DepartamentRow[]
): { row: DepartamentRow; depth: number; hasChildren: boolean; parentId: string | null }[] {
  const tree = buildDepartamentTree(rows);
  const out: { row: DepartamentRow; depth: number; hasChildren: boolean; parentId: string | null }[] = [];

  function traverse(node: TreeDepartamentNode) {
    out.push({
      row: node.row,
      depth: node.depth,
      hasChildren: node.children.length > 0,
      parentId: node.row.rowParentGUID && node.row.rowParentGUID !== 'empty' ? node.row.rowParentGUID : null,
    });
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const root of tree) {
    traverse(root);
  }

  return out;
}

/** Maps a DepartamentRow to CardItem for ListWebCardsComponent */
export function departamentToCard(
  row: DepartamentRow,
  index = 0,
  depth = 0,
  hasChildren = false
): CardItem {
  const json = row.rowJSON || ({} as DepartamentRowJSON);
  const code = json.departmentCode ? `[${json.departmentCode}] ` : '';
  const title = `${code}${json.departmentName || 'Untitled Department'}`;

  const details = [
    json.headPersonName ? `Lead: ${json.headPersonName}` : null,
    json.description ? json.description : null,
    hasChildren ? 'Has sub-departments' : null,
  ].filter(Boolean).join(' · ');

  return {
    id: row.rowGUID,
    title,
    description: details || 'No details',
    orderInList: row.orderInList ?? index,
    rawItem: row,
    parentId: row.rowParentGUID && row.rowParentGUID !== 'empty' ? row.rowParentGUID : null,
    depth,
    hasChildren,
  };
}
