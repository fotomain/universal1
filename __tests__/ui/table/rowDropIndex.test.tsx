/** @jest-environment jsdom */
// ReusableTable on iOS / Android: the ⠿ grip drags a row; rowDropIndex says where it lands.
import React, { act } from 'react';
import { rowDropIndex } from '../../../kit8/ui/components/table/reusable/tableRows';
import ReusableTableRowGrip from '../../../kit8/ui/components/table/reusable/ReusableTableRowGrip';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

describe('rowDropIndex', () => {
  const h = [52, 52, 52, 52, 52];
  it('a row moves over its neighbour when the finger has passed half of it', () => {
    expect(rowDropIndex(h, 1, 0)).toBe(1);
    expect(rowDropIndex(h, 1, 25)).toBe(1); // not yet half a row
    expect(rowDropIndex(h, 1, 26)).toBe(2);
    expect(rowDropIndex(h, 1, 60)).toBe(2);
    expect(rowDropIndex(h, 1, 80)).toBe(3); // 52 + 28
    expect(rowDropIndex(h, 3, -26)).toBe(2);
    expect(rowDropIndex(h, 3, -114)).toBe(1); // 52 + 52 + 10
    expect(rowDropIndex(h, 3, -140)).toBe(0); // 52 + 52 + 36 (more than half of the third)
  });
  it('never leaves the list', () => {
    expect(rowDropIndex(h, 0, -500)).toBe(0);
    expect(rowDropIndex(h, 4, 500)).toBe(4);
    expect(rowDropIndex(h, 1, 5000)).toBe(4);
    expect(rowDropIndex(h, 3, -5000)).toBe(0);
    expect(rowDropIndex([], 0, 10)).toBe(0);
    expect(rowDropIndex(h, 9, 10)).toBe(9); // an index outside the list stays
  });
  it('taller rows need a longer way', () => {
    const tall = [52, 120, 52];
    expect(rowDropIndex(tall, 0, 59)).toBe(0); // half of 120 is 60
    expect(rowDropIndex(tall, 0, 60)).toBe(1);
    expect(rowDropIndex(tall, 0, 130)).toBe(1); // 60 + not yet half of the last row
    expect(rowDropIndex(tall, 0, 146)).toBe(2);
  });
});

describe('ReusableTableRowGrip', () => {
  it('shows the grip; a table that is searched / filtered dims it', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const noop = () => undefined;
    act(() => root.render(<ReusableTableRowGrip testID="g1" color="#000" enabled onStart={noop} onMove={noop} onEnd={noop} onCancel={noop} />));
    expect(host.querySelector('[data-testid="g1"]')!.textContent).toBe('⠿');
    expect(getComputedStyle(host.querySelector('[data-testid="g1"]') as Element).opacity).toBe('1');
    act(() => root.render(<ReusableTableRowGrip testID="g1" color="#000" enabled={false} onStart={noop} onMove={noop} onEnd={noop} onCancel={noop} />));
    expect(Number(getComputedStyle(host.querySelector('[data-testid="g1"]') as Element).opacity)).toBeLessThan(1);
    act(() => root.unmount());
    host.remove();
  });
});
