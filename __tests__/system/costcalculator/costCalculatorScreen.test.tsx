/**
 * @jest-environment jsdom
 */
// The cost calculator screen (kit8/system/costcalculator/CostCalculatorScreen.tsx): parameters in, bill out; administrator only; the last set is remembered on the device.
import { cleanupUI, press, q, renderUI, textOf, typeInto } from '../../pm/ui/pmUiTestKit';
import React from 'react';
import { act } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CostCalculatorScreen from '../../../kit8/system/costcalculator/CostCalculatorScreen';
import { DEFAULT_COST_INPUT, calculateCosts, costExampleInput, COST_EXAMPLES } from '../../../kit8/system/costcalculator/costModel';
import { formatUsd } from '../../../kit8/system/costcalculator/costFormat';
import { COST_COEFFICIENTS_STORAGE_KEY, COST_INPUT_STORAGE_KEY } from '../../../kit8/system/costcalculator/useCostCalculator';

jest.mock('../../../kit8/permissions/usePermissions', () => ({
  usePermissions: () => ({ ready: true, isAdmin: (globalThis as any).__costTestAdmin !== false }),
}));

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(async () => {
  (globalThis as any).__costTestAdmin = true;
  await AsyncStorage.clear();
});
afterEach(() => cleanupUI());

describe('the answer follows the parameters', () => {
  it('opens with the defaults: Pro fee only, a Micro machine, and the warning that the prices are the built-in snapshot', () => {
    renderUI(<CostCalculatorScreen />);
    expect(textOf('cost-total')).toBe('$25.00');
    expect(textOf('cost-machine')).toBe('Micro');
    expect(textOf('cost-price-warning')).toContain('2026-11-12');
    expect(textOf('cost-bill-planFee')).toContain('Plan fee (Pro)');
    expect(textOf('cost-bill-machine')).toContain('included');
    expect(textOf('cost-next-size')).toMatch(/needed at about/);
  });

  it('typing a number changes the bill like the model says', () => {
    renderUI(<CostCalculatorScreen />);
    typeInto('cost-field-numberOfProjects', '200');
    typeInto('cost-field-maximumTasksInOneProject', '2000');
    typeInto('cost-field-maximumPlanLinesInOneProject', '5000');
    typeInto('cost-field-numberOfUsers', '300');
    const expected = calculateCosts({ ...DEFAULT_COST_INPUT, numberOfProjects: 200, maximumTasksInOneProject: 2000, maximumPlanLinesInOneProject: 5000, numberOfUsers: 300 });
    expect(textOf('cost-total')).toBe(formatUsd(expected.totalPerMonth));
    expect(textOf('cost-machine')).toBe(expected.machine.size);
    expect(textOf('cost-machine-why')).toMatch(/memory/);
  });

  it('a number that is cleared or is not a number is not handed to the model; what is typed stays', () => {
    renderUI(<CostCalculatorScreen />);
    typeInto('cost-field-numberOfUsers', '');
    expect((q('cost-field-numberOfUsers') as HTMLInputElement).value).toBe('');
    expect(textOf('cost-total')).toBe('$25.00');
    typeInto('cost-field-numberOfUsers', 'abc');
    expect(textOf('cost-total')).toBe('$25.00');
  });

  it('a percent over 100 comes back as 100', () => {
    renderUI(<CostCalculatorScreen />);
    press('cost-toggle-advanced');
    typeInto('cost-field-concurrentUsersPercent', '400');
    expect((q('cost-field-concurrentUsersPercent') as HTMLInputElement).value).toBe('100');
  });

  it('the example buttons load the four sizes of the spec', () => {
    renderUI(<CostCalculatorScreen />);
    for (const e of COST_EXAMPLES) {
      press(`cost-example-${e.id}`);
      const expected = calculateCosts(costExampleInput(e.overrides));
      expect(textOf('cost-total')).toBe(formatUsd(expected.totalPerMonth));
      expect(textOf('cost-machine')).toBe(expected.machine.size);
    }
    press('cost-example-large');
    expect(textOf('cost-total')).toBe('$129');   // 128.75: an amount of 100 or more is shown without cents, like the sketch of the spec
    expect(textOf('cost-machine')).toBe('Large');
  });

  it('switches and the plan: second environment adds a Micro, Team adds the plan fee difference; Reset goes back to the defaults', () => {
    renderUI(<CostCalculatorScreen />);
    press('cost-toggle-advanced');
    press('cost-field-secondEnvironment');
    expect(textOf('cost-total')).toBe('$35.00');
    expect(textOf('cost-bill-secondEnvironment')).toContain('$10.00');
    press('cost-field-plan-team');
    expect(textOf('cost-total')).toBe('$609');
    expect(textOf('cost-bill-planFee')).toContain('Plan fee (Team)');
    press('cost-reset');
    expect(textOf('cost-total')).toBe('$25.00');
  });

  it('the old pg_cron log shows up when the cleaning is switched off', () => {
    renderUI(<CostCalculatorScreen />);
    press('cost-toggle-advanced');
    const before = textOf('cost-growth');
    press('cost-field-cronLogCleaned');
    expect(textOf('cost-growth')).not.toBe(before);
    const expected = calculateCosts({ ...DEFAULT_COST_INPUT, cronLogCleaned: false });
    expect(textOf('cost-disk')).toContain(`${expected.diskGB} GB`);
  });
});

describe('the model coefficients', () => {
  it('are folded, can be changed (the database follows) and reset', () => {
    renderUI(<CostCalculatorScreen />);
    expect(q('cost-coefficient-bloat')).toBeNull();
    press('cost-toggle-coefficients');
    const before = textOf('cost-database');
    typeInto('cost-coefficient-bloat', '3.9');
    expect(textOf('cost-database')).not.toBe(before);
    press('cost-coefficients-reset');
    expect(textOf('cost-database')).toBe(before);
  });
});

describe('who and what is remembered', () => {
  it('only the administrator opens it', () => {
    (globalThis as any).__costTestAdmin = false;
    renderUI(<CostCalculatorScreen />);
    expect(q('cost-calculator-denied')).not.toBeNull();
    expect(q('cost-total')).toBeNull();
  });

  it('the last parameters and the changed coefficients are kept on the device and come back', async () => {
    renderUI(<CostCalculatorScreen />);
    typeInto('cost-field-numberOfUsers', '77');
    press('cost-toggle-coefficients');
    typeInto('cost-coefficient-bloat', '2');
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem(COST_INPUT_STORAGE_KEY))!).numberOfUsers).toBe(77);
    expect(JSON.parse((await AsyncStorage.getItem(COST_COEFFICIENTS_STORAGE_KEY))!)).toEqual({ bloat: 2 });
    cleanupUI();
    renderUI(<CostCalculatorScreen />);
    await flush();
    expect((q('cost-field-numberOfUsers') as HTMLInputElement).value).toBe('77');
  });

  it('a broken stored value is ignored', async () => {
    await AsyncStorage.setItem(COST_INPUT_STORAGE_KEY, '{"numberOfUsers":"many"}');
    await AsyncStorage.setItem(COST_COEFFICIENTS_STORAGE_KEY, 'not json');
    renderUI(<CostCalculatorScreen />);
    await flush();
    expect(textOf('cost-total')).toBe('$25.00');
  });
});
