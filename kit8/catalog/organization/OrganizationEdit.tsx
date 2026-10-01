import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  ORGANIZATION_CATALOG_OWNER,
  ORGANIZATION_ENTITY,
  ORGANIZATION_READ_PARAMS,
  ORGANIZATION_ROUTES,
  OrganizationErrors,
  OrganizationRow,
  OrganizationRowJSON,
  canEditOrganization,
  emptyOrganization,
  normalizeOrganization,
  validateOrganization,
} from './organizationModel';

type Form = {
  organizationTitle: string;
  organizationLegalName: string;
  createdByUser: string;
  isActive: boolean;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
  registrationNo: string;
  vatNo: string;
  legalAddress: string;
  country: string;
  bankIban: string;
};

const toForm = (j?: Partial<OrganizationRowJSON>, defaultUserEmail = ''): Form => {
  const v = { ...emptyOrganization(defaultUserEmail), ...(j || {}) };
  const leg = v.legalData || {};
  return {
    organizationTitle: v.organizationTitle || '',
    organizationLegalName: v.organizationLegalName || '',
    createdByUser: v.createdByUser || defaultUserEmail,
    isActive: v.isActive !== false,
    contactEmail: v.contactEmail || defaultUserEmail,
    contactPhone: v.contactPhone || '',
    website: v.website || '',
    notes: v.notes || '',
    registrationNo: leg.registrationNo || '',
    vatNo: leg.vatNo || '',
    legalAddress: leg.legalAddress || '',
    country: leg.country || 'LV',
    bankIban: leg.bankIban || '',
  };
};

const fromForm = (f: Form): OrganizationRowJSON =>
  normalizeOrganization({
    organizationTitle: f.organizationTitle,
    organizationLegalName: f.organizationLegalName,
    createdByUser: f.createdByUser,
    isActive: f.isActive,
    contactEmail: f.contactEmail,
    contactPhone: f.contactPhone,
    website: f.website,
    notes: f.notes,
    legalData: {
      registrationNo: f.registrationNo,
      vatNo: f.vatNo,
      legalAddress: f.legalAddress,
      country: f.country,
      bankIban: f.bankIban,
    },
  });

