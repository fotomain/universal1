// "Where to go after the sign in": the screen a guest wanted (Identification, Record audio / video / photo, Scan ... = `RecordingSignInGate`).
// The `returnTo` parameter of /user/signin is lost by every sign-in that leaves the page or does not start at the gate card: Google / Microsoft on the web
// (the page goes to the provider and comes back to <origin>/user/signin), the e-mail link, the "Sign In" row of the hamburger menu. So the wanted route is
// also REMEMBERED here (memory + localStorage on the web / SecureStore on a phone, 15 minutes) and the sign in screen takes it when it has no `returnTo` of its own.
import { Platform } from 'react-native';
import { safeReturnToRoute } from '../../lib/returnToRoute';

// loaded only on a phone: the web (and Jest) has no native module of expo-secure-store
const secureStore = () => require('expo-secure-store') as typeof import('expo-secure-store');

const KEY = 'pending_sign_in_return_to';
/** a wish older than this is forgotten (the user went away and signs in for another reason later) */
export const PENDING_RETURN_TO_TTL_MS = 15 * 60 * 1000;

interface Stored { route: string; at: number }

let memory: Stored | null = null;

const parse = (raw: string | null | undefined): Stored | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.route === 'string' && typeof v.at === 'number' ? { route: v.route, at: v.at } : null;
  } catch {
    return null;
  }
};

async function readStored(): Promise<Stored | null> {
  try {
    if (Platform.OS === 'web') return typeof window !== 'undefined' && window.localStorage ? parse(window.localStorage.getItem(KEY)) : null;
    return parse(await secureStore().getItemAsync(KEY));
  } catch {
    return null;
  }
}

async function writeStored(value: Stored | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (value) window.localStorage.setItem(KEY, JSON.stringify(value)); else window.localStorage.removeItem(KEY);
      return;
    }
    if (value) await secureStore().setItemAsync(KEY, JSON.stringify(value)); else await secureStore().deleteItemAsync(KEY);
  } catch {
    // no storage: the memory copy still serves a sign in that does not reload the app
  }
}

/** remember the route the user wants after the sign in; anything that is not an in-app path is ignored */
export function setPendingReturnTo(route: unknown, now: number = Date.now()): void {
  const safe = safeReturnToRoute(route);
  if (!safe) return;
  memory = { route: safe, at: now };
  void writeStored(memory);
}

/** the remembered route (still fresh) or null; does not forget it */
export async function peekPendingReturnTo(now: number = Date.now()): Promise<string | null> {
  const found = memory ?? (await readStored());
  if (!found || now - found.at > PENDING_RETURN_TO_TTL_MS) return null;
  return safeReturnToRoute(found.route);
}

export function clearPendingReturnTo(): void {
  memory = null;
  void writeStored(null);
}

/** test helper: forget the memory copy only */
export function resetPendingReturnToMemory(): void {
  memory = null;
}
