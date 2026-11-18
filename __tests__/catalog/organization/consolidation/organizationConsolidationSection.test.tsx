/** @jest-environment jsdom */
// The block "Consolidation" of Organization edit: the obligatory currency (no Clear), the rate type, the two VAT switches with their sentences, the state of the database, Refresh now.
import React from 'react';
import { cleanupUI, press, q, renderUI, textOf, toggleSwitch } from '../../../pm/ui/pmUiTestKit';

// the picker of the catalog is a FlatList (virtualised in jsdom): a plain button stands in; the section only uses onChange(guid, row) and the placeholder
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: (p: any) => R.createElement(Pressable, { testID: p.testID, onPress: () => p.onChange?.('cur-eur', { rowJSON: { currencyCode: 'EUR' } }) }, R.createElement(Text, null, `${p.label}|${p.placeholder}|clearable=${String(!!p.clearable)}`)) };
});
const mockRefresh = jest.fn();
let mockStatus: any = null;
jest.mock('../../../../kit8/catalog/organization/consolidation/useConsolidationStatus', () => ({
  useConsolidationStatus: () => ({ status: mockStatus, error: null, busy: false, reload: jest.fn(), refreshNow: mockRefresh }),
}));

import OrganizationConsolidationSection from '../../../../kit8/catalog/organization/consolidation/OrganizationConsolidationSection';

const base = { currency: 'USD', rateType: 'Default', includePurchaseVAT: false, includeSaleVAT: false };

describe('OrganizationConsolidationSection', () => {
  beforeEach(() => { mockRefresh.mockClear(); mockStatus = { ...base, state: 'ready', gaps: 0, queued: 0 }; });
  afterEach(() => cleanupUI());

  it('shows the obligatory currency with no Clear, and says what the VAT switches do', () => {
    renderUI(<OrganizationConsolidationSection value={base} onChange={jest.fn()} />);
    expect(textOf('organization-consolidation-currency')).toContain('Currency for consolidation (obligatory)');
    expect(textOf('organization-consolidation-currency')).toContain('USD');
    expect(textOf('organization-consolidation-currency')).toContain('clearable=false');
    expect(q('organization-consolidation-currency-error')).toBeNull();
    expect(document.body.textContent).toContain('Include purchase VAT into consolidation');
    expect(document.body.textContent).toContain('Include sale VAT into consolidation');
    expect(document.body.textContent).toContain('the part of the VAT that is not recoverable');
  });

  it('a pick changes the currency; the switches and the rate type report their own patch', () => {
    const onChange = jest.fn();
    renderUI(<OrganizationConsolidationSection value={base} onChange={onChange} />);
    press('organization-consolidation-currency');
    expect(onChange).toHaveBeenCalledWith({ currency: 'EUR' });
    toggleSwitch('organization-consolidation-purchaseVat');
    expect(onChange).toHaveBeenCalledWith({ includePurchaseVAT: true });
    toggleSwitch('organization-consolidation-saleVat');
    expect(onChange).toHaveBeenCalledWith({ includeSaleVAT: true });
    press('organization-consolidation-rateType-Budget');
    expect(onChange).toHaveBeenCalledWith({ rateType: 'Budget' });
  });

  it('an empty currency (a form not saved yet) says it is obligatory', () => {
    renderUI(<OrganizationConsolidationSection value={{ ...base, currency: '' }} onChange={jest.fn()} />);
    expect(textOf('organization-consolidation-currency-error')).toContain('obligatory');
  });

  it('the state of the database: ready / recalculating with a count / gaps; Refresh now calls the database', () => {
    mockStatus = { ...base, state: 'gaps', gaps: 3, queued: 0 };
    renderUI(<OrganizationConsolidationSection value={base} onChange={jest.fn()} />);
    expect(textOf('organization-consolidation-state')).toContain('wait for an exchange rate');
    expect(textOf('organization-consolidation-gaps')).toContain('3 movement(s) without a rate');
    press('organization-consolidation-refresh');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('a new organization has no status block', () => {
    renderUI(<OrganizationConsolidationSection value={base} onChange={jest.fn()} statusEnabled={false} />);
    expect(q('organization-consolidation-status')).toBeNull();
  });
});
