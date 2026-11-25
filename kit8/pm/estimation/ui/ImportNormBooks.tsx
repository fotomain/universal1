// ImportNormBooks - the window that reads norm books into the app: one or more files (a .zip or .xml of an official norm book, or a zip made by ExportNormBooks) -> the tree World Norms (v2) ->
// continent -> country -> book. The prices of an imported book are converted into the currency of the book (default EUR) at the rate typed here (the rate of the day is read from the rate
// book when there is one) and the original price is kept. The titles: with "Translate to English" (Google AI, off by default) the English text is the main one and both texts are stored in
// catalogTranslationTable; without it the original text stays the title. The work is done by importNormBooks / importNormBookZip (no React) and can be cancelled between batches.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { pickFiles } from '../../../files/common/pickFiles';
import { aiConfig } from '../../../ui/components/media/nfc/identification/aiRecognize';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { COUNTRIES } from '../model/normBookModel';
import { importNormBookZip, NORM_ZIP_FORMAT } from '../export/normBookZip';
import { importNormBooks, supabaseNormStore, type NormInputFile } from '../import/importNormBooks';
import { geminiTranslator } from '../import/normTranslator';
import { readCurrencyRate } from '../../view/project/estimation/estimationApi';

export interface ImportNormBooksProps {
  visible: boolean;
  client: any;
  canTranslate: boolean;
  onClose: (changed: boolean) => void;
  testID?: string;
}

const isZipOfApp = (bytes: Uint8Array): boolean => { try { return new TextDecoder().decode(bytes.subarray(0, 4000)).includes('manifest.json'); } catch { return false; } };

