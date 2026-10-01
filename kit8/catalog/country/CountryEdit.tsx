import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../components/common';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import {
  COUNTRY_CATALOG_OWNER,
  COUNTRY_ENTITY,
  COUNTRY_READ_PARAMS,
  COUNTRY_ROUTES,
  CountryErrors,
  CountryRow,
  CountryRowJSON,
  emptyCountry,
  normalizeCountry,
  validateCountry,
} from './countryModel';
import { useIsAppAdmin } from '../role/useIsAppAdmin';

type Form = {
  countryName: string;
  countryCode: string;
  countryCodeAlpha3: string;
  countryNumericCode: string;
  phonePrefix: string;
  currencyCode: string;
  flagEmoji: string;
  isActive: boolean;
};

const toForm = (j?: Partial<CountryRowJSON>): Form => {
  const v = { ...emptyCountry(), ...(j || {}) };
  return {
    countryName: v.countryName || '',
    countryCode: v.countryCode || '',
    countryCodeAlpha3: v.countryCodeAlpha3 || '',
    countryNumericCode: v.countryNumericCode || '',
    phonePrefix: v.phonePrefix || '',
    currencyCode: v.currencyCode || 'EUR',
    flagEmoji: v.flagEmoji || '',
    isActive: v.isActive !== false,
  };
};

const fromForm = (f: Form): CountryRowJSON =>
  normalizeCountry({
    countryName: f.countryName,
    countryCode: f.countryCode,
    countryCodeAlpha3: f.countryCodeAlpha3,
    countryNumericCode: f.countryNumericCode,
    phonePrefix: f.phonePrefix,
    currencyCode: f.currencyCode,
    flagEmoji: f.flagEmoji,
    isActive: f.isActive,
  });

export default function CountryEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const { rowGUID } = useLocalSearchParams<{ rowGUID?: string }>();
  const isNew = !rowGUID;

  const status = useRealtimeEntity(COUNTRY_ENTITY, { readParams: COUNTRY_READ_PARAMS });
  const rows: CountryRow[] =
    useSelector((s: any) => s?.[COUNTRY_ENTITY]?.entityDataFromServer) || [];

  const existing = useMemo(
    () => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined),
    [rows, rowGUID]
  );

  const [form, setForm] = useState<Form>(() => toForm(existing?.rowJSON));
  const [errors, setErrors] = useState<CountryErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (existing?.rowJSON) {
      setForm(toForm(existing.rowJSON));
    }
  }, [existing]);

  const update = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    const errKey = k as unknown as keyof CountryErrors;
    if (errors[errKey]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[errKey];
        return next;
      });
    }
  };

  const handleSave = () => {
    if (!isAdmin) {
      setSaveError('Permission denied: only roleAppAdmin can modify countries.');
      return;
    }
    const json = fromForm(form);
    const check = validateCountry(json);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }

    const actions = SystemMetaData[COUNTRY_ENTITY]?.actions;
    if (!actions) {
      setSaveError('Country entity actions not found');
      return;
    }

    try {
      if (isNew) {
        const newRowGUID = Crypto.randomUUID();
        dispatch(
          actions.createOne({
            rowGUID: newRowGUID,
            rowOwnerGUID: COUNTRY_CATALOG_OWNER,
            rowParentGUID: 'empty',
            orderInList: Date.now(),
            rowJSON: json,
          })
        );
      } else {
        dispatch(
          actions.updateOne({
            rowGUID: existing!.rowGUID,
            rowOwnerGUID: existing!.rowOwnerGUID || COUNTRY_CATALOG_OWNER,
            rowParentGUID: existing!.rowParentGUID || 'empty',
            orderInList: existing!.orderInList ?? 0,
            rowJSON: json,
          })
        );
      }
      router.replace(COUNTRY_ROUTES.list as any);
    } catch (err: any) {
      setSaveError(err.message || 'Error saving country');
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={styles.container}
      testID="country-edit-screen"
    >
      <View style={styles.topRow}>
        <CurrencyRealtimeBadge status={status} />
        <ButtonTextApp
          testID="country-back"
          title="Back to list"
          onPress={() => router.replace(COUNTRY_ROUTES.list as any)}
        />
      </View>

      <Text style={[styles.title, { color: c.text }]}>
        {isNew ? 'New Country' : 'Edit Country'}
      </Text>

      {saveError && (
        <View style={[styles.banner, { backgroundColor: '#ef444418', borderColor: '#ef4444' }]}>
          <IconApp name="error" size={18} color="#ef4444" />
          <Text style={[styles.bannerText, { color: '#ef4444' }]}>{saveError}</Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Country Details</Text>

        <TextInputApp
          testID="country-input-name"
          label="Country Name *"
          value={form.countryName}
          onChangeText={(v) => update('countryName', v)}
          placeholder="e.g. Latvia, United States"
          error={errors.countryName}
        />

        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <TextInputApp
              testID="country-input-code"
              label="Alpha-2 Code (ISO-2) *"
              value={form.countryCode}
              onChangeText={(v) => update('countryCode', v.toUpperCase())}
              placeholder="e.g. LV, US, DE"
              error={errors.countryCode}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInputApp
              testID="country-input-code-alpha3"
              label="Alpha-3 Code (ISO-3)"
              value={form.countryCodeAlpha3}
              onChangeText={(v) => update('countryCodeAlpha3', v.toUpperCase())}
              placeholder="e.g. LVA, USA, DEU"
              error={errors.countryCodeAlpha3}
            />
          </View>
        </View>

        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <TextInputApp
              testID="country-input-numeric"
              label="Numeric Code (ISO)"
              value={form.countryNumericCode}
              onChangeText={(v) => update('countryNumericCode', v)}
              placeholder="e.g. 428, 840"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInputApp
              testID="country-input-phone"
              label="Phone Prefix"
              value={form.phonePrefix}
              onChangeText={(v) => update('phonePrefix', v)}
              placeholder="e.g. +371, +1"
            />
          </View>
        </View>

        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <TextInputApp
              testID="country-input-currency"
              label="Currency Code"
              value={form.currencyCode}
              onChangeText={(v) => update('currencyCode', v.toUpperCase())}
              placeholder="e.g. EUR, USD"
              error={errors.currencyCode}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInputApp
              testID="country-input-flag"
              label="Flag Emoji"
              value={form.flagEmoji}
              onChangeText={(v) => update('flagEmoji', v)}
              placeholder="e.g. 🇱🇻"
            />
          </View>
        </View>

        <SwitchApp
          testID="country-switch-active"
          label="Country is active in selection lists"
          value={form.isActive}
          onValueChange={(v) => update('isActive', v)}
        />
      </View>

      <View style={styles.actions}>
        <ButtonPrimaryApp
          testID="country-save"
          title={isNew ? 'Create Country' : 'Save Changes'}
          onPress={handleSave}
        />
        <ButtonTextApp
          testID="country-cancel"
          title="Cancel"
          onPress={() => router.replace(COUNTRY_ROUTES.list as any)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 16, gap: 16, maxWidth: 680, alignSelf: 'center', width: '100%' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  bannerText: { flex: 1, fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  rowTwo: { flexDirection: 'row', gap: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, paddingBottom: 32 },
});
