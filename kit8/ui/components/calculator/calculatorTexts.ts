// calculatorTexts - the English texts of the calculator (the fallback) and the hook that reads the language of the user. The other languages are the
// block `calculator` of every language in kit8/i18n/i18n.ts (en zh hi es ar fr bn pt ru de nl lv fa lt et); a missing key shows the English text.
import { useTranslation } from 'react-i18next';
import { decimalSeparatorFor } from './calculatorModel';

export const CALCULATOR_TEXTS_EN = {
  title: 'Calculator',
  menu: 'Calculator',
  open: 'Calculator (F2)',
  ok: 'OK',
  cancel: 'Cancel',
  close: 'Close',
  copy: 'Copy result',
  copied: 'Copied',
  drag: 'Drag to move',
  clear: 'Clear',
  backspace: 'Delete the last character',
  equals: 'Calculate',
  mc: 'Memory clear',
  mr: 'Memory recall',
  mplus: 'Add to memory',
  mminus: 'Subtract from memory',
  sqrt: 'Square root',
  inv: 'One divided by the number',
  percent: 'Percent',
  sign: 'Change the sign',
  errSyntax: 'Wrong expression',
  errDivZero: 'Division by zero',
  errInvalid: 'Not a number',
} as const;

export type CalculatorTextKey = keyof typeof CALCULATOR_TEXTS_EN;

export function useCalculatorTexts(): { tx: (key: CalculatorTextKey) => string; separator: '.' | ','; language: string } {
  const { t, i18n } = useTranslation();
  const language = i18n?.language ?? 'en';
  const tx = (key: CalculatorTextKey) => {
    const full = `calculator.${key}`;
    const v = t(full);
    return typeof v === 'string' && v && v !== full ? v : CALCULATOR_TEXTS_EN[key];
  };
  return { tx, separator: decimalSeparatorFor(language), language };
}
