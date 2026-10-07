/** @jest-environment jsdom */
import React, { act } from 'react';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid-123' }), { virtual: true });
jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: jest.fn() }) } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}), { virtual: true });

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({
    activeSystem: 'native',
    isDark: false,
    themeColors: {
      primary: '#6366f1',
      background: '#fff',
      surface: '#fff',
      text: '#000',
      border: '#ccc',
      error: '#d00',
    },
  }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: any = { guid: 'org-test-123' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return ({ name, testID }: any) => R.createElement(Text, { testID }, name);
});

// SelectElementFromCatalog's search field is TextInputApp: here a plain input with the same testID
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcon, heightVariant, autoFocus, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({
  useRealtimeEntity: jest.fn(),
}));

jest.mock('../../../kit8/catalog/currency/CurrencyRealtimeBadge', () => {
  const R = require('react');
  return () => R.createElement('div', { 'data-testid': 'mock-realtime-badge' });
});

let mockReduxState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: (fn: any) => fn(mockReduxState),
  useDispatch: () => mockDispatch,
}));

jest.mock('../../../kit8/catalog/departament/DepartamentList', () => {
  const R = require('react');
  return ({ organizationGUID }: any) =>
    R.createElement('div', { 'data-testid': 'mock-departament-list', 'data-org': organizationGUID });
});

import OrganizationEdit from '../../../kit8/catalog/organization/OrganizationEdit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) =>
  act(() => {
    const el = q(id);
    if (!el) throw new Error(`Element ${id} not found`);
    el.click();
  });

describe('OrganizationEdit TopTabs & Country', () => {
  const sampleOrg = {
    rowGUID: 'org-test-123',
    rowOwnerGUID: 'organizationCatalog',
    rowParentGUID: 'empty',
    orderInList: 0,
    rowJSON: {
      organizationTitle: 'Universal Timber Corp',
      organizationLegalName: 'Universal Timber Corp SIA',
      createdByUser: 'admin@universal.io',
      countryOfResidence: 'LV',
      legalData: {
        registrationNo: '40003000000',
        vatNo: 'LV40003000000',
        country: 'LV',
      },
      isActive: true,
    },
  };

  const sampleCountries = [
    {
      rowGUID: 'guid-lv',
      rowOwnerGUID: 'countryCatalog',
      rowParentGUID: 'empty',
      orderInList: 0,
      rowJSON: {
        countryName: 'Latvia',
        countryCode: 'LV',
        countryCodeAlpha3: 'LVA',
        flagEmoji: '🇱🇻',
        currencyCode: 'EUR',
      },
    },
    {
      rowGUID: 'guid-ee',
      rowOwnerGUID: 'countryCatalog',
      rowParentGUID: 'empty',
      orderInList: 1,
      rowJSON: {
        countryName: 'Estonia',
        countryCode: 'EE',
        countryCodeAlpha3: 'EST',
        flagEmoji: '🇪🇪',
        currencyCode: 'EUR',
      },
    },
  ];

  beforeEach(() => {
    mockSearchParams = { guid: 'org-test-123' };
    mockReduxState = {
      activeUserState: { activeUserEmail: 'admin@universal.io' },
      organizationReusable: { entityDataFromServer: [sampleOrg] },
      countryReusable: { entityDataFromServer: sampleCountries },
      departamentReusable: { entityDataFromServer: [] },
    };
    mockDispatch.mockClear();
  });

  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  function render(ui: React.ReactElement) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(ui);
    });
  }

  it('renders TopTabs: TabMain and TabDepartaments', () => {
    render(<OrganizationEdit />);

    expect(q('organization-toptabs')).not.toBeNull();
    expect(q('organization-tab-TabMain')).not.toBeNull();
    expect(q('organization-tab-TabDepartaments')).not.toBeNull();

    // Default active tab is TabMain
    expect(q('organization-input-title')).not.toBeNull();
    expect(q('organization-select-country')).not.toBeNull();
  });

  it('switches to TabDepartaments and renders DepartamentList scoped to organization', () => {
    render(<OrganizationEdit />);

    press('organization-tab-TabDepartaments');

    expect(q('organization-tab-departaments-content')).not.toBeNull();
    const deptList = q('mock-departament-list');
    expect(deptList).not.toBeNull();
    expect(deptList?.getAttribute('data-org')).toBe('org-test-123');

    // Switch back to TabMain
    press('organization-tab-TabMain');
    expect(q('organization-input-title')).not.toBeNull();
  });

  it('displays country of residence in SelectElementFromCatalog on TabMain', () => {
    render(<OrganizationEdit />);

    const countryTrigger = q('organization-select-country-trigger');
    expect(countryTrigger).not.toBeNull();
    expect(countryTrigger?.textContent).toContain('Latvia');
    expect(countryTrigger?.textContent).toContain('LV');
  });

  it('shows informational card on TabDepartaments when creating a new organization before saving', () => {
    mockSearchParams = {}; // New organization (no guid)
    render(<OrganizationEdit />);

    press('organization-tab-TabDepartaments');

    expect(q('mock-departament-list')).toBeNull();
    expect(q('organization-tab-departaments-content')?.textContent).toContain('Organization Not Saved Yet');
  });
});
