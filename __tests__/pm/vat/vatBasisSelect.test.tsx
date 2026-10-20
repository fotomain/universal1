/** @jest-environment jsdom */
// VatBasisSelect: "VAT: Cost | Net | With VAT"; useVatBasis: one choice for every report.
import { cleanupUI, press, qa, renderUI, textOf } from '../ui/pmUiTestKit';

const VatBasisSelect = require('../../../kit8/pm/vat/VatBasisSelect').default;
const { useVatBasis, resetVatBasisForTest, getVatBasis } = require('../../../kit8/pm/vat/useVatBasis');

afterEach(() => { cleanupUI(); resetVatBasisForTest(); });

describe('VatBasisSelect', () => {
  it('offers the three bases in order and marks the one in force', () => {
    renderUI(<VatBasisSelect value="cost" onChange={() => {}} />);
    expect(qa('vat-basis-radio-').map((id) => id.replace('vat-basis-radio-', ''))).toEqual(['cost', 'net', 'gross']);
    expect(textOf('vat-basis')).toMatch(/VAT/);
    expect(textOf('vat-basis-radio-gross')).toMatch(/With VAT$/);
    expect(textOf('vat-basis-radio-cost')).toMatch(/^radio_button_checked/);
    expect(textOf('vat-basis-radio-net')).toMatch(/^radio_button_unchecked/);
  });
  it('pressing a basis reports it', () => {
    const onChange = jest.fn();
    renderUI(<VatBasisSelect value="cost" onChange={onChange} />);
    press('vat-basis-radio-gross');
    expect(onChange).toHaveBeenCalledWith('gross');
  });
});

describe('useVatBasis: ONE choice for every report', () => {
  function Probe({ id }: { id: string }) {
    const [basis, set] = useVatBasis();
    const R = require('react');
    const { Text, Pressable } = require('react-native');
    return R.createElement(Pressable, { testID: `${id}-btn`, onPress: () => set('net') }, R.createElement(Text, { testID: `${id}-val` }, basis));
  }
  it('starts on Cost; a change in one component reaches the other at once', () => {
    const R = require('react');
    renderUI(R.createElement(R.Fragment, null, R.createElement(Probe, { id: 'a' }), R.createElement(Probe, { id: 'b' })));
    expect([textOf('a-val'), textOf('b-val')]).toEqual(['cost', 'cost']);
    press('a-btn');
    expect([textOf('a-val'), textOf('b-val'), getVatBasis()]).toEqual(['net', 'net', 'net']);
  });
});
