// Test kit of the Files panel (kit8/files/PMTaskFilesPanel + FilesTable): the mocks the ReusableTable (local rows mode) and the panel need, the sample rows and a few helpers.
// Import it BEFORE the panel (the jest.mock calls below apply to every module required after it, as in __tests__/pm/ui/pmUiTestKit.tsx); the test file itself carries `@jest-environment jsdom`.
import React, { act } from 'react';

export const mockFilesApi: Record<string, jest.Mock> = {
  listFiles: jest.fn(), authorizeFiles: jest.fn(), fetchDriveStatus: jest.fn(), fetchDownloadUrl: jest.fn(), startDriveConnect: jest.fn(), deleteFileRow: jest.fn(), updateFile: jest.fn(),
  addLink: jest.fn(), moveFile: jest.fn(), listDocumentTypes: jest.fn(), listVersions: jest.fn(), uploadPickedFile: jest.fn(), replacePickedFile: jest.fn(),
  fetchAllDriveStatus: jest.fn(), countFilesForDelete: jest.fn(), disconnectDrive: jest.fn(), fetchStorageUsed: jest.fn(), runHealthCheck: jest.fn(), repairHealth: jest.fn(),
};
export const mockPick = jest.fn();
export const mockPush = jest.fn();
export const mockShowError = jest.fn();

