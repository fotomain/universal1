/** @jest-environment jsdom */
// The VAT % column of the task lines (Task-Edit, every tab): wide enough for two digits next to the calculator icon and the arrows.
jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/pm/inner/buttons/PMIconButton', () => ({ PMIconButton: () => null }));
jest.mock('../../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('../../../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import { buildTaskLineColumns, VAT_PERCENT_COLUMN_WIDTH } from '../../../../../kit8/pm/view/task/finances/taskLineColumns';
import { emptyTaskLineCatalogs } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';

it('the VAT % column is wide enough for two digits next to the calculator icon and the arrows, on every tab that has it', () => {
  expect(VAT_PERCENT_COLUMN_WIDTH).toBeGreaterThanOrEqual(140);
  for (const g of ['Time', 'Material', 'Expense', 'Revenue']) {
    const genus = (taskLineGenusDef as any)(g);
    if (!genus) continue;
    const cols: any[] = buildTaskLineColumns({ data: emptyTaskLineCatalogs(), genus, textColor: '#000', errorColor: '#f00', showErrors: false });
    const vat = cols.find((c) => c.key === 'vat');
    if (vat) expect(vat.width).toBe(VAT_PERCENT_COLUMN_WIDTH);
  }
});
