// "Look at the document without any password": everything a card tells freely. The personal data of a passport / ID card is locked by
// the card itself until the CAN or the MRZ values are given (that is the privacy design of ICAO 9303) - so without a password this
// finds out WHAT the document is, which applications it has, how it wants to be opened, and whether any file happens to be open.
import { buildApdu, IsoDepTransport, SW_OK, sendApdu, swHex } from './apdu';
import { readBinary, readFile, selectEf } from './cardFiles';
import { readTlvs, findTlv } from './asn1';
import { bytesToAscii, bytesToHex, hexToBytes } from './crypto/bytes';
import { EMRTD_AID, FILE_IDS } from './dataGroups';
import { PaceInfo, parsePaceInfos } from './pace';
import type { StepLog } from './emrtd';

export type DocumentKind = 'travel-document' | 'bank-card' | 'eid-only' | 'unknown';

export interface KnownApp {
  /** the start of the application id (hex) */
  prefix: string;
  name: string;
  /** the whole id: probed by SELECT; '' = only recognised in a directory */
  probe: string;
  kind: DocumentKind | 'signature';
}

/** applications that are recognised by their id (ISO 7816-5 registered ids; payment brands; the German eID) */
export const KNOWN_APPS: KnownApp[] = [
  { prefix: 'A0000002471001', name: 'ICAO travel document (passport / ID card chip)', probe: 'A0000002471001', kind: 'travel-document' },
  { prefix: 'E80704007F00070302', name: 'German eID (online identification application)', probe: 'E80704007F00070302', kind: 'eid-only' },
  { prefix: 'A000000063504B43532D3135', name: 'PKCS#15 (certificates / signature application)', probe: 'A000000063504B43532D3135', kind: 'signature' },
  { prefix: '325041592E5359532E4444463031', name: 'Contactless payment directory (PPSE)', probe: '325041592E5359532E4444463031', kind: 'bank-card' },
  { prefix: 'A0000000031010', name: 'Visa payment card', probe: 'A0000000031010', kind: 'bank-card' },
  { prefix: 'A0000000041010', name: 'Mastercard payment card', probe: 'A0000000041010', kind: 'bank-card' },
  { prefix: 'A0000000043060', name: 'Maestro payment card', probe: 'A0000000043060', kind: 'bank-card' },
  { prefix: 'A00000002501', name: 'American Express payment card', probe: 'A00000002501', kind: 'bank-card' },
  { prefix: 'A000000151', name: 'GlobalPlatform card manager', probe: '', kind: 'unknown' },
];

export const appNameOf = (aidHex: string): string => KNOWN_APPS.find((k) => aidHex.toUpperCase().startsWith(k.prefix))?.name ?? '';

export interface FoundApp {
  aid: string;
  label: string;
  name: string;
  source: 'directory' | 'probe';
}

export interface ProbeResult {
  /** what the NFC layer knows of the tag (the id is random on privacy cards: it changes with every tap) */
  tag: { id: string; techTypes: string[] } | null;
  applications: FoundApp[];
  /** the card has the ICAO travel document application */
  icao: boolean;
  /** the protocols of EF.CardAccess */
  pace: PaceInfo[];
  /** files of the travel document that answered WITHOUT a password ('EF.COM', 'DG1' ...) */
  openFiles: string[];
  /** the MRZ file can be read without a password */
  dg1Open: boolean;
  kind: DocumentKind;
  /** the personal data is locked: the CAN or the MRZ values are needed */
  needsPassword: boolean;
  /** what to tell the user, one line each */
  lines: string[];
}

const log = (on: ((s: StepLog) => void) | undefined, id: string, label: string, status: StepLog['status'], detail?: string) => on?.({ id, label, status, detail });

/** an application directory (EF.DIR): 61 { 4F aid, 50 label } entries */
export function parseEfDir(bytes: Uint8Array): Array<{ aid: string; label: string }> {
  const out: Array<{ aid: string; label: string }> = [];
  let tlvs;
  try {
    tlvs = readTlvs(bytes);
  } catch {
    return out;
  }
  for (const t of tlvs) {
    if (t.tag !== 0x61) continue;
    let kids;
    try {
      kids = readTlvs(t.value);
    } catch {
      continue;
    }
    const aid = findTlv(kids, 0x4f);
    if (aid) out.push({ aid: bytesToHex(aid.value), label: bytesToAscii(findTlv(kids, 0x50)?.value ?? []).replace(/[^\x20-\x7e]/g, '') });
  }
  return out;
}

/** EF.DIR is a file of records on most cards (READ RECORD) and a plain file on some (READ BINARY): both are tried */
export async function readDirectory(transport: IsoDepTransport): Promise<Array<{ aid: string; label: string }>> {
  if ((await selectEf(transport, null, 0x2f00)) !== SW_OK) return [];
  const out: Array<{ aid: string; label: string }> = [];
  for (let record = 1; record <= 16; record += 1) {
    const r = await sendApdu(transport, buildApdu(0x00, 0xb2, record, 0x04, undefined, 0x00));
    if (r.sw !== SW_OK || !r.data.length) break;
    out.push(...parseEfDir(r.data));
  }
  if (out.length) return out;
  const bin = await readBinary(transport, null, 0, 0x00);
  return bin.sw === SW_OK || bin.sw === 0x6282 ? parseEfDir(bin.data) : [];
}

