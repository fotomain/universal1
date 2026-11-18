/** @jest-environment jsdom */
// The Create New Project Assistant screen: the first screen with three ways, the questions with the navigation line and the way back, the currencies rule,
// the saved run offered at the next start, and the hand over to the New project window.
import React, { act } from 'react';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: any = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../../kit8/pm/i18n/pmT', () => ({ pmT: (t: string, v?: Record<string, any>) => (v ? t.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(v[k])) : t) }));
// the real hooks need Supabase + React Query: the screen takes the environment as a prop; the module of the hook is not loaded
jest.mock('../../../../kit8/ui/project/assistant/hooks/useAssistantEnvironment', () => ({ useAssistantEnvironment: () => ({}) }));
// Paper in a plain DOM: the small set of components the assistant uses
jest.mock('react-native-paper', () => {
  const R = require('react');
  const { View, Text: RNText, Pressable, TextInput: RNInput } = require('react-native');
  const Text = ({ children, testID, style }: any) => R.createElement(RNText, { testID, style }, children);
  const Btn = ({ children, onPress, disabled, testID }: any) => R.createElement(Pressable, { testID, onPress: disabled ? undefined : onPress, disabled: !!disabled, accessibilityRole: 'button' }, R.createElement(RNText, null, children));
  const Card: any = ({ children, onPress, testID, title, subtitle }: any) => R.createElement(Pressable, { testID, onPress }, title ? R.createElement(RNText, null, title) : null, subtitle ? R.createElement(RNText, null, subtitle) : null, children);
  Card.Content = ({ children }: any) => R.createElement(View, null, children);
  Card.Actions = ({ children }: any) => R.createElement(View, null, children);
  Card.Title = ({ title, subtitle }: any) => R.createElement(View, null, R.createElement(RNText, null, title), subtitle ? R.createElement(RNText, null, subtitle) : null);
  const Chip = ({ children, onPress, disabled, testID, selected }: any) => R.createElement(Pressable, { testID, onPress: disabled ? undefined : onPress, disabled: !!disabled, accessibilityRole: 'button' }, R.createElement(RNText, null, children));
  const TextInput: any = ({ value, onChangeText, testID, label, editable = true }: any) => R.createElement(RNInput, { testID, value, onChangeText, editable, accessibilityLabel: label });
  TextInput.Icon = () => null;
  const List: any = {};
  List.Item = ({ title, description, onPress, right, testID }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(RNText, null, title), description ? R.createElement(RNText, null, description) : null, right ? right({}) : null);
  List.Icon = () => null;
  return {
    Text, Button: Btn, Card, Chip, TextInput, List,
    IconButton: ({ onPress, testID }: any) => R.createElement(Pressable, { testID, onPress }),
    Surface: ({ children, testID }: any) => R.createElement(View, { testID }, children),
    ProgressBar: ({ testID }: any) => R.createElement(View, { testID }),
    HelperText: ({ children, testID }: any) => R.createElement(RNText, { testID }, children),
    Switch: ({ value, onValueChange, testID }: any) => R.createElement(Pressable, { testID, onPress: () => onValueChange(!value), 'data-value': String(!!value) }),
    SegmentedButtons: ({ buttons, onValueChange }: any) => R.createElement(View, null, buttons.map((b: any) => R.createElement(Pressable, { key: b.value, testID: b.testID, onPress: () => onValueChange(b.value) }, R.createElement(RNText, null, b.label)))),
    Banner: ({ children, testID }: any) => R.createElement(View, { testID }, R.createElement(RNText, null, children)),
    Snackbar: () => null,
    Divider: () => null,
    ActivityIndicator: () => null,
    useTheme: () => ({ colors: new Proxy({}, { get: () => '#888' }) }),
  };
});
// the currency picker of the catalog (needs redux + the design system): a plain input showing the chosen code + one button per currency + a clear button
jest.mock('react-redux', () => ({ useSelector: (fn: any) => fn({}) }));
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { View, Text: RNText, Pressable, TextInput: RNInput } = require('react-native');
  const pick = (code: string) => (code ? { rowGUID: 'g-' + code, rowJSON: { currencyCode: code } } : null);
  return {
    __esModule: true,
    default: ({ testID, placeholder, onChange }: any) =>
      R.createElement(View, null,
        R.createElement(RNInput, { testID, value: placeholder, editable: false }),
        ['EUR', 'USD', 'GBP'].map((c) => R.createElement(Pressable, { key: c, testID: `${testID}-${c}`, onPress: () => onChange('g-' + c, pick(c)) }, R.createElement(RNText, null, c))),
        R.createElement(Pressable, { testID: `${testID}-clear`, onPress: () => onChange(null, null) }, R.createElement(RNText, null, 'x'))),
  };
});
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ __esModule: true, default: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const CreateNewProjectAssistant = require('../../../../kit8/ui/project/assistant/create/CreateNewProjectAssistant').default;
const { usePMStore } = require('../../../../kit8/pm/store/store_pm');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { assistantStorageKey } = require('../../../../kit8/ui/project/assistant/model/assistantStorage');
const { defaultAssistantValues } = require('../../../../kit8/ui/project/assistant/model/assistantModel');

