/** @jest-environment jsdom */
import React, { act } from 'react';

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

jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ testID, name, onPress }: any) =>
    onPress
      ? R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, name))
      : R.createElement(Text, { testID }, name);
});

const mockUseRealtimeEntity = jest.fn();
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({
  useRealtimeEntity: (...args: any[]) => mockUseRealtimeEntity(...args),
}));

let mockReduxState: any = {};
jest.mock('react-redux', () => ({
  useSelector: (fn: any) => fn(mockReduxState),
  useDispatch: () => jest.fn(),
}));

import SelectElementFromCatalog, {
  defaultTitleExtractor,
  defaultSubtitleExtractor,
} from '../../../kit8/catalog/inner/select_element/SelectElementFromCatalog';

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
const typeInput = (id: string, text: string) => {
  const el = q(id);
  if (!el) throw new Error(`Input ${id} not found`);
  const input = (el.tagName === 'INPUT' ? el : el.querySelector('input')) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('SelectElementFromCatalog', () => {
  const samplePartners = [
    {
      rowGUID: 'part-sup-1',
      rowOwnerGUID: 'partnerCatalog',
      rowParentGUID: 'empty',
      orderInList: 2,
      rowJSON: {
        partnerTitle: 'Supplier Alpha',
        partnerIsSupplier: true,
        partnerIsCustomer: false,
        legalData: { vatNo: 'LV123456789' },
      },
    },
    {
      rowGUID: 'part-cust-1',
      rowOwnerGUID: 'partnerCatalog',
      rowParentGUID: 'empty',
      orderInList: 1,
      rowJSON: {
        partnerTitle: 'Customer Beta',
        partnerIsSupplier: false,
        partnerIsCustomer: true,
        legalData: { vatNo: 'EE987654321' },
      },
    },
  ];

  const sampleContracts = [
    {
      rowGUID: 'cnt-sup-1',
      rowOwnerGUID: 'part-sup-1',
      rowParentGUID: 'partner',
      orderInList: 0,
      rowJSON: {
        contractNumber: 'CNT-001',
        contractTitle: 'Supply Agreement Alpha',
        contractTotal: 5000,
        contractCurrency: 'EUR',
      },
    },
    {
      rowGUID: 'cnt-cust-1',
      rowOwnerGUID: 'part-cust-1',
      rowParentGUID: 'partner',
      orderInList: 0,
      rowJSON: {
        contractNumber: 'CNT-002',
        contractTitle: 'Customer Contract Beta',
        contractTotal: 15000,
        contractCurrency: 'USD',
      },
    },
  ];

  beforeEach(() => {
    mockReduxState = {
      partnerReusable: { entityDataFromServer: samplePartners },
      contractReusable: { entityDataFromServer: sampleContracts },
    };
    mockUseRealtimeEntity.mockClear();
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

  it('renders with placeholder and triggers realtime entity subscription', () => {
    render(
      <SelectElementFromCatalog
        testID="sel-supplier"
        entityName="partnerReusable"
        placeholder="Pick supplier..."
      />
    );

    const trigger = q('sel-supplier-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe('Pick supplier...');
    expect(mockUseRealtimeEntity).toHaveBeenCalledWith(
      'partnerReusable',
      expect.objectContaining({ enabled: true })
    );
  });

  it('displays selected item title and allows clearing selection', () => {
    const onChange = jest.fn();
    render(
      <SelectElementFromCatalog
        testID="sel-supplier"
        entityName="partnerReusable"
        value="part-sup-1"
        onChange={onChange}
      />
    );

    const trigger = q('sel-supplier-trigger');
    expect(trigger?.textContent).toBe('Supplier Alpha');

    const clearBtn = q('sel-supplier-clear');
    expect(clearBtn).not.toBeNull();
    press('sel-supplier-clear');
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('filters items by filterItem predicate', () => {
    const onChange = jest.fn();
    render(
      <SelectElementFromCatalog
        testID="sel-supplier"
        entityName="partnerReusable"
        filterItem={(p) => Boolean(p.rowJSON?.partnerIsSupplier)}
        onChange={onChange}
      />
    );

    press('sel-supplier-trigger');
    expect(q('sel-supplier-modal')).not.toBeNull();

    // Only Supplier Alpha should be visible, Customer Beta is filtered out
    expect(q('sel-supplier-item-part-sup-1')).not.toBeNull();
    expect(q('sel-supplier-item-part-cust-1')).toBeNull();

    press('sel-supplier-item-part-sup-1');
    expect(onChange).toHaveBeenCalledWith('part-sup-1', expect.objectContaining({ rowGUID: 'part-sup-1' }));
  });

  it('filters items by rowOwnerGUID and rowParentGUID in order', () => {
    const onChange = jest.fn();
    render(
      <SelectElementFromCatalog
        testID="sel-contract"
        entityName="contractReusable"
        rowOwnerGUID="part-sup-1"
        rowParentGUID="partner"
        onChange={onChange}
      />
    );

    // ReadParams should match rowOwnerGUID and rowParentGUID
    expect(mockUseRealtimeEntity).toHaveBeenCalledWith(
      'contractReusable',
      expect.objectContaining({
        readParams: expect.objectContaining({
          match: { rowOwnerGUID: 'part-sup-1', rowParentGUID: 'partner' },
        }),
      })
    );

    press('sel-contract-trigger');
    // Only supplier contract should be listed
    expect(q('sel-contract-item-cnt-sup-1')).not.toBeNull();
    expect(q('sel-contract-item-cnt-cust-1')).toBeNull();

    press('sel-contract-item-cnt-sup-1');
    expect(onChange).toHaveBeenCalledWith('cnt-sup-1', expect.objectContaining({ rowGUID: 'cnt-sup-1' }));
  });

  it('supports modal search filtering by text', () => {
    render(
      <SelectElementFromCatalog
        testID="sel-partner"
        entityName="partnerReusable"
      />
    );

    press('sel-partner-trigger');
    expect(q('sel-partner-item-part-sup-1')).not.toBeNull();
    expect(q('sel-partner-item-part-cust-1')).not.toBeNull();

    typeInput('sel-partner-search-input', 'Beta');
    expect(q('sel-partner-item-part-cust-1')).not.toBeNull();
    expect(q('sel-partner-item-part-sup-1')).toBeNull();
  });

  it('handles disabled state with disabledMessage', () => {
    render(
      <SelectElementFromCatalog
        testID="sel-contract-disabled"
        entityName="contractReusable"
        disabled
        disabledMessage="Select a supplier first"
      />
    );

    const trigger = q('sel-contract-disabled-trigger');
    expect(trigger?.textContent).toBe('Select a supplier first');

    // Clicking when disabled should not open modal
    press('sel-contract-disabled-trigger');
    expect(q('sel-contract-disabled-modal')).toBeNull();
  });

  it('extracts titles and subtitles properly with default extractors', () => {
    expect(defaultTitleExtractor(samplePartners[0])).toBe('Supplier Alpha');
    expect(defaultSubtitleExtractor(samplePartners[0])).toBe('VAT: LV123456789');

    expect(defaultTitleExtractor(sampleContracts[0])).toBe('CNT-001 — Supply Agreement Alpha');
    expect(defaultSubtitleExtractor(sampleContracts[0])).toContain('5000 EUR');

    const emptyRow = { rowGUID: 'row-empty', rowJSON: {} };
    expect(defaultTitleExtractor(emptyRow)).toBe('row-empty');
    expect(defaultSubtitleExtractor(emptyRow)).toBeUndefined();

    // Country extraction
    const countryRow = {
      rowGUID: 'country-lv',
      rowJSON: {
        countryName: 'Latvia',
        countryCode: 'LV',
        countryCodeAlpha3: 'LVA',
        flagEmoji: '🇱🇻',
        phonePrefix: '+371',
        currencyCode: 'EUR',
      },
    };
    expect(defaultTitleExtractor(countryRow)).toBe('🇱🇻 Latvia (LV)');
    expect(defaultSubtitleExtractor(countryRow)).toBe('LVA · 📞 +371 · 💱 EUR');

    // Departament extraction
    const deptRow = {
      rowGUID: 'dept-eng',
      rowJSON: {
        departmentName: 'Engineering',
        departmentCode: 'ENG',
        headPersonName: 'Alice Smith',
        description: 'Core product team',
      },
    };
    expect(defaultTitleExtractor(deptRow)).toBe('[ENG] Engineering');
    expect(defaultSubtitleExtractor(deptRow)).toBe('Lead: Alice Smith · Core product team');
  });

  it('resolves country by ISO code in value (e.g. value="LV")', () => {
    const sampleCountries = [
      {
        rowGUID: 'guid-latvia-123',
        rowOwnerGUID: 'countryCatalog',
        rowParentGUID: 'empty',
        orderInList: 0,
        rowJSON: {
          countryName: 'Latvia',
          countryCode: 'LV',
          flagEmoji: '🇱🇻',
        },
      },
    ];
    mockReduxState = {
      countryReusable: { entityDataFromServer: sampleCountries },
    };

    render(
      <SelectElementFromCatalog
        testID="sel-country"
        entityName="countryReusable"
        value="LV"
      />
    );

    const trigger = q('sel-country-trigger');
    expect(trigger?.textContent).toContain('Latvia');
    expect(trigger?.textContent).toContain('LV');
  });
});
