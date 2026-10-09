// CurrencyExchangeEdit - route /currency/exchange/edit?currencyGUID=… (new rate) or …&rowGUID=… (existing).
// One rate per currency, day and RATE TYPE (Default | Budget, as D365 FO): rowParentGUID = the day, or 'day|Budget', checked here (and by a unique index in SQL).
// Live: the row follows Supabase Realtime. Changed in another browser while this form is clean -> the
// form shows the new values; while it has unsaved edits -> a banner offers Reload / Keep mine.
// Deleted in another browser -> the form says so and cannot save.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, TextInputApp } from '../../../ui/components/common';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { matchRow } from '../../../redux/reusable/realtimeRows';
import CurrencyRealtimeBadge from '../CurrencyRealtimeBadge';
import { CURRENCY_ENTITY, CURRENCY_READ_PARAMS, CurrencyRow } from '../currencyModel';
import {
  addDays,
  CURRENCY_EXCHANGE_ENTITY,
  CURRENCY_EXCHANGE_ROUTES,
  CurrencyExchangeErrors,
  CurrencyExchangeRow,
  CurrencyExchangeRowJSON,
  emptyRate,
  exchangeReadParams,
  formatDay,
  isValidISODate,
  normalizeRate,
  orderInListForDate,
  rateKeyOf,
  RATE_TYPES,
  rateTypeOf,
  todayISO,
  validateRate,
} from './currencyExchangeModel';

type Form = { startingDate: string; currencyRatio: string; rateType: string };

const toForm = (j?: Partial<CurrencyExchangeRowJSON>): Form => {
  const v = { ...emptyRate(), ...(j || {}) };
  return { startingDate: v.startingDate, currencyRatio: Number.isFinite(Number(v.currencyRatio)) ? String(v.currencyRatio) : '', rateType: rateTypeOf({ rowJSON: v }) };
};
const rowVersion = (r?: CurrencyExchangeRow) => (r ? `${r.updated_at ?? ''}|${r.rowParentGUID}|${JSON.stringify(r.rowJSON)}` : '');

