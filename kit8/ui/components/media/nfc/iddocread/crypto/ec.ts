// Elliptic curves of the PACE domain parameters (ICAO 9303 part 11, ids 8..18: NIST P-192/224/256/384/521 and brainpool 192..512).
// noble's generic Weierstrass point class does the arithmetic; the constants are the generated table (curveParams.ts).
import { weierstrassN } from '@noble/curves/abstract/weierstrass';
import { bigToBytes, bytesToBig, concat } from './bytes';
import { ICAO_CURVES } from './curveParams';

export interface EcCurve {
  id: number;
  name: string;
  /** bytes of a coordinate */
  size: number;
  n: bigint;
  Point: any;
}

const cache = new Map<number, EcCurve>();
const big = (hex: string) => BigInt(`0x${hex}`);

export function curveOf(parameterId: number): EcCurve {
  const hit = cache.get(parameterId);
  if (hit) return hit;
  const c = ICAO_CURVES[parameterId];
  if (!c) throw new Error(`The card uses the domain parameters ${parameterId}, which this reader does not support (supported: ${Object.keys(ICAO_CURVES).join(', ')}).`);
  const Point = weierstrassN({ p: big(c.p), a: big(c.a), b: big(c.b), n: big(c.n), Gx: big(c.Gx), Gy: big(c.Gy), h: BigInt(c.h) });
  const curve: EcCurve = { id: parameterId, name: c.name, size: Math.ceil(big(c.p).toString(2).length / 8), n: big(c.n), Point };
  cache.set(parameterId, curve);
  return curve;
}

export const SUPPORTED_PARAMETER_IDS = Object.keys(ICAO_CURVES).map(Number);

/** uncompressed point 04 || x || y */
export function encodePoint(curve: EcCurve, point: any): Uint8Array {
  const a = point.toAffine();
  return concat(new Uint8Array([0x04]), bigToBytes(a.x, curve.size), bigToBytes(a.y, curve.size));
}

/** decodes an uncompressed point and checks that it is ON the curve (an invalid point attack is refused) */
export function decodePoint(curve: EcCurve, bytes: Uint8Array): any {
  if (bytes.length !== 1 + 2 * curve.size || bytes[0] !== 0x04) throw new Error('bad point encoding');
  const x = bytesToBig(bytes.slice(1, 1 + curve.size));
  const y = bytesToBig(bytes.slice(1 + curve.size));
  const p = curve.Point.fromAffine({ x, y });
  p.assertValidity();
  return p;
}

/** a random scalar in 1 .. n-1 from the bytes of `random` (rejection sampling) */
export function randomScalar(curve: EcCurve, random: (n: number) => Uint8Array): bigint {
  for (let i = 0; i < 64; i += 1) {
    const k = bytesToBig(random(curve.size + 8)) % curve.n;
    if (k > 0n) return k;
  }
  throw new Error('no random scalar');
}

export const xCoordinate = (curve: EcCurve, point: any): Uint8Array => bigToBytes(point.toAffine().x, curve.size);
