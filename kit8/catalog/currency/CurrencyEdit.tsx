// CurrencyEdit - route /currency/edit (new) or /currency/edit?rowGUID=… (existing).
// Live: the row follows Supabase Realtime. Changed in another browser while this form is clean -> the
// form shows the new values; while it has unsaved edits -> a banner offers Reload / Keep mine.
// Deleted in another browser -> the form says so and cannot save.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../ui/components/common';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from './CurrencyRealtimeBadge';
import IconApp from '../../ui/components/common/IconApp';
import { CURRENCY_EXCHANGE_ROUTES } from './exchange/currencyExchangeModel';
import {
  CURRENCY_CATALOG_OWNER,
  CURRENCY_ENTITY,
  CURRENCY_READ_PARAMS,
  CURRENCY_ROUTES,
  CurrencyErrors,
  CurrencyRow,
  CurrencyRowJSON,
  emptyCurrency,
  normalizeCurrency,
  validateCurrency,
} from './currencyModel';

type Form = { currencyCode: string; currencyName: string; currencySymbol: string; currencyNumericCode: string; decimalDigits: string; isActive: boolean };

const toForm = (j?: Partial<CurrencyRowJSON>): Form => {
  const v = { ...emptyCurrency(), ...(j || {}) };
  return {
    currencyCode: v.currencyCode,
    currencyName: v.currencyName,
    currencySymbol: v.currencySymbol,
    currencyNumericCode: v.currencyNumericCode || '',
    decimalDigits: String(v.decimalDigits ?? 2),
    isActive: v.isActive !== false,
  };
};
const fromForm = (f: Form): CurrencyRowJSON => normalizeCurrency({ ...f, decimalDigits: f.decimalDigits === '' ? NaN : Number(f.decimalDigits) });
const rowVersion = (r?: CurrencyRow) => (r ? `${r.updated_at ?? ''}|${JSON.stringify(r.rowJSON)}` : '');

