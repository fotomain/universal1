/** @jest-environment jsdom */
// The column "RACI" of the Time tab (documentation/PERMISSIONS_WBS.html section 3.2): a select of the four rows of managementRACIGenusTable on rowJSON.raciItem that cannot be emptied;
// the other genus have none. The catalog and the model: __tests__/catalog/management/raciGenus.test.ts.
jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#f00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/pm/inner/buttons/PMIconButton', () => ({ PMIconButton: () => null }));
jest.mock('../../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('../../../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import { RACI_GUIDS } from '../../../../../kit8/catalog/management/raci_genus/raciGenusModel';
import { buildTaskLineColumns } from '../../../../../kit8/pm/view/task/finances/taskLineColumns';
import { emptyTaskLineCatalogs } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';

const rows = RACI_GUIDS.slice().reverse().map((g, i) => ({ rowGUID: g, rowOwnerGUID: 'managementRACIGenusCatalog', rowParentGUID: 'empty', orderInList: 4000 - i * 1000, rowJSON: { title: g.replace(/^raci|GUID$/g, '') } }) as any);
const build = (genus: string, raciGenus: any[]) =>
  buildTaskLineColumns({ data: { ...emptyTaskLineCatalogs(), raciGenus }, genus: taskLineGenusDef(genus)!, textColor: '#000', errorColor: '#f00', showErrors: false }) as any[];

describe('the RACI column', () => {
  it('a Time line has it: a select on raciItem that cannot be emptied, options = the four GUIDs by orderInList', () => {
    const col = build('timeGenus', rows).find((c) => c.key === 'raci');
    expect(col).toBeTruthy();
    expect([col.type, col.field, col.allowEmpty, col.title]).toEqual(['select', 'raciItem', false, 'RACI']);
    expect(col.options.map((o: any) => o.value)).toEqual([...RACI_GUIDS]);
  });
  it('while the catalog is not read yet the four seed items are offered', () => {
    const col = build('timeGenus', []).find((c) => c.key === 'raci');
    expect(col.options.map((o: any) => o.label)).toEqual(['Responsible', 'Accountable', 'Consulted', 'Informed']);
  });
  it('Material, Expense and Revenue lines have none', () => {
    for (const g of ['materialGenus', 'expenseGenus', 'revenueGenus']) expect(build(g, rows).some((c) => c.key === 'raci')).toBe(false);
  });
});