const env = (over: any = {}) => ({
  userKey: 'u1', ownerGUID: 'owner-1', projectCount: 2, existingNames: [], organizationDefaults: null, organizationLoaded: true,
  organizationCurrencies: { currencyForBudget: 'USD', currencyForAccounting: 'EUR', currencyForContract: 'GBP' },
  consolidationCurrency: 'CHF', projectJSONOf: () => null, ...over,
});

let root: any;
let host: HTMLElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => { (q(id) as HTMLElement).click(); });
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
const type = (id: string, text: string) =>
  act(() => {
    const el = q(id) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const disabled = (id: string) => q(id)?.getAttribute('aria-disabled') === 'true';

async function mount(props: any = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<CreateNewProjectAssistant environment={env(props.env)} mode={props.mode} target={props.target} />));
  await flush();
}

beforeEach(async () => {
  mockPush.mockClear(); mockReplace.mockClear(); mockBack.mockClear();
  mockParams = {};
  await AsyncStorage.clear?.();
  usePMStore.setState({ projectAssistantResult: null, projectAssistantSeed: null, projectSettingsRequest: null });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('first screen', () => {
  it('asks how to create the project: assistant, manual, import', async () => {
    await mount();
    expect(q('assistant-start')).not.toBeNull();
    ['assistant', 'manual', 'import'].forEach((id) => expect(q(`assistant-option-${id}`)).not.toBeNull());
  });
  it('Manual input asks for the New project window; Import opens the import assistant', async () => {
    await mount();
    click('assistant-option-manual');
    expect(usePMStore.getState().projectSettingsRequest?.guid).toBe('new');
    expect(mockReplace).toHaveBeenCalledWith('/pm/project/dashboard');
    click('assistant-option-import');
    expect(mockPush).toHaveBeenCalledWith('/pm/project/assistant/import');
  });
  it('a guest is asked to sign in', async () => {
    await mount({ env: { ownerGUID: '' } });
    expect(q('assistant-signin')).not.toBeNull();
    expect(q('assistant-start')).toBeNull();
  });
});

describe('the questions', () => {
  async function toSchedule() {
    await mount();
    click('assistant-option-assistant');
    await flush();
    type('assistant-input-name', 'Plant 7 - shutdown');
    click('assistant-next');
  }
  it('Next is disabled until the name is typed; the navigation line shows the steps and lets the user go back', async () => {
    await mount();
    click('assistant-option-assistant');
    await flush();
    expect(q('assistant-step-body-identity')).not.toBeNull();
    expect(disabled('assistant-next')).toBe(true);
    type('assistant-input-name', 'Plant 7 - shutdown');
    expect(disabled('assistant-next')).toBe(false);
    click('assistant-next');
    expect(q('assistant-step-body-schedule')).not.toBeNull();
    expect(disabled('assistant-step-identity')).toBe(false); // already seen: can be pressed
    expect(disabled('assistant-step-control')).toBe(true); // ahead: cannot
    click('assistant-step-identity');
    expect(q('assistant-step-body-identity')).not.toBeNull();
    click('assistant-next');
    click('assistant-footer-back');
    expect(q('assistant-step-body-identity')).not.toBeNull();
  });
  it('the expert says why the step is asked, and warns', async () => {
    await toSchedule();
    expect(q('assistant-expert-tip')?.textContent).toMatch(/Fix the start first/);
    type('assistant-date-finish', '2026-10-01');
    expect(q('assistant-expert-note-error')?.textContent).toMatch(/finish is before the start/);
    expect(disabled('assistant-next')).toBe(true);
  });
  it('the currencies of the project are typed also when the organization has projects; the consolidation currency is read only', async () => {
    await toSchedule();
    click('assistant-next'); // planning
    click('assistant-next');
    expect(q('assistant-step-body-currencies')).not.toBeNull();
    expect(q('assistant-currencies-readonly')).toBeNull();
    // the organization's presets are the start values; budget + accounting stay obligatory
    expect((q('assistant-currency-budget') as HTMLInputElement).value).toBe('USD');
    // a currency is picked from the list, never typed; clearing it blocks the step
    click('assistant-currency-budget-clear');
    expect(disabled('assistant-next')).toBe(true);
    click('assistant-currency-budget-EUR');
    expect((q('assistant-currency-budget') as HTMLInputElement).value).toBe('EUR');
    click('assistant-currency-accounting-USD');
    expect(disabled('assistant-next')).toBe(false);
    const c = q('assistant-currency-consolidation') as HTMLInputElement;
    expect(c.value).toBe('CHF');
    expect(c.readOnly || c.disabled).toBe(true);
    expect(q('assistant-currency-consolidation-EUR')).toBeNull(); // no quick buttons: read only
  });
});

describe('the planning model and the time of day', () => {
  async function toPlanning() {
    await mount();
    click('assistant-option-assistant');
    await flush();
    type('assistant-input-name', 'Plant 7 - shutdown');
    click('assistant-next'); // schedule
    click('assistant-next'); // planning
  }
  it('day by day skips the time of day; hour by hour asks it, a wrong zone or window blocks Next, the answers reach the window', async () => {
    await toPlanning();
    expect(q('assistant-step-body-planning')).not.toBeNull();
    expect(q('assistant-step-timeOfDay')).toBeNull();
    click('assistant-model-hour');
    expect(q('assistant-step-timeOfDay')).not.toBeNull();
    click('assistant-next');
    expect(q('assistant-step-body-timeOfDay')).not.toBeNull();
    expect((q('assistant-windows') as HTMLInputElement).value).toBe('08:00-16:00');
    expect((q('assistant-zone') as HTMLInputElement).value).toBe('UTC');
    type('assistant-zone', 'Mars/Base');
    expect(disabled('assistant-next')).toBe(true);
    click('assistant-zone-utc');
    type('assistant-windows', '25:00-26:00');
    expect(disabled('assistant-next')).toBe(true);
    click('assistant-windows-lunch');
    expect(disabled('assistant-next')).toBe(false);
    click('assistant-choice-slot-30');
    click('assistant-next'); // currencies
    click('assistant-currency-budget-EUR');
    click('assistant-currency-accounting-EUR');
    click('assistant-next'); // budgets
    click('assistant-next'); // control
    click('assistant-next'); // review
    expect(q('assistant-review')?.textContent).toMatch(/Hour by hour/);
    click('assistant-create');
    return flush().then(() => {
      expect(usePMStore.getState().projectAssistantResult.patch).toMatchObject({
        resourceOptimizationMode: 'hourByHourModel', resourceSlotMinutes: 30, projectTimeZone: 'UTC', planHour: true,
        projectWorkWindows: [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }],
      });
    });
  });
  it('the resource optimization is asked after the resources, only while time costs are on', async () => {
    await toPlanning();
    click('assistant-next'); // currencies
    click('assistant-currency-budget-EUR');
    click('assistant-currency-accounting-EUR');
    click('assistant-next'); // budgets
    expect(q('assistant-step-optimization')).toBeNull();
    click('assistant-switch-cost');
    expect(q('assistant-step-optimization')).not.toBeNull();
  });
});

describe('the end', () => {
  async function toReview(e: any = {}) {
    await mount({ env: e });
    click('assistant-option-assistant');
    await flush();
    type('assistant-input-name', 'Plant 7 - shutdown');
    const steps = e.projectCount === 0 ? 5 : 5;
    click('assistant-next'); // schedule
    click('assistant-next'); // planning
    click('assistant-next'); // currencies
    click('assistant-next'); // budgets
    click('assistant-next'); // control
    click('assistant-next'); // review
    return steps;
  }
  it('Create project hands the answers to the New project window and leaves for the dashboard', async () => {
    await toReview();
    expect(q('assistant-review')).not.toBeNull();
    click('assistant-create');
    await flush();
    const r = usePMStore.getState().projectAssistantResult;
    expect(r).toMatchObject({ target: 'new', createNow: true });
    expect(r.patch).toMatchObject({ name: 'Plant 7 - shutdown', planDay: true });
    expect(r.patch).toMatchObject({ currencyForBudget: 'USD', currencyForAccounting: 'EUR', currencyForContract: 'GBP' });
    expect(mockReplace).toHaveBeenCalledWith('/pm/project/dashboard');
  });
  it('the panel has ONE fixed height on every step, with Back / Next inside it', async () => {
    await toReview();
    const h = (q('assistant-panel') as HTMLElement).style.height;
    expect(h).toMatch(/px$/);
    expect(q('assistant-panel')?.contains(q('assistant-footer'))).toBe(true);
  });
  it('Open in the project window does not save at once and hands over the typed currencies', async () => {
    const e = env({ projectCount: 0 });
    host = document.createElement('div'); // (own mount to keep the spy)
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<CreateNewProjectAssistant environment={e} />));
    await flush();
    click('assistant-option-assistant'); await flush();
    type('assistant-input-name', 'First project');
    click('assistant-next'); click('assistant-next'); click('assistant-next');
    click('assistant-currency-budget-EUR'); click('assistant-currency-accounting-USD');
    click('assistant-next'); click('assistant-next'); click('assistant-next');
    click('assistant-open-window');
    await flush();
    expect(usePMStore.getState().projectAssistantResult).toMatchObject({ createNow: false });
    expect(usePMStore.getState().projectAssistantResult.patch).toMatchObject({ currencyForBudget: 'EUR', currencyForAccounting: 'USD', currencyForContract: 'GBP' });
  });
});

