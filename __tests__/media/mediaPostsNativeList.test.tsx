/** @jest-environment jsdom */
// The Media Posts list of the phone = a ReusableList of mediaPostReusable posts with a card per post (the list itself is tested in __tests__/ui/list).
// Here: what MediaPostsNativeList hands to the list, the cards (default + sized), Play, the delete of a FILE row, the card size kept on the device.
import React, { act } from 'react';
import { Alert } from 'react-native';
import { cleanup, flush, press, q, render, text } from './mediaUiTestKit';

const mockDispatch = jest.fn();
const mockDelete = jest.fn((p: any) => ({ type: 'delete', p }));
const mockDeleteSuccess = jest.fn((p: any) => ({ type: 'deleteSuccess', p }));
const recorded = '2026-11-13T08:33:44.002Z';
let mockState: any;
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch, useSelector: (fn: any) => fn(mockState) }));
jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { mediaPostReusable: { actions: { deleteOne: (p: any) => mockDelete(p), deleteOneSuccess: (p: any) => mockDeleteSuccess(p) } } } }));
const mockDeleteFileRow = jest.fn();
const mockUploadPhoto = jest.fn();
jest.mock('../../kit8/files/common/identificationPhoto', () => ({ identificationPath: (f: string) => `identification/${f}`, uploadIdentificationPhotoWithRetry: (...a: any[]) => mockUploadPhoto(...a) }));
jest.mock('../../kit8/files/common/filesDriveApi', () => ({ deleteFileRow: (id: string) => mockDeleteFileRow(id) }));
jest.mock('../../kit8/ui/components/media/common/useMediaPostProjects', () => ({ useMediaPostProjects: () => ({ ['11111111-2222-3333-4444-555555555555']: { name: 'Railway #1', readonly: true } }) }));
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async (k: string) => mockStore[k] ?? null, setItem: async (k: string, v: string) => { mockStore[k] = v; } } }));
jest.mock('../../kit8/ui/components/list/cards/mediapost/PersonDocumentDetailsCard', () => { const R = require('react'); return { __esModule: true, default: ({ row, onClose }: any) => R.createElement('div', { 'data-testid': 'details', onClick: onClose }, row.rowGUID) }; });
jest.mock('../../kit8/ui/components/list/forms/CreateListElementForm', () => ({ __esModule: true, default: () => null }));
const mockModal = jest.fn();
jest.mock('../../kit8/ui/components/media/play/MediaPlayerModal', () => {
  const R = require('react');
  return { __esModule: true, default: (props: any) => { mockModal(props); return R.createElement('div', { 'data-testid': 'player-modal' }, props.title); } };
});
// the list: draws the cards of the rows (newest first, as orderDirection desc) and keeps its props; Delete of a card runs what the list runs
const mockList: { props: any } = { props: null };
const mockRemoved: string[][] = [];
jest.mock('../../kit8/ui/components/list/reusable/ReusableList', () => {
  const R = require('react');
  return { __esModule: true, default: (props: any) => {
    mockList.props = props;
    const rows = [...(mockState.mediaPostReusable.entityDataFromServer || [])].sort((a: any, b: any) => b.orderInList - a.orderInList);
    const remove = (id: string) => {
      const left = props.onDeleteRows([id], rows.filter((r: any) => r.rowGUID === id));
      if (left.length) mockRemoved.push(left);
    };
    const state = { index: 0, reorderable: false, dragging: false, grip: null, actions: { remove }, canEdit: true, canAdd: true, canDelete: true, canOpen: false };
    return R.createElement('div', { 'data-testid': props.testID },
      rows.length === 0 ? R.createElement('div', { 'data-testid': `${props.testID}-empty` }, props.emptyText) : rows.map((row: any) => R.createElement('div', { key: row.rowGUID }, props.renderItem(row, state))));
  } };
});

