// uxui.currentJSON = the JSON of the record the user is looking at right now.
// Screens / windows publish it with useUxuiCurrentJSON(value); the last mounted publisher wins
// (a window opened over a screen), and when it closes the previous one is published again.
// Used by "Share screenshot + JSON" (kit8/lib/shareScreenshot.ts).

import { useEffect, useRef } from 'react';
import { setCurrentJSON, UxuiCurrentJSON } from './uxuiSlice';
import { appDispatch } from './storeRef';

const stack: { id: number; value: UxuiCurrentJSON }[] = [];
let seq = 0;

const publish = () => appDispatch(setCurrentJSON(stack.length ? stack[stack.length - 1].value : null));

/** Publishes `value` as uxui.currentJSON while the component is mounted (null = nothing to publish). */
export function useUxuiCurrentJSON(value: UxuiCurrentJSON | null | undefined) {
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = ++seq;
  let key = '';
  try {
    key = value ? JSON.stringify(value) : '';
  } catch {
    key = '';
  }
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    const id = idRef.current;
    const i = stack.findIndex((e) => e.id === id);
    const v = key ? valueRef.current : null;
    if (v) {
      if (i >= 0) stack[i].value = v;
      else stack.push({ id, value: v });
    } else if (i >= 0) stack.splice(i, 1);
    publish();
  }, [key]);
  useEffect(
    () => () => {
      const i = stack.findIndex((e) => e.id === idRef.current);
      if (i >= 0) {
        stack.splice(i, 1);
        publish();
      }
    },
    []
  );
}
