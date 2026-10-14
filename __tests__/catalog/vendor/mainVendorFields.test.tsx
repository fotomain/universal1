/** @jest-environment jsdom */
// MainVendorFields (partner item): the vendor and ITS contract; the contract is disabled until a vendor is chosen and is cleared when the vendor changes; a partner is not offered as its own vendor.
import { act } from 'react';
import { cleanupUI, q, renderUI } from '../../pm/ui/pmUiTestKit';

const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); }, defaultTitleExtractor: () => '' }));
import MainVendorFields from '../../../kit8/catalog/vendor/MainVendorFields';

afterEach(() => { cleanupUI(); jest.clearAllMocks(); });
const V = 'mv-vendor', C = 'mv-contract';

it('the vendor select reads partners (suppliers); the contract select reads the partner contracts of the chosen vendor', () => {
  renderUI(<MainVendorFields testID="mv" value={{ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-1' }} onChange={jest.fn()} />);
  expect(mockSelects[V]).toMatchObject({ entityName: 'partnerReusable', value: 'vp-1' });
  expect(mockSelects[C]).toMatchObject({ entityName: 'contractReusable', rowParentGUID: 'partner', rowOwnerGUID: 'vp-1', value: 'vc-1', disabled: false });
});
it('no vendor: the contract select is disabled with its message', () => {
  renderUI(<MainVendorFields testID="mv" value={{}} onChange={jest.fn()} />);
  expect(mockSelects[C]).toMatchObject({ disabled: true, disabledMessage: 'Select a vendor first', value: null });
  expect(mockSelects[V].value).toBeNull();
});
it('a new vendor empties the contract; the contract is set on its own', () => {
  const onChange = jest.fn();
  renderUI(<MainVendorFields testID="mv" value={{ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-1' }} onChange={onChange} />);
  act(() => mockSelects[V].onChange('vp-2'));
  expect(onChange).toHaveBeenLastCalledWith({ mainVendorGUID: 'vp-2', mainVendorContractGUID: '' });
  act(() => mockSelects[C].onChange('vc-9'));
  expect(onChange).toHaveBeenLastCalledWith({ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-9' });
  act(() => mockSelects[V].onChange(null));
  expect(onChange).toHaveBeenLastCalledWith({ mainVendorGUID: '', mainVendorContractGUID: '' });
});
it('the partner being edited is not offered as its own vendor; customers are not offered', () => {
  renderUI(<MainVendorFields testID="mv" value={{}} ownGUID="vp-1" onChange={jest.fn()} />);
  const filter = mockSelects[V].filterItem;
  expect(filter({ rowGUID: 'vp-1', rowJSON: { partnerIsSupplier: true } })).toBe(false);
  expect(filter({ rowGUID: 'vp-2', rowJSON: { partnerIsSupplier: true } })).toBe(true);
  expect(filter({ rowGUID: 'vp-3', rowJSON: { partnerIsSupplier: false } })).toBe(false);
});
it('a contract of ANOTHER vendor is flagged', () => {
  renderUI(<MainVendorFields testID="mv" value={{ mainVendorGUID: 'vp-2', mainVendorContractGUID: 'vc-1' }} contracts={[{ rowGUID: 'vc-1', rowOwnerGUID: 'vp-1', rowParentGUID: 'partner' }]} onChange={jest.fn()} />);
  expect(q('mv-error')).not.toBeNull();
  cleanupUI();
  renderUI(<MainVendorFields testID="mv" value={{ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-1' }} contracts={[{ rowGUID: 'vc-1', rowOwnerGUID: 'vp-1', rowParentGUID: 'partner' }]} onChange={jest.fn()} />);
  expect(q('mv-error')).toBeNull();
});
it('disabled: both selects are', () => {
  renderUI(<MainVendorFields testID="mv" value={{ mainVendorGUID: 'vp-1' }} disabled onChange={jest.fn()} />);
  expect(mockSelects[V].disabled).toBe(true);
  expect(mockSelects[C].disabled).toBe(true);
});
