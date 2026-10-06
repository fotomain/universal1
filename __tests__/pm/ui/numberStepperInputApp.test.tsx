/** @jest-environment jsdom */
// kit8/ui/components/common/NumberStepperInputApp: clear button inside at the left, increase / decrease arrows inside
// at the right of the REAL TextInputApp (the PM test kit replaces TextInputApp by a plain input for other tests).
import { cleanupUI, inputValue, mustGet, press, q, renderUI, typeInto } from './pmUiTestKit';
import React from 'react';

const INPUT = '../../../kit8/ui/components/common/TextInputApp';
let NumberStepperInputApp: any;
let stepNumberText: any;
beforeAll(() => {
  jest.doMock(INPUT, () => jest.requireActual(INPUT));
  const m = require('../../../kit8/ui/components/common/NumberStepperInputApp');
  NumberStepperInputApp = m.default;
  stepNumberText = m.stepNumberText;
});
afterEach(() => cleanupUI());

describe('NumberStepperInputApp', () => {
  it('stepNumberText: step, clamp to min / max, empty field', () => {
    expect(stepNumberText('10', 1, { min: 0, max: 100 })).toBe('11');
    expect(stepNumberText('100', 1, { min: 0, max: 100 })).toBe('100');
    expect(stepNumberText('0', -1, { min: 0 })).toBe('0');
    expect(stepNumberText('', 1, { min: 1, emptyValue: 1 })).toBe('1');
    expect(stepNumberText('', -1, { min: 0 })).toBe('0');
    expect(stepNumberText('250', -1, { min: 0, max: 100 })).toBe('100');
  });

  it('close button at the left of the text, arrows at the right - all inside the input box', () => {
    const onChange = jest.fn();
    renderUI(<NumberStepperInputApp testID="n" value="10" min={0} max={100} onChangeText={onChange} />);
    const input = mustGet('n');
    const box = input.parentElement!;
    const clear = mustGet('n-clear');
    const arrows = mustGet('n-arrows');
    expect(clear.parentElement).toBe(box);
    expect(arrows.parentElement).toBe(box);
    const kids = Array.from(box.children);
    expect(kids.indexOf(clear)).toBeLessThan(kids.indexOf(input));
    expect(kids.indexOf(input)).toBeLessThan(kids.indexOf(arrows));
    expect(Array.from(arrows.children).map((e) => e.getAttribute('data-testid'))).toEqual(['n-increase', 'n-decrease']);
    expect(inputValue('n')).toBe('10');
    press('n-increase');
    expect(onChange).toHaveBeenLastCalledWith('11');
    press('n-decrease');
    expect(onChange).toHaveBeenLastCalledWith('9');
    press('n-clear');
    expect(onChange).toHaveBeenLastCalledWith('');
    // only one clear control: the default one of TextInputApp at the right is off
    expect(box.querySelectorAll('[data-testid$="-clear"]').length).toBe(1);
  });

  it('digits only; the arrows stop at min / max; a disabled field does nothing', () => {
    const onChange = jest.fn();
    const ui = renderUI(<NumberStepperInputApp testID="n" value="100" min={0} max={100} maxDigits={3} onChangeText={onChange} />);
    typeInto('n', '12a34');
    expect(onChange).toHaveBeenLastCalledWith('123');
    expect(mustGet('n-increase').getAttribute('aria-disabled')).toBe('true');
    ui.rerender(<NumberStepperInputApp testID="n" value="0" min={0} max={100} onChangeText={onChange} />);
    expect(mustGet('n-decrease').getAttribute('aria-disabled')).toBe('true');
    expect(q('n-increase')!.getAttribute('aria-disabled')).not.toBe('true');
    onChange.mockClear();
    ui.rerender(<NumberStepperInputApp testID="n" value="5" disabled onChangeText={onChange} />);
    press('n-increase');
    press('n-clear');
    expect(onChange).not.toHaveBeenCalled();
  });
});
