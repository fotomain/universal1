/** @jest-environment jsdom */
// OD5 (documentation/FILE_WITH_OneDrive_WBS.html): the storage of the files in the app - the radio set projectFilesStorageProvider, the connection block of the chosen storage, the question
// when a project with files changes its storage, the Files panel of a OneDrive project (state, Connect, a tag per file while two storages are mixed), and the model helpers.
import React, { act } from 'react';
import { mockFilesApi, mockShowError, PDF, fileRow, q, press, settle, resetFilesApi, mountPanel, unmountPanel } from './filesPanelTestKit';
jest.mock('../../kit8/ui/components/common/SwitchApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onValueChange, label }: any) => R.createElement(Pressable, { testID, onPress: () => onValueChange(!value) }, R.createElement(Text, null, `${label}: ${value ? 'on' : 'off'}`)) };
});
import PMTaskFilesPanel from '../../kit8/files/PMTaskFilesPanel';
import FilesStorageProviderRadio from '../../kit8/files/FilesStorageProviderRadio';
import FilesDriveBlock, { daysUntil } from '../../kit8/files/FilesDriveBlock';
import PMProjectFilesTab, { filesValuesOf } from '../../kit8/pm/view/project/settings/PMProjectFilesTab';
import { driveStateText, fileProviderOfRow, filesErrorText, filesProviderOfProject, providerTitleOf } from '../../kit8/files/fileModel';

const { createRoot } = require('react-dom/client');
let root: any;
const render = (el: React.ReactElement) => { const d = document.createElement('div'); document.body.appendChild(d); root = createRoot(d); act(() => root.render(el)); };
const status = (provider: string, over: any = {}) => ({ ok: true, data: { provider, providerConfigured: true, state: 'notConnected', accountEmail: null, lastRefreshAt: null, rootFolderUrl: null, secretExpires: null, cleanup: { waiting: 0, failed: 0 }, ...over } });

beforeEach(() => resetFilesApi());
afterEach(() => { unmountPanel(); if (root) act(() => root.unmount()); root = null; document.body.innerHTML = ''; });

describe('the model', () => {
  it('anything but oneDrive is Google Drive (a project / a row made before OneDrive has no value)', () => {
    expect(filesProviderOfProject(undefined)).toBe('googleDrive');
    expect(filesProviderOfProject({})).toBe('googleDrive');
    expect(filesProviderOfProject({ projectFilesStorageProvider: 'nonsense' })).toBe('googleDrive');
    expect(filesProviderOfProject({ projectFilesStorageProvider: 'oneDrive' })).toBe('oneDrive');
    expect(fileProviderOfRow({ rowJSON: {} })).toBe('googleDrive');
    expect(fileProviderOfRow({ rowJSON: { fileStorageProvider: 'oneDrive' } })).toBe('oneDrive');
    expect(providerTitleOf('oneDrive')).toBe('Microsoft OneDrive');
    expect(providerTitleOf(undefined)).toBe('Google Drive');
  });
  it('the settings values: the switch is true and the storage googleDrive while never saved', () => {
    expect(filesValuesOf(null)).toEqual({ filesFunctionalityEnabled: true, projectFilesStorageProvider: 'googleDrive' });
    expect(filesValuesOf({ filesFunctionalityEnabled: false, projectFilesStorageProvider: 'oneDrive' })).toEqual({ filesFunctionalityEnabled: false, projectFilesStorageProvider: 'oneDrive' });
  });
  it('the words of the state carry the storage name; the function\'s own Microsoft sentence is kept', () => {
    expect(driveStateText('ok', 'a@b.test')).toBe('Google Drive: connected as a@b.test');
    expect(driveStateText('ok', 'a@b.test', 'oneDrive')).toBe('Microsoft OneDrive: connected as a@b.test');
    expect(driveStateText('needsReconnect', null, 'oneDrive')).toBe('Microsoft OneDrive is disconnected - reconnect');
    expect(driveStateText('notConnected', null, 'oneDrive')).toBe('Microsoft OneDrive is not connected');
    expect(filesErrorText('notConnected', 'Microsoft OneDrive is not connected.')).toBe('Microsoft OneDrive is not connected.');
    expect(filesErrorText('notConnected', 'x')).toBe('Google Drive is not connected - ask the administrator.');
  });
  it('days until the expiry of the Microsoft client secret', () => {
    const today = new Date(Date.UTC(2028, 9, 11));
    expect(daysUntil('2028-11-10', today)).toBe(30);
    expect(daysUntil('2028-10-10', today)).toBe(-1);
    expect(daysUntil('', today)).toBeNaN();
    expect(daysUntil('10/11/2028', today)).toBeNaN();
  });
});

