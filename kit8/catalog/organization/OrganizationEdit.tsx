import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../components/common';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import SelectElementFromCatalog from '../inner/select_element/SelectElementFromCatalog';
import DepartamentList from '../departament/DepartamentList';
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
  countryOfResidence: string;
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
    countryOfResidence: v.countryOfResidence || leg.country || 'LV',
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
    countryOfResidence: f.countryOfResidence,
    contactEmail: f.contactEmail,
    contactPhone: f.contactPhone,
    website: f.website,
    notes: f.notes,
    legalData: {
      registrationNo: f.registrationNo,
      vatNo: f.vatNo,
      legalAddress: f.legalAddress,
      country: f.countryOfResidence || f.country,
      bankIban: f.bankIban,
    },
  });

export default function OrganizationEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ rowGUID?: string; guid?: string }>();
  const rowGUID = params.rowGUID || params.guid;
  const isNew = !rowGUID;

  const [activeTab, setActiveTab] = useState<'TabMain' | 'TabDepartaments'>('TabMain');

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
    const errKey = k as unknown as keyof OrganizationErrors;
    if (errors[errKey]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[errKey];
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
          title="Back to list"
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

      {/* TopTabs Bar: TabMain, TabDepartaments */}
      <View testID="organization-toptabs" style={[styles.topTabsBar, { borderBottomColor: c.border }]}>
        {[
          { id: 'TabMain' as const, label: 'Main Details', icon: 'info' },
          { id: 'TabDepartaments' as const, label: 'Departments', icon: 'schema' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`organization-tab-${tab.id}`}
              accessibilityRole="tab"
              aria-selected={active}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.topTabButton,
                {
                  borderBottomColor: active ? c.primary : 'transparent',
                  backgroundColor: active ? `${c.primary}18` : 'transparent',
                },
              ]}
            >
              <IconApp
                name={tab.icon}
                size={16}
                color={active ? c.primary : c.text}
              />
              <Text
                style={[
                  styles.topTabText,
                  {
                    color: active ? c.primary : c.text,
                    fontWeight: active ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* TAB 1: TabMain */}
      {activeTab === 'TabMain' && (
        <>
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

            {/* Country of Residence from countryTable catalog via SelectElementFromCatalog */}
            <SelectElementFromCatalog
              testID="organization-select-country"
              entityName="countryReusable"
              label="Country of Residence *"
              placeholder="Select country of residence from catalog..."
              value={form.countryOfResidence || form.country}
              onSelect={(guid, row) => {
                const code = row?.rowJSON?.countryCode || guid || 'LV';
                update('countryOfResidence', code);
                update('country', code);
              }}
              onChange={(guid, row) => {
                const code = row?.rowJSON?.countryCode || guid || 'LV';
                update('countryOfResidence', code);
                update('country', code);
              }}
              disabled={!canEdit}
            />

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
                title={isNew ? 'Create Organization' : 'Save Changes'}
                onPress={handleSave}
              />
              <ButtonTextApp
                testID="organization-cancel"
                title="Cancel"
                onPress={() => router.replace(ORGANIZATION_ROUTES.list as any)}
              />
            </View>
          )}
        </>
      )}

      {/* TAB 2: TabDepartaments */}
      {activeTab === 'TabDepartaments' && (
        <View style={styles.tabContent} testID="organization-tab-departaments-content">
          {isNew ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, alignItems: 'center', padding: 32 }]}>
              <IconApp name="schema" size={48} color={c.text + '99'} />
              <Text style={[styles.sectionTitle, { color: c.text, textAlign: 'center', marginTop: 12 }]}>
                Organization Not Saved Yet
              </Text>
              <Text style={{ color: c.text + '99', textAlign: 'center', marginTop: 6, maxWidth: 400 }}>
                Please save this organization first on the "Main Details" tab. Once saved, you can add departments and manage your organizational tree structure here.
              </Text>
            </View>
          ) : (
            <DepartamentList organizationGUID={existing!.rowGUID} />
          )}
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
  topTabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    gap: 8,
    marginBottom: 4,
  },
  topTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  topTabText: {
    fontSize: 14,
  },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  tabContent: { width: '100%' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, paddingBottom: 32 },
});
