/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, render } from './mediaUiTestKit';

const mockDispatch = jest.fn();
const mockCreateOne = jest.fn((payload: any) => ({ type: 'mediaPostReusable/createOne', payload }));
let mockActions: any = { createOne: mockCreateOne };
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (fn: any) => fn({ activeUserState: { activeUserGUID: 'user-42' } }),
}));
jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { get mediaPostReusable() { return { actions: mockActions }; } } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));
const mockPersist = jest.fn(async (uri: string, kind: string) => `kept-${kind}:${uri}`);
jest.mock('../../kit8/ui/components/media/mediaFileStore', () => ({ persistRecording: (u: string, k: string) => mockPersist(u, k) }));

import { useSaveRecording } from '../../kit8/ui/components/media/useSaveRecording';

let save: (segments: any[], title?: string) => Promise<any>;
function Probe({ kind }: { kind: 'audio' | 'video' }) {
  save = useSaveRecording(kind);
  return null;
}
afterEach(() => { cleanup(); jest.clearAllMocks(); mockActions = { createOne: mockCreateOne }; });

it('keeps every file, builds the post of the active user and creates it through the saga action', async () => {
  render(<Probe kind="video" />);
  let post: any;
  await act(async () => {
    post = await save([
      { uri: 'file:///cache/1.mp4', durationSec: 2, hasAudio: true },
      { uri: 'file:///cache/2.mp4', durationSec: 3, hasAudio: false },
    ], 'Trip');
  });
  expect(mockPersist).toHaveBeenNthCalledWith(1, 'file:///cache/1.mp4', 'video');
  expect(mockPersist).toHaveBeenNthCalledWith(2, 'file:///cache/2.mp4', 'video');
  expect(post).toMatchObject({ rowGUID: 'uuid-1', rowOwnerGUID: 'user-42', rowParentGUID: 'empty' });
  expect(post.rowJSON).toMatchObject({ mediaPostTitle: 'Trip', mediaPostOrigin: 'kept-video:file:///cache/1.mp4', mediaDurationSec: 5, mediaKind: 'video' });
  expect(post.rowJSON.mediaSegments.map((s: any) => s.uri)).toEqual(['kept-video:file:///cache/1.mp4', 'kept-video:file:///cache/2.mp4']);
  expect(mockCreateOne).toHaveBeenCalledWith(post);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'mediaPostReusable/createOne', payload: post });
});

it('fails clearly (and keeps nothing as a post) when the post list is not ready', async () => {
  mockActions = undefined;
  render(<Probe kind="audio" />);
  await expect(save([{ uri: 'file:///a.m4a', durationSec: 1, hasAudio: true }])).rejects.toThrow('not ready');
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(mockPersist).not.toHaveBeenCalled();
});

it('a file that cannot be kept stops everything: no post', async () => {
  mockPersist.mockRejectedValueOnce(new Error('no space left'));
  render(<Probe kind="audio" />);
  await expect(save([{ uri: 'file:///a.m4a', durationSec: 1, hasAudio: true }])).rejects.toThrow('no space left');
  expect(mockDispatch).not.toHaveBeenCalled();
});
