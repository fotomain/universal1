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

// The TEXT job: when this phone cannot find a valid zone (the front of an ID card), the recognised LINES (no picture) go to Google AI by themselves.
// ON by default (the owner asked for it to run automatically after the photo); it can be switched off on the photo screen, and the choice is kept on this device.
const TEXT_KEY = 'kit8.identification.googleAiText';

export async function loadAiTextConsent(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (await require('@react-native-async-storage/async-storage').default.getItem(TEXT_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function saveAiTextConsent(on: boolean): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await require('@react-native-async-storage/async-storage').default.setItem(TEXT_KEY, on ? 'on' : 'off');
  } catch {
    // nothing to keep it in
  }
}
