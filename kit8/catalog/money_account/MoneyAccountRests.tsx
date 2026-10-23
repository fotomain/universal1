// MoneyAccountRests - the REST of a money account (cash_account_ledger_rests): what the account holds now per sum kind and currency, and the rests day by day. The database builds them from the posted payment
// facts and rebuilds them when an exchange rate changes; this panel only READS them. The button "Refresh rests" lets the database work off the queue of the rate changes now (the app also works without pg_cron).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { useSupabase } from '../../providers/WithSupabase';
import ButtonApp from '../../ui/components/common/ButtonApp';
import { pmT } from '../../pm/i18n/pmT';
import type { DefRow } from '../product/productModel';
import { REST_SUM_KINDS, RestRow, latestRests, parseRests } from './moneyAccountModel';

const money = (n: number): string => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MoneyAccountRests({ account, testID = 'money-account-rests' }: { account: DefRow<any> | null; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const [rests, setRests] = useState<RestRow[]>([]);
  const [queue, setQueue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const guid = account?.rowGUID ?? '';

  const load = useCallback(async () => {
    if (!guid) { setRests([]); return; }
    try {
      const { data, error: e } = await (supabase as any).from('cash_account_ledger_rests').select('*').eq('moneyAccount', guid).order('periodDay', { ascending: true });
      if (e) throw e;
      setRests(parseRests(data));
      const q = await (supabase as any).rpc('cash_ledger_queue_length');
      setQueue(q?.error ? null : Number(q?.data));
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [supabase, guid]);
  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setBusy(true);
    try {
      const { error: e } = await (supabase as any).rpc('cash_ledger_refresh_now');
      if (e) throw e;
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const now = useMemo(() => latestRests(rests, account), [rests, account]);
  const days = useMemo(() => rests.slice().sort((a, b) => b.periodDay.localeCompare(a.periodDay) || a.sumKind.localeCompare(b.sumKind)), [rests]);

  if (!account) return <Text testID={`${testID}-none`} style={{ color: c.text, opacity: 0.6, padding: 12 }}>{pmT('Pick a money account to see its rests.')}</Text>;
  return (
    <View testID={testID} style={[styles.box, { borderColor: c.border }]}>
      <View style={styles.head}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{pmT('Rests')} · {String(account.rowJSON?.moneyAccountTitle ?? account.rowGUID)}</Text>
        <View style={{ flex: 1 }} />
        {queue ? <Text testID={`${testID}-queue`} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{queue} {pmT('exchange rate changes wait')}</Text> : null}
        <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh rests')} icon="refresh" variant="text" size="small" disabled={busy} onPress={() => { void refresh(); }} />
      </View>
      {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, fontSize: 12 }}>{error}</Text>}
      <View testID={`${testID}-now`} style={styles.now}>
        {now.length === 0 && <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('No posted payment on this account yet.')}</Text>}
        {now.map((r) => (
          <View key={`${r.kind}|${r.currency}`} testID={`${testID}-now-${r.kind}-${r.currency}`} style={[styles.chip, { borderColor: c.border }]}>
            <Text style={{ color: c.text, opacity: 0.65, fontSize: 11 }}>{pmT(REST_SUM_KINDS.find((k) => k.id === r.kind)?.title ?? r.kind)}{r.day ? ` · ${r.day}` : ''}</Text>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{money(r.rest)} {r.currency}</Text>
          </View>
        ))}
      </View>
      {days.length > 0 && (
        <View testID={`${testID}-days`}>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            {['Day', 'Rest of', 'Currency', 'Turnover', 'Rest'].map((h) => <Text key={h} style={[styles.cell, { color: c.text, fontWeight: '700' }]}>{pmT(h)}</Text>)}
          </View>
          {days.slice(0, 200).map((r) => (
            <View key={`${r.sumKind}|${r.currency}|${r.periodDay}`} style={[styles.row, { borderBottomColor: c.border }]}>
              <Text style={[styles.cell, { color: c.text }]}>{r.periodDay}</Text>
              <Text style={[styles.cell, { color: c.text }]}>{pmT(REST_SUM_KINDS.find((k) => k.id === r.sumKind)?.title ?? r.sumKind)}</Text>
              <Text style={[styles.cell, { color: c.text }]}>{r.currency}</Text>
              <Text style={[styles.cell, { color: c.text }]}>{money(r.turnover)}</Text>
              <Text style={[styles.cell, { color: c.text, fontWeight: '700' }]}>{money(r.rest)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, margin: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  now: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  cell: { flex: 1, fontSize: 12 },
});
