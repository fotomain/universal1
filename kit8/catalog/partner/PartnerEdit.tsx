// PartnerEdit - route /partner/edit (new) or /partner/edit?rowGUID=… (existing).
// Includes Legal Data, Supplier Data, Customer Data, and embedded Contracts section.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../ui/components/common';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import { ContractList } from '../contract';
import { CONTRACT_ENTITY, ContractRow } from '../contract/contractModel';
import {
  PARTNER_CATALOG_OWNER,
  PARTNER_ENTITY,
  PARTNER_READ_PARAMS,
  PARTNER_ROUTES,
  PartnerErrors,
  PartnerRow,
  PartnerRowJSON,
  emptyPartner,
  normalizePartner,
  validatePartner,
} from './partnerModel';

type Form = {
  partnerTitle: string;
  partnerLegalName: string;
  partnerKind: 'company' | 'individual';
  isActive: boolean;
  partnerIsSupplier: boolean;
  partnerIsCustomer: boolean;
  // Legal
  registrationNo: string;
  vatNo: string;
  legalAddress: string;
  country: string;
  bankIban: string;
  // Supplier
  supplierPaymentTermsDays: string;
  supplierDefaultCurrency: string;
  supplierNotes: string;
  // Customer
  customerPaymentTermsDays: string;
  customerCreditLimit: string;
  customerDefaultCurrency: string;
  customerDiscountPercent: string;
};

const toForm = (j?: Partial<PartnerRowJSON>): Form => {
  const v = { ...emptyPartner(), ...(j || {}) };
  const leg = v.legalData || {};
  const sup = v.supplierData || {};
  const cus = v.customerData || {};
  return {
    partnerTitle: v.partnerTitle,
    partnerLegalName: v.partnerLegalName || '',
    partnerKind: v.partnerKind || 'company',
    isActive: v.isActive !== false,
    partnerIsSupplier: Boolean(v.partnerIsSupplier),
    partnerIsCustomer: Boolean(v.partnerIsCustomer),
    registrationNo: leg.registrationNo || '',
    vatNo: leg.vatNo || '',
    legalAddress: leg.legalAddress || '',
    country: leg.country || '',
    bankIban: leg.bankIban || '',
    supplierPaymentTermsDays: String(sup.paymentTermsDays ?? 14),
    supplierDefaultCurrency: sup.defaultCurrency || 'EUR',
    supplierNotes: sup.notes || '',
    customerPaymentTermsDays: String(cus.paymentTermsDays ?? 30),
    customerCreditLimit: String(cus.creditLimit ?? 0),
    customerDefaultCurrency: cus.defaultCurrency || 'EUR',
    customerDiscountPercent: String(cus.discountPercent ?? 0),
  };
};

const fromForm = (f: Form): PartnerRowJSON =>
  normalizePartner({
    partnerTitle: f.partnerTitle,
    partnerLegalName: f.partnerLegalName,
    partnerKind: f.partnerKind,
    isActive: f.isActive,
    partnerIsSupplier: f.partnerIsSupplier,
    partnerIsCustomer: f.partnerIsCustomer,
    legalData: {
      registrationNo: f.registrationNo,
      vatNo: f.vatNo,
      legalAddress: f.legalAddress,
      country: f.country,
      bankIban: f.bankIban,
    },
    supplierData: {
      paymentTermsDays: Number(f.supplierPaymentTermsDays || 14),
      defaultCurrency: f.supplierDefaultCurrency,
      notes: f.supplierNotes,
    },
    customerData: {
      paymentTermsDays: Number(f.customerPaymentTermsDays || 30),
      creditLimit: Number(f.customerCreditLimit || 0),
      defaultCurrency: f.customerDefaultCurrency,
      discountPercent: Number(f.customerDiscountPercent || 0),
    },
  });

const rowVersion = (r?: PartnerRow) => (r ? `${r.updated_at ?? ''}|${JSON.stringify(r.rowJSON)}` : '');

