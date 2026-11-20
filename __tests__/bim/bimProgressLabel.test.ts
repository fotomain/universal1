import { bimProgressFraction, bimProgressLabel } from '../../kit8/pm/bim/import/bimImportModel';

describe('BIM import progress line', () => {
  it('writes the step and a whole percent', () => {
    expect(bimProgressLabel(3, 'Starting the import')).toBe('Starting the import (3%)');
    expect(bimProgressLabel(41.6, 'Writing the model…')).toBe('Writing the model (42%)');
  });
  it('is robust against bad numbers and empty text', () => {
    expect(bimProgressLabel(NaN, '')).toBe('Working (0%)');
    expect(bimProgressLabel(250, 'Done')).toBe('Done (100%)');
    expect(bimProgressLabel(-5, 'x')).toBe('x (0%)');
  });
  it('keeps the bar visible and inside 0..1', () => {
    expect(bimProgressFraction(0)).toBe(0.02);
    expect(bimProgressFraction(50)).toBe(0.5);
    expect(bimProgressFraction(999)).toBe(1);
    expect(bimProgressFraction(NaN)).toBe(0.02);
  });
});
