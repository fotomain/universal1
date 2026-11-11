// The rows of the matrix editor (pure) and the writes an edit needs.
import { DELIVERED_OWNER, MATRIX_PROFILES, matrixRowsOf, matrixWrites, type CrudRow } from '../../kit8/permissions/permissionMatrixModel';

const row = (owner: string, profile: string, table: string, set: string, guid = `${owner}.${profile}.${table}`): CrudRow => ({ rowGUID: guid, rowOwnerGUID: owner, rowParentGUID: profile, rowJSON: { permissionTable: table, permissionSet: set } });
const raw: CrudRow[] = [
  row(DELIVERED_OWNER, 'permissionProjectManager', 'partnerTable', 'RC'),
  row(DELIVERED_OWNER, 'permissionProjectReadOnly', 'partnerTable', 'R'),
  row(DELIVERED_OWNER, 'permissionProjectManager', 'project_task_table', 'CRUD'),
  row('orgA', 'permissionProjectManager', 'partnerTable', 'CRUD'),     // the organization's own row
  row('orgB', 'permissionProjectReadOnly', 'partnerTable', 'N'),       // another organization: not shown
  { rowGUID: 'bad', rowOwnerGUID: DELIVERED_OWNER, rowParentGUID: 'x', rowJSON: {} },
];

describe('matrixRowsOf', () => {
  const rows = matrixRowsOf(raw, 'orgA');
  it('one row per table, sorted; the organization row wins over the delivered one; other organizations are ignored', () => {
    expect(rows.map((r) => r.table)).toEqual(['partnerTable', 'project_task_table']);
    const p = rows[0];
    expect(p.cells.permissionProjectManager).toEqual({ set: 'CRUD', overrideGUID: 'orgA.permissionProjectManager.partnerTable', delivered: 'RC' });
    expect(p.cells.permissionProjectReadOnly).toEqual({ set: 'R', overrideGUID: null, delivered: 'R' });
    expect(p.overridden).toBe(1);
    expect(rows[1].overridden).toBe(0);
  });
  it('nothing in, nothing out', () => {
    expect(matrixRowsOf(null, 'orgA')).toEqual([]);
  });
});

describe('matrixWrites', () => {
  const rows = matrixRowsOf(raw, 'orgA');
  it('a changed cell without an own row is an insert, with one an update', () => {
    expect(matrixWrites(rows, { partnerTable: { permissionProjectReadOnly: 'N' } })).toEqual([{ kind: 'insert', table: 'partnerTable', profile: 'permissionProjectReadOnly', set: 'N' }]);
    expect(matrixWrites(rows, { partnerTable: { permissionProjectManager: 'RUD' } })).toEqual([{ kind: 'update', guid: 'orgA.permissionProjectManager.partnerTable', set: 'RUD' }]);
  });
  it('setting a cell back to the delivered letters removes the own row; an unchanged cell writes nothing', () => {
    expect(matrixWrites(rows, { partnerTable: { permissionProjectManager: 'RC' } })).toEqual([{ kind: 'delete', guid: 'orgA.permissionProjectManager.partnerTable' }]);
    expect(matrixWrites(rows, { partnerTable: { permissionProjectManager: 'CRUD', permissionProjectReadOnly: 'R' } })).toEqual([]);
    expect(matrixWrites(rows, {})).toEqual([]);
  });
  it('a profile that has no row for the table is not written (the matrix is the owner\'s sheet: no new cells here)', () => {
    expect(matrixWrites(rows, { partnerTable: { permissionTaskManager: 'CRUD' } })).toEqual([]);
    expect(MATRIX_PROFILES).toHaveLength(11);
  });
});