import MediaPostsNativeList from '../../kit8/ui/components/media/common/MediaPostsNativeList';

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  mockRemoved.length = 0;
  mockState = {
    activeUserState: { activeUserGUID: 'cut32', userGUID: 'full-user-guid' },
    mediaPostReusable: {
      entityDataFromServer: [
        { rowGUID: 'v1', orderInList: 20, rowJSON: { mediaPostTitle: 'My video', mediaKind: 'video', mediaDurationSec: 34, mediaRecordedAt: recorded, mediaPostOrigin: 'file:///a.mp4', mediaDateTimeOver: { position: 'topRight', burnedIn: false, parts: [{ startedAt: recorded }] } } },
        { rowGUID: 'f1', orderInList: 5, rowParentGUID: 'task-1', rowJSON: { mediaPostTitle: 'photo_1_y.jpg', mediaPostOriginType: 'file', fileSourceKind: 'task', fileSourceProjectGUID: '11111111-2222-3333-4444-555555555555' } },
        { rowGUID: 'id1', orderInList: 1, rowJSON: { mediaPostTitle: 'JURIJS', dataOriginName: 'idreader', idCardOwnerName: 'JURIJS' } },
        { rowGUID: 'l1', orderInList: 10, rowJSON: { mediaPostTitle: 'A web page', mediaPostOrigin: 'https://example.com' } },
      ],
    },
  };
});
afterEach(() => { cleanup(); jest.clearAllMocks(); jest.restoreAllMocks(); });

it('is a ReusableList of the posts of the FULL user guid, newest first, with the form of the Add button and a read on every focus', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  expect(mockList.props).toMatchObject({ entityName: 'mediaPostReusable', listOwnerGUID: 'full-user-guid', listParentGUID: 'empty', orderDirection: 'desc', refreshOnFocus: true, itemHeight: 96 });
  expect(mockList.props.selectionEnabled).not.toBe(false); // the ring button + the check boxes of the cards
  expect(typeof mockList.props.CreateElementForm).toBe('function');
  expect(mockList.props.visualColumns.map((c: any) => c.field)).toEqual(expect.arrayContaining(['mediaPostTitle', 'mediaPostDescription', 'dataOriginName']));
  expect(text('media-post-title-v1')).toBe('My video');
  expect(q('media-post-play-v1')).not.toBeNull();
  expect(q('media-post-l1')).not.toBeNull();
  expect(q('media-post-play-l1')).toBeNull();
});

it('a person document made with the Add form: its photo is uploaded to the file storage under the guid of the new post, and the result is said', async () => {
  mockUploadPhoto.mockResolvedValue({ ok: true });
  render(<MediaPostsNativeList />);
  await flush();
  await act(async () => { mockList.props.onElementCreated('new-guid', { mediaPostTitle: 'A' }, { idPhoto: { mime: 'image/jpeg', base64: 'SGVsbG8=', folder: 'passport' } }); });
  expect(mockUploadPhoto).toHaveBeenCalledTimes(1);
  const [guid, photo] = mockUploadPhoto.mock.calls[0];
  expect(guid).toBe('new-guid');
  expect(photo.mime).toBe('image/jpeg');
  expect(Buffer.from(photo.bytes).toString()).toBe('Hello');
  expect(mockDispatch).toHaveBeenCalledWith({ type: expect.stringContaining('showSnackbar'), payload: expect.objectContaining({ message: 'Owner photo saved to the file storage: identification/passport/new-guid' }) });
  mockUploadPhoto.mockClear();
  await act(async () => { mockList.props.onElementCreated('g2', {}, undefined); });
  expect(mockUploadPhoto).not.toHaveBeenCalled();
});

it('a photo that could not be uploaded is said, the post stays', async () => {
  mockUploadPhoto.mockResolvedValue({ ok: false, error: 'no permission' });
  render(<MediaPostsNativeList />);
  await flush();
  await act(async () => { mockList.props.onElementCreated('g3', {}, { idPhoto: { mime: 'image/jpeg', base64: 'SGVsbG8=', folder: 'idcard' } }); });
  expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ message: 'The owner photo was NOT saved to the file storage: no permission' }) }));
});

it('the default card has one size: no size button, a small item', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  expect(mockList.props.cardSize).toBeUndefined();
  expect(mockList.props.onCardSizeChange).toBeUndefined();
});

