/** @jest-environment jsdom */
// kit8/components/common/ColorPickerRowApp: auto swatch, Default chip, swatches, Custom… chip.
import { cleanupUI, mustGet, press, q, qa, renderUI, textOf } from './pmUiTestKit';
import React from 'react';
import ColorPickerRowApp, { normalizeHexColor, readableOn } from '../../../kit8/components/common/ColorPickerRowApp';

afterEach(() => cleanupUI());
const SW = ['#6366f1', '#ef4444'];

describe('ColorPickerRowApp', () => {
  it('helpers', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC');
    expect(normalizeHexColor('zz')).toBeNull();
    expect(readableOn('#FFFF00')).toBe('#000000');
    expect(readableOn('#1E293B')).toBe('#FFFFFF');
  });

  it('order: Default chip, auto, swatches, Custom…; choosing reports the color (null for auto / Default)', () => {
    const onChange = jest.fn();
    renderUI(<ColorPickerRowApp testID="c" value={null} onChange={onChange} swatches={SW} showAuto defaultColor="#000000" />);
    expect(qa('c-')).toEqual(['c-default', 'c-auto', 'c-#6366F1', 'c-#EF4444', 'c-custom']);
    expect(mustGet('c-auto').getAttribute('aria-checked')).toBe('true');
    expect(textOf('c-custom')).toContain('Custom');
    press('c-#EF4444');
    expect(onChange).toHaveBeenLastCalledWith('#EF4444');
    press('c-auto');
    expect(onChange).toHaveBeenLastCalledWith(null);
    press('c-default');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('the selected swatch is marked (any letter case); a color outside the set shows in the Custom chip', () => {
    const ui = renderUI(<ColorPickerRowApp testID="c" value="#6366f1" onChange={jest.fn()} swatches={SW} />);
    expect(mustGet('c-#6366F1').getAttribute('aria-checked')).toBe('true');
    expect(textOf('c-#6366F1')).toContain('check');
    expect(mustGet('c-#EF4444').getAttribute('aria-checked')).toBe('false');
    ui.rerender(<ColorPickerRowApp testID="c" value="#123456" onChange={jest.fn()} swatches={SW} />);
    expect(textOf('c-custom')).toContain('#123456');
    expect(mustGet('c-custom').getAttribute('aria-pressed')).toBe('true');
  });

  it('allowCustom={false}: no Custom chip; disabled: nothing can be chosen; swatchTestID overrides the ids', () => {
    const onChange = jest.fn();
    renderUI(<ColorPickerRowApp testID="c" value={null} onChange={onChange} swatches={SW} allowCustom={false} disabled swatchTestID={(x) => `my-${x}`} />);
    expect(q('c-custom')).toBeNull();
    press('my-#6366F1');
    expect(onChange).not.toHaveBeenCalled();
  });
});
