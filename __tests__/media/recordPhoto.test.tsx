/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, pressAsync, q, render, text } from './mediaUiTestKit';

const cam: any = { zooms: [] as number[], takes: [] as any[], flash: [] as string[] };
(globalThis as any).__cam = cam;
(globalThis as any).__camPerm = { hasPermission: true, requestPermission: jest.fn(async () => true) };
jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  const Camera = R.forwardRef((props: any, ref: any) => {
    const c = (globalThis as any).__cam;
    c.zooms.push(props.zoom);
    R.useImperativeHandle(ref, () => ({ takePhoto: async (o: any) => { c.takes.push(o); return { path: '/cache/shot.jpg', width: 4000, height: 3000 }; } }));
    return R.createElement('div', { 'data-testid': 'camera' });
  });
  return { Camera, useCameraDevice: () => ({ id: 'back', minZoom: 1, maxZoom: 10, neutralZoom: 1, hasFlash: true }), useCameraPermission: () => (globalThis as any).__camPerm };
});
const mockApply = jest.fn(async (uri: string, filterId: string) => ({ uri: filterId === 'original' ? uri : `${uri}#${filterId}`, width: 3000, height: 4000 }));
jest.mock('../../kit8/ui/components/media/photo/applyPhotoFilter', () => ({ applyPhotoFilter: (u: string, f: string) => mockApply(u, f) }));
const mockSavePhoto = jest.fn(async (photo: any, filter: any, zoom: number) => ({ rowGUID: 'r1', rowOwnerGUID: 'u', rowParentGUID: 'empty', orderInList: 1, rowJSON: { mediaPostTitle: 'Photo T', photoFilter: filter.id, mediaImageUri: photo.uri, photoZoomFactor: zoom } }));
jest.mock('../../kit8/ui/components/media/photo/useSavePhoto', () => ({ useSavePhoto: () => mockSavePhoto }));

import RecordPhoto from '../../kit8/ui/components/media/photo/RecordPhoto';

jest.setTimeout(30000);
afterEach(() => { cleanup(); Object.assign(cam, { zooms: [], takes: [], flash: [] }); jest.clearAllMocks(); });

it('shows the camera with zoom, black and white modes and colour looks', async () => {
  render(<RecordPhoto />);
  await flush();
  expect(q('camera')).not.toBeNull();
  expect(q('record-photo-zoom-preset-2')).not.toBeNull();
  for (const id of ['original', 'mono', 'noir', 'silver', 'vivid', 'warm', 'fade']) expect(q(`record-photo-filters-${id}`)).not.toBeNull();
  press('record-photo-zoom-preset-3');
  expect(cam.zooms.at(-1)).toBe(3);
});

it('Take photo -> review with the look chosen before the shot -> another look is made from the ORIGINAL -> Save keeps the shown file', async () => {
  render(<RecordPhoto />);
  await flush();
  press('record-photo-zoom-preset-2');
  press('record-photo-filters-noir');
  expect(text('record-photo-filter-note')).toContain('after the shot');
  await pressAsync('record-photo-shutter');
  expect(cam.takes).toHaveLength(1);
  await flush();
  // the file of the camera, as a file uri, through the look chosen before the shot
  expect(mockApply).toHaveBeenLastCalledWith('file:///cache/shot.jpg', 'noir');
  expect(q('photo-review')).not.toBeNull();
  await pressAsync('photo-filters-mono');
  await flush();
  expect(mockApply).toHaveBeenLastCalledWith('file:///cache/shot.jpg', 'mono'); // never a look on top of a look
  await pressAsync('photo-review-save');
  expect(mockSavePhoto).toHaveBeenCalledTimes(1);
  expect(mockSavePhoto.mock.calls[0][0]).toMatchObject({ uri: 'file:///cache/shot.jpg#mono' });
  expect(mockSavePhoto.mock.calls[0][1]).toMatchObject({ id: 'mono' });
  expect(mockSavePhoto.mock.calls[0][2]).toBe(2); // shot at 2×
  expect(q('photo-review-saved')).not.toBeNull();
  press('photo-review-again');
  expect(q('record-photo')).not.toBeNull();
});

it('Retake goes back to the camera without saving', async () => {
  render(<RecordPhoto />);
  await flush();
  await pressAsync('record-photo-shutter');
  await flush();
  press('photo-review-retake');
  expect(q('record-photo')).not.toBeNull();
  expect(mockSavePhoto).not.toHaveBeenCalled();
});

it('a look that fails is reported and the original is shown', async () => {
  mockApply.mockRejectedValueOnce(new Error('too big'));
  render(<RecordPhoto />);
  await flush();
  press('record-photo-filters-vivid');
  await pressAsync('record-photo-shutter');
  await flush();
  await flush();
  expect((globalThis as any).__showError).toHaveBeenCalled();
  expect(mockApply).toHaveBeenLastCalledWith('file:///cache/shot.jpg', 'original');
});
