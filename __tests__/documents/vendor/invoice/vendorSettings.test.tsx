/** @jest-environment jsdom */
// Project settings → Vendor (TabVendor): userCanCreateVendorInvoicesFromTasksWithEmptyVendors and independentInvoiceInputAvailable - both TRUE by default (also for a project that never had the keys).
import { cleanupUI, q, renderUI, toggleSwitch } from '../../../pm/ui/pmUiTestKit';
import PMProjectVendorTab, { vendorValuesOf } from '../../../../kit8/pm/view/project/settings/PMProjectVendorTab';

afterEach(cleanupUI);

it('the first two are true by default - a missing key is true; only a stored false is false. The multi project switch is OFF by default', () => {
  expect(vendorValuesOf(null)).toEqual({ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: true, independentInvoiceInputAvailable: true, multiProjectVendorInvoceNeeded: false });
  expect(vendorValuesOf({})).toEqual({ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: true, independentInvoiceInputAvailable: true, multiProjectVendorInvoceNeeded: false });
  expect(vendorValuesOf({ independentInvoiceInputAvailable: false })).toEqual({ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: true, independentInvoiceInputAvailable: false, multiProjectVendorInvoceNeeded: false });
  expect(vendorValuesOf({ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: false }).userCanCreateVendorInvoicesFromTasksWithEmptyVendors).toBe(false);
});

it('the two switches are on for a project without the keys and change only their own key', () => {
  const onChange = jest.fn();
  renderUI(<PMProjectVendorTab values={{}} onChange={onChange} />);
  const on = (id: string) => (q(id)!.querySelector('input') as HTMLInputElement).checked;
  expect(on('pm-project-vendor-empty-vendors')).toBe(true);
  expect(on('pm-project-vendor-independent-input')).toBe(true);
  toggleSwitch('pm-project-vendor-empty-vendors');
  expect(onChange).toHaveBeenLastCalledWith({ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: false });
  toggleSwitch('pm-project-vendor-independent-input');
  expect(onChange).toHaveBeenLastCalledWith({ independentInvoiceInputAvailable: false });
});

it('the multi project switch is OFF by default, turns on only for a stored true, and changes only its own key', () => {
  expect(vendorValuesOf({ multiProjectVendorInvoceNeeded: true }).multiProjectVendorInvoceNeeded).toBe(true);
  const onChange = jest.fn();
  renderUI(<PMProjectVendorTab values={{}} onChange={onChange} />);
  expect((q('pm-project-vendor-multi-project')!.querySelector('input') as HTMLInputElement).checked).toBe(false);
  toggleSwitch('pm-project-vendor-multi-project');
  expect(onChange).toHaveBeenLastCalledWith({ multiProjectVendorInvoceNeeded: true });
});

it('shows the saved false values', () => {
  renderUI(<PMProjectVendorTab values={{ userCanCreateVendorInvoicesFromTasksWithEmptyVendors: false, independentInvoiceInputAvailable: false }} onChange={jest.fn()} />);
  expect((q('pm-project-vendor-empty-vendors')!.querySelector('input') as HTMLInputElement).checked).toBe(false);
  expect((q('pm-project-vendor-independent-input')!.querySelector('input') as HTMLInputElement).checked).toBe(false);
});