describe('the radio set', () => {
  it('has the two storages in order, marks the chosen one and reports a choice', () => {
    const onChange = jest.fn();
    render(<FilesStorageProviderRadio value="googleDrive" onChange={onChange} />);
    expect(q('files-storage-provider-googleDrive')!.textContent).toContain('1. Google Drive');
    expect(q('files-storage-provider-oneDrive')!.textContent).toContain('2. Microsoft OneDrive');
    expect(q('files-storage-provider-googleDrive')!.getAttribute('aria-checked')).toBe('true');
    expect(q('files-storage-provider-oneDrive')!.getAttribute('aria-checked')).toBe('false');
    press('files-storage-provider-oneDrive');
    expect(onChange).toHaveBeenCalledWith('oneDrive');
  });
  it('disabled: no choice is possible and the stored value stays shown; a storage that is not configured is disabled with its hint (unless it is the stored one)', () => {
    const onChange = jest.fn();
    render(<FilesStorageProviderRadio value="oneDrive" onChange={onChange} disabled />);
    press('files-storage-provider-googleDrive');
    expect(onChange).not.toHaveBeenCalled();
    expect(q('files-storage-provider-oneDrive')!.getAttribute('aria-checked')).toBe('true');
    act(() => root.unmount()); document.body.innerHTML = '';
    render(<FilesStorageProviderRadio value="googleDrive" onChange={onChange} notConfigured={['oneDrive']} />);
    expect(q('files-storage-provider-oneDrive-hint')!.textContent).toBe('not configured on this server');
    press('files-storage-provider-oneDrive');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Project settings -> Files', () => {
  const mount = (props: Record<string, any> = {}) => render(<PMProjectFilesTab values={{}} onChange={jest.fn()} {...props} />);
  it('shows the radio under the switch with Google Drive chosen for a project saved before OneDrive; the block is the chosen storage\'s', async () => {
    mockFilesApi.fetchDriveStatus.mockImplementation(async (p?: string) => status(p || 'googleDrive', p === 'oneDrive' ? {} : { state: 'ok', accountEmail: 'drive@gmail.test' }));
    mount();
    await settle(); await settle();
    expect(q('files-storage-provider-googleDrive')!.getAttribute('aria-checked')).toBe('true');
    expect(q('files-drive-block-state')!.textContent).toBe('Google Drive: connected as drive@gmail.test');
    expect(q('pm-project-files-other-state')!.textContent).toBe('Microsoft OneDrive is not connected');
  });
  it('the radio is disabled while filesFunctionalityEnabled is off and enabled when it is on', async () => {
    const onChange = jest.fn();
    mount({ values: { filesFunctionalityEnabled: false }, onChange });
    await settle();
    press('files-storage-provider-oneDrive');
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    act(() => root.unmount()); document.body.innerHTML = '';
    mount({ values: { filesFunctionalityEnabled: true }, onChange });
    await settle();
    press('files-storage-provider-oneDrive');
    await settle();
    expect(onChange).toHaveBeenCalledWith({ projectFilesStorageProvider: 'oneDrive' });
  });
  it('a project with NO files changes its storage at once (organization defaults too: no project); the block follows the choice and asks the OneDrive status', async () => {
    mockFilesApi.fetchDriveStatus.mockImplementation(async (p?: string) => status(p || 'googleDrive', p === 'oneDrive' ? { state: 'ok', accountEmail: 'owner@outlook.test' } : {}));
    const onChange = jest.fn();
    mount({ values: { projectFilesStorageProvider: 'oneDrive' }, onChange, projectGUID: 'p1' });
    await settle(); await settle();
    expect(q('files-drive-block-state')!.textContent).toBe('Microsoft OneDrive: connected as owner@outlook.test');
    expect(mockFilesApi.fetchDriveStatus).toHaveBeenCalledWith('oneDrive');
    expect(q('files-drive-block-permission-note')!.textContent).toContain('kit8root');
    press('files-storage-provider-googleDrive');
    await settle();
    expect(mockFilesApi.countFilesForDelete).toHaveBeenCalledWith('project', 'p1');
    expect(onChange).toHaveBeenCalledWith({ projectFilesStorageProvider: 'googleDrive' });
  });
  it('a project WITH files asks first: "N files stay in X. New files will be stored in Y." - Cancel keeps the storage, Change takes it', async () => {
    mockFilesApi.countFilesForDelete.mockResolvedValue({ ok: true, data: 4 });
    const onChange = jest.fn();
    mount({ onChange, projectGUID: 'p1' });
    await settle();
    press('files-storage-provider-oneDrive');
    await settle(); await settle();
    expect(q('pm-project-files-provider-ask')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    press('pm-project-files-provider-ask-no');
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    press('files-storage-provider-oneDrive');
    await settle(); await settle();
    press('pm-project-files-provider-ask-yes');
    await settle();
    expect(onChange).toHaveBeenCalledWith({ projectFilesStorageProvider: 'oneDrive' });
  });
  it('a storage that is not configured on the server is disabled with its hint', async () => {
    mockFilesApi.fetchAllDriveStatus.mockResolvedValue({ ok: true, data: { googleDrive: status('googleDrive').data, oneDrive: status('oneDrive', { providerConfigured: false }).data } });
    mount();
    await settle(); await settle();
    expect(q('files-storage-provider-oneDrive-hint')).not.toBeNull();
  });
});

describe('the connection block', () => {
  it('OneDrive: not configured = the words and no usable Connect; the administrator sees Connect Microsoft OneDrive; the Connect asks for the oneDrive storage', async () => {
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { providerConfigured: false }));
    render(<FilesDriveBlock provider="oneDrive" />);
    await settle(); await settle();
    expect(q('files-drive-block-not-configured')!.textContent).toBe('Microsoft OneDrive is not configured on this server.');
    expect(q('files-drive-block-connect')!.textContent).toBe('Connect Microsoft OneDrive');
    act(() => root.unmount()); document.body.innerHTML = '';
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive'));
    mockFilesApi.startDriveConnect.mockResolvedValue({ ok: true, data: { url: 'https://login.microsoftonline.com/x' } });
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(<FilesDriveBlock provider="oneDrive" />);
    await settle(); await settle();
    press('files-drive-block-connect');
    await settle();
    expect(mockFilesApi.startDriveConnect).toHaveBeenCalledWith('oneDrive');
    expect(openSpy).toHaveBeenCalledWith('https://login.microsoftonline.com/x', '_blank', 'noopener');
    openSpy.mockRestore();
  });
  it('the Microsoft secret: a warning for the administrator within 30 days and after the date; none far away; Google never shows it', async () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok', secretExpires: soon }));
    render(<FilesDriveBlock provider="oneDrive" />);
    await settle(); await settle();
    expect(q('files-drive-block-secret-expiry')!.textContent).toMatch(/expires in (9|10|11) days/);
    act(() => root.unmount()); document.body.innerHTML = '';
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok', secretExpires: '2020-01-01' }));
    render(<FilesDriveBlock provider="oneDrive" />);
    await settle(); await settle();
    expect(q('files-drive-block-secret-expiry')!.textContent).toContain('expired on 2020-01-01');
    act(() => root.unmount()); document.body.innerHTML = '';
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok', secretExpires: '2099-01-01' }));
    render(<FilesDriveBlock provider="oneDrive" />);
    await settle(); await settle();
    expect(q('files-drive-block-secret-expiry')).toBeNull();
  });
  it('Check files and Disconnect ask for the storage of the block', async () => {
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok' }));
    mockFilesApi.runHealthCheck.mockResolvedValue({ ok: true, data: { checkedFolders: 3, missing: [], orphans: [], unreadableFolders: [] } });
    mockFilesApi.disconnectDrive.mockResolvedValue({ ok: true, data: { disconnected: true } });
    render(<FilesDriveBlock provider="oneDrive" />);
    await settle(); await settle();
    press('files-drive-block-health');
    await settle();
    expect(mockFilesApi.runHealthCheck).toHaveBeenCalledWith('oneDrive');
    expect(q('files-drive-block-health-result')!.textContent).toContain('Folders checked: 3');
    press('files-drive-block-disconnect');
    await settle();
    press('files-drive-block-disconnect-ask-yes');
    await settle();
    expect(mockFilesApi.disconnectDrive).toHaveBeenCalledWith('oneDrive');
  });
});