export default function CurrencyEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ rowGUID?: string }>();
  const rowGUID = typeof params.rowGUID === 'string' && params.rowGUID ? params.rowGUID : null;
  const status = useRealtimeEntity(CURRENCY_ENTITY, { readParams: CURRENCY_READ_PARAMS });
  const actions = SystemMetaData[CURRENCY_ENTITY]?.actions;
  const rows: CurrencyRow[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const loaded = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.readSuccessful === 1);
  const row = useMemo(() => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined), [rows, rowGUID]);

  const [form, setForm] = useState<Form>(() => toForm(row?.rowJSON));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<CurrencyErrors>({});
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seenVersion = useRef<string>('');
  const everSeen = useRef(false);

  // a different currency / a new one: fresh form
  useEffect(() => {
    setForm(toForm(row?.rowJSON));
    setDirty(false);
    setErrors({});
    setRemoteChanged(false);
    setConfirmDelete(false);
    seenVersion.current = rowVersion(row);
    everSeen.current = !!row;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowGUID]);

  // realtime: the row changed on the server (this or another browser)
  useEffect(() => {
    if (!row) return;
    everSeen.current = true;
    const v = rowVersion(row);
    if (v === seenVersion.current) return;
    if (!seenVersion.current || !dirty) {
      seenVersion.current = v;
      setForm(toForm(row.rowJSON));
      setRemoteChanged(false);
    } else {
      setRemoteChanged(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const deletedElsewhere = !!rowGUID && everSeen.current && !row && loaded;
  const notFound = !!rowGUID && !everSeen.current && !row && loaded;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const back = () => router.replace(CURRENCY_ROUTES.list as any);

  const save = () => {
    const value = fromForm(form);
    const e = validateCurrency(value, rows, rowGUID);
    setErrors(e);
    if (Object.keys(e).length || !actions) return;
    if (rowGUID) {
      dispatch(actions.updateOne({ rowGUID, rowOwnerGUID: row?.rowOwnerGUID ?? CURRENCY_CATALOG_OWNER, rowJSON: value }));
    } else {
      dispatch(
        actions.createOne({
          rowGUID: Crypto.randomUUID(),
          rowOwnerGUID: CURRENCY_CATALOG_OWNER,
          rowParentGUID: 'empty',
          orderInList: Date.now(),
          rowJSON: value,
        })
      );
    }
    setDirty(false);
    back();
  };

  const remove = () => {
    if (!rowGUID || !actions) return;
    if (!confirmDelete) return setConfirmDelete(true);
    dispatch(actions.deleteOne({ rowGUID, rowOwnerGUID: row?.rowOwnerGUID ?? CURRENCY_CATALOG_OWNER }));
    back();
  };

  const input = (k: keyof Form, label: string, extra: any = {}) => (
    <TextInputApp
      testID={`currency-edit-${k}`}
      label={label}
      value={String(form[k] ?? '')}
      onChangeText={(v: string) => set(k, v as any)}
      error={errors[k as keyof CurrencyErrors]}
      showError={!!errors[k as keyof CurrencyErrors]}
      {...extra}
    />
  );

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" testID="currency-edit">
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>{rowGUID ? `Currency ${row?.rowJSON.currencyCode ?? ''}` : 'New currency'}</Text>
        <CurrencyRealtimeBadge status={status} />
      </View>
      {/* hyperlink "Rates" only for a saved currency (the rates' rowOwnerGUID is its rowGUID) */}
      {rowGUID && row ? (
        <Pressable
          testID="currency-edit-rates"
          accessibilityRole="link"
          onPress={() => router.push({ pathname: CURRENCY_EXCHANGE_ROUTES.list, params: { currencyGUID: rowGUID } } as any)}
          style={styles.ratesLink}
        >
          <IconApp name="currency_exchange" size={18} color={c.primary} />
          <Text style={{ color: c.primary, fontWeight: '600', textDecorationLine: 'underline' }}>Rates</Text>
        </Pressable>
      ) : null}

      {remoteChanged && (
        <View style={[styles.banner, { borderColor: c.primary, backgroundColor: `${c.primary}14` }]} testID="currency-edit-remote-changed">
          <Text style={{ color: c.text, flex: 1 }}>This currency was changed in another window.</Text>
          <ButtonTextApp
            testID="currency-edit-reload"
            onPress={() => {
              seenVersion.current = rowVersion(row);
              setForm(toForm(row?.rowJSON));
              setDirty(false);
              setRemoteChanged(false);
            }}
          >
            Reload
          </ButtonTextApp>
          <ButtonTextApp
            testID="currency-edit-keep"
            onPress={() => {
              seenVersion.current = rowVersion(row);
              setRemoteChanged(false);
            }}
          >
            Keep mine
          </ButtonTextApp>
        </View>
      )}
      {(deletedElsewhere || notFound) && (
        <View style={[styles.banner, { borderColor: c.error }]} testID="currency-edit-gone">
          <Text style={{ color: c.error }}>{deletedElsewhere ? 'This currency was deleted in another window.' : 'Currency not found.'}</Text>
        </View>
      )}

      {input('currencyCode', 'Code (ISO 4217, e.g. EUR)', { autoCapitalize: 'characters', maxLength: 3 })}
      {input('currencyName', 'Name', { maxLength: 60 })}
      {input('currencySymbol', 'Symbol', { maxLength: 5 })}
      {input('currencyNumericCode', 'Numeric code (optional, e.g. 978)', { keyboardType: 'numeric', maxLength: 3 })}
      {input('decimalDigits', 'Decimals (0-4)', { keyboardType: 'numeric', maxLength: 1 })}
      <SwitchApp testID="currency-edit-isActive" label="Active" value={form.isActive} onValueChange={(v) => set('isActive', v)} />

      <View style={styles.actions}>
        {rowGUID && !deletedElsewhere && !notFound ? (
          <ButtonTextApp testID="currency-edit-delete" onPress={remove} color={c.error}>
            {confirmDelete ? 'Press again to sql_for_delete' : 'Delete'}
          </ButtonTextApp>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ButtonTextApp testID="currency-edit-cancel" onPress={back}>
            Cancel
          </ButtonTextApp>
          <ButtonPrimaryApp testID="currency-edit-save" onPress={save} disabled={deletedElsewhere || notFound}>
            {rowGUID ? 'Save' : 'Create'}
          </ButtonPrimaryApp>
        </View>
      </View>
      {Platform.OS === 'web' && <Text style={[styles.hint, { color: c.text }]}>Changes appear in every open browser automatically.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  ratesLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12, gap: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 12, textAlign: 'center' },
});
