/** @jest-environment jsdom */
// WorkCenterCRUD: a ReusableTable with a tree of folders = business units (only the units that hold a work center), "+" opens the New work center window, the base / base variant selects follow
// the kind of the row, "Copy Variant settings" copies the base variant once and asks before it overwrites a variant the work center has.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../pm/ui/pmUiTestKit';

const mockData: Record<string, any> = {};
jest.mock('../../../kit8/catalog/work_center/useWorkCenterData', () => ({ useWorkCenterData: () => mockData }));
jest.mock('../../../kit8/catalog/management/calendar/useResourceCalendarColumn', () => ({
  useResourceCalendarColumn: () => ({ key: 'resourceCalendar', title: 'Calendar', type: 'select', field: 'resourceCalendar', options: [] }),
  resourceCalendarOptions: (rows: any[]) => rows.map((r) => ({ value: r.rowGUID, label: r.rowGUID })),
}));
jest.mock('../../../kit8/catalog/management/calendar/useManagementCalendarData', () => ({ useManagementCalendarData: () => ({ rows: [{ rowGUID: 'cal-6h' }], loaded: true, error: '', reload: jest.fn() }) }));
const mockCopy = jest.fn(() => Promise.resolve('new-variant'));
jest.mock('../../../kit8/catalog/work_center/workCenterApi', () => ({ copyWorkCenterVariantSettings: (...a: any[]) => (mockCopy as any)(...a) }));
const mockTable = jest.fn();
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({
  __esModule: true,
  default: (p: any) => {
    mockTable(p);
    const copy = p.visualColumns.find((c: any) => c.key === 'copyVariant');
    const rows: any[] = (globalThis as any).__wcRows || [];
    return require('react').createElement('div', { 'data-testid': p.testID }, rows.map((r) => require('react').createElement('span', { key: r.rowGUID }, copy.renderCell(r, 0, () => {}))));
  },
}));
const mockModal = jest.fn();
jest.mock('../../../kit8/catalog/work_center/WorkCenterNewModal', () => ({ __esModule: true, default: (p: any) => { mockModal(p); return null; } }));
const mockCreateOne = jest.fn((p: any) => ({ type: 'createOne', p }));
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { workCenterReusable: { actions: { createOne: (p: any) => mockCreateOne(p) } } } }));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'wc-new' }));
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: 'formRound' }) }));
const mockDispatch = jest.fn();
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch }));

const WorkCenterCRUD = require('../../../kit8/catalog/work_center/WorkCenterCRUD').default;

const row = (rowGUID: string, rowJSON: any = {}, rowParentGUID = 'empty', rowOwnerGUID = 'x', orderInList = 0): any => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const lastModal = () => mockModal.mock.calls.at(-1)![0];
const col = (key: string) => lastTable().visualColumns.find((c: any) => c.key === key);

