// "Read with Google AI" is an OPT-IN: the photo of an identity document goes to Google only when the user switched it on. The choice is kept on this device.
const KEY = 'kit8.identification.googleAi';

export async function loadAiConsent(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (await require('@react-native-async-storage/async-storage').default.getItem(KEY)) === 'on';
  } catch {
    return false;
  }
}

export async function saveAiConsent(on: boolean): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await require('@react-native-async-storage/async-storage').default.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // nothing to keep it in
  }
}
// (The reading of the recognised TEXT by Google AI has no switch since 2026-11-23: it runs after every photo, see MrzPhotoStep.tsx.)
