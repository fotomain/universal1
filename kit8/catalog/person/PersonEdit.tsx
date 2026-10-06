// PersonEdit - route /person/edit (new) or /person/edit?rowGUID=… (existing).
// Includes Employee section and embedded Contracts section.
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
  PERSON_CATALOG_OWNER,
  PERSON_ENTITY,
  PERSON_READ_PARAMS,
  PERSON_ROUTES,
  PersonErrors,
  PersonRow,
  PersonRowJSON,
  emptyPerson,
  normalizePerson,
  validatePerson,
} from './personModel';

type Form = {
  personFirstName: string;
  personLastName: string;
  personTitle: string;
  personEmail: string;
  personPhone: string;
  isActive: boolean;
  personIsEmployee: boolean;
  employeeNumber: string;
  position: string;
  department: string;
  personalCode: string;
  bankIban: string;
};

const toForm = (j?: Partial<PersonRowJSON>): Form => {
  const v = { ...emptyPerson(), ...(j || {}) };
  const emp = v.employeeData || {};
  return {
    personFirstName: v.personFirstName,
    personLastName: v.personLastName || '',
    personTitle: v.personTitle,
    personEmail: v.personEmail || '',
    personPhone: v.personPhone || '',
    isActive: v.isActive !== false,
    personIsEmployee: Boolean(v.personIsEmployee),
    employeeNumber: emp.employeeNumber || '',
    position: emp.position || '',
    department: emp.department || '',
    personalCode: emp.personalCode || '',
    bankIban: emp.bankIban || '',
  };
};

const fromForm = (f: Form): PersonRowJSON =>
  normalizePerson({
    personFirstName: f.personFirstName,
    personLastName: f.personLastName,
    personTitle: f.personTitle,
    personEmail: f.personEmail,
    personPhone: f.personPhone,
    isActive: f.isActive,
    personIsEmployee: f.personIsEmployee,
    employeeData: {
      employeeNumber: f.employeeNumber,
      position: f.position,
      department: f.department,
      personalCode: f.personalCode,
      bankIban: f.bankIban,
    },
  });

const rowVersion = (r?: PersonRow) => (r ? `${r.updated_at ?? ''}|${JSON.stringify(r.rowJSON)}` : '');

