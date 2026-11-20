/** @jest-environment jsdom */
// The Create Organization Assistant screen: the questions with Next blocked by an error, the save, then "Continue to create Project?" (Yes = the project assistant) and, after No,
// "Set up the default settings for projects?" (Yes = the project assistant for the organization defaults, No = the default settings are stored in the organization).
import React, { act } from 'react';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../../../kit8/pm/i18n/pmT', () => ({ pmT: (t: string, v?: Record<string, any>) => (v ? t.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(v[k])) : t) }));
jest.mock('react-redux', () => ({ useSelector: (fn: any) => fn({ activeUserState: { activeUserEmail: mockEmail } }) }));
let mockEmail = 'boss@acme.test';
const mockClient = { id: 'client' };
jest.mock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));
const mockSwitch = jest.fn();
const mockReload = jest.fn();
let mockMemberships: any[] = [];
jest.mock('../../../../kit8/catalog/organization/switch/useSwitchOrganization', () => ({ useSwitchOrganization: () => mockSwitch }));
jest.mock('../../../../kit8/catalog/organization/switch/useOrganizationMemberships', () => ({ useOrganizationMemberships: () => ({ memberships: mockMemberships, loaded: true, active: 'orgOld', reload: mockReload }) }));
// the settings helpers import the whole settings UI: the full set of settings is not needed here, only that it is built from the currencies of the answers
jest.mock('../../../../kit8/catalog/organization/defaultProjectSettings', () => ({ defaultProjectSettingsOf: (s: any) => ({ ...s, builtIn: true }) }));
const mockInsert = jest.fn();
const mockSaveDefaults = jest.fn();
jest.mock('../../../../kit8/ui/organization/assistant/saveOrganization', () => ({
  insertOrganization: (...a: any[]) => (mockInsert as any)(...a),
  saveOrganizationDefaultSettings: (...a: any[]) => (mockSaveDefaults as any)(...a),
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-paper', () => {
  const R = require('react');
  const { View, Text: RNText, Pressable, TextInput: RNInput } = require('react-native');
  const Text = ({ children, testID, style }: any) => R.createElement(RNText, { testID, style }, children);
  const Btn = ({ children, onPress, disabled, testID }: any) => R.createElement(Pressable, { testID, onPress: disabled ? undefined : onPress, disabled: !!disabled, accessibilityRole: 'button' }, R.createElement(RNText, null, children));
  const Card: any = ({ children, onPress, testID }: any) => R.createElement(Pressable, { testID, onPress }, children);
  Card.Content = ({ children }: any) => R.createElement(View, null, children);
  Card.Actions = ({ children }: any) => R.createElement(View, null, children);
  Card.Title = ({ title, subtitle }: any) => R.createElement(View, null, R.createElement(RNText, null, title), subtitle ? R.createElement(RNText, null, subtitle) : null);
  const Chip = ({ children, onPress, disabled, testID }: any) => R.createElement(Pressable, { testID, onPress: disabled ? undefined : onPress, disabled: !!disabled, accessibilityRole: 'button' }, R.createElement(RNText, null, children));
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
    Switch: () => null,
    Snackbar: ({ visible, children }: any) => (visible ? R.createElement(RNText, { testID: 'org-assistant-snackbar' }, children) : null),
    Divider: () => null,
    useTheme: () => ({ colors: new Proxy({}, { get: () => '#888' }) }),
  };
});
jest.mock('../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { View, Text: RNText, Pressable, TextInput: RNInput } = require('react-native');
  const pick = (code: string) => (code ? { rowGUID: 'g-' + code, rowJSON: { currencyCode: code, countryCode: code } } : null);
  return {
    __esModule: true,
    default: ({ testID, placeholder, onChange }: any) =>
      R.createElement(View, null,
        R.createElement(RNInput, { testID, value: placeholder, editable: false }),
        ['EUR', 'USD', 'GBP', 'CHF'].map((c) => R.createElement(Pressable, { key: c, testID: `${testID}-${c}`, onPress: () => onChange('g-' + c, pick(c)) }, R.createElement(RNText, null, c))),
        R.createElement(Pressable, { testID: `${testID}-clear`, onPress: () => onChange(null, null) }, R.createElement(RNText, null, 'x'))),
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const CreateOrganizationAssistant = require('../../../../kit8/ui/organization/assistant/CreateOrganizationAssistant').default;

let root: any;
let host: HTMLElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => { (q(id) as HTMLElement).click(); });
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
const type = (id: string, text: string) =>
  act(() => {
    const el = q(id) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const disabled = (id: string) => q(id)?.getAttribute('aria-disabled') === 'true';

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<CreateOrganizationAssistant />));
  await flush();
}
/** answers the first step and walks to the review */
async function toReview(title = 'Beta Timber') {
  type('org-assistant-input-title', title);
  for (let i = 0; i < 4; i++) { click('org-assistant-next'); await flush(); }
  expect(q('org-assistant-review')).not.toBeNull();
}