export default function ImportNormBooks({ visible, client, canTranslate, onClose, testID = 'import-norm-books' }: ImportNormBooksProps) {
  const { themeColors: c } = useDesignSystem();
  const [files, setFiles] = useState<NormInputFile[]>([]);
  const [country, setCountry] = useState('RU');
  const [bookCode, setBookCode] = useState('FSNB-2022');
  const [bookTitle, setBookTitle] = useState('FSNB-2022');
  const [version, setVersion] = useState('');
  const [language, setLanguage] = useState('ru');
  const [sourceCurrency, setSourceCurrency] = useState('RUB');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const [rate, setRate] = useState('');
  const [translate, setTranslate] = useState(false);
  const [originals, setOriginals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const cancel = useRef(false);
  const ai = aiConfig();

  useEffect(() => { if (visible) { setMessage(''); setError(''); } }, [visible]);
  // the rate of the day from the rate book (the user can type another)
  useEffect(() => {
    if (!visible || !client || !sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return;
    let alive = true;
    readCurrencyRate(client, sourceCurrency.toUpperCase(), targetCurrency.toUpperCase(), new Date().toISOString().slice(0, 10)).then((r) => { if (alive && r) setRate(String(Number(r.toPrecision(6)))); }).catch(() => {});
    return () => { alive = false; };
  }, [visible, client, sourceCurrency, targetCurrency]);

  const pick = async () => {
    setError('');
    const picked = await pickFiles();
    const read: NormInputFile[] = [];
    for (const f of picked) read.push({ name: f.name, bytes: new Uint8Array(await (f.blob as Blob).arrayBuffer()) });
    setFiles(read);
    if (read[0] && !version) setVersion(new Date().toISOString().slice(0, 10));
  };

  const run = async () => {
    cancel.current = false;
    setBusy(true);
    setError('');
    setMessage(pmT('Reading the files'));
    try {
      const store = supabaseNormStore(client);
      const appZip = files.length === 1 && files[0].bytes[0] === 0x50 && isZipOfApp(files[0].bytes) && /\.zip$/i.test(files[0].name) && await (async () => { try { const { readNormBookZip } = await import('../export/normBookZip'); readNormBookZip(files[0].bytes); return true; } catch { return false; } })();
      if (appZip) {
        const r = await importNormBookZip(store, files[0].bytes, { onProgress: (p) => setMessage(`${p.step}: ${p.done} / ${p.total}`), isCancelled: () => cancel.current });
        setMessage(r.cancelled ? pmT('Cancelled.') : pmT('Done: {{n}} rows written.', { n: Object.values(r.written).reduce((a, b) => a + b, 0) }));
      } else {
        const fx = Number(rate.replace(',', '.'));
        const translator = translate && ai ? geminiTranslator({ apiKey: ai.apiKey, model: ai.model }) : undefined;
        const r = await importNormBooks(store, {
          files, countryCode: country, bookCode, bookTitle, version: version || new Date().toISOString().slice(0, 10), sourceCurrency: sourceCurrency.toUpperCase(), targetCurrency: targetCurrency.toUpperCase(),
          fxRate: sourceCurrency.toUpperCase() === targetCurrency.toUpperCase() ? 1 : fx, fxDate: new Date().toISOString().slice(0, 10), language, translator, storeOriginals: originals && canTranslate,
          onProgress: (p) => setMessage(`${p.step} - ${p.done}`), isCancelled: () => cancel.current,
        });
        setMessage(r.cancelled ? pmT('Cancelled.') : pmT('Done: {{norms}} norms, {{sections}} sections, {{resources}} resources.', { norms: r.norms, sections: r.sections, resources: r.resources }) + (r.skippedFiles.length ? ` ${pmT('Skipped files: {{n}}.', { n: r.skippedFiles.length })}` : ''));
      }
    } catch (e: any) { setError(String(e?.message ?? e)); setMessage(''); }
    setBusy(false);
  };

  const Field = ({ id, label, value, set, width = 200 }: { id: string; label: string; value: string; set: (v: string) => void; width?: number }) => (
    <View style={{ width, minWidth: 130 }}><TextInputApp testID={`${testID}-${id}`} label={pmT(label)} value={value} disabled={busy} onChangeText={set} /></View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(false); }}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>{pmT('Import norm books')}</Text>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <Text style={{ color: c.text, opacity: 0.75, fontSize: 12 }}>{pmT('Files: a .zip or .xml of a norm book (norms and priced resources), or a .zip made by Export ({{f}}).', { f: NORM_ZIP_FORMAT })}</Text>
            <View style={styles.row}>
              <PMDialogButton testID={`${testID}-pick`} kind="secondary" icon="folder_open" title={pmT('Choose files')} disabled={busy} onPress={() => { void pick(); }} />
              <Text style={{ color: c.text, fontSize: 12 }}>{files.length ? files.map((f) => `${f.name} (${Math.round(f.bytes.length / 1024)} KB)`).join(', ') : pmT('No file chosen')}</Text>
            </View>
            <Text style={[styles.h, { color: c.text }]}>{pmT('Where the book goes in the tree')}</Text>
            <View style={styles.row}>
              <View style={{ width: 200 }}><TextInputApp testID={`${testID}-country`} label={pmT('Country code (ISO)')} value={country} disabled={busy} onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))} helperText={COUNTRIES.find((x) => x.code === country)?.title ?? pmT('Unknown country')} /></View>
              <Field id="code" label="Book code" value={bookCode} set={setBookCode} />
              <Field id="title" label="Book title" value={bookTitle} set={setBookTitle} width={260} />
              <Field id="version" label="Edition / date" value={version} set={setVersion} />
            </View>
            <Text style={[styles.h, { color: c.text }]}>{pmT('Currency')}</Text>
            <View style={styles.row}>
              <Field id="source-currency" label="Currency of the book" value={sourceCurrency} set={(v) => setSourceCurrency(v.toUpperCase().slice(0, 3))} width={150} />
              <Field id="target-currency" label="Convert to" value={targetCurrency} set={(v) => setTargetCurrency(v.toUpperCase().slice(0, 3))} width={150} />
              <Field id="rate" label="Rate (1 unit of the book currency)" value={rate} set={setRate} width={240} />
            </View>
            <Text style={[styles.h, { color: c.text }]}>{pmT('Texts')}</Text>
            <View style={styles.row}>
              <Field id="language" label="Language of the files" value={language} set={(v) => setLanguage(v.toLowerCase().slice(0, 2))} width={150} />
              <View style={{ minWidth: 300 }}><SwitchApp testID={`${testID}-translate`} label={pmT('Translate to English with Google AI (the English text becomes the main one)')} value={translate && !!ai} disabled={busy || !ai} onValueChange={setTranslate} /></View>
              <View style={{ minWidth: 300 }}><SwitchApp testID={`${testID}-originals`} label={pmT('Keep the original texts as translations (catalog translations)')} value={originals && canTranslate} disabled={busy || !canTranslate} onValueChange={setOriginals} /></View>
            </View>
            {!ai && <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('Translation needs a Google AI key in the app settings (GOOGLE_AI_API_KEY).')}</Text>}
            {!!message && <Text testID={`${testID}-message`} style={{ color: c.text, fontWeight: '600' }}>{message}</Text>}
            {!!error && <Text testID={`${testID}-error`} style={{ color: c.error }}>{error}</Text>}
          </ScrollView>
          <View style={styles.row}>
            <PMDialogButton testID={`${testID}-run`} kind="primary" icon="upload" title={pmT('Import')} disabled={busy || !files.length} loading={busy} onPress={() => { void run(); }} />
            <PMDialogButton testID={`${testID}-cancel`} kind="secondary" title={busy ? pmT('Cancel import') : pmT('Close')} onPress={() => (busy ? (cancel.current = true) : onClose(!!message && !error))} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', maxWidth: 880, maxHeight: Platform.OS === 'web' ? '90%' : '92%', borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  h: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
});
