// SHA-1 / SHA-2 (noble hashes: audited, pure JS, work on Hermes).
import { sha1 } from '@noble/hashes/sha1';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2';

export type HashName = 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512';

export function digest(name: HashName, data: Uint8Array): Uint8Array {
  switch (name) {
    case 'sha1': return sha1(data);
    case 'sha256': return sha256(data);
    case 'sha384': return sha384(data);
    case 'sha512': return sha512(data);
    default: throw new Error(`hash ${name} is not supported`);
  }
}

/** the hash of a data group as named by the OID of the SOD (id-sha1, id-sha256 ...) */
export const HASH_OIDS: Record<string, HashName> = {
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
  '2.16.840.1.101.3.4.2.4': 'sha224',
};