describe('the Files panel of a OneDrive project', () => {
  const T = 'tf';
  it('reads the OneDrive status, says it in words, and offers Connect Microsoft OneDrive when it is not connected', async () => {
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive'));
    mockFilesApi.startDriveConnect.mockResolvedValue({ ok: true, data: { url: 'https://login.microsoftonline.com/x' } });
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    mountPanel({ provider: 'oneDrive' }, PMTaskFilesPanel);
    await settle(); await settle();
    expect(mockFilesApi.fetchDriveStatus).toHaveBeenCalledWith('oneDrive');
    expect(q(`${T}-state`)!.textContent).toBe('Microsoft OneDrive is not connected');
    expect(q(`${T}-connect`)!.textContent).toBe('Connect Microsoft OneDrive');
    expect(q(`${T}-add`)).toBeNull();
    press(`${T}-connect`);
    await settle();
    expect(mockFilesApi.startDriveConnect).toHaveBeenCalledWith('oneDrive');
    openSpy.mockRestore();
  });
  it('Google stays the default: the status is asked with no provider and the words are Google\'s', async () => {
    mountPanel({}, PMTaskFilesPanel);
    await settle(); await settle();
    expect(mockFilesApi.fetchDriveStatus).toHaveBeenCalledWith(undefined);
    expect(q(`${T}-state`)!.textContent).toBe('Google Drive: connected as drive@gmail.test');
  });
  it('a file of the OTHER storage is tagged in its Details while the list is mixed; a list of one storage has no tag', async () => {
    const od = fileRow('f9', { mediaPostTitle: 'new.pdf', fileName: 'new.pdf', fileSizeBytes: 10, fileKind: 'pdf', fileStorageProvider: 'oneDrive', oneDriveItemId: 'I1' }, 9);
    resetFilesApi([PDF, od]);
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok', accountEmail: 'owner@outlook.test' }));
    mountPanel({ provider: 'oneDrive' }, PMTaskFilesPanel);
    await settle(); await settle();
    expect(q(`${T}-details-f1`)!.textContent).toContain('Google Drive');
    expect(q(`${T}-details-f9`)!.textContent).not.toContain('Microsoft OneDrive');
    unmountPanel();
    resetFilesApi([od]);
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok' }));
    mountPanel({ provider: 'oneDrive' }, PMTaskFilesPanel);
    await settle(); await settle();
    expect(q(`${T}-details-f9`)!.textContent).toBe('');
  });
  it('Delete says which storage the file is deleted from', async () => {
    const od = fileRow('f9', { mediaPostTitle: 'new.pdf', fileName: 'new.pdf', fileSizeBytes: 10, fileKind: 'pdf', fileStorageProvider: 'oneDrive' }, 9);
    resetFilesApi([od]);
    mockFilesApi.fetchDriveStatus.mockResolvedValue(status('oneDrive', { state: 'ok' }));
    mountPanel({ provider: 'oneDrive' }, PMTaskFilesPanel);
    await settle(); await settle();
    press(`${T}-delete-f9`);
    await settle();
    expect(q(`${T}-delete-ask`)).not.toBeNull();
  });
});