export default function OrganizationEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const { rowGUID } = useLocalSearchParams<{ rowGUID?: string }>();
  const isNew = !rowGUID;

  const status = useRealtimeEntity(ORGANIZATION_ENTITY, { readParams: ORGANIZATION_READ_PARAMS });
  const rows: OrganizationRow[] =
    useSelector((s: any) => s?.[ORGANIZATION_ENTITY]?.entityDataFromServer) || [];
  const activeUserEmail = useSelector((s: any) => s?.activeUserState?.activeUserEmail) || '';

  const existing = useMemo(
    () => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined),
    [rows, rowGUID]
  );

  const canEdit = isNew || canEditOrganization(existing, activeUserEmail);

  const [form, setForm] = useState<Form>(() => toForm(existing?.rowJSON, activeUserEmail));
  const [errors, setErrors] = useState<OrganizationErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (existing?.rowJSON) {
      setForm(toForm(existing.rowJSON, activeUserEmail));
    }
  }, [existing, activeUserEmail]);

  const update = <K extends keyof Form>(k: K, v: Form[K]) => {
    if (!canEdit) return;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as any]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[k as any];
        return next;
      });
    }
  };

  const handleSave = () => {
    if (!canEdit) return;
    const json = fromForm(form);
    const check = validateOrganization(json);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }

    const actions = SystemMetaData[ORGANIZATION_ENTITY]?.actions;
    if (!actions) {
      setSaveError('Entity actions not found');
      return;
    }

    try {
      if (isNew) {
        const newRowGUID = Crypto.randomUUID();
        dispatch(
          actions.createOne({
            rowGUID: newRowGUID,
            rowOwnerGUID: ORGANIZATION_CATALOG_OWNER,
            rowParentGUID: 'empty',
            orderInList: Date.now(),
            rowJSON: json,
          })
        );
      } else {
        dispatch(
          actions.updateOne({
            rowGUID: existing!.rowGUID,
            rowOwnerGUID: existing!.rowOwnerGUID || ORGANIZATION_CATALOG_OWNER,
            rowParentGUID: existing!.rowParentGUID || 'empty',
            orderInList: existing!.orderInList ?? 0,
            rowJSON: json,
          })
        );
      }
      router.replace(ORGANIZATION_ROUTES.list as any);
    } catch (err: any) {
      setSaveError(err.message || 'Error saving organization');
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={styles.container}
      testID="organization-edit-screen"
    >
      <View style={styles.topRow}>
        <CurrencyRealtimeBadge status={status} />
        <ButtonTextApp
          testID="organization-back"
          text="Back to list"
          onPress={() => router.replace(ORGANIZATION_ROUTES.list as any)}
        />
      </View>

      <Text style={[styles.title, { color: c.text }]}>
        {isNew ? 'New Organization' : canEdit ? 'Edit Organization' : 'View Organization'}
      </Text>

      {!canEdit && (
        <View style={[styles.banner, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b' }]}>
          <IconApp name="lock" size={18} color="#d97706" />
          <Text style={[styles.bannerText, { color: c.text }]}>
            Read-only: You are viewing this organization. Only the creator (
            {existing?.rowJSON?.createdByUser || 'unknown'}) has permission to edit.
          </Text>
        </View>
      )}

      {saveError && (
        <View style={[styles.banner, { backgroundColor: '#ef444418', borderColor: '#ef4444' }]}>
          <IconApp name="error" size={18} color="#ef4444" />
          <Text style={[styles.bannerText, { color: '#ef4444' }]}>{saveError}</Text>
        </View>
      )}

      {/* Main Info */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>General Information</Text>

        <TextInputApp
          testID="organization-input-title"
          label="Organization Title *"
          value={form.organizationTitle}
          onChangeText={(v) => update('organizationTitle', v)}
          placeholder="Trade name or brand"
          error={errors.organizationTitle}
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-legal-name"
          label="Legal Entity Name"
          value={form.organizationLegalName}
          onChangeText={(v) => update('organizationLegalName', v)}
          placeholder="Official legal name (e.g. SIA, Ltd, Inc)"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-creator"
          label="Creator User Email"
          value={form.createdByUser}
          onChangeText={(v) => update('createdByUser', v)}
          placeholder="Creator email"
          disabled={true} // creator is read-only
          error={errors.createdByUser}
        />

        <SwitchApp
          testID="organization-switch-active"
          label="Organization is active"
          value={form.isActive}
          onValueChange={(v) => update('isActive', v)}
          disabled={!canEdit}
        />
      </View>

      {/* Contact Info */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Contact Information</Text>

        <TextInputApp
          testID="organization-input-email"
          label="Contact Email"
          value={form.contactEmail}
          onChangeText={(v) => update('contactEmail', v)}
          placeholder="contact@company.com"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-phone"
          label="Contact Phone"
          value={form.contactPhone}
          onChangeText={(v) => update('contactPhone', v)}
          placeholder="+1 555 0100"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-website"
          label="Website"
          value={form.website}
          onChangeText={(v) => update('website', v)}
          placeholder="https://example.com"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-notes"
          label="Notes"
          value={form.notes}
          onChangeText={(v) => update('notes', v)}
          placeholder="Additional notes"
          multiline
          disabled={!canEdit}
        />
      </View>

      {/* Legal Data */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Legal & Registration Data</Text>

        <TextInputApp
          testID="organization-input-reg-no"
          label="Registration No"
          value={form.registrationNo}
          onChangeText={(v) => update('registrationNo', v)}
          placeholder="Official company registration number"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-vat-no"
          label="VAT Number"
          value={form.vatNo}
          onChangeText={(v) => update('vatNo', v)}
          placeholder="e.g. LV40003999999"
          error={errors.vatNo}
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-address"
          label="Legal Address"
          value={form.legalAddress}
          onChangeText={(v) => update('legalAddress', v)}
          placeholder="Street, City, Postal Code"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-country"
          label="Country Code (ISO-2)"
          value={form.country}
          onChangeText={(v) => update('country', v.toUpperCase())}
          placeholder="LV"
          disabled={!canEdit}
        />

        <TextInputApp
          testID="organization-input-iban"
          label="Bank IBAN"
          value={form.bankIban}
          onChangeText={(v) => update('bankIban', v.toUpperCase())}
          placeholder="Bank account IBAN"
          disabled={!canEdit}
        />
      </View>

      {/* Save / Actions */}
      {canEdit && (
        <View style={styles.actions}>
          <ButtonPrimaryApp
            testID="organization-save"
            text={isNew ? 'Create Organization' : 'Save Changes'}
            onPress={handleSave}
          />
          <ButtonTextApp
            testID="organization-cancel"
            text="Cancel"
            onPress={() => router.replace(ORGANIZATION_ROUTES.list as any)}
          />
        </View>
      )}
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
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, paddingBottom: 32 },
});
