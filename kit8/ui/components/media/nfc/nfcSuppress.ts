// While the ID reading is on the screen (Identification flow, ID card reader) the phone must not hand the ID card to the "data scan at the background" of
// NfcBackgroundHandler: that one makes an NFC read of it and opens the NFC screen over the reading ("NFC tag ... no readable message" - the post the user got
// instead of the ID post, 2026-11-23). A screen calls `suppressBackgroundNfc()` while it is focused and calls the answer when it is left.
let count = 0;

/** background tags are ignored until the returned function is called (safe to call it twice) */
export function suppressBackgroundNfc(): () => void {
  count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
  };
}

export const isBackgroundNfcSuppressed = (): boolean => count > 0;
