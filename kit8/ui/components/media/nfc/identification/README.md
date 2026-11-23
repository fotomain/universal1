# Identification: 1 ID or passport? -> 2 photo -> 3 text recognised on the phone -> 4 NFC scan

Route `/media/nfc/identification`, Drawer **Scan -> Identification**. Built 2026-11-19 from the plan `documentation/PASSPORT_1ST_PHOTO_2ND_SCAN.html`.
The user no longer types the document number and the two dates: the app reads them from a photo of the machine readable zone (MRZ) and the NFC scan
(`../iddocread`, unchanged) opens the chip with them. **Not tried with a real document yet.**

| Step | File | What |
|---|---|---|
| 1 ID card or passport? | `DocumentTypeStep.tsx`, `lastDocumentType.ts` | two buttons (the last choice is remembered on the device); "Type the values" skips the photo |
| 2 photo | `MrzPhotoStep.tsx` (+ `.web`) | Vision Camera `takePhoto`, **no strict frame** (the whole document anywhere in the picture), torch, zoom; the photo is made upright + at most 2000 px (`expo-image-manipulator`), read, and **deleted at once** (never saved or shown) |
| 3 read + confirm | `aiRecognize.ts` + `aiResult.ts` (Google AI, opt-in), `ocrEngine.ts` (+ `.web`) + `mrzFromText.ts` (this phone), `MrzConfirmStep.tsx` | **Google AI** (Gemini) when the user switched "Read with Google AI" on: the photo is sent, the answer is checked with the check digits; **this phone** (`expo-mlkit-ocr`, ML Kit) otherwise and as the fallback when Google AI fails or finds nothing. Three editable values with a check mark each + the CAN when printed; **the scan starts only after the user confirms** |
| 4 scan | `IdentificationFlow.tsx` -> `../iddocread/IdCardReader` (`initialForm`) | "Read from document" with the confirmed values (PACE-MRZ / BAC) |

Everything (values, recognised text) is wiped when the screen is left. The web has no camera step and no OCR yet (`MrzPhotoStep.web.tsx`: type the values); a browser cannot read the chip anyway.

## Google AI (added 2026-11-19)

The photo of the whole document goes to the Gemini API with a FIXED prompt and a JSON schema (`supabase/functions/identification-recognize/handler.ts`: `SYSTEM_PROMPT`, `RESPONSE_SCHEMA`; the README there). Two transports, the same code:
the app calls the API **directly from React Native** when `.env GOOGLE_AI_API_KEY` is set (`app.config.js` -> `extra.googleAiApiKey`; the key is then inside the app - restrict it), else through the Edge Function (signed-in users, the key stays on the server).
- **Opt-in:** the switch "Read with Google AI" is OFF by default and remembered on the device (`aiConsent.ts`); the screen says the photo is SENT to Google when it is on.
- **Not trusted blindly:** the zone lines it returns go through `mrzFromText` (repair + check digits). A zone that passes = trusted (and the printed fields are a second opinion: a difference is shown as a note); a zone that fails = the printed fields are shown and marked "no check digits"; nothing usable = this phone reads the photo.
- **CAN:** a CAN printed on the front of an ID card is returned and fills the CAN field and step 4 (shown with a note to check it).
- **Failures** (offline, quota, key refused, blocked) fall back to this phone and say so on the confirm step. The key never appears in an error or a log.

