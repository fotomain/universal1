# kit8/ui/components/calculator - W1 INLINE CALCULATOR

A calculator for **numeric fields**: a calculator icon stands at the RIGHT side of the field, the user pre-calculates in a small window and **OK** closes it and puts the result into the field. The same calculator is also a **standalone window** (app bar three dots menu -> Calculator). Spec: Google Doc "W1 INLINE CALCULATOR" (2026-11-19); the model is the built-in calculator of 1C (display with the expression, memory, percent, OK assigns the result).

## Files
| File | What |
|---|---|
| `calculatorModel.ts` | PURE: the parser `evaluateExpression`, the key state machine `calcPress`, `calcOk`, `applyConstraints`, number / expression format, `decimalSeparatorFor(language)`, keyboard map |
| `CalculatorApp.tsx` | the panel: display (expression + value), keys, memory, OK / Cancel (`mode="inline"`) or Copy result / Close (`mode="window"`) |
| `CalculatorTrigger.tsx` | the icon + the pop-up next to the field (`getValue`, `onResult`, `integer`, `min`, `max`, `openRef`) |
| `CalculatorWindowHost.tsx` | the standalone window: floating, draggable by its title bar, NOT modal (the screen below stays usable); mounted once in `app/_layout.tsx` |
| `calculatorStore.ts` | the memory (shared by all calculators) + the window state / place (module store, `useCalculatorStore`) |
| `calculatorTexts.ts` | English fallback texts + `useCalculatorTexts()` (language, decimal separator) |

## Where the icon is
- **Every editable number column of the task lines (all Task-Edit tables: Time / Material / Expense / Deliverable, Payments) and of all document lines** (fact input, purchase order, product receipt, vendor / customer invoice, payment fact): through `pmNumberColumn` -> `PMNumberInputApp` (prop `calculator`, default `true`) -> `NumberCell`. A new editable number column that spreads `pmNumberColumn(...)` has it with no extra work.
- Other `ReusableTable` number columns: `calculator: true` on the column (default false).
- Form fields: `<NumberInputApp calculator />` (default false).
- A read only cell has no icon.

## How it works
- The icon opens the calculator with the number the field has now (typed, even if not saved). The first digit replaces it, an operator continues it (`12.5` then `*` = `12.5*`).
- **OK**: the expression is calculated, the result gets the limits of the field (`integer` rounds, `min` / `max` clamp, positive-only fields never go below 0), the window closes and the field takes + saves the value. A wrong expression (`5/0`) keeps the window open with the message. OK with an empty display = Cancel. **Cancel** / Escape / a press outside: nothing changes.
- Keys: 0-9 . + - x / ( ) %, `=`, C, backspace, sqrt, 1/x, +/-, memory MC MR M+ M-. Percent works like 1C / Windows: `200+10%` = 220, `200-10%` = 180, `200*10%` = 20. Results keep 12 significant digits (0.1+0.2 = 0.3).
- Keyboard (web): the keys above, Enter = `=` while the expression has an operator, else OK; Escape = Cancel; **F2 in the field** opens the calculator.
- Language: texts = the block `calculator` of the 15 languages of `kit8/i18n/i18n.ts` (English fallback); the decimal key and the shown numbers use the separator of the language (comma: es fr pt ru de nl lv lt et; point: en zh hi bn ar fa). Digits stay 0-9. The key layout stays left to right in Arabic / Farsi (like every calculator).
- The memory is the same number in the calculator of every field and in the standalone window; it is kept while the app runs.

## Standalone window
App bar -> three dots -> **Calculator** (toggles it). It floats over the screen, is dragged by the title bar (mouse and finger, kept on screen) and does not block the screen below: the user clicks in either. Buttons: Copy result, Close. NOT built: sending the result into the field that was last in focus, remembering the place after a restart, resizing.

## Not built
- the time sheet day cells (`PMTimesheetDocumentLines`, a plain grid) and the hour / minute fields of the task window have no icon (an hour is not a sum);
- a visual check on a real phone / in the browser was not done by the author (Jest only).

Tests: `__tests__/ui/calculator/calculatorModel.test.ts` (parser, keys, formats), `calculatorUi.test.tsx` (icon, OK / Cancel, language, window, memory, the 15 languages).