it('Play opens the player with the files and the date and time stamp', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-play-v1');
  expect(q('player-modal')).not.toBeNull();
  expect(mockModal.mock.calls.at(-1)![0]).toMatchObject({ kind: 'video', source: ['file:///a.mp4'], dateTimeOver: { position: 'topRight', burnedIn: false } });
});

it('no posts: says so', async () => {
  mockState.mediaPostReusable.entityDataFromServer = [];
  render(<MediaPostsNativeList />);
  await flush();
  expect(text('media-posts-empty')).toContain('No media posts yet');
});

it('an ordinary post is deleted by the list (nothing is taken by the host)', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-delete-v1');
  expect(mockDeleteFileRow).not.toHaveBeenCalled();
  expect(mockRemoved).toEqual([['v1']]);
});

it('a FILE row goes through the files function (a plain DELETE would only hide the card); the card leaves after the OK', async () => {
  mockDeleteFileRow.mockResolvedValue({ ok: true, data: {} });
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-delete-f1');
  await flush();
  expect(mockDeleteFileRow).toHaveBeenCalledWith('f1');
  expect(mockRemoved).toEqual([]);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'deleteSuccess', p: { rowGUID: 'f1' } });
});

it('a refused file delete keeps the card and says why', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockDeleteFileRow.mockResolvedValue({ ok: false, error: 'You may not delete this file.' });
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-delete-f1');
  await flush();
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
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockDeleteFileRow.mockResolvedValue({ ok: false, error: 'No permission: files, delete (projectReadonly)', code: 'projectReadonly' });
  render(<MediaPostsNativeList />);
  await flush();
  press('media-post-delete-f1');
  await flush();
  expect(alert).toHaveBeenLastCalledWith('The file was not deleted', 'Delete process stopped! This media post belongs to the Project Railway #1 and Project is readonly now ');
});

it('a double click on the card of an ID card opens its read only details; a click on the details closes them', async () => {
  render(<MediaPostsNativeList />);
  await flush();
  expect(q('details')).toBeNull();
  press('media-post-press-id1');
  press('media-post-press-id1');
  expect(q('details')!.textContent).toBe('id1');
  press('details');
  expect(q('details')).toBeNull();
});

describe('with a reusableCard that has sizes', () => {
  const Sized = ({ row, cardSize }: any) => <div data-testid={`sized-${row.rowGUID}`} data-size={cardSize} />;

  it('the list gets the card, the size button and an item as high as the size', async () => {
    render(<MediaPostsNativeList reusableCard={Sized} />);
    await flush();
    expect(q('sized-v1')!.getAttribute('data-size')).toBe('cardSmall');
    expect(mockList.props.cardSize).toBe('cardSmall');
    expect(mockList.props.itemHeight).toBe(96);
    act(() => mockList.props.onCardSizeChange('cardMedium'));
    await flush();
    expect(q('sized-v1')!.getAttribute('data-size')).toBe('cardMedium');
    expect(mockList.props.itemHeight).toBe(192);
    act(() => mockList.props.onCardSizeChange('cardBig'));
    await flush();
    expect(mockList.props.itemHeight).toBe(400);
  });

  it('the size the user picked is kept on the device and comes back', async () => {
    render(<MediaPostsNativeList reusableCard={Sized} />);
    await flush();
    act(() => mockList.props.onCardSizeChange('cardBig'));
    await flush();
    expect(mockStore.mediaPostsCardSize).toBe('cardBig');
    cleanup();
    render(<MediaPostsNativeList reusableCard={Sized} />);
    await flush();
    await flush();
    expect(q('sized-v1')!.getAttribute('data-size')).toBe('cardBig');
  });

  it('a stored value that is no size is ignored', async () => {
    mockStore.mediaPostsCardSize = 'enormous';
    render(<MediaPostsNativeList reusableCard={Sized} />);
    await flush();
    await flush();
    expect(q('sized-v1')!.getAttribute('data-size')).toBe('cardSmall');
  });
});