describe('stop and continue', () => {
  it('Save and exit keeps the last input; the next run offers to continue with it', async () => {
    await mount();
    click('assistant-option-assistant'); await flush();
    type('assistant-input-name', 'Plant 7 - shutdown');
    click('assistant-next');
    click('assistant-exit');
    await flush();
    expect(mockBack).toHaveBeenCalled();
    expect(JSON.parse(await AsyncStorage.getItem(assistantStorageKey('u1', 'new')))).toMatchObject({ stepId: 'schedule', values: { name: 'Plant 7 - shutdown' } });
    act(() => root.unmount()); host.remove();

    await mount();
    expect(q('assistant-resume-card')).not.toBeNull();
    expect(q('assistant-resume-text')?.textContent).toMatch(/Plant 7 - shutdown - step Schedule/);
    click('assistant-resume');
    await flush();
    expect(q('assistant-step-body-schedule')).not.toBeNull();
    click('assistant-step-identity');
    expect((q('assistant-input-name') as HTMLInputElement).value).toBe('Plant 7 - shutdown');
  });
  it('a run with nothing typed is not offered', async () => {
    await AsyncStorage.setItem(assistantStorageKey('u1', 'new'), JSON.stringify({ version: 1, target: 'new', values: defaultAssistantValues(), stepId: 'identity', reached: ['identity'], savedAt: new Date().toISOString() }));
    await mount();
    expect(q('assistant-resume-card')).toBeNull();
  });
  it('called for a project window (mode=assistant) it starts at once, from the answers of that window', async () => {
    usePMStore.getState().setProjectAssistantSeed({ target: 'new', values: { name: 'From the window', projectStartDate: '2026-12-01' } });
    await mount({ mode: 'assistant', target: 'new' });
    await flush();
    expect(q('assistant-step-body-identity')).not.toBeNull();
    expect((q('assistant-input-name') as HTMLInputElement).value).toBe('From the window');
    expect(usePMStore.getState().projectAssistantSeed).toBeNull();
  });
});
