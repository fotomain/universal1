// The tips of the Estimation dashboard buttons: the NAME first, the description after it.
import { BASIS_TIPS } from '../../../kit8/pm/estimation/model/estimationModel';

describe('estimation button tips', () => {
  test('every currency basis has a name and a description', () => {
    for (const b of ['budget', 'accounting', 'consolidation'] as const) {
      expect(BASIS_TIPS[b].name).toMatch(/currency$/);
      expect(BASIS_TIPS[b].description.length).toBeGreaterThan(20);
    }
  });
  test('every layout tip starts with its own button name, then a colon and the description', () => {
    const { ESTIMATION_LAYOUTS } = require('../../../kit8/pm/estimation/model/estimationLayouts');
    expect(ESTIMATION_LAYOUTS.length).toBe(4);
    for (const { label, tip } of ESTIMATION_LAYOUTS) expect(tip.startsWith(`${label}: `) && tip.length > label.length + 10).toBe(true);
  });
});
