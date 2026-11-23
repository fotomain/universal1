// Reads an ICAO 9303 travel document (a passport or an ID card with the eMRTD application) over NFC.
//   1. the card says how it wants to be opened (EF.CardAccess: PACE protocols)
//   2. the reader opens it with the password: CAN or MRZ by PACE, or the MRZ by BAC
//   3. every file is read through the secure messaging: EF.COM, DG1 (the MRZ), DG2 (the face), DG11, DG12, EF.SOD
//   4. the data groups are hashed and compared with the hashes the issuer signed (EF.SOD) - "passive authentication" without the signature
// Fingerprints / iris (DG3, DG4) need terminal certificates of the issuing state (EAC): this reader never asks for them.
import { buildApdu, CardError, IsoDepTransport, SW_OK, sendApdu, swHex } from './apdu';
import { readTlv } from './asn1';
import { bytesToHex, concat, equalBytes } from './crypto/bytes';
import { digest } from './crypto/hash';
import { RandomSource, systemRandom } from './crypto/random';
import { performBac } from './bac';
import { Dg11, Dg12, DG_NAMES, EMRTD_AID, EfCom, FaceImage, FILE_IDS, parseDg1, parseDg11, parseDg12, parseEfCom, parseFaceImage, parseSod, SodHashes } from './dataGroups';
import { accessFromMrz, MrzAccess, MrzData } from './mrz';
import { performPace, PaceInfo, PacePassword, parsePaceInfos, pickPace, whyNoPace } from './pace';
import { SecureMessaging } from './secureMessaging';
import { readFile } from './cardFiles';
import { probeDocument, ProbeResult } from './probe';