export default function CurrencyExchangeEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ currencyGUID?: string; rowGUID?: string }>();
  const currencyGUID = typeof params.currencyGUID === 'string' && params.currencyGUID ? params.currencyGUID : '';
  const rowGUID = typeof params.rowGUID === 'string' && params.rowGUID ? params.rowGUID : null;

  useRealtimeEntity(CURRENCY_ENTITY, { readParams: CURRENCY_READ_PARAMS });
  const currency: CurrencyRow | undefined = useSelector((s: any) => (s?.[CURRENCY_ENTITY]?.entityDataFromServer || []).find((r: any) => r.rowGUID === currencyGUID));
  const code = currency?.rowJSON?.currencyCode || '';

  const readParams = useMemo(() => exchangeReadParams(currencyGUID), [currencyGUID]);
  const status = useRealtimeEntity(CURRENCY_EXCHANGE_ENTITY, { readParams, enabled: !!currencyGUID });
  const actions = SystemMetaData[CURRENCY_EXCHANGE_ENTITY]?.actions;
  const all: CurrencyExchangeRow[] = useSelector((s: any) => s?.[CURRENCY_EXCHANGE_ENTITY]?.entityDataFromServer) || [];
  const loaded = useSelector((s: any) => s?.[CURRENCY_EXCHANGE_ENTITY]?.readSuccessful === 1);
  const rows = useMemo(() => all.filter((r) => matchRow(r, { rowOwnerGUID: currencyGUID })), [all, currencyGUID]);
  const row = useMemo(() => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined), [rows, rowGUID]);

  const [form, setForm] = useState<Form>(() => toForm(row?.rowJSON));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<CurrencyExchangeErrors>({});
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seenVersion = useRef<string>('');
  const everSeen = useRef(false);

  // another rate / a new one: fresh form
  useEffect(() => {
    setForm(toForm(row?.rowJSON));
    setDirty(false);
    setErrors({});
    setRemoteChanged(false);
    setConfirmDelete(false);
    seenVersion.current = rowVersion(row);
    everSeen.current = !!row;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowGUID, currencyGUID]);

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
    setErrors((e) => ({ ...e, [k]: undefined, ...(k === 'startingDate' || k === 'rateType' ? { duplicateRowGUID: undefined } : {}) }));
  };
  const back = () => router.replace({ pathname: CURRENCY_EXCHANGE_ROUTES.list, params: { currencyGUID } } as any);
  const openRow = (id: string) => router.replace({ pathname: CURRENCY_EXCHANGE_ROUTES.edit, params: { currencyGUID, rowGUID: id } } as any);

  const save = () => {
    const value = normalizeRate(form);
    const e = validateRate(value, rows, currencyGUID, rowGUID);
    setErrors(e);
    if (Object.keys(e).length || !actions || !currencyGUID) return;
    if (rowGUID) {
      dispatch(
        actions.updateOne({
          rowGUID,
          rowOwnerGUID: currencyGUID,
          rowJSON: value,
          orderInList: orderInListForDate(value.startingDate),
          // the day (and the rate type) is the row's key: moving the rate to another day / type moves rowParentGUID too
          columns: { rowParentGUID: rateKeyOf(value.startingDate, value.rateType) },
        })
      );
    } else {
      dispatch(
        actions.createOne({
          rowGUID: Crypto.randomUUID(),
          rowOwnerGUID: currencyGUID,
          rowParentGUID: rateKeyOf(value.startingDate, value.rateType),
          orderInList: orderInListForDate(value.startingDate),
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
    dispatch(actions.deleteOne({ rowGUID, rowOwnerGUID: currencyGUID }));
    back();
  };

  const shiftDay = (n: number) => set('startingDate', addDays(form.startingDate, n));

  if (!currencyGUID) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]} testID="currency-exchange-edit-no-currency">
        <Text style={{ color: c.text }}>Open a currency first, then its rates.</Text>
      </View>
    );
  }

  const dayValid = isValidISODate(form.startingDate);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" testID="currency-exchange-edit">
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]} testID="currency-exchange-edit-title">
          {rowGUID ? `${code || 'Currency'} rate` : `New ${code || ''} rate`.replace('  ', ' ')}
        </Text>
        <CurrencyRealtimeBadge status={status} />
      </View>

      {remoteChanged && (
        <View style={[styles.banner, { borderColor: c.primary, backgroundColor: `${c.primary}14` }]} testID="currency-exchange-edit-remote-changed">
          <Text style={{ color: c.text, flex: 1 }}>This rate was changed in another window.</Text>
          <ButtonTextApp
            testID="currency-exchange-edit-reload"
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
            testID="currency-exchange-edit-keep"
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
        <View style={[styles.banner, { borderColor: c.error }]} testID="currency-exchange-edit-gone">
          <Text style={{ color: c.error }}>{deletedElsewhere ? 'This rate was deleted in another window.' : 'Rate not found.'}</Text>
        </View>
      )}

      <TextInputApp
        testID="currency-exchange-edit-startingDate"
        label="Starting date (YYYY-MM-DD)"
        value={form.startingDate}
        onChangeText={(v: string) => set('startingDate', v)}
        error={errors.startingDate}
        showError={!!errors.startingDate}
        maxLength={10}
        helperText={dayValid ? formatDay(form.startingDate) : undefined}
      />
      <View style={styles.dayRow}>
        <ButtonTextApp testID="currency-exchange-edit-prev-day" onPress={() => shiftDay(-1)}>
          − 1 day
        </ButtonTextApp>
        <ButtonTextApp testID="currency-exchange-edit-today" onPress={() => set('startingDate', todayISO())}>
          Today
        </ButtonTextApp>
        <ButtonTextApp testID="currency-exchange-edit-next-day" onPress={() => shiftDay(1)}>
          + 1 day
        </ButtonTextApp>
      </View>
      <SegmentButtonsApp
        testID="currency-exchange-edit-rateType"
        value={form.rateType}
        onValueChange={(v: string) => set('rateType', v)}
        buttons={RATE_TYPES.map((t) => ({ value: t.value, label: t.label, testID: `currency-exchange-edit-rateType-${t.value}` }))}
      />
      <Text style={[styles.hint, { color: c.text, marginTop: 4, marginBottom: 8, textAlign: 'left' }]}>{RATE_TYPES.find((t) => t.value === form.rateType)?.hint ?? ''}</Text>
      {errors.duplicateRowGUID ? (
        <Pressable onPress={() => openRow(errors.duplicateRowGUID!)} accessibilityRole="link" testID="currency-exchange-edit-open-duplicate">
          <Text style={[styles.link, { color: c.primary }]}>Open the rate of {form.startingDate}</Text>
        </Pressable>
      ) : null}

      <TextInputApp
        testID="currency-exchange-edit-currencyRatio"
        label={code ? `Ratio (${code})` : 'Ratio'}
        value={form.currencyRatio}
        onChangeText={(v: string) => set('currencyRatio', v)}
        error={errors.currencyRatio}
        showError={!!errors.currencyRatio}
        keyboardType="numeric"
        inputMode="decimal"
        maxLength={24}
      />

      <View style={styles.actions}>
        {rowGUID && !deletedElsewhere && !notFound ? (
          <ButtonTextApp testID="currency-exchange-edit-delete" onPress={remove} color={c.error}>
            {confirmDelete ? 'Press again to sql_for_delete' : 'Delete'}
          </ButtonTextApp>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ButtonTextApp testID="currency-exchange-edit-cancel" onPress={back}>
            Cancel
          </ButtonTextApp>
          <ButtonPrimaryApp testID="currency-exchange-edit-save" onPress={save} disabled={deletedElsewhere || notFound}>
            {rowGUID ? 'Save' : 'Create'}
          </ButtonPrimaryApp>
        </View>
      </View>
      <Text style={[styles.hint, { color: c.text }]}>
        One rate per currency, day and rate type.{Platform.OS === 'web' ? ' Changes appear in every open browser automatically.' : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12, gap: 6 },
  dayRow: { flexDirection: 'row', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  link: { fontWeight: '600', textDecorationLine: 'underline', marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 12, textAlign: 'center' },
});
