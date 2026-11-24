// The state of the ID reader screen: idle -> reading (the steps arrive one by one) -> done (the document) or error. Nothing is kept after clear().
import { useCallback, useEffect, useRef, useState } from 'react';
import { IdDocument, NeedsPasswordError, ProbeOnlyError, ReadOptions, readEmrtd, StepLog } from './emrtd';
import type { ProbeResult } from './probe';
import { cancelIsoDepWait, openIsoDep } from './idTransport';

/** needs-password = a locked travel document (the probe is shown, the password asked); info = the card is not a travel document (the probe is shown) */
export type IdReaderState = 'idle' | 'reading' | 'done' | 'needs-password' | 'info' | 'error';

/** an NFC failure in words a person can act on */
export function friendlyIdError(e: any): string {
  const text = String(e?.message ?? e ?? 'The document could not be read.');
  if (/tag was lost|TagLost|Transceive failed|lost|IOException|session invalidated|not connected/i.test(text)) return 'The document moved away from the phone. Hold it still against the back of the phone and try again.';
  if (/cancel|user cancel/i.test(text) && !/The card/.test(text)) return 'Reading was cancelled.';
  if (/timeout/i.test(text)) return 'The document took too long to answer. Hold it still and try again.';
  return text;
}

export interface UseIdReader {
  state: IdReaderState;
  steps: StepLog[];
  document: IdDocument | null;
  /** what the document says without a password (set when no password was given) */
  probe: ProbeResult | null;
  error: string;
  read: (options: Omit<ReadOptions, 'onStep'>) => Promise<void>;
  /** wipes the document, the steps and the error from the memory */
  clear: () => void;
}

export function useIdReader(): UseIdReader {
  const [state, setState] = useState<IdReaderState>('idle');
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [document, setDocument] = useState<IdDocument | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reading = useRef(false);

  const clear = useCallback(() => {
    runId.current += 1;
    // a reading that waits for the document (or runs) is stopped, else its request stays open and blocks the next one
    if (reading.current) void cancelIsoDepWait();
    setState('idle');
    setSteps([]);
    setDocument(null);
    setProbe(null);
    setError('');
  }, []);

  const read = useCallback(async (options: Omit<ReadOptions, 'onStep'>) => {
    const mine = ++runId.current;
    reading.current = true;
    setState('reading');
    setSteps([]);
    setDocument(null);
    setProbe(null);
    setError('');
    let transport: Awaited<ReturnType<typeof openIsoDep>> | null = null;
    try {
      transport = await openIsoDep();
      const doc = await readEmrtd(transport, {
        ...options,
        onStep: (step) => {
          if (!alive.current || mine !== runId.current) return;
          // a step is shown once: its later states replace it
          setSteps((list) => {
            const i = list.findIndex((x) => x.id === step.id);
            return i < 0 ? [...list, step] : list.map((x, k) => (k === i ? step : x));
          });
        },
      });
      if (!alive.current || mine !== runId.current) return;
      setDocument(doc);
      setState('done');
    } catch (e: any) {
      if (!alive.current || mine !== runId.current) return;
      if (e instanceof ProbeOnlyError) {
        // not a failure: the document was looked at, the screen shows what it said
        setProbe(e.probe);
        setState(e instanceof NeedsPasswordError ? 'needs-password' : 'info');
        return;
      }
      setError(friendlyIdError(e));
      setState('error');
    } finally {
      if (mine === runId.current) reading.current = false;
      await transport?.close();
    }
  }, []);

  return { state, steps, document, probe, error, read, clear };
}