export type StepStatus = 'run' | 'ok' | 'fail' | 'skip' | 'info';
/** one line of the log the screen shows (NEVER keys, passwords or personal data - only what was done and how the card answered) */
export interface StepLog {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface ReadOptions {
  /** the CAN printed on the card (6 digits) */
  can?: string;
  /** the MRZ values: document number, birth date, expiry date */
  mrz?: MrzAccess;
  random?: RandomSource;
  onStep?: (step: StepLog) => void;
  /** read the second face / more data groups: DG11 + DG12 (default true) */
  extras?: boolean;
}

export type AccessMethod = 'pace-can' | 'pace-mrz' | 'bac' | 'none';

/** no password was given and nothing could be read: carries what the probe found (the screen shows it, it is no failure) */
export class ProbeOnlyError extends CardError {
  constructor(public readonly probe: ProbeResult, message: string) {
    super(message);
  }
}

/** the document is a locked travel document: the screen asks for the CAN / MRZ */
export class NeedsPasswordError extends ProbeOnlyError {
  constructor(probe: ProbeResult) {
    super(probe, 'This document asks for its password: enter the CAN or the MRZ values (document number, date of birth, date of expiry).');
  }
}

export interface FileInfo {
  name: string;
  dg: number | null;
  size: number;
  /** the whole file was read (a file over 32 KB is cut: the offset of READ BINARY has 15 bits) */
  complete: boolean;
}

export interface IntegrityResult {
  dg: number;
  /** true = the hash matches the signed one, false = it does not, null = the SOD has no hash of it */
  ok: boolean | null;
}

export interface IdDocument {
  access: AccessMethod;
  /** 'PACE ECDH-GM AES-128 (brainpoolP256r1)' ... */
  protocol: string;
  mrz: MrzData | null;
  mrzText: string;
  photo: FaceImage | null;
  details: Dg11 | null;
  document: Dg12 | null;
  com: EfCom | null;
  files: FileInfo[];
  integrity: { algorithm: string; results: IntegrityResult[]; signatureChecked: false } | null;
  warnings: string[];
}

export { readFile };

const label = (n: number) => `DG${n} ${DG_NAMES[n] ?? ''}`.trim();

/** the whole reading */
export async function readEmrtd(transport: IsoDepTransport, options: ReadOptions): Promise<IdDocument> {
  const random = options.random ?? systemRandom;
  const log = (id: string, text: string, status: StepStatus, detail?: string) => options.onStep?.({ id, label: text, status, detail });
  const warnings: string[] = [];
  const noPassword = !options.can && !options.mrz;
  let probe: ProbeResult | null = null;
  if (noPassword) {
    // no password given: look at the document, and read what it gives freely
    probe = await probeDocument(transport, transport.tag ?? null, options.onStep);
    if (!probe.icao) throw new ProbeOnlyError(probe, probe.lines.join(' '));
    if (!probe.dg1Open) throw new NeedsPasswordError(probe);
    warnings.push('This document gave its data without a password.');
  }

  // --- 1. the application
  log('select', 'Select the travel document application', 'run');
  let sel = await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, EMRTD_AID));
  if (sel.sw !== SW_OK) {
    log('select', 'Select the travel document application', 'fail', `card answer ${swHex(sel.sw)}`);
    throw new CardError('This card has no ICAO travel document application (passports and ID cards that follow ICAO 9303 have one). It may be a bank card, a transport card or an ID card with only a national application', sel.sw);
  }
  log('select', 'Select the travel document application', 'ok');

  // --- 2. how the card wants to be opened
  let paceInfos: PaceInfo[] = [];
  let ca = await readFile(transport, null, FILE_IDS.cardAccess);
  if (!ca) {
    // some cards keep EF.CardAccess in the master file only
    await sendApdu(transport, buildApdu(0x00, 0xa4, 0x00, 0x0c, new Uint8Array([0x3f, 0x00])));
    ca = await readFile(transport, null, FILE_IDS.cardAccess);
    await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, EMRTD_AID));
  }
  if (ca) {
    try {
      paceInfos = parsePaceInfos(ca.data);
      log('cardaccess', 'Read EF.CardAccess', 'ok', paceInfos.length ? paceInfos.map((i) => `${i.mapping} ${i.cipherLabel} p${i.parameterId ?? '-'}`).join(' | ') : 'no PACE');
    } catch (e: any) {
      log('cardaccess', 'Read EF.CardAccess', 'fail', String(e?.message ?? e));
    }
  } else {
    log('cardaccess', 'Read EF.CardAccess', 'skip', 'not available: the card may know BAC only');
  }

  // --- 3. open it: PACE with the CAN, PACE with the MRZ, BAC with the MRZ
  const attempts: Array<{ method: AccessMethod; password?: PacePassword }> = [];
  const pace = pickPace(paceInfos);
  if (pace) {
    if (options.can) attempts.push({ method: 'pace-can', password: { kind: 'can', can: options.can } });
    if (options.mrz) attempts.push({ method: 'pace-mrz', password: { kind: 'mrz', access: options.mrz } });
  } else if (paceInfos.length) {
    log('pace', 'PACE', 'skip', whyNoPace(paceInfos));
  }
  if (options.mrz) attempts.push({ method: 'bac' });

  let sm: SecureMessaging | null = null;
  let method: AccessMethod | null = null;
  let protocol = '';
  const failures: string[] = [];
  for (const attempt of attempts) {
    const name = attempt.method === 'bac' ? 'BAC with the MRZ' : attempt.method === 'pace-can' ? 'PACE with the CAN' : 'PACE with the MRZ';
    log(attempt.method, name, 'run');
    try {
      if (attempt.method === 'bac') {
        sm = await performBac(transport, options.mrz as MrzAccess, random);
        protocol = 'BAC (3DES)';
      } else {
        sm = await performPace(transport, pace as PaceInfo, attempt.password as PacePassword, random, true);
        protocol = `PACE ${(pace as PaceInfo).mapping} ${(pace as PaceInfo).cipherLabel} (curve ${(pace as PaceInfo).parameterId})`;
        // an AES card that refuses the FIRST protected command did not like our MAC: open it again with the other way of building the MAC (see secureMessaging.ts)
        if (sm.kind === 'aes') {
          const diag: { sw?: number } = {};
          const first = await readFile(transport, sm, FILE_IDS.com, diag).catch(() => null);
          if (!first) {
            log('sm-check', 'Secure messaging with the padded MAC', 'fail', diag.sw != null ? `card answer ${swHex(diag.sw)}` : 'no answer');
            await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, EMRTD_AID)).catch(() => undefined);
            sm = await performPace(transport, pace as PaceInfo, attempt.password as PacePassword, random, false);
            log('sm-check', 'Secure messaging with the plain MAC (second try)', 'ok');
          }
        }
      }
      method = attempt.method;
      log(attempt.method, name, 'ok');
      break;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      failures.push(`${name}: ${msg}`);
      log(attempt.method, name, 'fail', msg);
      // a failed attempt leaves the card in an unknown state: select the application again
      await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, EMRTD_AID)).catch(() => undefined);
    }
  }
  if (noPassword) {
    // an open document: the files are read without secure messaging
    method = 'none';
    protocol = 'no password needed';
  }
  if ((!sm && !noPassword) || !method) {
    throw new CardError(`The card could not be opened. ${failures.join(' ')}${options.can && !options.mrz ? ' Check the CAN, or also enter the MRZ values.' : ''}`);
  }

  // --- 4. the files
  const files: FileInfo[] = [];
  const raw: Record<number, Uint8Array> = {};
  const get = async (name: string, id: number, dg: number | null): Promise<Uint8Array | null> => {
    log(`file-${name}`, `Read ${name}`, 'run');
    try {
      const diag: { sw?: number } = {};
      const f = await readFile(transport, sm, id, diag);
      if (!f) {
        log(`file-${name}`, `Read ${name}`, 'skip', diag.sw != null ? `not available (card answer ${swHex(diag.sw)})` : 'not available');
        return null;
      }
      files.push({ name, dg, size: f.data.length, complete: f.complete });
      if (!f.complete) warnings.push(`${name} was cut: it is longer than 32 KB.`);
      if (dg != null) raw[dg] = f.data;
      log(`file-${name}`, `Read ${name}`, 'ok', `${f.data.length} bytes`);
      return f.data;
    } catch (e: any) {
      log(`file-${name}`, `Read ${name}`, 'fail', String(e?.message ?? e));
      return null;
    }
  };

  const comBytes = await get('EF.COM', FILE_IDS.com, null);
  let com: EfCom | null = null;
  try {
    com = comBytes ? parseEfCom(comBytes) : null;
  } catch {
    com = null;
  }
  const has = (n: number) => !com || com.dataGroups.length === 0 || com.dataGroups.includes(n);

  const dg1 = await get(label(1), FILE_IDS.dg(1), 1);
  let mrz: MrzData | null = null;
  let mrzText = '';
  if (dg1) {
    try {
      const parsed = parseDg1(dg1);
      mrz = parsed.mrz;
      mrzText = parsed.raw;
    } catch (e: any) {
      warnings.push(`DG1 could not be read: ${e?.message ?? e}`);
    }
  }
  let photo: FaceImage | null = null;
  if (has(2)) {
    const dg2 = await get(label(2), FILE_IDS.dg(2), 2);
    if (dg2) {
      try {
        photo = parseFaceImage(dg2);
        if (!photo) warnings.push('The face image is in a format this reader does not know.');
        else if (photo.mime === 'image/jp2') warnings.push('The face image is JPEG 2000: iOS shows it, Android cannot.');
      } catch (e: any) {
        warnings.push(`DG2 could not be read: ${e?.message ?? e}`);
      }
    }
  }
  let details: Dg11 | null = null;
  let document: Dg12 | null = null;
  if (options.extras !== false) {
    if (has(11)) {
      const dg11 = await get(label(11), FILE_IDS.dg(11), 11);
      if (dg11) try { details = parseDg11(dg11); } catch (e: any) { warnings.push(`DG11 could not be read: ${e?.message ?? e}`); }
    }
    if (has(12)) {
      const dg12 = await get(label(12), FILE_IDS.dg(12), 12);
      if (dg12) try { document = parseDg12(dg12); } catch (e: any) { warnings.push(`DG12 could not be read: ${e?.message ?? e}`); }
    }
  }

  // --- 5. passive authentication (hashes)
  let integrity: IdDocument['integrity'] = null;
  const sodBytes = await get('EF.SOD', FILE_IDS.sod, null);
  if (sodBytes) {
    let sod: SodHashes | null = null;
    try {
      sod = parseSod(sodBytes);
    } catch {
      sod = null;
    }
    if (sod?.algorithm) {
      const results: IntegrityResult[] = Object.keys(raw).map(Number).map((dg) => {
        const expected = sod!.hashes[dg];
        return { dg, ok: expected ? equalBytes(digest(sod!.algorithm!, raw[dg]), expected) : null };
      });
      integrity = { algorithm: sod.algorithm, results, signatureChecked: false };
      log('integrity', 'Compare the data with the signed hashes (EF.SOD)', results.every((r) => r.ok !== false) ? 'ok' : 'fail', results.map((r) => `DG${r.dg}:${r.ok === null ? '?' : r.ok ? 'ok' : 'BAD'}`).join(' '));
    } else {
      log('integrity', 'Compare the data with the signed hashes (EF.SOD)', 'skip', 'the SOD could not be read');
    }
  }
  if (integrity?.results.some((r) => r.ok === false)) warnings.push('A data group does NOT match the signed hash: do not trust this data.');
  warnings.push('The signature of the issuing state was not checked (this reader has no list of trusted state certificates): the data can be read but not proven to be genuine.');

  return { access: method, protocol, mrz, mrzText, photo, details, document, com, files, integrity, warnings };
}

export { accessFromMrz, readTlv, bytesToHex };
