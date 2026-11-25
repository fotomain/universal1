// The tips of the Estimation dashboard buttons: the NAME first, the description after it.
import fs from 'fs';
import path from 'path';
import { BASIS_TIPS } from '../../../kit8/pm/estimation/model/estimationModel';

describe('estimation button tips', () => {
  test('every currency basis has a name and a description', () => {
    for (const b of ['budget', 'accounting', 'consolidation'] as const) {
      expect(BASIS_TIPS[b].name).toMatch(/currency$/);
      expect(BASIS_TIPS[b].description.length).toBeGreaterThan(20);
    }
  });
  test('every layout tip starts with its own button name, then a colon and the description', () => {
    // EstimateSheet pulls the whole design system: read the list from the source
    const src = fs.readFileSync(path.join(__dirname, '../../../kit8/pm/estimation/ui/EstimateSheet.tsx'), 'utf8');
    const rows = [...src.matchAll(/\{ value: '(\w+)', label: '([^']+)', tip: '([^']+)' \}/g)];
    expect(rows.length).toBe(4);
    for (const [, , label, tip] of rows) expect(tip.startsWith(`${label}: `) && tip.length > label.length + 10).toBe(true);
  });
});
