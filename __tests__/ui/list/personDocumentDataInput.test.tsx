/** @jest-environment jsdom */
// PersonDocumentDataInput - the full set of inputs of an ID card / passport + the owner photo (attach, replace, remove).
import React, { act } from 'react';

jest.mock('react-native-paper', () => {
  const R = require('react');
  const RN = require('react-native');
  return { Text: ({ children, testID }: any) => R.createElement(RN.Text, { testID }, children), useTheme: () => ({ colors: new Proxy({}, { get: () => '#123456' }) }) };
});
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, errorCheck, helperText, label }: any) => {
    const err = errorCheck ? errorCheck(value ?? '') : null;
    return R.createElement(View, null, R.createElement(Text, { testID: `${testID}-label` }, label), R.createElement(TextInput, { testID, value, onChangeText }),
      helperText ? R.createElement(Text, { testID: `${testID}-helper` }, helperText) : null, err ? R.createElement(Text, { testID: `${testID}-error` }, String(err)) : null);
  } };
});
jest.mock('../../../kit8/ui/components/common/TextAreaApp', () => { const R = require('react'); const { TextInput } = require('react-native'); return { __esModule: true, default: ({ testID, value, onChangeText }: any) => R.createElement(TextInput, { testID, value, onChangeText }) }; });
jest.mock('../../../kit8/ui/components/common/SelectorFromApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onValueChange, options }: any) => R.createElement(View, { testID }, R.createElement(Text, { testID: `${testID}-value` }, value),
    options.map((o: any) => R.createElement(Pressable, { key: o.value || 'none', testID: `${testID}-opt-${o.value || 'none'}`, onPress: () => onValueChange(o.value) }, R.createElement(Text, null, o.label)))) };
});
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, onSelectDate, error, format }: any) => R.createElement(View, null,
    R.createElement(TextInput, { testID, value, onChangeText }), R.createElement(Pressable, { testID: `${testID}-pick`, onPress: () => onSelectDate(new Date(2029, 5, 30, 12)) }, R.createElement(Text, null, format(new Date(2029, 5, 30)))),
    error ? R.createElement(Text, { testID: `${testID}-error` }, error) : null) };
});
const mockBtn = (p: any) => { const R = require('react'); const { Pressable, Text } = require('react-native'); return R.createElement(Pressable, { testID: p.testID, onPress: p.disabled ? undefined : p.onPress, 'aria-disabled': !!p.disabled }, R.createElement(Text, null, p.title ?? p.children)); };
jest.mock('../../../kit8/ui/components/common/ButtonSecondaryApp', () => ({ __esModule: true, default: (p: any) => mockBtn(p) }));
jest.mock('../../../kit8/ui/components/common/ButtonTextApp', () => ({ __esModule: true, default: (p: any) => mockBtn(p) }));

import PersonDocumentDataInput from '../../../kit8/ui/components/list/forms/PersonDocumentDataInput';
import { emptyPersonDocumentInput } from '../../../kit8/ui/components/list/forms/personDocumentInputModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const T = 'pi';
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const type = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const wait = (ms = 10) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const onChange = jest.fn(); const onPhotoChange = jest.fn();
function mount(extra: any = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<PersonDocumentDataInput testID={T} kind="idCard" value={emptyPersonDocumentInput()} onChange={onChange} photo={null} onPhotoChange={onPhotoChange} {...extra} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('has the full set of a scan: owner, document and photo', () => {
  mount();
  ['surname', 'givenNames', 'sex', 'birthDate', 'placeOfBirth', 'nationality', 'personalNumber', 'address', 'documentNumber', 'issuingState', 'issueDate', 'expiryDate', 'issuedBy', 'notes'].forEach((k) => expect(q(`${T}-${k}`)).not.toBeNull());
  ['owner', 'document', 'photo'].forEach((k) => expect(q(`${T}-section-${k}`)).not.toBeNull());
  expect(q(`${T}-section-document`)!.textContent).toBe('ID card');
  expect(q(`${T}-section-photo`)!.textContent).toBe('Photo of the document');
});

it('a passport says Passport and keeps its photo in the passport folder', () => {
  mount({ kind: 'passport' });
  expect(q(`${T}-section-document`)!.textContent).toBe('Passport');
  expect(q(`${T}-photo-hint`)!.textContent).toContain('identification/passport');
});

it('names and numbers are written in capitals; a state is 3 letters and shows its name', () => {
  mount({ value: { ...emptyPersonDocumentInput(), nationality: 'LVA' } });
  type(`${T}-surname`, 'terentjevs');
  expect(onChange).toHaveBeenLastCalledWith({ surname: 'TERENTJEVS' });
  type(`${T}-documentNumber`, 'lv6073206');
  expect(onChange).toHaveBeenLastCalledWith({ documentNumber: 'LV6073206' });
  type(`${T}-issuingState`, 'latvia');
  expect(onChange).toHaveBeenLastCalledWith({ issuingState: 'LAT' });
  expect(q(`${T}-nationality-helper`)!.textContent).toBe('Latvia');
});

it('sex is picked, a date picked in the calendar is written as DD.MM.YYYY', () => {
  mount();
  press(`${T}-sex-opt-F`);
  expect(onChange).toHaveBeenLastCalledWith({ sex: 'F' });
  press(`${T}-expiryDate-pick`);
  expect(onChange).toHaveBeenLastCalledWith({ expiryDate: '30.06.2029' });
});

it('the errors of the form are shown at their inputs', () => {
  mount({ errors: { surname: 'Surname is required', expiryDate: 'Date as DD.MM.YYYY' } });
  expect(q(`${T}-surname-error`)!.textContent).toBe('Surname is required');
  expect(q(`${T}-expiryDate-error`)!.textContent).toBe('Date as DD.MM.YYYY');
});

it('Attach photo picks a picture and hands it over; with a photo the button says Replace and Remove appears', async () => {
  const photo = { dataUri: 'data:image/jpeg;base64,/9j/AA', mime: 'image/jpeg', base64: '/9j/AA' };
  const pickPhoto = jest.fn(async () => photo);
  mount({ pickPhoto });
  expect(q(`${T}-attach`)!.textContent).toBe('Attach photo');
  expect(q(`${T}-no-photo`)).not.toBeNull();
  press(`${T}-attach`);
  await wait();
  expect(onPhotoChange).toHaveBeenCalledWith(photo);
  act(() => root.unmount()); document.body.innerHTML = '';
  mount({ photo, pickPhoto });
  expect(q(`${T}-attach`)!.textContent).toBe('Replace photo');
  expect(document.body.innerHTML).toContain('data:image/jpeg;base64,/9j/AA');
  press(`${T}-remove-photo`);
  expect(onPhotoChange).toHaveBeenLastCalledWith(null);
});

it('a picture that cannot be read: the words are shown, nothing is changed; cancelling the picker does nothing', async () => {
  mount({ pickPhoto: jest.fn(async () => { throw new Error('Choose a picture (JPEG, PNG ...).'); }) });
  press(`${T}-attach`);
  await wait();
  expect(q(`${T}-photo-problem`)!.textContent).toContain('Choose a picture');
  expect(onPhotoChange).not.toHaveBeenCalled();
  act(() => root.unmount()); document.body.innerHTML = '';
  mount({ pickPhoto: jest.fn(async () => null) });
  press(`${T}-attach`);
  await wait();
  expect(onPhotoChange).not.toHaveBeenCalled();
  expect(q(`${T}-photo-problem`)).toBeNull();
});
