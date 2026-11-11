// MyPersonSection - on the user profile: a user and his person are independent (documentation/PERMISSIONS_WBS.html section 4.6). The person is found by the e-mail of the user. A user without one
// presses "Create my person" (RPC person_create_own, the name comes from his user row); the administrator can do the same for a member (Organization members -> row menu).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSupabase } from '../../providers/WithSupabase';
import { ButtonPrimaryApp } from '../../ui/components/common';
import { pmT } from '../../pm/i18n/pmT';

export type MyPersonState = 'unknown' | 'none' | 'exists';

/** the state of the person of an e-mail from the rows of personTable that carry it */
export const myPersonStateOf = (rows: unknown): MyPersonState => (Array.isArray(rows) ? (rows.length > 0 ? 'exists' : 'none') : 'unknown');

export default function MyPersonSection({ email, textColor, testID = 'my-person' }: { email: string; textColor?: string; testID?: string }) {
  const { supabase } = useSupabase();
  const [state, setState] = useState<MyPersonState>('unknown');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mail = (email || '').trim().toLowerCase();

  const read = useCallback(async () => {
    if (!mail) { setState('unknown'); return; }
    try {
      const { data, error: e } = await (supabase as any).from('personTable').select('rowGUID').eq('rowJSON->>personEmail', mail).limit(1);
      setState(e ? 'unknown' : myPersonStateOf(data));
    } catch {
      setState('unknown');
    }
  }, [supabase, mail]);
  useEffect(() => { void read(); }, [read]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: e } = await (supabase as any).rpc('person_create_own');
      if (e) throw e;
      await read();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (state === 'unknown' && !error) return null;
  return (
    <View testID={testID} style={styles.box}>
      <Text style={[styles.label, textColor ? { color: textColor } : null]}>{pmT('Person')}</Text>
      {state === 'exists' ? (
        <Text testID={`${testID}-exists`} style={textColor ? { color: textColor } : null}>{pmT('Your person exists.')}</Text>
      ) : (
        <ButtonPrimaryApp testID={`${testID}-create`} title={pmT('Create my person')} onPress={create} disabled={busy} />
      )}
      {!!error && <Text testID={`${testID}-error`} style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8, gap: 6 },
  label: { fontWeight: '600' },
  error: { color: '#b3261e' },
});
