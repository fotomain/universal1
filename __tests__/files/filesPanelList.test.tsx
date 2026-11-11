/** @jest-environment jsdom */
// The list of the Files panel (kit8/files): a ReusableTable in local rows mode with the action buttons in each row, and the search by file name above it.
import { act } from 'react';
import { mockFilesApi, mockPick, mockPush, mockShowError, PDF, PHOTO, LINK, fileRow, q, qa, press, settle, typeInto, tableGuids, resetFilesApi, mountPanel, unmountPanel } from './filesPanelTestKit';
import PMTaskFilesPanel from '../../kit8/files/common/PMTaskFilesPanel';

const T = 'tf';
const mount = (props: Record<string, any> = {}) => mountPanel(props, PMTaskFilesPanel);
const open = async (props: Record<string, any> = {}) => { mount(props); await settle(); await settle(); };

beforeEach(() => resetFilesApi());
afterEach(() => unmountPanel());

describe('the list is a ReusableTable', () => {
  it('shows one table row per file and link, with the kind icon, the name, the size and the details', async () => {
    await open();
    expect(q(`${T}-table`)).not.toBeNull();
    expect(tableGuids()).toEqual(['f1', 'f2', 'f3']);
    expect(q(`${T}-name-f1`)!.textContent).toBe('Plan of the Hall.pdf');
    expect(q(`${T}-kind-f1`)!.textContent).toBe('picture_as_pdf');
    expect(q(`${T}-kind-f2`)!.textContent).toBe('image');
    expect(q(`${T}-kind-f3`)!.textContent).toBe('link');
    expect(q(`${T}-size-f1`)!.textContent).toBe('2.0 MB');
    expect(q(`${T}-size-f2`)!.textContent).toBe('91 KB');
    expect(q(`${T}-size-f3`)!.textContent).toBe('');
    expect(q(`${T}-details-f1`)!.textContent).toBe('Paper: Cabinet 3');
    expect(q(`${T}-details-f2`)!.textContent).toBe('v2');
    // the footer of the table counts the files
    expect(q(`${T}-table-count`)!.textContent).toBe('3 files');
  });

  it('the header has Kind · Name · Size · Actions · Details', async () => {
    await open();
    const head = qa(`${T}-table-header-`).map((e) => e.getAttribute('data-testid'));
    expect(head).toEqual(expect.arrayContaining([`${T}-table-header-kind`, `${T}-table-header-name`, `${T}-table-header-size`, `${T}-table-header-actions`, `${T}-table-header-details`]));
  });

  it('the person who may change files gets every action; a link has no Replace; the history button only where there is a version 2', async () => {
    await open();
    for (const a of ['view', 'move', 'edit', 'delete']) for (const g of ['f1', 'f2', 'f3']) expect(q(`${T}-${a}-${g}`)).not.toBeNull();
    expect(q(`${T}-replace-f1`)).not.toBeNull();
    expect(q(`${T}-replace-f2`)).not.toBeNull();
    expect(q(`${T}-replace-f3`)).toBeNull();
    expect(q(`${T}-versions-button-f2`)).not.toBeNull();
    expect(q(`${T}-versions-button-f1`)).toBeNull();
  });

  it('a plain member sees the list and View only', async () => {
    resetFilesApi([PDF, PHOTO, LINK], { canChange: false });
    await open();
    expect(tableGuids()).toEqual(['f1', 'f2', 'f3']);
    expect(q(`${T}-view-f1`)).not.toBeNull();
    for (const a of ['replace', 'move', 'edit', 'delete']) expect(q(`${T}-${a}-f1`)).toBeNull();
    expect(q(`${T}-add`)).toBeNull();
  });

  it('the table only shows: no check boxes, no row menu, no add / delete buttons, no second search box', async () => {
    await open();
    expect(qa(`${T}-table-select-`)).toHaveLength(0);
    expect(qa(`${T}-table-menu-button-`)).toHaveLength(0);
    expect(q(`${T}-table-add`)).toBeNull();
    expect(q(`${T}-table-delete-selected`)).toBeNull();
    expect(q(`${T}-table-search`)).toBeNull();
    expect(qa(`${T}-table-drag-`)).toHaveLength(0);
  });

  it('every action still works from its row button', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    mockFilesApi.deleteFileRow.mockResolvedValue({ ok: true, data: { deleted: true } });
    mockFilesApi.updateFile.mockResolvedValue({ ok: true, data: {} });
    mockFilesApi.moveFile.mockResolvedValue({ ok: true, data: {} });
    mockFilesApi.replacePickedFile.mockResolvedValue({ ok: true, data: {} });
    mockPick.mockResolvedValue([{ name: 'new.pdf', size: 3, mimeType: 'application/pdf', uri: 'x' }]);
    await open();
    // open
    press(`${T}-view-f1`); await settle();
    expect(openSpy).toHaveBeenCalledWith('/files/view?post=f1', '_blank');
    press(`${T}-view-f3`); await settle();
    expect(openSpy).toHaveBeenLastCalledWith('https://youtu.be/x', '_blank', 'noopener');
    // replace
    press(`${T}-replace-f1`); await settle();
    expect(mockPick).toHaveBeenCalled();
    expect(mockFilesApi.replacePickedFile).toHaveBeenCalledTimes(1);
    expect(mockFilesApi.replacePickedFile.mock.calls[0][0].rowGUID).toBe('f1');
    // move
    press(`${T}-move-f2`); await settle();
    expect(q(`${T}-move-form`)).not.toBeNull();
    press(`${T}-move-organization`); await settle();
    expect(mockFilesApi.moveFile).toHaveBeenCalledWith('f2', { scope: 'organization' });
    // edit (the name of the row is in the form)
    press(`${T}-edit-f3`); await settle();
    expect(q(`${T}-edit-form`)).not.toBeNull();
    press(`${T}-edit-save`); await settle();
    expect(mockFilesApi.updateFile).toHaveBeenCalledWith('f3', expect.objectContaining({ mediaPostTitle: 'Site video' }));
    // delete asks first
    press(`${T}-delete-f1`); await settle();
    expect(mockFilesApi.deleteFileRow).not.toHaveBeenCalled();
    press(`${T}-delete-ask-yes`); await settle();
    expect(mockFilesApi.deleteFileRow).toHaveBeenCalledWith('f1');
    expect(mockShowError).not.toHaveBeenCalled();
    openSpy.mockRestore();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('the history button shows the older versions of THAT file under the table, and hides them again', async () => {
    await open();
    expect(q(`${T}-versions-panel`)).toBeNull();
    press(`${T}-versions-button-f2`); await settle();
    expect(q(`${T}-versions-panel`)!.textContent).toContain('photo_2026.jpg');
    expect(q(`${T}-versions-f2`)!.textContent).toContain('v1');
    expect(mockFilesApi.listVersions).toHaveBeenCalledWith('f2');
    press(`${T}-versions-button-f2`); await settle();
    expect(q(`${T}-versions-panel`)).toBeNull();
  });

  it('the document type chosen for a file is in its Details', async () => {
    mockFilesApi.listDocumentTypes.mockResolvedValue({ ok: true, data: [{ rowGUID: 'ty1', rowJSON: { title: 'Contract' } }] });
    resetFilesApiWithType();
    await open();
    expect(q(`${T}-details-f9`)!.textContent).toBe('Contract  ·  Paper: Safe  ·  v3');
  });
});

function resetFilesApiWithType() {
  mockFilesApi.listFiles.mockResolvedValue({ ok: true, data: [fileRow('f9', { mediaPostTitle: 'Deal', googleDriveFileId: 'D9', mediaPostOriginType: 'googleDrive', fileDocumentTypeGUID: 'ty1', paperDocumentPlace: 'Safe', fileVersionNumber: 3 })] });
}

describe('the search by file name', () => {
  it('a field above the table, only while the scope has files', async () => {
    resetFilesApi([]);
    await open();
    expect(q(`${T}-search`)).toBeNull();
    expect(q(`${T}-empty`)!.textContent).toBe('No files on this task.');
    unmountPanel();
    resetFilesApi();
    await open();
    expect(q(`${T}-search`)).not.toBeNull();
    expect((q(`${T}-search`) as HTMLInputElement).placeholder).toBe('Search files by name');
  });

  it('filters live while typing, case-insensitive, the files AND the links', async () => {
    await open();
    typeInto(`${T}-search`, 'PLAN');
    expect(tableGuids()).toEqual(['f1']);
    typeInto(`${T}-search`, 'photo');
    expect(tableGuids()).toEqual(['f2']);
    typeInto(`${T}-search`, 'Video');
    expect(tableGuids()).toEqual(['f3']); // a link
    typeInto(`${T}-search`, '');
    expect(tableGuids()).toEqual(['f1', 'f2', 'f3']);
  });

  it('the footer counts the rows that match, the other buttons of the row still act on the right file', async () => {
    mockFilesApi.deleteFileRow.mockResolvedValue({ ok: true, data: { deleted: true } });
    await open();
    typeInto(`${T}-search`, 'photo');
    expect(q(`${T}-table-count`)!.textContent).toBe('1 file');
    press(`${T}-delete-f2`); await settle();
    press(`${T}-delete-ask-yes`); await settle();
    expect(mockFilesApi.deleteFileRow).toHaveBeenCalledWith('f2');
  });

  it('no match: a clear text with the typed words, no table; clearing the field brings the list back', async () => {
    await open();
    typeInto(`${T}-search`, 'zzz');
    expect(tableGuids()).toEqual([]);
    expect(q(`${T}-table`)).toBeNull();
    expect(q(`${T}-no-match`)!.textContent).toBe('No files match "zzz".');
    expect(q(`${T}-empty`)).toBeNull();
    typeInto(`${T}-search`, '');
    expect(q(`${T}-no-match`)).toBeNull();
    expect(tableGuids()).toEqual(['f1', 'f2', 'f3']);
  });

  it('the search keeps working after the list is read again (a new file arrives while a word is typed)', async () => {
    await open();
    typeInto(`${T}-search`, 'plan');
    expect(tableGuids()).toEqual(['f1']);
    mockFilesApi.listFiles.mockResolvedValue({ ok: true, data: [PDF, PHOTO, LINK, fileRow('f4', { mediaPostTitle: 'Floor PLAN 2', googleDriveFileId: 'D4', mediaPostOriginType: 'googleDrive' }, 4)] });
    mockFilesApi.deleteFileRow.mockResolvedValue({ ok: true, data: { deleted: true } });
    press(`${T}-delete-f1`); await settle();
    press(`${T}-delete-ask-yes`); await settle(); await settle();
    expect(tableGuids()).toEqual(['f1', 'f4']);
  });
});

describe('the rest of the panel is unchanged', () => {
  it('Add file, Add link and the Drive state are there; Add file picks and uploads', async () => {
    mockFilesApi.uploadPickedFile.mockResolvedValue({ ok: true, data: {} });
    mockPick.mockResolvedValue([{ name: 'a.txt', size: 1, mimeType: 'text/plain', uri: 'x' }]);
    await open();
    expect(q(`${T}-state`)!.textContent).toBe('Google Drive: connected as drive@gmail.test');
    expect(q(`${T}-add-link`)).not.toBeNull();
    press(`${T}-add`); await settle();
    expect(mockFilesApi.uploadPickedFile).toHaveBeenCalledTimes(1);
  });

  it('Add link opens its form and saves through the function', async () => {
    mockFilesApi.addLink.mockResolvedValue({ ok: true, data: {} });
    await open();
    press(`${T}-add-link`);
    expect(q(`${T}-link-form`)).not.toBeNull();
    press(`${T}-link-save`); await settle();
    expect(mockFilesApi.addLink).toHaveBeenCalledTimes(1);
  });

  it('the scope of the panel: project and organization read their own list', async () => {
    await open({ scope: 'project' });
    expect(mockFilesApi.listFiles).toHaveBeenCalledWith({ scope: 'project', guid: 'p1', projectGUID: 'p1' });
    unmountPanel();
    resetFilesApi([PDF]);
    await open({ scope: 'organization' });
    expect(mockFilesApi.listFiles).toHaveBeenCalledWith({ scope: 'organization' });
    expect(tableGuids()).toEqual(['f1']);
    expect(q(`${T}-search`)).not.toBeNull();
  });

  it('empty texts per scope', async () => {
    resetFilesApi([]);
    await open({ scope: 'project' });
    expect(q(`${T}-empty`)!.textContent).toBe('No files on this project.');
  });

  it('the file drop on the panel (web) uploads the dropped files', async () => {
    mockFilesApi.uploadPickedFile.mockResolvedValue({ ok: true, data: {} });
    await open();
    const root = q(T)!;
    const file = { name: 'dropped.png', size: 5, type: 'image/png' };
    const ev: any = new Event('drop', { bubbles: true, cancelable: true });
    ev.dataTransfer = { files: [file] };
    await act(async () => { root.dispatchEvent(ev); await Promise.resolve(); });
    await settle();
    expect(mockFilesApi.uploadPickedFile).toHaveBeenCalledTimes(1);
    expect(mockFilesApi.uploadPickedFile.mock.calls[0][1]).toEqual(file);
  });
});
