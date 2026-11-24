/** @jest-environment jsdom */
// CreateListElementForm - the form of the Add button: origin types, inputs by origin, the check, Add first / Add last / close in ONE row.
import React, { act } from 'react';

jest.mock('react-native-paper', () => {
  const R = require('react');
  const RN = require('react-native');
  const Card: any = ({ children, testID }: any) => R.createElement(RN.View, { testID }, children);
  Card.Content = ({ children }: any) => R.createElement(RN.View, null, children);
  return { Card, Text: ({ children }: any) => R.createElement(RN.Text, null, children), useTheme: () => ({ colors: new Proxy({}, { get: () => '#123456' }) }) };
});
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, errorCheck, label }: any) => {
    const err = errorCheck ? errorCheck(value ?? '') : null;
    return R.createElement(View, null, R.createElement(Text, { testID: `${testID}-label` }, label), R.createElement(TextInput, { testID, value, onChangeText }), err ? R.createElement(Text, { testID: `${testID}-error` }, String(err)) : null);
  } };
});
jest.mock('../../../kit8/ui/components/common/TextAreaApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText }: any) => R.createElement(TextInput, { testID, value, onChangeText }) };
});
jest.mock('../../../kit8/ui/components/common/SelectorFromApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onValueChange, options }: any) => R.createElement(View, { testID },
    R.createElement(Text, { testID: `${testID}-value` }, value),
    (Array.isArray(options) ? options : []).map((o: any) => { const v = typeof o === 'object' ? o.value : o; return R.createElement(Pressable, { key: v, testID: `${testID}-opt-${v}`, onPress: () => onValueChange(v) }, R.createElement(Text, null, typeof o === 'object' ? o.label : o)); })) };
});
const mockButton = (props: any) => { const R = require('react'); const { Pressable, Text } = require('react-native'); return R.createElement(Pressable, { testID: props.testID, onPress: props.disabled ? undefined : props.onPress, 'aria-disabled': !!props.disabled }, R.createElement(Text, null, props.title)); };
jest.mock('../../../kit8/ui/components/common/ButtonPrimaryApp', () => ({ __esModule: true, default: (p: any) => mockButton(p) }));
jest.mock('../../../kit8/ui/components/common/ButtonTextApp', () => ({ __esModule: true, default: (p: any) => mockButton(p) }));
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
const mockDispatch = jest.fn();
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, onPress, icon }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  const flat = (items: any[]): any[] => items.flatMap((i) => [i, ...(i.submenu ? flat(i.submenu) : [])]);
  return { __esModule: true, default: ({ testID, items }: any) => R.createElement(View, { testID }, flat(items).map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.submenu ? undefined : i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
const mockBuild = jest.fn(() => ({ fileName: 'x.json' }));
const mockExport = jest.fn(async () => 'downloaded');
const mockShare = jest.fn(async () => 'copied');
jest.mock('../../../kit8/ui/components/table/reusable/tableExportActions', () => ({
  buildTableFile: (...a: any[]) => (mockBuild as any)(...a), exportTableFile: (...a: any[]) => (mockExport as any)(...a), shareTableFile: (...a: any[]) => (mockShare as any)(...a),
  TABLE_EXPORT_FORMATS: [{ format: 'json', label: 'to JSON', icon: 'data_object' }, { format: 'csv', label: 'to CSV', icon: 'description' }],
  tableFileResultMessage: (r: string) => (r === 'copied' ? 'copied to the clipboard' : null),
}));

jest.mock('../../../kit8/ui/components/list/forms/PersonDocumentDataInput', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, kind, value, onChange, photo, onPhotoChange, errors }: any) => R.createElement(View, { testID },
    R.createElement(Text, { testID: `${testID}-kind` }, kind),
    R.createElement(Pressable, { testID: `${testID}-fill`, onPress: () => onChange({ surname: 'TERENTJEVS', givenNames: 'JURIJS', documentNumber: 'P1' }) }, R.createElement(Text, null, 'fill')),
    R.createElement(Pressable, { testID: `${testID}-photo`, onPress: () => onPhotoChange({ dataUri: 'data:image/jpeg;base64,/9j/AA', mime: 'image/jpeg', base64: '/9j/AA' }) }, R.createElement(Text, null, photo ? 'photo' : 'no photo')),
    errors ? R.createElement(Text, { testID: `${testID}-errors` }, Object.values(errors).join('|')) : null) };
});
import CreateListElementForm from '../../../kit8/ui/components/list/forms/CreateListElementForm';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const T = 'f';
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const type = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const first = jest.fn(); const last = jest.fn(); const close = jest.fn();
function mount(extra: any = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<CreateListElementForm testID={T} onCreateFirst={first} onCreateLast={last} onClose={close} {...extra} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('starts as a YouTube post: origin type, URL, title, description and data manipulation', () => {
  mount();
  expect(q(`${T}-origin-value`)!.textContent).toBe('youtube');
  ['url', 'title', 'description', 'manipulation'].forEach((id) => expect(q(`${T}-${id}`)).not.toBeNull());
  expect(q(`${T}-number`)).toBeNull();
});

it('offers the origin types with names, the two person documents included', () => {
  mount();
  ['youtube', 'webpage', 'pdf', 'msword', 'msexcel', 'html', 'text', 'personIDCard', 'personPassport'].forEach((o) => expect(q(`${T}-origin-opt-${o}`)).not.toBeNull());
  expect(q(`${T}-origin-opt-personIDCard`)!.textContent).toBe('Person - ID card');
});

it('a person document shows the full set of inputs (PersonDocumentDataInput): no address, no data manipulation, no title / description of a post', () => {
  mount();
  press(`${T}-origin-opt-personPassport`);
  expect(q(`${T}-person`)).not.toBeNull();
  expect(q(`${T}-person-kind`)!.textContent).toBe('passport');
  ['url', 'title', 'description', 'manipulation'].forEach((id) => expect(q(`${T}-${id}`)).toBeNull());
  press(`${T}-origin-opt-personIDCard`);
  expect(q(`${T}-person-kind`)!.textContent).toBe('idCard');
});

it('Add last of a person document: the rowJSON of the reader\'s post and the photo as an extra; without the data it says what is missing', () => {
  mount();
  press(`${T}-origin-opt-personPassport`);
  press(`${T}-add-last`);
  expect(last).not.toHaveBeenCalled();
  expect(q(`${T}-person-errors`)!.textContent).toContain('Surname is required');
  press(`${T}-person-fill`);
  press(`${T}-person-photo`);
  press(`${T}-add-last`);
  expect(last).toHaveBeenCalledWith(expect.objectContaining({ mediaPostTitle: 'JURIJS TERENTJEVS', dataOriginName: 'personPassport', idCardKind: 'Passport', mediaImageUri: 'data:image/jpeg;base64,/9j/AA' }),
    { idPhoto: { mime: 'image/jpeg', base64: '/9j/AA', folder: 'passport' } });
});

it('Add first without a title does not create: it says the title is required', () => {
  mount();
  press(`${T}-add-first`);
  expect(first).not.toHaveBeenCalled();
  expect(q(`${T}-title-error`)!.textContent).toBe('Title is required');
});

it('Add first with a title makes the rowJSON of the post', () => {
  mount();
  press(`${T}-origin-opt-webpage`);
  type(`${T}-url`, 'https://example.com/a');
  type(`${T}-title`, 'A page');
  type(`${T}-description`, 'About it');
  press(`${T}-add-first`);
  expect(first).toHaveBeenCalledWith(expect.objectContaining({ mediaPostTitle: 'A page', mediaPostDescription: 'About it', mediaPostOrigin: 'https://example.com/a', dataOriginName: 'webpage', mediaPostOriginType: 'url' }), undefined);
});

it('a wrong address is flagged and blocks Add', () => {
  mount();
  type(`${T}-url`, 'not a url');
  type(`${T}-title`, 'T');
  expect(q(`${T}-url-error`)!.textContent).toMatch(/Invalid URL/);
  press(`${T}-add-first`);
  press(`${T}-add-last`);
  expect(first).not.toHaveBeenCalled();
  expect(last).not.toHaveBeenCalled();
});

it('the close icon is at the LEFT, Add last / Add first at the RIGHT, all in ONE row; close calls onClose', () => {
  mount();
  const row = q(`${T}-buttons`)!;
  [`${T}-add-first`, `${T}-add-last`, `${T}-close`].forEach((id) => expect(q(id)!.parentElement).toBe(row));
  expect(q(`${T}-close`)!.textContent).toBe('Close');
  const order = Array.from(row.children).map((c) => c.getAttribute('data-testid'));
  expect(order[0]).toBe(`${T}-close`);
  expect(order.filter(Boolean)).toEqual([`${T}-close`, `${T}-add-last`, `${T}-add-first`]);
  press(`${T}-close`);
  expect(close).toHaveBeenCalledTimes(1);
});

it('the origin types can be limited by the host', () => {
  mount({ originTypes: ['personIDCard', 'personPassport'] });
  expect(q(`${T}-origin-opt-youtube`)).toBeNull();
  expect(q(`${T}-origin-value`)!.textContent).toBe('personIDCard');
  expect(q(`${T}-person`)).not.toBeNull();
});

it('there is no Save button: the element is made by Add first or Add last', () => {
  mount();
  expect(q(`${T}-save`)).toBeNull();
});

it('the three dots icon at the top right opens Export and Share (the formats of the lists) for what is typed', async () => {
  mount();
  type(`${T}-title`, 'Song');
  press(`${T}-more`);
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(q(`${T}-menu`)).not.toBeNull();
  press(`${T}-menu-export-json`);
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  expect(mockBuild).toHaveBeenCalledWith('json', expect.objectContaining({ title: 'Song', rows: [expect.objectContaining({ rowJSON: expect.objectContaining({ mediaPostTitle: 'Song' }) })] }));
  expect(mockExport).toHaveBeenCalledTimes(1);
  press(`${T}-more`);
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  press(`${T}-menu-share-csv`);
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  expect(mockShare).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'copied to the clipboard' } });
});
