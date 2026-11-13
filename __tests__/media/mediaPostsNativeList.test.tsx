/** @jest-environment jsdom */
// The Media Posts list of the phone: rows, Play opens the player with the stamp, Delete asks first
import React from 'react';
import { Alert } from 'react-native';
import { cleanup, flush, press, q, render, text } from './mediaUiTestKit';

const mockDispatch = jest.fn();
const mockRead = jest.fn((p: any) => ({ type: 'read', p }));
const mockDelete = jest.fn((p: any) => ({ type: 'delete', p }));
const recorded = '2026-11-13T08:33:44.002Z';
let mockState: any;
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch, useSelector: (fn: any) => fn(mockState) }));
jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { mediaPostReusable: { actions: { readData: (p: any) => mockRead(p), deleteOne: (p: any) => mockDelete(p), deleteOneSuccess: (p: any) => mockDeleteSuccess(p) } } } }));
const mockDeleteSuccess = jest.fn((p: any) => ({ type: 'deleteSuccess', p }));
const mockDeleteFileRow = jest.fn();
jest.mock('../../kit8/files/common/filesDriveApi', () => ({ deleteFileRow: (id: string) => mockDeleteFileRow(id) }));
const PROJ = '11111111-2222-3333-4444-555555555555';
jest.mock('../../kit8/ui/components/media/useMediaPostProjects', () => ({ useMediaPostProjects: () => ({ ['11111111-2222-3333-4444-555555555555']: { name: 'Railway #1', readonly: true } }) }));
const mockModal = jest.fn();
jest.mock('../../kit8/ui/components/media/MediaPlayerModal', () => {
  const R = require('react');
  return { __esModule: true, default: (props: any) => { mockModal(props); return R.createElement('div', { 'data-testid': 'player-modal' }, props.title); } };
});

import MediaPostsNativeList from '../../kit8/ui/components/media/MediaPostsNativeList';

beforeEach(() => {
  mockState = {
    activeUserState: { activeUserGUID: 'cut32', userGUID: 'full-user-guid' },
    mediaPostReusable: {
      entityDataFromServer: [
        { rowGUID: 'v1', orderInList: 20, rowJSON: { mediaPostTitle: 'My video', mediaKind: 'video', mediaDurationSec: 34, mediaRecordedAt: recorded, mediaPostOrigin: 'file:///a.mp4', mediaDateTimeOver: { position: 'topRight', burnedIn: false, parts: [{ startedAt: recorded }] } } },
        { rowGUID: 'f1', orderInList: 5, rowParentGUID: 'task-1', rowJSON: { mediaPostTitle: 'photo_1_y.jpg', mediaPostOriginType: 'file', fileSourceKind: 'task', fileSourceProjectGUID: '11111111-2222-3333-4444-555555555555' } },
        { rowGUID: 'l1', orderInList: 10, rowJSON: { mediaPostTitle: 'A web page', mediaPostOrigin: 'https://example.com' } },
      ],
    },
  };
});
afterEach(() => { cleanup(); jest.clearAllMocks(); jest.restoreAllMocks(); });

it('reads the posts of the FULL user guid and shows them newest first; a link post has no Play', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  expect(mockRead).toHaveBeenCalledWith(expect.objectContaining({ rowOwnerGUID: 'full-user-guid', rowParentGUID: 'empty' }));
  expect(text('media-post-title-v1')).toBe('My video');
  expect(q('media-post-play-v1')).not.toBeNull();
  expect(q('media-post-l1')).not.toBeNull();
  expect(q('media-post-play-l1')).toBeNull();
});

it('Play opens the player with the files and the date and time stamp', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-play-v1');
  expect(q('player-modal')).not.toBeNull();
  expect(mockModal.mock.calls.at(-1)![0]).toMatchObject({ kind: 'video', source: ['file:///a.mp4'], dateTimeOver: { position: 'topRight', burnedIn: false } });
});

it('Delete asks first and deletes only after the user confirms', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-delete-v1');
  expect(mockDelete).not.toHaveBeenCalled();
  const buttons: any[] = alert.mock.calls[0][2] as any[];
  buttons.find((b) => b.text === 'Delete').onPress();
  expect(mockDelete).toHaveBeenCalledWith({ rowGUID: 'v1', rowOwnerGUID: 'full-user-guid' });
});

it('no posts: says so', async () => {
  mockState.mediaPostReusable.entityDataFromServer = [];
  render(<MediaPostsNativeList />);
  await flush();
  expect(text('media-posts-empty')).toContain('No media posts yet');
});

async function confirmDelete(id: string) {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  render(<MediaPostsNativeList />);
  await flush();
  press(`media-post-delete-${id}`);
  (alert.mock.calls[0][2] as any[]).find((b) => b.text === 'Delete').onPress();
  await flush();
  return alert;
}

it('a FILE row goes through the files function (a plain DELETE would only hide the card); the card leaves after the OK', async () => {
  mockDeleteFileRow.mockResolvedValue({ ok: true, data: {} });
  await confirmDelete('f1');
  expect(mockDeleteFileRow).toHaveBeenCalledWith('f1');
  expect(mockDelete).not.toHaveBeenCalled();
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'deleteSuccess', p: { rowGUID: 'f1' } });
});

it('a refused file delete keeps the card and says why', async () => {
  mockDeleteFileRow.mockResolvedValue({ ok: false, error: 'You may not delete this file.' });
  const alert = await confirmDelete('f1');
  expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'deleteSuccess' }));
  expect(alert).toHaveBeenLastCalledWith('The file was not deleted', 'You may not delete this file.');
});

it('a post of a project shows the project name on its card; an independent post does not', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  expect(text('media-post-project-f1')).toBe('Project: Railway #1 (read-only)');
  expect(q('media-post-project-v1')).toBeNull();
});

it('a file delete stopped by a read-only project says whose project it is', async () => {
  mockDeleteFileRow.mockResolvedValue({ ok: false, error: 'No permission: files, delete (projectReadonly)', code: 'projectReadonly' });
  const alert = await confirmDelete('f1');
  expect(alert).toHaveBeenLastCalledWith('The file was not deleted', 'Delete process stopped! This media post belongs to the Project Railway #1 and Project is readonly now ');
});
