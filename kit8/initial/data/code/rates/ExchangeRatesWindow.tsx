// ExchangeRatesWindow - the SEPARATE window of the exchange rates of the initial data (Q5 of documentation/INITIAL_DATA_WBS.html). Opened after the initial data is ready, and by the button
// "Exchange rates" of the screen Create initial data. The rate of 31 December of the previous year is made by the run itself; here the user may
//   1. fill every day from 1 January of this year to today (the rates service),
//   2. download the template  currencies_reates_import_template.csv,
//   3. import the filled template (a preview first: how many rates, which lines are wrong; rates that exist stay unless the box is checked).
// the ✕ at the top right and the button Close close it; everything can be done later from the currency screens.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import ButtonApp from '../../../../ui/components/common/ButtonApp';
import { currencyRefreshMessage } from '../../../../catalog/currency/refresh/refreshCurrencyRatio';
import { currencyRefreshConfig } from '../../../../catalog/currency/refresh/currencyRefreshConfig';
import { downloadTextFile } from '../../../../pm/crud/exchange/project/export/downloadTextFile';
import { pickFiles } from '../../../../files/common/pickFiles';
import { fillRatesFromYearStart, importRates, readCurrencies } from './ratesApi';
import { buildRatesTemplate, parseRatesCsv, RATES_TEMPLATE_FILE, RatesCsvResult, yearStart } from './ratesModel';
import { todayISO } from '../../../../catalog/currency/exchange/currencyExchangeModel';

export interface ExchangeRatesWindowProps {
  visible: boolean;
  supabase: any;
  onClose: () => void;
  testID?: string;
}

/** the text of a picked file (web File / phone Blob) */
export async function readPickedText(blob: any): Promise<string> {
  if (blob && typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('The file could not be read'));
    reader.readAsText(blob);
  });
}

export default function ExchangeRatesWindow({ visible, supabase, onClose, testID = 'exchange-rates' }: ExchangeRatesWindowProps) {
  const { themeColors: c } = useDesignSystem();
  const base = currencyRefreshConfig().base;
  const today = todayISO();
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ fileName: string; result: RatesCsvResult } | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMessage(null); setProblem(null); setParsed(null); setOverwrite(false);
    readCurrencies(supabase).then(setCurrencies).catch((e) => setProblem(e?.message || String(e)));
  }, [visible, supabase]);

  const guard = useCallback(async (what: string, work: () => Promise<void>) => {
    setBusy(what); setProblem(null); setMessage(null);
    try { await work(); } catch (e: any) { setProblem(e?.message || String(e)); } finally { setBusy(null); }
  }, []);

  const fillYear = () => guard('fill', async () => {
    const r = await fillRatesFromYearStart({ supabase, currencies });
    setMessage(currencyRefreshMessage(r));
  });
  const download = () => guard('download', async () => {
    const res = await downloadTextFile(RATES_TEMPLATE_FILE, buildRatesTemplate(currencies, base, today), 'text/csv');
    setMessage(res === 'dismissed' ? `${RATES_TEMPLATE_FILE} was not saved` : `${RATES_TEMPLATE_FILE} is ready (columns: currencyCode, startingDate, currencyRatio, rateType)`);
  });
  const chooseFile = () => guard('pick', async () => {
    const files = await pickFiles();
    if (!files.length) return;
    const text = await readPickedText(files[0].blob);
    setParsed({ fileName: files[0].name, result: parseRatesCsv(text, currencies, base) });
  });
  const doImport = () => guard('import', async () => {
    if (!parsed || parsed.result.rates.length === 0) return;
    const r = await importRates({ supabase, rates: parsed.result.rates, base, overwrite });
    setMessage(`${r.written} rate(s) written${r.skipped ? `, ${r.skipped} already existed and stayed as they are` : ''}`);
    setParsed(null);
  });

  const res = parsed?.result;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]}>Exchange rates</Text>
            <Pressable testID={`${testID}-close-x`} accessibilityRole="button" accessibilityLabel="Close" disabled={busy === 'fill' || busy === 'import'} onPress={onClose} hitSlop={10} style={[styles.closeX, (busy === 'fill' || busy === 'import') && { opacity: 0.4 }]}>
              <Text style={{ color: c.text, fontSize: 20, lineHeight: 22 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
            <Text style={[styles.note, { color: c.text }]}>
              The rate of 31 December of the previous year is in place. Fill the rest of this year (from {yearStart(today)} to today) now, or later from the currency screens.
              Rates that exist are never changed. All ratios are units of the currency for 1 {base}.
            </Text>
            <ButtonApp testID={`${testID}-fill`} title={`Fill from ${yearStart(today)} to today`} icon="cloud_download" variant="contained" disabled={!!busy || currencies.length === 0} onPress={fillYear} />
            <View style={styles.row}>
              <ButtonApp testID={`${testID}-download`} title={`Download ${RATES_TEMPLATE_FILE}`} icon="download" variant="outlined" size="small" disabled={!!busy || currencies.length === 0} onPress={download} />
              <ButtonApp testID={`${testID}-import`} title="Import from CSV" icon="upload_file" variant="outlined" size="small" disabled={!!busy || currencies.length === 0} onPress={chooseFile} />
            </View>
            {res && (
              <View testID={`${testID}-preview`} style={[styles.preview, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{parsed?.fileName}</Text>
                <Text style={{ color: c.text }}>{res.rates.length} rate(s) can be imported{res.emptyLines ? `, ${res.emptyLines} line(s) without a ratio are skipped` : ''}{res.errors.length ? `, ${res.errors.length} line(s) have a problem` : ''}.</Text>
                {res.errors.slice(0, 8).map((e) => <Text key={e.line} style={{ color: c.error, fontSize: 12 }}>Line {e.line}: {e.message}</Text>)}
                {res.errors.length > 8 && <Text style={{ color: c.error, fontSize: 12 }}>… and {res.errors.length - 8} more</Text>}
                <Pressable testID={`${testID}-overwrite`} accessibilityRole="checkbox" accessibilityState={{ checked: overwrite }} onPress={() => setOverwrite(!overwrite)} style={styles.row}>
                  <Text style={{ color: c.text }}>{overwrite ? '☑' : '☐'} Replace a rate that already exists for the same currency, day and type</Text>
                </Pressable>
                <ButtonApp testID={`${testID}-import-go`} title={`Import ${res.rates.length} rate(s)`} variant="contained" size="small" disabled={!!busy || res.rates.length === 0} onPress={doImport} />
              </View>
            )}
            {busy && <Text testID={`${testID}-busy`} style={{ color: c.text, opacity: 0.7 }}>Working…</Text>}
            {message && <Text testID={`${testID}-message`} style={{ color: c.text }}>{message}</Text>}
            {problem && <Text testID={`${testID}-problem`} style={{ color: c.error }}>{problem}</Text>}
          </ScrollView>
          <View style={styles.buttons}>
            <ButtonApp testID={`${testID}-close`} title="Close" variant="outlined" disabled={busy === 'fill' || busy === 'import'} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 520, maxHeight: '90%', borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeX: { paddingHorizontal: 6, paddingVertical: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  note: { fontSize: 13, opacity: 0.8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  preview: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 6 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
