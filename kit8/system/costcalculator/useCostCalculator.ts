// useCostCalculator - the state of the cost calculator screen: the parameters and the changed coefficients are remembered on the device (spec Q8, phase 1: the last set),
// the model runs on every change (it is cheap), the price list is the built-in snapshot until the price fetcher exists.
import { useCallback, useMemo } from 'react';
import { coefficientChanges, isCoefficientOverrides, mergeCoefficients, type CostCoefficients } from './costCoefficients';
import { COST_EXAMPLES, DEFAULT_COST_INPUT, calculateCosts, costExampleInput, diskAfterMonths, isCostInput, nextMachineChange, normalizeCostInput, type CostInput } from './costModel';
import { BUILT_IN_PRICES, priceListAgeDays, priceListState } from './supabasePrices';
import { useStoredValue } from './useStoredValue';

export const COST_INPUT_STORAGE_KEY = 'costCalculator.input.v1';
export const COST_COEFFICIENTS_STORAGE_KEY = 'costCalculator.coefficients.v1';

export function useCostCalculator() {
  const [stored, setStored] = useStoredValue<CostInput>(COST_INPUT_STORAGE_KEY, DEFAULT_COST_INPUT, isCostInput);
  const [overrides, setOverrides] = useStoredValue<Partial<CostCoefficients>>(COST_COEFFICIENTS_STORAGE_KEY, {}, isCoefficientOverrides);
  const prices = BUILT_IN_PRICES;

  const input = useMemo(() => normalizeCostInput(stored), [stored]);
  const coefficients = useMemo(() => mergeCoefficients(overrides), [overrides]);
  const result = useMemo(() => calculateCosts(input, prices, coefficients), [input, prices, coefficients]);
  const diskIn12Months = useMemo(() => diskAfterMonths(input, 12, prices, coefficients), [input, prices, coefficients]);
  const diskIn24Months = useMemo(() => diskAfterMonths(input, 24, prices, coefficients), [input, prices, coefficients]);
  const nextSize = useMemo(() => nextMachineChange(input, prices, coefficients), [input, prices, coefficients]);
  const priceState = useMemo(() => ({ state: priceListState(prices), ageDays: priceListAgeDays(prices) }), [prices]);

  const setField = useCallback(<K extends keyof CostInput>(key: K, value: CostInput[K]) => setStored(normalizeCostInput({ ...input, [key]: value })), [input, setStored]);
  const reset = useCallback(() => setStored(DEFAULT_COST_INPUT), [setStored]);
  const loadExample = useCallback((id: string) => {
    const e = COST_EXAMPLES.find((x) => x.id === id);
    if (e) setStored(costExampleInput(e.overrides));
  }, [setStored]);
  const setCoefficient = useCallback((key: keyof CostCoefficients, value: number) => setOverrides(coefficientChanges({ ...coefficients, [key]: value })), [coefficients, setOverrides]);
  const resetCoefficients = useCallback(() => setOverrides({}), [setOverrides]);

  return { input, coefficients, prices, priceState, result, diskIn12Months, diskIn24Months, nextSize, setField, reset, loadExample, setCoefficient, resetCoefficients };
}

export type CostCalculator = ReturnType<typeof useCostCalculator>;