export async function probeDocument(transport: IsoDepTransport, tag: ProbeResult['tag'] = null, onStep?: (s: StepLog) => void): Promise<ProbeResult> {
  const applications: FoundApp[] = [];
  const add = (aid: string, label: string, source: FoundApp['source']) => {
    if (!applications.some((a) => a.aid === aid)) applications.push({ aid, label, name: appNameOf(aid), source });
  };
  log(onStep, 'probe', 'Look at the document (no password needed)', 'run');

  // 1. the directory of the card
  try {
    await sendApdu(transport, buildApdu(0x00, 0xa4, 0x00, 0x0c, new Uint8Array([0x3f, 0x00])));
    const dir = await readDirectory(transport);
    for (const e of dir) add(e.aid, e.label, 'directory');
    log(onStep, 'probe-dir', 'Read the application directory', dir.length ? 'ok' : 'skip', dir.length ? `${dir.length} entries` : 'the card has none');
  } catch (e: any) {
    log(onStep, 'probe-dir', 'Read the application directory', 'skip', String(e?.message ?? e));
  }

  // 2. the known applications, one SELECT each (a card answers 6A82 for those it does not have)
  let icao = false;
  for (const app of KNOWN_APPS.filter((k) => k.probe)) {
    try {
      const r = await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, hexToBytes(app.probe)));
      if (r.sw === SW_OK) {
        add(app.probe, '', 'probe');
        if (app.probe === bytesToHex(EMRTD_AID)) icao = true;
      }
    } catch {
      break; // the card stopped answering (it was moved away): report what we have
    }
  }
  log(onStep, 'probe-apps', 'Look for known applications', applications.length ? 'ok' : 'skip', applications.map((a) => a.name || a.aid).join(' | ') || 'none of the known ones');

  // 3. the travel document: how it wants to be opened, and what is open without a password
  let pace: PaceInfo[] = [];
  const openFiles: string[] = [];
  if (icao) {
    try {
      await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, EMRTD_AID));
      const ca = await readFile(transport, null, FILE_IDS.cardAccess);
      if (ca) {
        try {
          pace = parsePaceInfos(ca.data);
        } catch {
          pace = [];
        }
      }
      for (const [name, id] of [['EF.COM', FILE_IDS.com], ['DG1 (MRZ)', FILE_IDS.dg(1)], ['EF.SOD', FILE_IDS.sod]] as const) {
        await sendApdu(transport, buildApdu(0x00, 0xa4, 0x04, 0x0c, EMRTD_AID)); // a refused file may leave the selection undefined
        const f = await readFile(transport, null, id);
        if (f) openFiles.push(name);
      }
      log(onStep, 'probe-icao', 'Ask the travel document how it is opened', 'ok', `${pace.map((p) => `${p.mapping} ${p.cipherLabel}`).join(', ') || 'BAC only (no PACE)'}; open without a password: ${openFiles.join(', ') || 'nothing'}`);
    } catch (e: any) {
      log(onStep, 'probe-icao', 'Ask the travel document how it is opened', 'fail', String(e?.message ?? e));
    }
  }

  const dg1Open = openFiles.includes('DG1 (MRZ)');
  const hasPayment = applications.some((a) => KNOWN_APPS.find((k) => a.aid.startsWith(k.prefix))?.kind === 'bank-card');
  const hasEid = applications.some((a) => KNOWN_APPS.find((k) => a.aid.startsWith(k.prefix))?.kind === 'eid-only');
  const kind: DocumentKind = icao ? 'travel-document' : hasPayment ? 'bank-card' : hasEid || applications.length ? 'eid-only' : 'unknown';
  const needsPassword = icao && !dg1Open;

  const lines: string[] = [];
  if (tag?.id) lines.push(`Tag id ${tag.id}${tag.id.toUpperCase().startsWith('08') ? ' (starts with 08: a random id, it changes every time - a privacy feature)' : ''}${tag.techTypes?.length ? `, ${tag.techTypes.join(' + ')}` : ''}.`);
  if (kind === 'travel-document') {
    lines.push('This is a travel document: a passport, or an ID card with the ICAO application.');
    lines.push(dg1Open ? 'Its data can be read without a password.' : `Its personal data is locked. Enter the CAN (6 digits printed on the card) or the document number with the two dates of the machine readable zone, then press the button again.${pace.length ? ` The card offers PACE (${pace.map((p) => p.cipherLabel).join(' / ')}), so the CAN works if it has one.` : ' The card offers BAC only: it needs the MRZ values.'}`);
  } else if (kind === 'bank-card') {
    lines.push('This is a payment card, not an identity document. Nothing is read from it.');
  } else if (kind === 'eid-only') {
    lines.push('This card has applications of its own but not the ICAO travel document application: its data is behind a national protocol that this reader does not speak (e.g. the German ID card needs the AusweisApp).');
  } else {
    lines.push('The card did not answer any known application. It may be another kind of card, or it moved away: hold it still and try again.');
  }
  log(onStep, 'probe', 'Look at the document (no password needed)', 'ok', kind);
  return { tag, applications, icao, pace, openFiles, dg1Open, kind, needsPassword, lines };
}

export { swHex };
