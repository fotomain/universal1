# ID card / passport reader (ICAO 9303) - route `/media/nfc/iddocread`

Reads the chip of a **passport or ID card** over NFC on iOS and Android. Built 2026-11-19. Pure TypeScript on top of `react-native-nfc-manager`
(`requestTechnology(IsoDep)` + `isoDepHandler.transceive`): no native module of its own. **Not tried on a real document yet** - see "Testing with a real card".

## The first control: "Read from document" (no input)

`ReadFromDocumentButton` is the FIRST control of the screen. Pressed with nothing typed it runs `probeDocument` (`probe.ts`) and shows **what the document
freely tells**: whether it is a travel document / a payment card / a card with national applications (EF.DIR + SELECT of known application ids: ICAO,
German eID, PKCS#15, Visa / Mastercard / Maestro / Amex, PPSE), the tag id (random on privacy cards, e.g. `08...`), how the travel document wants to be
opened (PACE ciphers and curve, or BAC only) and which files, if any, answer without a password. **The personal data itself is locked by the card until
the CAN or the MRZ values are given - the card enforces it, no reader can bypass it.** So the probe ends with "this document needs its password" and the
password card below turns that colour; with the CAN / MRZ typed, the SAME button reads the whole document. A document that really needs no password
(`openAll` in the tests) is read at once, without a secure session. Not done on purpose: guessing passwords.
Without typing the MRZ, the only way would be to scan it with the camera (OCR): not built (needs a native text recognition module).

## What "all possible countries" means here

The one protocol that is the same everywhere is **ICAO 9303** (the standard of the electronic passport). This reader speaks it completely
enough to read **the passports of every state that issues an electronic passport** and **every ID card that carries the same travel document
application** (many European ID cards do). What a state keeps behind its own national protocol is NOT readable by any generic reader:

| Kind of document | Result |
|---|---|
| Passport of any ICAO state (D, LVA, USA, JPN ...) | Readable: MRZ values (BAC / PACE-MRZ), face image, data groups 1, 2, 11, 12, hash check |
| ID card with the ICAO application (e.g. several EU states; Latvia, Estonia, Spain, Italy are candidates - **unverified**) | Readable the same way; some cards want the **CAN** printed on the card (PACE-CAN) |
| ID card with national functions only (Germany: online ID function; Austria: ID Austria app; Belgium: eID middleware) | Not readable here: the screen says "no ICAO travel document application" and shows the note of the country |
| PIN-protected functions of any card (log in, e-signature, bank) | Never |
| Fingerprints (DG3) / iris (DG4) | Never: they need a certificate of the issuing state (EAC) |

`countries.ts` = every ISO 3166-1 state + the special ICAO codes (`D` = Germany, `XXA` stateless ...); `countryNotes.ts` = what to expect per state
(each note carries `source`: `research` = read in official / vendor pages, `standard` = follows from ICAO 9303, `unverified` = expectation, not checked with a card).

## Protocols

| Step | Where | Notes |
|---|---|---|
| Select the application `A0000002471001` | `emrtd.ts` | a card without it is refused in words (a bank card, a national-only ID card) |
| EF.CardAccess -> which PACE the card offers | `pace.ts` `parsePaceInfos` | 3DES and AES-128 / 192 / 256 |
| **PACE** ECDH, generic mapping (also the chip authentication mapping variant) | `pace.ts` | curves = the ICAO standardized domain parameters 8..18: NIST P-192/224/256/384/521 and brainpool P192/224/256/320/384/512 (`crypto/curveParams.ts` is GENERATED from OpenSSL) |
| **BAC** (3DES) | `bac.ts` | for older passports and as the fallback |
| Secure messaging 3DES / AES | `secureMessaging.ts` | every command and answer after the opening is encrypted + MAC'd |
| Files: EF.COM, DG1, DG2, DG11, DG12, EF.SOD | `emrtd.ts`, `dataGroups.ts` | pieces of 192 bytes, smaller when the card answers 6700 / 6Cxx; a file over 32 KB is cut and says so |
| Passive authentication (hashes) | `emrtd.ts` | each data group is hashed and compared with EF.SOD; **the signature of the state is NOT checked** (no list of state certificates) |

Order tried: PACE with the CAN (if given) -> PACE with the MRZ -> BAC with the MRZ. A failed attempt is logged and the next one runs. The step list
on the screen shows every step and the status word of the card (never keys, passwords or personal data).

**Not supported (said in words when the card needs them):** modular Diffie-Hellman PACE (domain parameters 0..2), the integrated mapping (ECDH-IM / DH-IM),
card chosen explicit curve parameters, EAC / chip authentication / active authentication, DG3 / DG4, files over 32 KB (READ BINARY with an odd instruction),
JPEG 2000 faces on Android (the phone cannot show them), the signature check of EF.SOD.

## Testing with a real card (Latvian ID card)

1. Drawer **Scan -> ID card / passport** (or the button on the NFC screen). Android: NFC on, the app in front.
2. Country `LVA` shows the note. Enter the three values of the **MRZ on the back of the card**: document number, date of birth, date of expiry (DD.MM.YYYY) - or paste the three MRZ lines. If the card has a **CAN** (6 digits printed on it), enter it too.
3. **Hold** the card against the back of the phone (the NFC antenna is usually near the camera) and keep it still, press **Read from document** (the elliptic curve exchange takes the chip 1-2 s); if the "Steps" window does not appear, take the card away and hold it again.
4. The step list says what happened. Typical outcomes:
   - `Select the travel document application` fails (6A82): the card has no ICAO application -> national functions only.
   - `PACE ...` fails with `PACE step 4`: wrong CAN / MRZ value (the card cannot say which).
   - `BAC` fails (6300 / 6982): a value of the MRZ is wrong (check the document number: letters and digits as printed, `O` is the letter, `0` the digit).
   - `The document moved away`: the card left the antenna - hold it still.
   - Everything `ok` but the face is missing: DG2 is JPEG 2000 (Android) - the warning says so.
   Please send the step list (it contains no personal data) when something fails: it tells exactly where.
5. **Clear** wipes the screen; leaving the screen wipes it too. Nothing is saved or sent anywhere, and there is no "create media post" for an ID on purpose.

## How it was verified (no real document yet)

- **ICAO 9303 part 11 specimens:** the BAC keys, `E_IFD` and `M_IFD` of the example (appendix D), the PACE `K_pi` + decrypted nonce of the example (MRZ `T22000129364081251010318`).
- **RFC 4493** AES-CMAC vectors; **OpenSSL**: the point arithmetic of all eleven curves (public key and shared secret agree with `crypto.createECDH`).
- **A software card** (`__tests__/media/idCardTestKit.ts`, card side written separately with Node crypto): BAC, PACE on all 11 curves with 3DES / AES-128 / 192 / 256, files, secure messaging, wrong passwords, tampered data, small READ BINARY, 20 KB images.
- This is NOT a proof against a real chip: real cards have quirks (extended length, other file ids, timing). Hence the step list.

## Files

`IdCardReader.tsx` (screen) · `ReadFromDocumentButton.tsx` · `probe.ts` · `cardFiles.ts` · `useIdReader.ts` · `emrtd.ts` (the reading) · `pace.ts` · `bac.ts` · `secureMessaging.ts` · `apdu.ts` · `dataGroups.ts` · `mrz.ts` · `asn1.ts` ·
`countries.ts` · `countryNotes.ts` · `idTransport.ts` (+ `.web`: a browser cannot do ISO-DEP) · `crypto/` (`symmetric` = 3DES via `node-forge`, AES via `@noble/ciphers`; `hash`; `ec` + `curveParams`; `random`; `bytes`).
Tests: `__tests__/media/idCrypto`, `idModel`, `idReader`, `idScreen` (+ `idCardTestKit`).

## Privacy and law

The data of an ID card is personal data. The reader keeps it in the memory of the screen only and never writes or sends it. The holder must give the
CAN / MRZ values himself: read only documents you are entitled to read. Some states restrict who may read their cards' chips.


## Media post of the result (2026-11-23)
After a read the button **Create media post** (`IdCardPostOffer.tsx`, a signed-in user; a guest sees Sign in) makes a post whose TITLE is the owner's name (`GIVEN NAMES SURNAME`) and whose SUB TITLE is `ID card · No. <document number>` (`Passport` for a code that starts with P), so both show in the Media Posts list (`buildIdCardPost` in `common/notePost.ts`; the description also has nationality and date of expiry). Nothing is saved before the press; the face image and the other chip data are never kept. Tests: `__tests__/media/idCardPost.test.ts`, `idScreen.test.tsx`.

The **owner photo** of the chip (face image, DG2) is saved too, when the post is created: `kit8/files/common/identificationPhoto.ts` -> Edge Function `files-drive`, scope `identification` -> the file storage of the organization (Google Drive / OneDrive): `<kit8 root>/identification/idcard|passport/<media post guid>.jpg|jp2`. Only the author of the post sees / downloads it (SQL PART 49, policy `mediaPost_select`); it goes with the post. If the storage is not connected or the upload fails, the post stays and the screen says the photo was NOT saved. Tests: `__tests__/files/identificationPhoto.test.ts`, `filesDriveFunction.test.ts`, Docker `tests/107`.

## ID card post: all the data + the photo (2026-11-23)

**Create media post** (`IdCardPostOffer`) now keeps the whole reading in the post, not only the name and the number: `idCardFields(doc)` (`iddocread/idCardFields.ts`, pure) lists every readable datum of the zone, DG11 (personal details) and DG12 (document details) as label + value - the description of the post is one line per datum and `rowJSON.idCardFields` keeps the list. The owner photo of the chip is in the post as `mediaImageUri` (a data address) when it is a JPEG up to `ID_POST_PHOTO_MAX_CHARS`; a JPEG 2000 photo (Android cannot draw it) is only in the file storage and the post says so in a `Photo` line. The phone list (`MediaPostsNativeList`, `MediaPostRow.isIdCard`) and the web list (`MediaPostCRUDComponent`) draw it as a portrait above the text. Tests `__tests__/media/idCardFields.test.ts`, `idCardPost.test.ts`.


## Create user from the document (2026-11-24)
The screen "Media post created." has the button **Create user** (`CreateUserFromIDDocumentButton`) between "Media posts" and "Close". It makes the USER of the document:
- e-mail = `<first given name>.<surname>@<domain of the signed-in user's e-mail>` (`idUserEmail.ts`: lower case, marks of letters dropped, a surname of several words joined with `-`; `jurijs.terentjevs@company.com`). The e-mail is shown under the button; a guest (no e-mail with a domain) cannot press it.
- a member of the ACTIVE organization is made (`organizationMemberTable`, the same row as the Invite of Organization members) and, for an e-mail nobody has used yet, the invitation is sent by the Edge Function `organization-invite` (Supabase makes the user of that e-mail; `createUserFromIdDocument.ts`). **An invitation e-mail really goes to that address.**
- when it is done the button reads **User created.** and stays off (an e-mail that is a member already: "User already exists."). A refusal (only an administrator of the organization may add members) is written under the button; a member made but an invitation that could not be sent is written there too.
Tests: `__tests__/media/createUserFromIdDocument.test.tsx`, `idCardPostOffer.test.tsx`.

## Cards under the Read button (2026-11-24)
"Password of the document (only if it asks for one)" and "What this reader does" show their TITLE and a **more...** link (`ExpandableCard.tsx`); the link opens the text and the inputs, **less** closes them. The password card opens by itself when the document asks for its password (`needs-password`). Tests: `__tests__/media/idScreen.test.tsx`.