jest.mock('../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: (...a: any[]) => mockPush(...a) }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: jest.fn(), createOne: jest.fn(), updateOne: jest.fn(), deleteOne: jest.fn() } }) }) }));
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn({ uxuiState: { askBeforeDeletePost: false } }), useDispatch: () => jest.fn() }));
jest.mock('../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
jest.mock('../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
// the search field: a plain input that keeps `value` / `placeholder` (the real one adds the clear x of TextInputApp, tested with the design system)
jest.mock('../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, hideClearIcon, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../kit8/ui/components/common/ErrorModalWindow', () => ({ showErrorModal: (...a: any[]) => mockShowError(...a) }));
jest.mock('../../kit8/ui/components/common/ModalAskComponent', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { ModalAskComponent: ({ visible, onConfirm, onCancel, testID }: any) => (visible ? R.createElement(View, { testID }, R.createElement(Pressable, { testID: `${testID}-yes`, onPress: onConfirm }, R.createElement(Text, null, 'Delete')), R.createElement(Pressable, { testID: `${testID}-no`, onPress: onCancel }, R.createElement(Text, null, 'Cancel'))) : null) };
});
jest.mock('../../kit8/files/common/pickFiles', () => ({ pickFiles: (...a: any[]) => mockPick(...a), fromWebFile: (f: any) => f }));
jest.mock('../../kit8/files/common/filesDriveApi', () => ({
  ...jest.requireActual('../../kit8/files/common/filesDriveApi'),
  listFiles: (...a: any[]) => mockFilesApi.listFiles(...a),
  authorizeFiles: (...a: any[]) => mockFilesApi.authorizeFiles(...a),
  fetchDriveStatus: (...a: any[]) => mockFilesApi.fetchDriveStatus(...a),
  fetchDownloadUrl: (...a: any[]) => mockFilesApi.fetchDownloadUrl(...a),
  startDriveConnect: (...a: any[]) => mockFilesApi.startDriveConnect(...a),
  deleteFileRow: (...a: any[]) => mockFilesApi.deleteFileRow(...a),
  updateFile: (...a: any[]) => mockFilesApi.updateFile(...a),
  addLink: (...a: any[]) => mockFilesApi.addLink(...a),
  moveFile: (...a: any[]) => mockFilesApi.moveFile(...a),
  listDocumentTypes: (...a: any[]) => mockFilesApi.listDocumentTypes(...a),
  listVersions: (...a: any[]) => mockFilesApi.listVersions(...a),
  uploadPickedFile: (...a: any[]) => mockFilesApi.uploadPickedFile(...a),
  replacePickedFile: (...a: any[]) => mockFilesApi.replacePickedFile(...a),
  fetchAllDriveStatus: (...a: any[]) => mockFilesApi.fetchAllDriveStatus(...a),
  countFilesForDelete: (...a: any[]) => mockFilesApi.countFilesForDelete(...a),
  disconnectDrive: (...a: any[]) => mockFilesApi.disconnectDrive(...a),
  fetchStorageUsed: (...a: any[]) => mockFilesApi.fetchStorageUsed(...a),
  runHealthCheck: (...a: any[]) => mockFilesApi.runHealthCheck(...a),
  repairHealth: (...a: any[]) => mockFilesApi.repairHealth(...a),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

export const fileRow = (guid: string, json: any, order = 1) => ({ rowGUID: guid, rowOwnerGUID: 'org1', rowParentGUID: 't1', orderInList: order, rowJSON: { fileSourceKind: 'task', fileSourceProjectGUID: 'p1', ...json } });
export const PDF = fileRow('f1', { mediaPostTitle: 'Plan of the Hall.pdf', fileName: 'Plan.pdf', fileSizeBytes: 2 * 1048576, fileKind: 'pdf', googleDriveFileId: 'D1', mediaPostOriginType: 'googleDrive', paperDocumentPlace: 'Cabinet 3' });
export const PHOTO = fileRow('f2', { mediaPostTitle: 'photo_2026.jpg', fileName: 'photo_2026.jpg', fileSizeBytes: 93000, fileKind: 'image', googleDriveFileId: 'D2', mediaPostOriginType: 'googleDrive', fileVersionNumber: 2 }, 2);
export const LINK = fileRow('f3', { mediaPostTitle: 'Site video', mediaPostOriginType: 'url', mediaPostOrigin: 'https://youtu.be/x', fileKind: 'other' }, 3);

export const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
export const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`)) as HTMLElement[];
export const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
export const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
/** type into the search input (React listens to the native `input` event of the value setter) */
export const typeInto = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement;
  if (!el) throw new Error(`${id} not found`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

let root: any;
/** the ids of the file rows now in the table, in order */
export const tableGuids = (T = 'tf') => qa(`${T}-table-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${T}-table-row-`, ''));

export function resetFilesApi(files: any[] = [PDF, PHOTO, LINK], opts: { canChange?: boolean; driveState?: string } = {}) {
  Object.values(mockFilesApi).forEach((m) => m.mockReset());
  mockPick.mockReset(); mockPush.mockReset(); mockShowError.mockReset();
  mockFilesApi.listFiles.mockResolvedValue({ ok: true, data: files });
  mockFilesApi.authorizeFiles.mockResolvedValue({ ok: true, data: { allowed: opts.canChange !== false } });
  mockFilesApi.fetchDriveStatus.mockResolvedValue({ ok: true, data: { state: opts.driveState || 'ok', accountEmail: 'drive@gmail.test', lastRefreshAt: null, rootFolderUrl: null, cleanup: { waiting: 0, failed: 0 } } });
  mockFilesApi.listDocumentTypes.mockResolvedValue({ ok: true, data: [] });
  const st = (provider: string, over: any = {}) => ({ provider, providerConfigured: true, state: 'notConnected', accountEmail: null, lastRefreshAt: null, rootFolderUrl: null, secretExpires: null, cleanup: { waiting: 0, failed: 0 }, ...over });
  mockFilesApi.fetchAllDriveStatus.mockResolvedValue({ ok: true, data: { googleDrive: st('googleDrive', { state: 'ok', accountEmail: 'drive@gmail.test' }), oneDrive: st('oneDrive') } });
  mockFilesApi.countFilesForDelete.mockResolvedValue({ ok: true, data: 0 });
  mockFilesApi.fetchStorageUsed.mockResolvedValue({ ok: false, error: 'none' });
  mockFilesApi.listVersions.mockResolvedValue({ ok: true, data: [{ rowGUID: 'v1', rowJSON: { version: 1, fileSizeBytes: 1024, replacedAt: '2026-11-01T10:00:00Z' } }] });
}

export function mountPanel(props: Record<string, any> = {}, Panel: any) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<Panel projectGUID="p1" taskGUID="t1" testID="tf" {...props} />));
}
export function unmountPanel() {
  if (root) act(() => root.unmount());
  root = null;
  document.body.innerHTML = '';
}
