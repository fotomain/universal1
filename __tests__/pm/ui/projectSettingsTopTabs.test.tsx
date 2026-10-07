/** @jest-environment jsdom */
import { act } from 'react';
import React from 'react';
import {
  cleanupUI,
  fakeCrud,
  inputValue,
  OWNER,
  press,
  q,
  qa,
  renderUI,
  seedStore,
  toggleSwitch,
  typeInto,
} from './pmUiTestKit';

// ---- Supabase hooks mocks ----
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('../../../kit8/pm/crud/queries', () => ({
  useBuildProjectRow: () => (name: string, startMs?: number) => ({
    rowGUID: '99999999-9999-4999-8999-999999999999',
    treePath: 'x',
    rowOwnerGUID: '11111111-1111-4111-8111-111111111111',
    rowDuration: null,
    rowProgress: 0,
    orderInList: 9999,
    rowJSON: {
      rowKind: 'project',
      name,
      durationDays: 0,
      projectStartAt: new Date(startMs ?? 0).toISOString(),
    },
  }),
  useCreateProjectMutation: () => ({ mutate: mockCreate }),
  useUpdateProjectMutation: () => ({ mutate: mockUpdate }),
  useDeleteProjectMutation: () => ({ mutate: mockDelete }),
  useProjectSearchQuery: () => ({ data: undefined, isFetching: false }),
}));

// the Import / Export section has its own test suite and requires SupabaseProvider
jest.mock('../../../kit8/pm/crud/exchange/project/ImportExportProject', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => R.createElement(View, { testID: 'pm-project-exchange' }),
  };
});

jest.mock('../../../kit8/pm/view/kanban/PMKanbanStagesModalWindow', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: any) =>
      visible ? R.createElement(View, { testID: 'pm-kanban-stages-window' }) : null,
  };
});

jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({
  useRealtimeEntity: jest.fn(),
}));

let mockReduxState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useSelector: (fn: any) => fn(mockReduxState),
    useDispatch: () => mockDispatch,
  };
});

import PMRecentProjectsToolbar from '../../../kit8/pm/view/project/recent/PMRecentProjectsToolbar';

const samplePartners = [
  {
    rowGUID: 'partner-sup-1',
    rowOwnerGUID: 'partnerCatalog',
    rowParentGUID: 'empty',
    orderInList: 0,
    rowJSON: {
      partnerTitle: 'Nordic Timber Supplier',
      partnerIsSupplier: true,
      partnerIsCustomer: false,
    },
  },
  {
    rowGUID: 'partner-cust-1',
    rowOwnerGUID: 'partnerCatalog',
    rowParentGUID: 'empty',
    orderInList: 1,
    rowJSON: {
      partnerTitle: 'Baltic Construction Customer',
      partnerIsSupplier: false,
      partnerIsCustomer: true,
    },
  },
];

const sampleContracts = [
  {
    rowGUID: 'contract-sup-1',
    rowOwnerGUID: 'partner-sup-1',
    rowParentGUID: 'partner',
    orderInList: 0,
    rowJSON: {
      contractNumber: 'S-2026-01',
      contractTitle: 'Timber Supply 2026',
      contractTotal: 25000,
      contractCurrency: 'EUR',
      supplierRole: true,
      customerRole: false,
    },
  },
  {
    rowGUID: 'contract-cust-1',
    rowOwnerGUID: 'partner-cust-1',
    rowParentGUID: 'partner',
    orderInList: 0,
    rowJSON: {
      contractNumber: 'C-2026-99',
      contractTitle: 'Building Works Phase 1',
      contractTotal: 80000,
      contractCurrency: 'EUR',
      supplierRole: false,
      customerRole: true,
    },
  },
];