export default function PersonEdit() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ rowGUID?: string }>();
  const rowGUID = typeof params.rowGUID === 'string' && params.rowGUID ? params.rowGUID : null;

  const status = useRealtimeEntity(PERSON_ENTITY, { readParams: PERSON_READ_PARAMS });
  const actions = SystemMetaData[PERSON_ENTITY]?.actions;
  const rows: PersonRow[] = useSelector((s: any) => s?.[PERSON_ENTITY]?.entityDataFromServer) || [];
  const loaded = useSelector((s: any) => s?.[PERSON_ENTITY]?.readSuccessful === 1);
  const row = useMemo(() => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined), [rows, rowGUID]);

  // Check if person has contracts to prevent hard deletion
  const allContracts: ContractRow[] = useSelector((s: any) => s?.[CONTRACT_ENTITY]?.entityDataFromServer) || [];
  const hasContracts = useMemo(
    () => Boolean(rowGUID && allContracts.some((ct) => ct.rowOwnerGUID === rowGUID)),
    [rowGUID, allContracts]
  );

  const [form, setForm] = useState<Form>(() => toForm(row?.rowJSON));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<PersonErrors>({});
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

  const back = () => router.replace(PERSON_ROUTES.list as any);

  const save = () => {
    const value = fromForm(form);
    const e = validatePerson(value, rows, rowGUID);
    setErrors(e);
    if (Object.keys(e).length || !actions) return;

    if (rowGUID) {
      dispatch(
        actions.updateOne({
          rowGUID,
          rowOwnerGUID: row?.rowOwnerGUID ?? PERSON_CATALOG_OWNER,
          rowJSON: value,
        })
      );
    } else {
      dispatch(
        actions.createOne({
          rowGUID: Crypto.randomUUID(),
          rowOwnerGUID: PERSON_CATALOG_OWNER,
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
      setDeleteBlockedMessage('This person has associated contracts and cannot be deleted. Please set "Active" to OFF instead.');
      return;
    }
    if (!confirmDelete) return setConfirmDelete(true);
    dispatch(actions.deleteOne({ rowGUID, rowOwnerGUID: row?.rowOwnerGUID ?? PERSON_CATALOG_OWNER }));
    back();
  };

  const input = (k: keyof Form, label: string, extra: any = {}) => (
    <TextInputApp
      testID={`person-edit-${k}`}
      label={label}
      value={String(form[k] ?? '')}
      onChangeText={(v: string) => set(k, v as any)}
      error={errors[k as keyof PersonErrors]}
      showError={!!errors[k as keyof PersonErrors]}
      {...extra}
    />
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      testID="person-edit"
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.text }]}>
          {rowGUID ? `Person: ${row?.rowJSON.personTitle || form.personTitle || 'Edit'}` : 'New Person'}
        </Text>
        <CurrencyRealtimeBadge status={status} />
      </View>

      {remoteChanged && (
        <View style={[styles.banner, { borderColor: c.primary, backgroundColor: `${c.primary}14` }]} testID="person-edit-remote-changed">
          <Text style={{ color: c.text, flex: 1 }}>This person was modified in another window.</Text>
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
        <View style={[styles.banner, { borderColor: c.error }]} testID="person-edit-gone">
          <Text style={{ color: c.error }}>{deletedElsewhere ? 'This person was deleted in another window.' : 'Person not found.'}</Text>
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
        <View style={{ flex: 1 }}>{input('personFirstName', 'First Name *', { maxLength: 60 })}</View>
        <View style={{ flex: 1 }}>{input('personLastName', 'Last Name', { maxLength: 60 })}</View>
      </View>

      {input('personTitle', 'Display Title (auto "First Last" if empty)', { maxLength: 120 })}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>{input('personEmail', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}</View>
        <View style={{ flex: 1 }}>{input('personPhone', 'Phone', { keyboardType: 'phone-pad' })}</View>
      </View>

      <View style={styles.switchRow}>
        <SwitchApp testID="person-edit-isActive" label="Active" value={form.isActive} onValueChange={(v) => set('isActive', v)} />
        <SwitchApp
          testID="person-edit-isEmployee"
          label="Is Employee"
          value={form.personIsEmployee}
          onValueChange={(v) => set('personIsEmployee', v)}
        />
      </View>

      {/* Employee Data Sub-section */}
      {form.personIsEmployee && (
        <View style={[styles.subSection, { borderColor: '#6366f160', backgroundColor: '#6366f108' }]}>
          <Text style={[styles.subSectionTitle, { color: '#6366f1' }]}>Employee Legal & Position Details</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{input('employeeNumber', 'Employee #')}</View>
            <View style={{ flex: 1 }}>{input('personalCode', 'Personal / Tax ID')}</View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{input('position', 'Job Position')}</View>
            <View style={{ flex: 1 }}>{input('department', 'Department')}</View>
          </View>
          {input('bankIban', 'Bank IBAN', { autoCapitalize: 'characters' })}
        </View>
      )}

      {/* Contracts Sub-section */}
      <ContractList ownerGUID={rowGUID || ''} partyType="person" defaultCurrency="EUR" disabled={!rowGUID} />

      <View style={styles.actions}>
        {rowGUID && !deletedElsewhere && !notFound ? (
          <ButtonTextApp testID="person-edit-delete" onPress={remove} color={c.error}>
            {confirmDelete ? 'Press again to delete' : 'Delete'}
          </ButtonTextApp>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ButtonTextApp testID="person-edit-cancel" onPress={back}>
            Cancel
          </ButtonTextApp>
          <ButtonPrimaryApp testID="person-edit-save" onPress={save} disabled={deletedElsewhere || notFound}>
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
