/** @jest-environment jsdom */
// "Create based on → Payment fact" of a vendor / customer invoice: the button + the window of a POSTED invoice (PaymentFactBasedOn) and the row menu of the lists (usePaymentFactBasedOnRowMenu). The hook is a fake.
import React, { act } from 'react';
import { cleanupUI, press, q, renderUI } from '../../../pm/ui/pmUiTestKit';

const mockCreate = jest.fn(async () => ({ documents: [{ documentGUID: 'n1', lineCount: 1, taskGUID: 't1' }], skipped: [] }));
let mockBusy = false;
jest.mock('../../../../kit8/documents/payment/fact/usePaymentFact', () => ({ useCreatePaymentFactFromInvoice: () => ({ create: (...a: any[]) => (mockCreate as any)(...a), busy: mockBusy, error: null }) }));
const mockList = jest.fn();
jest.mock('../../../../kit8/ui/components/common/ModalWindowListToSelect', () => ({ __esModule: true, default: (p: any) => { mockList(p); return require('react').createElement('div', { 'data-testid': p.testID, 'data-visible': String(!!p.visible) }); } }));
const mockButtons: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const Real = jest.requireActual('../../../../kit8/ui/components/common/ButtonApp').default;
  const Spy = (p: any) => { if (p.testID) mockButtons[p.testID] = p; return R.createElement(Real, p); };
  return { __esModule: true, default: Spy, ButtonApp: Spy };
});
const PaymentFactBasedOn = require('../../../../kit8/documents/payment/fact/PaymentFactBasedOn').default;
const { usePaymentFactBasedOnRowMenu } = require('../../../../kit8/documents/payment/fact/PaymentFactBasedOn');

const lastList = () => mockList.mock.calls.at(-1)![0];
afterEach(() => { cleanupUI(); jest.clearAllMocks(); mockBusy = false; Object.keys(mockButtons).forEach((k) => delete mockButtons[k]); });

describe('the button in the bar of an invoice', () => {
  it('a POSTED invoice has "Create based on"; a draft has nothing', () => {
    renderUI(<PaymentFactBasedOn kind="vendor" invoiceGUID="vi1" status="posted" testID="vendor-invoice" />);
    expect(q('vendor-invoice-create-based-on')).not.toBeNull();
    expect(mockButtons['vendor-invoice-create-based-on']).toMatchObject({ size: 'small', variant: 'outlined', icon: 'add_circle' });
    cleanupUI();
    renderUI(<PaymentFactBasedOn kind="vendor" invoiceGUID="vi1" status="draft" testID="vendor-invoice" />);
    expect(q('vendor-invoice-create-based-on')).toBeNull();
  });
  it('the window offers ONE item, Payment fact, with a text that says the direction (vendor: pays, customer: receives)', () => {
    renderUI(<PaymentFactBasedOn kind="vendor" invoiceGUID="vi1" status="posted" testID="vendor-invoice" />);
    expect(lastList().visible).toBe(false);
    press('vendor-invoice-create-based-on');
    expect(lastList()).toMatchObject({ visible: true, title: 'Create based on this vendor invoice' });
    expect(lastList().items).toHaveLength(1);
    expect(lastList().items[0]).toMatchObject({ id: 'paymentFact', title: 'Payment fact', icon: 'account_balance' });
    expect(lastList().items[0].subtitle).toContain('outbound');
    cleanupUI();
    renderUI(<PaymentFactBasedOn kind="customer" invoiceGUID="ci1" status="posted" testID="customer-invoice" />);
    press('customer-invoice-create-based-on');
    expect(lastList().title).toBe('Create based on this customer invoice');
    expect(lastList().items[0].subtitle).toContain('inbound');
  });
  it('choosing Payment fact creates it for THIS invoice and closes the window; Cancel / another id do nothing', () => {
    renderUI(<PaymentFactBasedOn kind="customer" invoiceGUID="ci1" status="posted" testID="customer-invoice" />);
    press('customer-invoice-create-based-on');
    act(() => lastList().onSelect('somethingElse'));
    expect(mockCreate).not.toHaveBeenCalled();
    press('customer-invoice-create-based-on');
    act(() => lastList().onSelect('paymentFact'));
    expect(mockCreate).toHaveBeenCalledWith('customer', 'ci1');
    expect(lastList().visible).toBe(false);
    press('customer-invoice-create-based-on');
    act(() => lastList().onClose());
    expect(lastList().visible).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
  it('the button is off while another command runs or the document is being made', () => {
    renderUI(<PaymentFactBasedOn kind="vendor" invoiceGUID="vi1" status="posted" disabled testID="vendor-invoice" />);
    expect(mockButtons['vendor-invoice-create-based-on'].disabled).toBe(true);
    cleanupUI();
    mockBusy = true;
    renderUI(<PaymentFactBasedOn kind="vendor" invoiceGUID="vi1" status="posted" testID="vendor-invoice" />);
    expect(mockButtons['vendor-invoice-create-based-on'].disabled).toBe(true);
  });
});

describe('the row menu of a list', () => {
  let build: any;
  function Probe({ kind }: { kind: 'vendor' | 'customer' }) { build = usePaymentFactBasedOnRowMenu(kind, 'list'); return null; }
  it('a POSTED invoice: Create based on → Payment fact (it closes the menu and creates); a draft or an unknown row: nothing', () => {
    renderUI(<Probe kind="vendor" />);
    const close = jest.fn();
    const items = build('vi1', 'posted', close);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ testID: 'list-menu-create-vi1', label: 'Create based on' });
    const sub = items[0].submenu[0];
    expect(sub).toMatchObject({ testID: 'list-menu-create-payment-fact-vi1', label: 'Payment fact', icon: 'account_balance' });
    sub.onPress();
    expect(close).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith('vendor', 'vi1');
    expect(build('vi2', 'draft', close)).toEqual([]);
    expect(build('vi3', undefined, close)).toEqual([]);
  });
  it('a customer list creates a customer payment fact', () => {
    renderUI(<Probe kind="customer" />);
    build('ci1', 'posted', jest.fn())[0].submenu[0].onPress();
    expect(mockCreate).toHaveBeenCalledWith('customer', 'ci1');
  });
});
