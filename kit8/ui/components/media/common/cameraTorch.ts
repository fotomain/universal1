// The flashlight (torch) of the camera screens (video, photo). Pure: no React, no native module.
// A torch is a PERMANENT light (on while the camera is open and while a video is recorded); the flash of a photo fires once at the shutter.
// The choice is the persisted setting `recordTorchEnabled` (kit8/redux/recordVideoSettings.ts), shared by the video and the photo screen.

/** Vision Camera `torch` prop: on only when the user wants it AND the camera has a torch (the front camera has none) */
export const nativeTorchProp = (wanted: boolean, hasTorch: boolean | undefined | null): 'on' | 'off' => (wanted && hasTorch ? 'on' : 'off');

/** the icon / label of the torch button */
export const torchIcon = (on: boolean) => (on ? 'flashlight' : 'flashlight-off');
export const torchLabel = (on: boolean) => (on ? 'Flashlight on' : 'Flashlight off');

/** a browser video track that may have a torch (Chrome on Android: `getCapabilities().torch`; desktop browsers have none) */
export interface TorchTrack {
  getCapabilities?: () => any;
  applyConstraints?: (constraints: any) => Promise<void>;
}

/** does this track have a torch? */
export function webHasTorch(track: TorchTrack | null | undefined): boolean {
  try {
    return !!track?.getCapabilities?.()?.torch;
  } catch {
    return false;
  }
}

/** switch the torch of a track; false = the browser refused (the caller shows the button as off) */
export async function applyWebTorch(track: TorchTrack | null | undefined, on: boolean): Promise<boolean> {
  if (!track?.applyConstraints || !webHasTorch(track)) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as any] });
    return true;
  } catch {
    return false;
  }
}
