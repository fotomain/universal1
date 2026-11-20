// The flashlight of the camera screens (kit8/ui/components/media/common/cameraTorch.ts): pure rules
import { applyWebTorch, nativeTorchProp, torchIcon, torchLabel, webHasTorch } from '../../kit8/ui/components/media/common/cameraTorch';

it('native: the torch is on only when it is wanted AND the camera has one (the front camera has none)', () => {
  expect(nativeTorchProp(true, true)).toBe('on');
  expect(nativeTorchProp(true, false)).toBe('off');
  expect(nativeTorchProp(true, undefined)).toBe('off');
  expect(nativeTorchProp(false, true)).toBe('off');
});

it('icon and label follow the state', () => {
  expect(torchIcon(true)).toBe('flashlight');
  expect(torchIcon(false)).toBe('flashlight-off');
  expect(torchLabel(true)).toBe('Flashlight on');
  expect(torchLabel(false)).toBe('Flashlight off');
});

it('web: a track has a torch only when its capabilities say so; a throwing track has none', () => {
  expect(webHasTorch({ getCapabilities: () => ({ torch: true }) })).toBe(true);
  expect(webHasTorch({ getCapabilities: () => ({ zoom: { min: 1, max: 4 } }) })).toBe(false);
  expect(webHasTorch({})).toBe(false);
  expect(webHasTorch(null)).toBe(false);
  expect(webHasTorch({ getCapabilities: () => { throw new Error('x'); } })).toBe(false);
});

it('web: applyWebTorch sends the constraint, answers false for no torch or a refusal', async () => {
  const applyConstraints = jest.fn(async () => undefined);
  expect(await applyWebTorch({ getCapabilities: () => ({ torch: true }), applyConstraints }, true)).toBe(true);
  expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
  expect(await applyWebTorch({ getCapabilities: () => ({}), applyConstraints }, true)).toBe(false);
  expect(await applyWebTorch({ getCapabilities: () => ({ torch: true }), applyConstraints: async () => { throw new Error('denied'); } }, true)).toBe(false);
  expect(await applyWebTorch(undefined, false)).toBe(false);
});
