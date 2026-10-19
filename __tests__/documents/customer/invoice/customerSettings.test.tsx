/** @jest-environment jsdom */
// Project settings → Customer (TabCustomer): customerInvoiceFunctionalityEnabled - TRUE by default (also for a project that never had the key); it is part of the organization defaults.
import { cleanupUI, q, renderUI, toggleSwitch } from '../../../pm/ui/pmUiTestKit';
import PMProjectCustomerTab, { customerInvoiceEnabledOf, customerValuesOf } from '../../../../kit8/pm/view/project/settings/PMProjectCustomerTab';
import { defaultProjectSettingsOf } from '../../../../kit8/catalog/organization/defaultProjectSettings';

afterEach(cleanupUI);

it('true by default: a missing key is true; only a stored false is false', () => {
  expect(customerValuesOf(null)).toEqual({ customerInvoiceFunctionalityEnabled: true });
  expect(customerValuesOf({})).toEqual({ customerInvoiceFunctionalityEnabled: true });
  expect(customerValuesOf({ customerInvoiceFunctionalityEnabled: false })).toEqual({ customerInvoiceFunctionalityEnabled: false });
  expect(customerInvoiceEnabledOf(undefined)).toBe(true);
  expect(customerInvoiceEnabledOf({ customerInvoiceFunctionalityEnabled: false })).toBe(false);
});

it('the switch is on for a project without the key and changes only its own key', () => {
  const onChange = jest.fn();
  renderUI(<PMProjectCustomerTab values={{}} onChange={onChange} />);
  expect(q('pm-project-tab-customer-content')).not.toBeNull();
  expect((q('pm-project-customer-invoice-enabled')!.querySelector('input') as HTMLInputElement).checked).toBe(true);
  toggleSwitch('pm-project-customer-invoice-enabled');
  expect(onChange).toHaveBeenLastCalledWith({ customerInvoiceFunctionalityEnabled: false });
});

it('shows the saved false value', () => {
  renderUI(<PMProjectCustomerTab values={{ customerInvoiceFunctionalityEnabled: false }} onChange={jest.fn()} />);
  expect((q('pm-project-customer-invoice-enabled')!.querySelector('input') as HTMLInputElement).checked).toBe(false);
});

it('the organization defaults carry the switch (a new project starts from them)', () => {
  expect(defaultProjectSettingsOf(null).customerInvoiceFunctionalityEnabled).toBe(true);
  expect(defaultProjectSettingsOf({ customerInvoiceFunctionalityEnabled: false }).customerInvoiceFunctionalityEnabled).toBe(false);
});
