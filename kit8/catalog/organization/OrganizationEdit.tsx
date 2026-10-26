import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../ui/components/common';
import IconApp from '../../ui/components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import SelectElementFromCatalog from '../inner/select_element/SelectElementFromCatalog';
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
import { organizationOwnerOf } from './ensureUserOrganization';
import { CAPACITY_MODES, CapacityMode, DEFAULT_CAPACITY_MODE, capacityModeOf } from '../../pm/view/task/plan/busyControl';
import { pmT } from '../../pm/i18n/pmT';
import ScrollableTabBar from '../../ui/components/tabs/ScrollableTabBar';
import TabTimesheet, { storedTimesheetSettings, type TimesheetStoredSettings } from '../../documents/timesheet/TabTimesheet';

// Projects -> Settings pulls in the whole project settings UI: loaded only when that tab opens (Jest cannot run import())
const OrganizationProjectSettings = React.lazy(() => Promise.resolve(require('./OrganizationProjectSettings')));

type OrgTab = 'main' | 'projects' | 'timesheet' | 'system';
type ProjectsTab = 'settings';
const ORG_TABS: { id: OrgTab; label: string; icon: string }[] = [
  { id: 'main', label: 'Main', icon: 'info' },
  { id: 'projects', label: 'Projects', icon: 'view_timeline' },
  { id: 'timesheet', label: 'Time sheet', icon: 'schedule' },
  { id: 'system', label: 'System', icon: 'settings_applications' },
];
const PROJECTS_TABS: { id: ProjectsTab; label: string }[] = [{ id: 'settings', label: 'Settings' }];

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
  resourceCapacityStrongMode: CapacityMode;
  /** organizationTable.rowJSON.defaultProjectSettings: kept as stored, edited by Projects -> Settings */
  defaultProjectSettings?: Record<string, any>;
  /** the time sheet defaults of every user (TabTimesheet): only the keys that are stored */
  timesheet: TimesheetStoredSettings;
  /** count the screens the users open (kit8/catalog/user/visit): true unless stored false */
  numberOfVisitsFunctionalityEnabled: boolean;
  /** the base currency of the exchange rates the database converts with (the cost of a time sheet hour); '' = EUR */
  baseCurrency: string;
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
    resourceCapacityStrongMode: capacityModeOf(v) ?? DEFAULT_CAPACITY_MODE,
    defaultProjectSettings: v.defaultProjectSettings,
    timesheet: storedTimesheetSettings(v as Record<string, any>),
    numberOfVisitsFunctionalityEnabled: v.numberOfVisitsFunctionalityEnabled !== false,
    baseCurrency: v.baseCurrency || '',
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
    resourceCapacityStrongMode: f.resourceCapacityStrongMode,
    defaultProjectSettings: f.defaultProjectSettings,
    ...f.timesheet,
    numberOfVisitsFunctionalityEnabled: f.numberOfVisitsFunctionalityEnabled,
    baseCurrency: f.baseCurrency,
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
  const [topTab, setTopTab] = useState<OrgTab>('main');
  const [projectsTab, setProjectsTab] = useState<ProjectsTab>('settings');

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
        // 1 user === 1 organization: rowOwnerGUID = createdByUser = the user's email (lower case)
        const owner = organizationOwnerOf(activeUserEmail);
        if (!owner) {
          setSaveError('Sign in to create an organization');
          return;
        }
        if (rows.some((r) => r.rowOwnerGUID === owner || organizationOwnerOf(r.rowJSON?.createdByUser || '') === owner)) {
          setSaveError('You already have an organization - one user can have only one organization.');
          return;
        }
        json.createdByUser = owner;
        const newRowGUID = Crypto.randomUUID();
        dispatch(
          actions.createOne({
            rowGUID: newRowGUID,
            rowOwnerGUID: owner,
            rowParentGUID: 'empty',
            orderInList: Date.now(),
            rowJSON: json,
          })
        );
      } else {
        // the owner never changes: createdByUser stays the one of the row (owner === createdByUser)
        json.createdByUser = (existing!.rowJSON?.createdByUser || json.createdByUser || '').trim().toLowerCase();
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

      {/* TopTabs: Main | Projects (Projects -> Settings = the default settings of a new project) */}
      <ScrollableTabBar testID="organization-toptabs" style={[styles.topTabsBar, { borderBottomColor: c.border }]}>
        {ORG_TABS.map((tab) => {
          const on = topTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`organization-tab-${tab.id}`}
              accessibilityRole="tab"
              aria-selected={on}
              onPress={() => setTopTab(tab.id)}
              style={[styles.topTabButton, { borderBottomColor: on ? c.primary || '#4f46e5' : 'transparent' }]}
            >
              <IconApp name={tab.icon} size={15} color={on ? c.primary || '#4f46e5' : c.text} />
              <Text style={[styles.topTabText, { color: on ? c.primary || '#4f46e5' : c.text, fontWeight: on ? '700' : '500' }]}>{pmT(tab.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      {topTab === 'projects' && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="organization-projects-tab-content">
          <ScrollableTabBar testID="organization-projects-subtabs" style={[styles.topTabsBar, { borderBottomColor: c.border }]}>
            {PROJECTS_TABS.map((tab) => {
              const on = projectsTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  testID={`organization-projects-tab-${tab.id}`}
                  accessibilityRole="tab"
                  aria-selected={on}
                  onPress={() => setProjectsTab(tab.id)}
                  style={[styles.topTabButton, { borderBottomColor: on ? c.primary || '#4f46e5' : 'transparent' }]}
                >
                  <Text style={[styles.topTabText, { color: on ? c.primary || '#4f46e5' : c.text, fontWeight: on ? '700' : '500' }]}>{pmT(tab.label)}</Text>
                </Pressable>
              );
            })}
          </ScrollableTabBar>
          {projectsTab === 'settings' && (
            <Suspense fallback={null}>
              <OrganizationProjectSettings
                values={form.defaultProjectSettings}
                onChange={(next: Record<string, any>) => update('defaultProjectSettings', next)}
                disabled={!canEdit}
              />
            </Suspense>
          )}
        </View>
      )}

      {/* Time sheet: the default switches of every user (a person may set his own: Person edit) */}
      {topTab === 'timesheet' && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="organization-timesheet-tab-content">
          <TabTimesheet testID="organization-timesheet-settings" values={form.timesheet} disabled={!canEdit} onChange={(next) => update('timesheet', next)} />
          {/* the base of the exchange rate book (the cost of an hour is converted in the database): the currency the rates are quoted against */}
          <TextInputApp
            testID="organization-baseCurrency" label={pmT('Base currency of the exchange rates')} value={form.baseCurrency} maxLength={3} autoCapitalize="characters" placeholder="EUR" disabled={!canEdit}
            helperText={pmT('The currency the exchange rates are quoted against (EUR unless you changed EXPO_PUBLIC_CURRENCY_RATES_BASE). Empty = EUR.')}
            onChangeText={(t: string) => update('baseCurrency', t.toUpperCase())}
          />
        </View>
      )}

      {/* System: the switches of the app itself */}
      {topTab === 'system' && (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="organization-system-tab-content">
          <SwitchApp
            testID="organization-switch-numberOfVisits"
            label={pmT('Number of visits')}
            value={form.numberOfVisitsFunctionalityEnabled}
            onValueChange={(v) => update('numberOfVisitsFunctionalityEnabled', v)}
            disabled={!canEdit}
          />
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
            {pmT('On (default): the app counts how often each user opens each screen (System settings -> Routes visits) and the hamburger menu shows the 5 most visited. Off: nothing is counted.')}
          </Text>
        </View>
      )}

      {/* the Main Details (the Departments tab was removed: see the business units) */}
      {topTab === 'main' && (
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

          {/* Resource capacity: what Post does when a resource is booked more than its calendar allows (all projects of the organization share the resources) */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="organization-capacity-card">
            <Text style={[styles.sectionTitle, { color: c.text }]}>{pmT('Resource capacity')}</Text>
            <Text style={{ color: c.textSecondary || c.text, fontSize: 12, marginBottom: 8 }}>
              {pmT('The projects of this organization share their persons and equipment. What should Post do when a resource is booked more than its calendar allows?')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {CAPACITY_MODES.map((m) => {
                const on = form.resourceCapacityStrongMode === m.mode;
                return (
                  <Pressable
                    key={m.mode}
                    testID={`organization-capacity-${m.mode}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: !canEdit }}
                    disabled={!canEdit}
                    onPress={() => update('resourceCapacityStrongMode', m.mode)}
                    style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? (c.primary || '#4f46e5') : c.border, backgroundColor: on ? (c.primary || '#4f46e5') : 'transparent', opacity: canEdit ? 1 : 0.6 }}
                  >
                    <Text style={{ color: on ? '#fff' : c.text, fontWeight: '600' }}>{pmT(m.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: c.textSecondary || c.text, fontSize: 12, marginTop: 8 }} testID="organization-capacity-hint">
              {pmT(CAPACITY_MODES.find((m) => m.mode === form.resourceCapacityStrongMode)?.hint || '')}
            </Text>
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

        </>
      )}

      {/* Save / Actions (both tabs) */}
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