const sampleCurrencies = [
  { rowGUID: 'cur-eur', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', decimalDigits: 2, isActive: true } },
  { rowGUID: 'cur-usd', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$', decimalDigits: 2, isActive: true } },
];

const sampleKanbanStates = [
  {
    rowGUID: 'kstate-1',
    rowOwnerGUID: 'p-1',
    rowParentGUID: 'task-1',
    orderInList: 0,
    rowJSON: {
      stageGUID: 'stage-todo',
      kanbanStageProgressPercent: 10,
    },
  },
];

describe('Project settings window TopTabs', () => {
  beforeEach(() => {
    mockReduxState = {
      partnerReusable: { entityDataFromServer: samplePartners },
      contractReusable: { entityDataFromServer: sampleContracts },
      currencyReusable: { entityDataFromServer: sampleCurrencies },
      projectTaskKanbanStateReusable: { entityDataFromServer: sampleKanbanStates },
    };
    // pmUiTestKit's react-redux mock is the one in effect: it reads this state
    (globalThis as any).__pmTestReduxState = mockReduxState;
    mockCreate.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockDispatch.mockClear();
  });

  afterEach(() => {
    cleanupUI();
    delete (globalThis as any).__pmTestReduxState;
    jest.clearAllMocks();
  });

  it('renders all 5 TopTabs and defaults to TabMain', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');

    expect(q('pm-project-settings-toptabs')).not.toBeNull();
    expect(q('pm-project-tab-TabMain')).not.toBeNull();
    expect(q('pm-project-tab-TabFinances')).not.toBeNull();
    expect(q('pm-project-tab-TabUXUI')).not.toBeNull();
    expect(q('pm-project-tab-TabPartners')).not.toBeNull();
    // TabFinances comes right after TabMain
    const tabIds = Array.from(q('pm-project-settings-toptabs')!.querySelectorAll('[data-testid^="pm-project-tab-"]')).map((e: any) => e.getAttribute('data-testid'));
    expect(tabIds.slice(0, 2)).toEqual(['pm-project-tab-TabMain', 'pm-project-tab-TabFinances']);
    expect(q('pm-project-tab-TabKanban')).not.toBeNull();

    // Default tab is TabMain
    expect(q('pm-project-tab-main-content')).not.toBeNull();
    expect(q('pm-project-tab-uxui-content')).toBeNull();
    expect(q('pm-project-tab-partners-content')).toBeNull();
    expect(q('pm-project-tab-kanban-content')).toBeNull();
    expect(q('pm-project-name')).not.toBeNull();
    expect(q('pm-project-start')).not.toBeNull();
    expect(q('pm-project-weekends')).not.toBeNull();
  });

  it('switches to TabUXUI and updates plan switches and planDateInputFormat', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');

    press('pm-project-tab-TabUXUI');
    expect(q('pm-project-tab-uxui-content')).not.toBeNull();
    expect(q('pm-project-tab-main-content')).toBeNull();

    // Verify switches
    expect(q('pm-project-plan-day')).not.toBeNull();
    expect(q('pm-project-plan-hour')).not.toBeNull();
    expect(q('pm-project-plan-minute')).not.toBeNull();
    expect(q('pm-project-plan-second')).not.toBeNull();

    // Toggle planHour
    toggleSwitch('pm-project-plan-hour');

    // Pick date format
    press('pm-project-format-DD_MM_YYYY');

    // Save and verify patch contains UX/UI values
    press('pm-project-save');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const patchRowJSON = mockUpdate.mock.calls[0][0].patch.rowJSON;
    expect(patchRowJSON.planHour).toBe(true);
    expect(patchRowJSON.planDateInputFormat).toBe('DD.MM.YYYY');
  });

  it('switches to TabFinances and saves the 3 currencies and the budget checkboxes to rowJSON', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');

    press('pm-project-tab-TabFinances');
    expect(q('pm-project-tab-finances-content')).not.toBeNull();
    expect(q('pm-project-tab-main-content')).toBeNull();

    press('pm-project-currencyForBudget-trigger');
    press('pm-project-currencyForBudget-item-cur-eur');
    press('pm-project-currencyForAccounting-trigger');
    press('pm-project-currencyForAccounting-item-cur-usd');
    press('pm-project-currencyForContract-trigger');
    press('pm-project-currencyForContract-item-cur-eur');
    toggleSwitch('pm-project-revenue-budget-needed');

    press('pm-project-save');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const patchRowJSON = mockUpdate.mock.calls[0][0].patch.rowJSON;
    expect(patchRowJSON.currencyForBudget).toBe('EUR');
    expect(patchRowJSON.currencyForAccounting).toBe('USD');
    expect(patchRowJSON.currencyForContract).toBe('EUR');
    expect(patchRowJSON.projectRevenueBudgetNeeded).toBe(true);
    expect(patchRowJSON.projectExpenseBudgetNeeded).toBe(false);
  });

  it('switches to TabPartners and supports supplier & customer selection with contract cascading', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');

    press('pm-project-tab-TabPartners');
    expect(q('pm-project-tab-partners-content')).not.toBeNull();

    // Supplier contract selector is always clickable
    const supContractTrigger = q('pm-project-main-supplier-contract-trigger');
    expect(supContractTrigger?.textContent).toBe('Select supplier contract...');

    // Select Supplier
    press('pm-project-main-supplier-trigger');
    expect(q('pm-project-main-supplier-modal')).not.toBeNull();
    expect(q('pm-project-main-supplier-item-partner-sup-1')).not.toBeNull();
    press('pm-project-main-supplier-item-partner-sup-1');

    // Open supplier contract selector
    press('pm-project-main-supplier-contract-trigger');
    expect(q('pm-project-main-supplier-contract-modal')).not.toBeNull();
    expect(q('pm-project-main-supplier-contract-item-contract-sup-1')).not.toBeNull();
    press('pm-project-main-supplier-contract-item-contract-sup-1');

    // Select Customer
    press('pm-project-main-customer-trigger');
    expect(q('pm-project-main-customer-modal')).not.toBeNull();
    expect(q('pm-project-main-customer-item-partner-cust-1')).not.toBeNull();
    press('pm-project-main-customer-item-partner-cust-1');

    // Select Customer Contract
    press('pm-project-main-customer-contract-trigger');
    expect(q('pm-project-main-customer-contract-modal')).not.toBeNull();
    expect(q('pm-project-main-customer-contract-item-contract-cust-1')).not.toBeNull();
    press('pm-project-main-customer-contract-item-contract-cust-1');

    // Save project and verify rowJSON contains all 4 partner fields
    press('pm-project-save');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const patchRowJSON = mockUpdate.mock.calls[0][0].patch.rowJSON;
    expect(patchRowJSON.mainSupplierGUID).toBe('partner-sup-1');
    expect(patchRowJSON.mainSupplierContractGUID).toBe('contract-sup-1');
    expect(patchRowJSON.mainCustomerGUID).toBe('partner-cust-1');
    expect(patchRowJSON.mainCustomerContractGUID).toBe('contract-cust-1');
  });

  it('resets supplier contract when supplier selection is changed or cleared', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');

    press('pm-project-tab-TabPartners');
    // Select supplier and supplier contract
    press('pm-project-main-supplier-trigger');
    press('pm-project-main-supplier-item-partner-sup-1');
    press('pm-project-main-supplier-contract-trigger');
    press('pm-project-main-supplier-contract-item-contract-sup-1');

    // Clear supplier
    press('pm-project-main-supplier-clear');
    // Supplier contract should be reset to empty
    const contractTrigger = q('pm-project-main-supplier-contract-trigger');
    expect(contractTrigger?.textContent).toBe('Select supplier contract...');

    press('pm-project-save');
    const patchRowJSON = mockUpdate.mock.calls[0][0].patch.rowJSON;
    expect(patchRowJSON.mainSupplierGUID).toBeNull();
    expect(patchRowJSON.mainSupplierContractGUID).toBeNull();
  });

  it('switches to TabKanban and displays project Kanban states and Kanban stages trigger', () => {
    const { demo } = seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');

    press('pm-project-tab-TabKanban');
    expect(q('pm-project-tab-kanban-content')).not.toBeNull();

    // Verify Kanban Stages button
    expect(q('pm-project-kanban-stages')).not.toBeNull();
    press('pm-project-kanban-stages');
    expect(q('pm-kanban-stages-window')).not.toBeNull();
  });

  it('shows save reminder on TabKanban for new unsaved project', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-add'); // new project menu
    press('pm-project-add-menu-new');

    press('pm-project-tab-TabKanban');
    expect(q('pm-project-tab-kanban-content')?.textContent).toContain(
      'Save this project first to manage task Kanban states.'
    );
  });
});