### The front of the card (added 2026-11-19, after the first test with a Latvian ID card)
The first photo was the FRONT of the card: no machine readable zone. This phone read the printed text well (number, name, dates, a lone 6-digit number) but the zone finder accepted ordinary words ("PERSONAL", "NATIONALITY") as zone lines and filled junk values.
- **Fixed:** a candidate zone needs at least 6 filler characters `<` (`MIN_FILLERS`); no zone = no values (test with the recognised text of that card, values changed).
- **Google AI from the TEXT - ALWAYS AUTOMATIC (2026-11-23, owner: "must always"):** right after EVERY photo, whatever this phone found (no zone, a bad zone or a checked zone), the recognised LINES (no picture) go to Gemini by themselves (`recognizeTextWithAi`, prompt `textPrompt` in the function's `handler.ts`) and the values, the printed names and a **CAN candidate** come back. There is NO switch for it any more (the old switch "Let Google AI read the recognised text by itself" and `loadAiTextConsent` were removed); it needs the key in the app or a signed-in user (the screen is for signed-in users only). **It asks again by itself** (`aiTextRetry.ts`, `readTextWithAiRetry`): up to 3 calls (pauses 0.7 s, 1.5 s) when a call fails for a moment (busy, lost connection, timeout) or answers without a complete set of values; a refusal that another call cannot change (key refused, bad request, blocked, too big, no key on the server) is not repeated. When it still fails, the confirm step says so in its MAIN line (`Google AI (text): ... (tried 3 times)`), not only behind "more...", and the button asks again. Not covered: this phone's OCR returning NO text at all (nothing to send; the photo itself goes to Google AI only with the "Read with Google AI" switch). `mergeTextRecognition` (`MrzPhotoStep.tsx`): a zone of this phone that passed its check digits keeps the three values (the check digits are the proof) and Google AI adds the CAN, the printed name and its notes; otherwise Google AI's complete values replace the phone's. The button **Ask Google AI to read the recognised text** on the confirm step stays VISIBLE whenever there is recognised text ("again" after an answer) - to ask once more after a failure, or when the switch is off. The separate switch "Read with Google AI" (default OFF) sends the PHOTO.
- **CAN candidate:** a lone, unlabelled 6-digit number on the front (the Latvian ID card has one near the signature) is returned as `canCandidate` and filled into the CAN field with a note to check it; a wrong CAN is harmless (the scan falls back to the number and the dates).
- Values from printed fields have no check digits (`fields` confidence): compare them with the document. Measured live with synthetic front text: 7.8 s, number, dates, names, personal number and the CAN candidate all right.

## `mrzFromText` (pure, `__tests__/media/mrzFromText.test.ts`)

1. each OCR line -> the MRZ alphabet (upper case, `A-Z 0-9 <`; `« ‹` = `<`; a run of K / C / E / L / X / S at the end of a line = filler);
2. runs of 2 or 3 lines of about 44 / 36 / 30 characters (the expected format of step 1 first; the zone may also come as one long string); each line is padded / cut to the exact length;
3. repair by field class (position tables for TD1 / TD2 / TD3): digit positions `O Q D I L B S Z G -> 0 0 0 1 1 8 5 2 6`, letter positions the other way, sex `M F <`;
4. the check digits decide (`mrz.ts` `parseMrz`): when they disagree the confusable characters of the document number and the dates are swapped (at most 2^8 combinations) until they agree;
5. result `confidence`: `checked` = number, birth date, expiry date AND the composite digit agree; `partly` = the three agree; `unchecked` = the user must look.

## The spike (2026-11-19): which text recognition for the phone

| Candidate | Android | iOS | Result |
|---|---|---|---|
| `expo-mlkit-ocr` 0.2.7 | `com.google.mlkit:text-recognition:16.0.1` = the **bundled** model (offline from the first start); blocks -> lines -> elements with boxes | ML Kit pod `GoogleMLKit/TextRecognition ~> 7.0` (needs iOS 16, the SDK default is 16.4+; Apple Vision as the fallback on the simulator, plugin option `iosEngine: 'auto'`) | **chosen.** The Kotlin module COMPILES against this project's Expo SDK 57 / RN 0.86 (`./gradlew :expo-mlkit-ocr:compileDebugKotlin`: BUILD SUCCESSFUL). iOS could NOT be compiled (this Mac has no Xcode). |
| `expo-text-extractor` 2.0.0 | `play-services-mlkit-text-recognition` = the UNBUNDLED model (downloaded through Google Play services on first use: not offline at once); text blocks only, no boxes | Apple Vision with language correction ON (it "corrects" the `<<<` and the codes) and the camera orientation ignored | not chosen |
| own module | - | - | the fallback if `expo-mlkit-ocr` fails on a device (about 150 lines) |

**Still open (needs the phone):** does ML Kit read the Latvian ID card's zone well? The confirm step has "Show recognised text" - look at what the engine saw when a value is wrong and send it. Cropping the lower band of the photo before the recognition is NOT done (the guide frame and the sensor photo have different aspect ratios); add it if the full photo reads badly.

## Files

`IdentificationFlow.tsx` · `DocumentTypeStep.tsx` · `MrzPhotoStep.tsx` (+ `.web`) · `MrzConfirmStep.tsx` · `mrzFromText.ts` · `ocrEngine.ts` (+ `.web`) · `aiRecognize.ts` · `aiResult.ts` · `aiConsent.ts` · `confirmedValues.ts` · `identificationTypes.ts` · `lastDocumentType.ts`.
Tests: `__tests__/media/mrzFromText.test.ts`, `aiResult.test.ts`, `aiRecognize.test.ts`, `identificationFunction.test.ts`, `identificationFlow.test.tsx` (fake camera, fake OCR, the software card of the ID reader tests).
The package `expo-mlkit-ocr` is native code: a dev build is needed (Expo Go cannot run it); `app.config.js` has the plugin `['expo-mlkit-ocr', { iosEngine: 'auto' }]`; do NOT set an iOS deployment target below 16.4 (Expo SDK 57 refuses the whole config; the default is fine for ML Kit).
