// The state of the NFC screen: is NFC there, is it on, is the reader running, what was read. The reads go to the inbox (nfcInbox.ts).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { makeReceived } from './nfcModel';
import { pushNfcRead } from './nfcInbox';
import type { NfcAvailability, NfcReaderHandle } from './nfcReaderTypes';
import { nfcAvailability, openNfcSettings, startNfcReader } from './nfcReader';

export type NfcReaderState = 'checking' | NfcAvailability | 'scanning' | 'stopped' | 'error';

export interface UseNfcReader {
  state: NfcReaderState;
  /** the text of an error ('' = none) */
  error: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  openSettings: () => Promise<void>;
  /** iOS shows its own sheet and needs a press; Android / web read by themselves */
  needsPress: boolean;
}

/** `active` = the screen is shown: the reader runs only then (the screen stays mounted in the drawer) */
export function useNfcReader(active: boolean): UseNfcReader {
  const [state, setState] = useState<NfcReaderState>('checking');
  const [error, setError] = useState('');
  const handle = useRef<NfcReaderHandle | null>(null);
  /** the user pressed Stop / left the screen: a closed session is then NOT started again */
  const wanted = useRef(false);
  const needsPress = Platform.OS === 'ios';

  const stop = useCallback(async () => {
    wanted.current = false;
    const h = handle.current;
    handle.current = null;
    if (h) await h.stop();
    setState((s) => (s === 'scanning' ? 'stopped' : s));
  }, []);

  const start = useCallback(async () => {
    setError('');
    const availability = await nfcAvailability();
    if (availability !== 'ready') {
      setState(availability);
      return;
    }
    if (handle.current) return;
    wanted.current = true;
    try {
      handle.current = await startNfcReader(
        (tag) => {
          pushNfcRead(makeReceived(tag, 'foreground'));
        },
        (closed) => {
          // the system ended the session (iOS: time limit / Cancel). Android and the web are never closed by themselves.
          handle.current = null;
          if (closed && wanted.current && /cancel|user/i.test(String((closed as any)?.message ?? closed))) wanted.current = false;
          setState('stopped');
        },
      );
      setState('scanning');
    } catch (e: any) {
      handle.current = null;
      wanted.current = false;
      setError(String(e?.message || e || 'NFC could not be started.'));
      setState('error');
    }
  }, []);

  // the reader runs while the screen is shown (Android / web: starts by itself; iOS: the button)
  useEffect(() => {
    let cancelled = false;
    if (!active) {
      void stop();
      return undefined;
    }
    void (async () => {
      const availability = await nfcAvailability();
      if (cancelled) return;
      if (availability !== 'ready') {
        setState(availability);
        return;
      }
      if (needsPress) setState('stopped');
      else await start();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => { void stop(); }, [stop]);

  return { state, error, start, stop, openSettings: openNfcSettings, needsPress };
}