export default function PartnerEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ rowGUID?: string }>();
  const rowGUID = typeof params.rowGUID === 'string' && params.rowGUID ? params.rowGUID : null;

  const status = useRealtimeEntity(PARTNER_ENTITY, { readParams: PARTNER_READ_PARAMS });
  const actions = SystemMetaData[PARTNER_ENTITY]?.actions;
  const rows: PartnerRow[] = useSelector((s: any) => s?.[PARTNER_ENTITY]?.entityDataFromServer) || [];
  const loaded = useSelector((s: any) => s?.[PARTNER_ENTITY]?.readSuccessful === 1);
  const row = useMemo(() => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined), [rows, rowGUID]);

  // Check if partner has contracts to prevent hard deletion
  const allContracts: ContractRow[] = useSelector((s: any) => s?.[CONTRACT_ENTITY]?.entityDataFromServer) || [];
  const hasContracts = useMemo(
    () => Boolean(rowGUID && allContracts.some((ct) => ct.rowOwnerGUID === rowGUID)),
    [rowGUID, allContracts]
  );

  const [form, setForm] = useState<Form>(() => toForm(row?.rowJSON));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<PartnerErrors>({});
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null);
  const seenVersion = useRef<string>('');
  const everSeen = useRef(false);

  useEffect(() => {
    setForm(toForm(row?.rowJSON));
    setDirty(false);
    setErrors({});
    setRemoteChanged(false);
    setConfirmDelete(false);
    setDeleteBlockedMessage(null);
    seenVersion.current = rowVersion(row);
    everSeen.current = !!row;
  }, [rowGUID]);

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
  }, [row]);

  const deletedElsewhere = !!rowGUID && everSeen.current && !row && loaded;
  const notFound = !!rowGUID && !everSeen.current && !row && loaded;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const back = () => router.replace(PARTNER_ROUTES.list as any);

  const save = () => {
    const value = fromForm(form);
    const e = validatePartner(value, rows, rowGUID);
    setErrors(e);
    if (Object.keys(e).length || !actions) return;

    if (rowGUID) {
      dispatch(
        actions.updateOne({
          rowGUID,
          rowOwnerGUID: row?.rowOwnerGUID ?? PARTNER_CATALOG_OWNER,
          rowJSON: value,
        })
      );
    } else {
      dispatch(
        actions.createOne({
          rowGUID: Crypto.randomUUID(),
          rowOwnerGUID: PARTNER_CATALOG_OWNER,
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
    if (hasContracts) {
      setDeleteBlockedMessage('This partner has associated contracts and cannot be deleted. Please set "Active" to OFF instead.');
      return;
    }
    if (!confirmDelete) return setConfirmDelete(true);
    dispatch(actions.deleteOne({ rowGUID, rowOwnerGUID: row?.rowOwnerGUID ?? PARTNER_CATALOG_OWNER }));
    back();
  };

  const input = (k: keyof Form, label: string, extra: any = {}) => (
    <TextInputApp
      testID={`partner-edit-${k}`}
      label={label}
      value={String(form[k] ?? '')}
      onChangeText={(v: string) => set(k, v as any)}
      error={errors[k as keyof PartnerErrors]}
      showError={!!errors[k as keyof PartnerErrors]}
      {...extra}
    />
  );

  const showLegal = form.partnerIsSupplier || form.partnerIsCustomer;

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      testID="partner-edit"
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>
          {rowGUID ? `Partner: ${row?.rowJSON.partnerTitle || form.partnerTitle || 'Edit'}` : 'New Partner'}
        </Text>
        <CurrencyRealtimeBadge status={status} />
      </View>

      {remoteChanged && (
        <View style={[styles.banner, { borderColor: c.primary, backgroundColor: `${c.primary}14` }]} testID="partner-edit-remote-changed">
          <Text style={{ color: c.text, flex: 1 }}>This partner was modified in another window.</Text>
          <ButtonTextApp
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
        <View style={[styles.banner, { borderColor: c.error }]} testID="partner-edit-gone">
          <Text style={{ color: c.error }}>{deletedElsewhere ? 'This partner was deleted in another window.' : 'Partner not found.'}</Text>
        </View>
      )}

      {deleteBlockedMessage && (
        <View style={[styles.banner, { borderColor: c.error, backgroundColor: `${c.error}14` }]}>
          <Text style={{ color: c.error, flex: 1 }}>{deleteBlockedMessage}</Text>
          <ButtonTextApp onPress={() => setDeleteBlockedMessage(null)}>Dismiss</ButtonTextApp>
        </View>
      )}

      {/* Main Info */}
      <View style={styles.row}>
        <View style={{ flex: 2 }}>{input('partnerTitle', 'Partner Name / Brand *', { maxLength: 100 })}</View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.labelSmall, { color: c.text }]}>Kind</Text>
          <View style={styles.kindSelector}>
            <Text
              onPress={() => set('partnerKind', 'company')}
              style={[
                styles.kindChip,
                {
                  backgroundColor: form.partnerKind === 'company' ? c.primary : `${c.border}40`,
                  color: form.partnerKind === 'company' ? '#fff' : c.text,
                },
              ]}
            >
              Company
            </Text>
            <Text
              onPress={() => set('partnerKind', 'individual')}
              style={[
                styles.kindChip,
                {
                  backgroundColor: form.partnerKind === 'individual' ? c.primary : `${c.border}40`,
                  color: form.partnerKind === 'individual' ? '#fff' : c.text,
                },
              ]}
            >
              Individual
            </Text>
          </View>
        </View>
      </View>

      {input('partnerLegalName', 'Official Legal Name (optional)', { maxLength: 120 })}

      <View style={styles.switchRow}>
        <SwitchApp testID="partner-edit-isActive" label="Active" value={form.isActive} onValueChange={(v) => set('isActive', v)} />
        <SwitchApp
          testID="partner-edit-isSupplier"
          label="Is Supplier"
          value={form.partnerIsSupplier}
          onValueChange={(v) => set('partnerIsSupplier', v)}
        />
        <SwitchApp
          testID="partner-edit-isCustomer"
          label="Is Customer"
          value={form.partnerIsCustomer}
          onValueChange={(v) => set('partnerIsCustomer', v)}
        />
      </View>

      {/* Legal Data Sub-section */}
      {showLegal && (
        <View style={[styles.subSection, { borderColor: '#0ea5e960', backgroundColor: '#0ea5e908' }]}>
          <Text style={[styles.subSectionTitle, { color: '#0284c7' }]}>Legal & Tax Information</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{input('registrationNo', 'Reg No / CRN')}</View>
            <View style={{ flex: 1 }}>{input('vatNo', 'VAT No (e.g. LV40003000111)', { autoCapitalize: 'characters' })}</View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 2 }}>{input('legalAddress', 'Legal Address')}</View>
            <View style={{ flex: 1 }}>{input('country', 'Country (e.g. LV)', { autoCapitalize: 'characters', maxLength: 2 })}</View>
          </View>
          {input('bankIban', 'Bank IBAN', { autoCapitalize: 'characters' })}
        </View>
      )}

      {/* Supplier Data Sub-section */}
      {form.partnerIsSupplier && (
        <View style={[styles.subSection, { borderColor: '#10b98160', backgroundColor: '#10b98108' }]}>
          <Text style={[styles.subSectionTitle, { color: '#059669' }]}>Supplier Terms</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{input('supplierPaymentTermsDays', 'Payment Terms (Days)', { keyboardType: 'numeric' })}</View>
            <View style={{ flex: 1 }}>{input('supplierDefaultCurrency', 'Currency', { autoCapitalize: 'characters', maxLength: 3 })}</View>
          </View>
          {input('supplierNotes', 'Supplier Notes', { multiline: true, numberOfLines: 2 })}
        </View>
      )}

      {/* Customer Data Sub-section */}
      {form.partnerIsCustomer && (
        <View style={[styles.subSection, { borderColor: '#3b82f660', backgroundColor: '#3b82f608' }]}>
          <Text style={[styles.subSectionTitle, { color: '#2563eb' }]}>Customer Terms</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{input('customerPaymentTermsDays', 'Payment Terms (Days)', { keyboardType: 'numeric' })}</View>
            <View style={{ flex: 1 }}>{input('customerCreditLimit', 'Credit Limit', { keyboardType: 'numeric' })}</View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{input('customerDefaultCurrency', 'Currency', { autoCapitalize: 'characters', maxLength: 3 })}</View>
            <View style={{ flex: 1 }}>{input('customerDiscountPercent', 'Discount %', { keyboardType: 'numeric' })}</View>
          </View>
        </View>
      )}

      {/* Contracts Sub-section */}
      <ContractList
        ownerGUID={rowGUID || ''}
        partyType="partner"
        defaultCurrency={form.supplierDefaultCurrency || form.customerDefaultCurrency || 'EUR'}
        disabled={!rowGUID}
      />

      <View style={styles.actions}>
        {rowGUID && !deletedElsewhere && !notFound ? (
          <ButtonTextApp testID="partner-edit-delete" onPress={remove} color={c.error}>
            {confirmDelete ? 'Press again to sql_for_delete' : 'Delete'}
          </ButtonTextApp>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ButtonTextApp testID="partner-edit-cancel" onPress={back}>
            Cancel
          </ButtonTextApp>
          <ButtonPrimaryApp testID="partner-edit-save" onPress={save} disabled={deletedElsewhere || notFound}>
            {rowGUID ? 'Save' : 'Create'}
          </ButtonPrimaryApp>
        </View>
      </View>

      {Platform.OS === 'web' && <Text style={[styles.hint, { color: c.text }]}>Changes sync across all browsers automatically.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  labelSmall: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  kindSelector: { flexDirection: 'row', gap: 4, height: 42, alignItems: 'center' },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  subSection: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    gap: 8,
  },
  subSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12, gap: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 12, textAlign: 'center' },
});
