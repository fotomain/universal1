/** @jest-environment jsdom */
// The importer screen (route /pm/bim/import) is a Drawer screen: it STAYS MOUNTED. Opened again from Project settings -> BIM -> "Import again" for ANOTHER project,
// its Project GUID must be the one of the route, not the one of the last visit; the examples still fill in their own GUID and name when the route names no existing project.
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

let mockParams: Record<string, any> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('react-native-paper', () => {
  const R = require('react');
  const RN = require('react-native');
  const box = (p: any) => R.createElement(RN.View, { testID: p.testID }, p.children);
  const Card: any = (p: any) => box(p);
  Card.Title = () => null;
  Card.Content = (p: any) => box(p);
  return {
    Button: (p: any) => R.createElement(RN.Pressable, { testID: p.testID, onPress: p.onPress, disabled: p.disabled }, R.createElement(RN.Text, null, p.children)),
    Card,
    HelperText: (p: any) => R.createElement(RN.Text, { testID: p.testID }, p.children),
    ProgressBar: () => null,
    RadioButton: { Group: (p: any) => R.createElement(R.Fragment, null, R.Children.map(p.children, (c: any) => R.cloneElement(c, { __group: p }))), Item: (p: any) => R.createElement(RN.Pressable, { testID: p.testID, onPress: () => p.__group.onValueChange(p.value) }, R.createElement(RN.Text, null, p.label)) },
    Switch: (p: any) => R.createElement(RN.Pressable, { testID: p.testID, onPress: () => p.onValueChange(!p.value) }),
    Text: RN.Text,
    TextInput: (p: any) => R.createElement(RN.TextInput, { testID: p.testID, value: p.value, onChangeText: p.onChangeText }),
    useTheme: () => ({ colors: { background: '#fff', outlineVariant: '#ccc' } }),
  };
});
jest.mock('../../kit8/pm/crud/queries', () => ({ usePMOwnerGUID: () => 'owner-1' }));
jest.mock('../../kit8/pm/bim/import/useBimImport', () => ({ useBimImport: () => ({ run: jest.fn(), status: { kind: 'idle' }, busy: false }) }));
jest.mock('../../kit8/pm/bim/import/bimServerClient', () => ({ ...jest.requireActual('../../kit8/pm/bim/import/bimServerClient'), bimServerUrl: () => 'http://localhost:8765' }));

import BIMToProjectImport from '../../kit8/pm/bim/import/BIMToProjectImport';
import { BIM_EXAMPLE1_PROJECT_GUID, BIM_EXAMPLE2_NAME, BIM_EXAMPLE2_PROJECT_GUID } from '../../kit8/pm/bim/model/bimModel';
import { usePMStore } from '../../kit8/pm/store/store_pm';

const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
let root: Root | null = null;
let host: HTMLDivElement | null = null;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const render = () => act(() => root!.render(<BIMToProjectImport />));
const guid = () => (q('bim-import-guid') as HTMLInputElement).value;
const name = () => (q('bim-import-name') as HTMLInputElement | null)?.value;

beforeEach(() => {
  mockParams = {};
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => usePMStore.setState({ projectsById: {} } as any));
});
afterEach(() => {
  act(() => root!.unmount());
  host!.remove();
});

describe('importer screen: the Project GUID', () => {
  it('opened for a project (route parameter): that project is the target', () => {
    mockParams = { projectGUID: A };
    render();
    expect(guid()).toBe(A);
  });

  it('the screen stays mounted: opened again for ANOTHER project it takes the new GUID', () => {
    mockParams = { projectGUID: A };
    render();
    expect(guid()).toBe(A);
    mockParams = { projectGUID: B };
    render();
    expect(guid()).toBe(B);
  });

  it('without a route project the first example is the default', () => {
    render();
    expect(guid()).toBe(BIM_EXAMPLE1_PROJECT_GUID);
  });

  it('an example fills in its own GUID and name when the route project does not exist yet; an existing route project keeps its GUID', () => {
    mockParams = { projectGUID: A };
    render();
    act(() => q('bim-import-source-example2')!.click());
    expect(guid()).toBe(BIM_EXAMPLE2_PROJECT_GUID);
    expect(name()).toBe(BIM_EXAMPLE2_NAME);
    act(() => usePMStore.setState({ projectsById: { [B]: { rowGUID: B, rowJSON: { name: 'Mine' } } } } as any));
    mockParams = { projectGUID: B };
    render();
    expect(guid()).toBe(B);
    act(() => q('bim-import-source-example1')!.click());
    expect(guid()).toBe(B);
  });
});