beforeEach(() => {
  mockEmail = 'boss@acme.test';
  mockMemberships = [{ organizationGUID: 'orgOld', organizationTitle: 'Acme', isAdministrator: true, isActive: true }];
  [mockPush, mockReplace, mockBack, mockSwitch, mockReload, mockInsert, mockSaveDefaults].forEach((m) => m.mockReset());
  mockSwitch.mockResolvedValue(true);
  mockInsert.mockResolvedValue({ ok: true, rowGUID: 'orgNew', rowOwnerGUID: 'organizationCatalog' });
  mockSaveDefaults.mockResolvedValue({ ok: true });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('the questions', () => {
  it('a guest is asked to sign in', async () => {
    mockEmail = '';
    await mount();
    expect(q('org-assistant-signin')).not.toBeNull();
    expect(q('org-assistant-footer')).toBeNull();
  });

  it('starts at the name; Next is blocked until it is typed, then walks to the review', async () => {
    await mount();
    expect(q('org-assistant-step-body-identity')).not.toBeNull();
    expect(disabled('org-assistant-next')).toBe(true);
    expect(q('org-assistant-expert-note-error')).not.toBeNull();
    type('org-assistant-input-title', 'Beta Timber');
    expect(disabled('org-assistant-next')).toBe(false);
    click('org-assistant-next'); await flush();
    expect(q('org-assistant-step-body-legal')).not.toBeNull();
    click('org-assistant-next'); await flush();
    expect(q('org-assistant-step-body-currencies')).not.toBeNull();
    click('org-assistant-next'); await flush();
    expect(q('org-assistant-step-body-resources')).not.toBeNull();
    click('org-assistant-next'); await flush();
    expect(q('org-assistant-step-body-review')).not.toBeNull();
    expect(q('org-assistant-create')).not.toBeNull();
    expect(q('org-assistant-next')).toBeNull();
  });

  it('a wrong VAT number blocks the legal step; the currency of the consolidation is obligatory', async () => {
    await mount();
    type('org-assistant-input-title', 'Beta Timber');
    click('org-assistant-next'); await flush();
    type('org-assistant-input-vatNo', '123');
    expect(disabled('org-assistant-next')).toBe(true);
    type('org-assistant-input-vatNo', 'LV12345678901');
    expect(disabled('org-assistant-next')).toBe(false);
    click('org-assistant-next'); await flush();
    click('assistant-currency-org-consolidation-clear');
    expect(disabled('org-assistant-next')).toBe(true);
    click('assistant-currency-org-consolidation-CHF');
    expect(disabled('org-assistant-next')).toBe(false);
  });
});

describe('Create organization', () => {
  it('makes the row of the answers, makes it the active organization and asks "Continue to create Project?"', async () => {
    await mount();
    await toReview('Beta Timber');
    click('org-assistant-create'); await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [client, email, rowJSON] = mockInsert.mock.calls[0];
    expect(client).toBe(mockClient);
    expect(email).toBe('boss@acme.test');
    expect(rowJSON.organizationTitle).toBe('Beta Timber');
    expect(rowJSON.createdByUser).toBe('boss@acme.test');
    expect(rowJSON.currencyForConsolidation).toBe('USD');
    expect(mockSwitch).toHaveBeenCalledWith('orgNew');
    expect(mockReload).toHaveBeenCalled();
    expect(q('org-assistant-ask-project')).not.toBeNull();
    expect(q('org-assistant-footer')).toBeNull();
  });

  it('a refused insert says why and stays on the review: nothing else happens', async () => {
    mockInsert.mockResolvedValue({ ok: false, error: 'new row violates row-level security policy' });
    await mount();
    await toReview();
    click('org-assistant-create'); await flush();
    expect(q('org-assistant-snackbar')?.textContent).toContain('row-level security');
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(q('org-assistant-review')).not.toBeNull();
    expect(q('org-assistant-ask-project')).toBeNull();
  });

  it('a switch that fails still goes on (the organization exists) and tells the user to pick it', async () => {
    mockSwitch.mockResolvedValue(false);
    await mount();
    await toReview();
    click('org-assistant-create'); await flush();
    expect(q('org-assistant-ask-project')).not.toBeNull();
    expect(q('org-assistant-snackbar')?.textContent).toContain('Organization filter');
  });
});

describe('what happens after the organization is made', () => {
  async function made() {
    await mount();
    await toReview('Beta Timber');
    click('org-assistant-create'); await flush();
  }

  it('Continue to create Project? Yes = the project assistant for a NEW project', async () => {
    await made();
    click('org-assistant-project-yes');
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/pm/project/assistant', params: { mode: 'assistant', target: 'new' } });
  });

  it('No = "Set up the default settings for projects?"; Yes = the project assistant for the defaults of the organization (no project)', async () => {
    await made();
    click('org-assistant-project-no');
    expect(q('org-assistant-ask-defaults')).not.toBeNull();
    expect(q('org-assistant-ask-project')).toBeNull();
    click('org-assistant-defaults-yes');
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/pm/project/assistant', params: { mode: 'assistant', target: 'organization' } });
    expect(mockSaveDefaults).not.toHaveBeenCalled();
  });

  it('No again = the default project settings are STORED in the organization (its currencies + the standard defaults) and the user is back in the list', async () => {
    await made();
    click('org-assistant-project-no');
    click('org-assistant-defaults-no'); await flush();
    expect(mockSaveDefaults).toHaveBeenCalledTimes(1);
    const [client, guid, settings] = mockSaveDefaults.mock.calls[0];
    expect(client).toBe(mockClient);
    expect(guid).toBe('orgNew');
    expect(settings).toMatchObject({ currencyForBudget: 'USD', currencyForAccounting: 'EUR', currencyForContract: 'GBP', builtIn: true });
    expect(mockReplace).toHaveBeenCalledWith('/catalog/organization');
  });

  it('a refused save of the defaults stays on the question and says why', async () => {
    mockSaveDefaults.mockResolvedValue({ ok: false, error: 'Only the administrator of the organization (its creator) can change its settings.' });
    await made();
    click('org-assistant-project-no');
    click('org-assistant-defaults-no'); await flush();
    expect(mockReplace).not.toHaveBeenCalledWith('/catalog/organization');
    expect(q('org-assistant-ask-defaults')).not.toBeNull();
    expect(q('org-assistant-snackbar')?.textContent).toContain('administrator');
  });
});