beforeEach(() => {
  Object.keys(mockData).forEach((k) => delete mockData[k]);
  Object.assign(mockData, {
    data: {
      workCenter: [
        row('w-anna', { workCenterTitle: 'Anna K', workCenterKind: 'person', workCenterBase: 'p-anna', workCenterBaseVariant: 'k1', workCenterVariant: 'k1' }, 'bu-key'),
        row('w-crane', { workCenterKind: 'equipment', workCenterBase: 'e-crane' }, 'bu-it'),
      ],
      businessUnit: [row('bu-ent', { title: 'Enterprise' }), row('bu-sales', { title: 'Sales' }, 'bu-ent'), row('bu-key', { title: 'Key accounts' }, 'bu-sales'), row('bu-it', { title: 'IT' }, 'bu-ent'), row('bu-hr', { title: 'HR' }, 'bu-ent')],
      person: [row('p-anna', { personFirstName: 'Anna', personLastName: 'K' }), row('p-boris', { personFirstName: 'Boris', personLastName: 'M' })],
      equipment: [row('e-crane', { equipmentTitle: 'Tower crane' }), row('e-exc', { equipmentTitle: 'Excavator' })],
      partner: [row('pa-sup', { partnerTitle: 'Acme', partnerIsSupplier: true })],
      variant: [row('bv-1', { title: 'Senior, English', descriptorKey: 'k1' }, 'empty', 'p-anna'), row('own-1', { title: 'Senior, English', descriptorKey: 'k1' }, 'empty', 'w-anna'), row('bv-2', { title: 'Middle', descriptorKey: 'k2' }, 'empty', 'p-boris')],
    },
    loaded: true, error: '', reload: jest.fn(),
  });
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('a ReusableTable on the work center entity: all the business units as parents, the work center catalog as owner, "+" opens the New work center window', () => {
  renderUI(<WorkCenterCRUD />);
  expect(lastTable()).toMatchObject({ entityName: 'workCenterReusable', itemLabel: 'Work center', listOwnerGUID: 'workCenterCatalog', listParentGUID: '*', realtime: true });
  expect(typeof lastTable().onAdd).toBe('function');
  expect(textOf('work-center')).toContain('2 work centers');
  expect(lastModal().visible).toBe(false);
  act(() => lastTable().onAdd());
  expect(lastModal().visible).toBe(true);
});

it('the columns, in order', () => {
  renderUI(<WorkCenterCRUD />);
  expect(lastTable().visualColumns.map((c: any) => c.key)).toEqual(['n', 'title', 'kind', 'base', 'baseVariant', 'variant', 'copyVariant', 'resourceCalendar', 'businessUnit', 'isActive']);
  expect(col('kind')).toMatchObject({ type: 'select', field: 'workCenterKind', editable: false });
  expect(col('variant')).toMatchObject({ editable: false });
  expect(col('businessUnit')).toMatchObject({ type: 'select', target: 'rowParentGUID', allowEmpty: false });
  expect(col('businessUnit').options.map((o: any) => o.label)).toEqual(['Enterprise', 'Enterprise › HR', 'Enterprise › IT', 'Enterprise › Sales', 'Enterprise › Sales › Key accounts']);
});

it('the base and the base variant depend on the kind (and the base) of the ROW', () => {
  renderUI(<WorkCenterCRUD />);
  const anna = lastTable().visualColumns.find((c: any) => c.key === 'base').options(row('w-anna', { workCenterKind: 'person' }));
  expect(anna.map((o: any) => o.label)).toEqual(['Anna K', 'Boris M']);                 // the one this work center has stays; a person that has another work center would not be here
  const crane = col('base').options(row('w-crane', { workCenterKind: 'equipment' }));
  expect(crane.map((o: any) => o.label)).toEqual(['Excavator', 'Tower crane']);
  expect(col('base').options(row('w-sup', { workCenterKind: 'partner' })).map((o: any) => o.label)).toEqual(['Acme']);
  expect(col('baseVariant').options(row('w-anna', { workCenterBase: 'p-anna' }))).toEqual([{ value: 'k1', label: 'Senior, English' }]);
  expect(col('baseVariant').options(row('w-boris', { workCenterBase: 'p-boris' }))).toEqual([{ value: 'k2', label: 'Middle' }]);
  expect(col('baseVariant').options(row('w-crane', { workCenterBase: 'e-crane' }))).toEqual([]);
  expect(col('variant').options(row('w-anna'))).toEqual([{ value: 'k1', label: 'Senior, English' }]);
});

it('the folders are the business units that hold a work center (with the units above them); the tree is read only', () => {
  renderUI(<WorkCenterCRUD />);
  const ids = lastTable().foldersTree.nodes.map((n: any) => n.id).sort();
  expect(ids).toEqual(['bu-ent', 'bu-it', 'bu-key', 'bu-sales']);          // HR holds no work center: no folder
  expect(lastTable().foldersTree).toMatchObject({ folderTarget: 'rowParentGUID', noFolderValue: 'empty', tree: { readOnly: true } });
  expect(lastTable().uxuiTable).toMatchObject({ showFoldersTree: true });
});

it('the last work center of a folder removed: the folder is hidden again, and a picked folder that vanished goes back to All', () => {
  renderUI(<WorkCenterCRUD />);
  act(() => lastTable().foldersTree.onSelectedFolderChange('bu-it'));
  expect(lastTable().foldersTree.selectedFolderId).toBe('bu-it');
  mockData.data = { ...mockData.data, workCenter: mockData.data.workCenter.filter((w: any) => w.rowParentGUID !== 'bu-it') };
  renderUI(<WorkCenterCRUD />);
  expect(lastTable().foldersTree.nodes.some((n: any) => n.id === 'bu-it')).toBe(false);
  expect(lastTable().foldersTree.selectedFolderId).toBe('__tree_all__');
});

it('the New window starts in the picked folder; Create saves the work center in that folder through the redux entity', () => {
  renderUI(<WorkCenterCRUD />);
  expect(lastModal().initialUnit).toBeNull();
  act(() => lastTable().foldersTree.onSelectedFolderChange('bu-key'));
  expect(lastModal().initialUnit).toBe('bu-key');
  expect(lastModal().calendarOptions).toEqual([{ value: 'cal-6h', label: 'cal-6h' }]);
  act(() => lastTable().onAdd());
  const json = { workCenterKind: 'person', workCenterBase: 'p-boris', businessUnit: 'bu-it' };
  act(() => lastModal().onCreate('bu-it', json));
  expect(mockCreateOne).toHaveBeenCalledWith(expect.objectContaining({ rowGUID: 'wc-new', rowOwnerGUID: 'workCenterCatalog', rowParentGUID: 'bu-it', rowJSON: json }));
  expect(mockDispatch).toHaveBeenCalled();
  expect(lastModal().visible).toBe(false);
});

it('a new row defaults to the picked folder (the unit), else no folder', () => {
  renderUI(<WorkCenterCRUD />);
  expect(lastTable().newRowDefaults()).toEqual({ rowOwnerGUID: 'workCenterCatalog', rowParentGUID: 'empty', rowJSON: {} });
  act(() => lastTable().foldersTree.onSelectedFolderChange('bu-key'));
  expect(lastTable().newRowDefaults().rowParentGUID).toBe('bu-key');
});

describe('Copy Variant settings', () => {
  const withRows = (...rows: any[]) => { (globalThis as any).__wcRows = rows; };
  afterEach(() => { (globalThis as any).__wcRows = []; });
  const anna = () => row('w-anna', { workCenterKind: 'person', workCenterBase: 'p-anna', workCenterBaseVariant: 'k1', workCenterVariant: 'k1' }, 'bu-key');
  const boris = () => row('w-boris', { workCenterKind: 'person', workCenterBase: 'p-boris', workCenterBaseVariant: 'k2' }, 'bu-it');

  it('the button of a row copies at once while the work center has no variant', async () => {
    withRows(boris());
    renderUI(<WorkCenterCRUD />);
    await act(async () => { press('work-center-copy-variant-w-boris'); });
    expect(mockCopy).toHaveBeenCalledWith('w-boris', false);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'The variant settings are copied to the work center.' } });
    expect(q('work-center-overwrite-content')).toBeNull();
  });

  it('a work center that has a variant is asked first: nothing is copied until the user confirms, then the copy overwrites', async () => {
    withRows(anna());
    renderUI(<WorkCenterCRUD />);
    expect(q('work-center-overwrite-content')).toBeNull();
    act(() => press('work-center-copy-variant-w-anna'));
    expect(mockCopy).not.toHaveBeenCalled();
    expect(textOf('work-center-overwrite-topBar')).toBe('Overwrite the work center variant?');
    await act(async () => { press('work-center-overwrite-confirm'); });
    expect(mockCopy).toHaveBeenCalledWith('w-anna', true);
    expect(q('work-center-overwrite-content')).toBeNull();
  });

  it('Cancel copies nothing', () => {
    withRows(anna());
    renderUI(<WorkCenterCRUD />);
    act(() => press('work-center-copy-variant-w-anna'));
    expect(q('work-center-overwrite-content')).not.toBeNull();
    act(() => press('work-center-overwrite-cancel'));
    expect(mockCopy).not.toHaveBeenCalled();
    expect(q('work-center-overwrite-content')).toBeNull();
  });

  it('the button is off without a base variant', () => {
    withRows(row('w-none', { workCenterKind: 'person', workCenterBase: 'p-boris' }, 'bu-it'));
    renderUI(<WorkCenterCRUD />);
    const btn = q('work-center-copy-variant-w-none') as any;
    expect(btn.getAttribute('aria-disabled') === 'true' || btn.disabled === true).toBe(true);
    act(() => press('work-center-copy-variant-w-none'));
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('a refusal of the server is told in a snackbar', async () => {
    withRows(boris());
    mockCopy.mockRejectedValueOnce(new Error('the base has no variant "k2"') as never);
    renderUI(<WorkCenterCRUD />);
    await act(async () => { press('work-center-copy-variant-w-boris'); });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'the base has no variant "k2"' } });
  });

  it('the row menu has the same command, off without a base variant, and it asks like the button', () => {
    withRows(anna());
    renderUI(<WorkCenterCRUD />);
    const close = jest.fn();
    expect(lastTable().extraMenuItems(row('w-x', { workCenterBaseVariant: null }), close)[0]).toMatchObject({ label: 'Copy Variant settings', disabled: true });
    const item = lastTable().extraMenuItems(anna(), close)[0];
    expect(item.disabled).toBe(false);
    act(() => item.onPress());
    expect(close).toHaveBeenCalled();
    expect(q('work-center-overwrite-content')).not.toBeNull();
  });
});

it('a read error says to run the SQL (PART 35); Refresh reads again', () => {
  mockData.error = 'relation "workCenterTable" does not exist';
  renderUI(<WorkCenterCRUD />);
  expect(textOf('work-center-setup')).toContain('PART 35');
  press('work-center-reload');
  expect(mockData.reload).toHaveBeenCalled();
});
