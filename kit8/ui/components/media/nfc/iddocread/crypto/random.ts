// The random bytes of the protocol (nonces, ephemeral keys): expo-crypto on a phone (the system generator), the Node / browser generator in tests.
export type RandomSource = (n: number) => Uint8Array;

export const systemRandom: RandomSource = (n) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Crypto = require('expo-crypto');
    if (typeof Crypto.getRandomBytes === 'function') return Crypto.getRandomBytes(n) as Uint8Array;
  } catch {
    // not available: next generator
  }
  const g: any = (globalThis as any).crypto;
  if (g?.getRandomValues) return g.getRandomValues(new Uint8Array(n));
  throw new Error('No secure random generator on this device.');
};
