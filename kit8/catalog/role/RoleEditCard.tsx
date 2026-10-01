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
  ROLE_CATALOG_OWNER,
  ROLE_ENTITY,
  ROLE_READ_PARAMS,
  ROLE_ROUTES,
  RoleErrors,
  RoleRow,
  RoleRowJSON,
  emptyRole,
  validateRole,
} from './roleModel';
import { useIsAppAdmin } from './useIsAppAdmin';

export default function RoleEditCard() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const { rowGUID } = useLocalSearchParams<{ rowGUID?: string }>();
  const isNew = !rowGUID;

  const status = useRealtimeEntity(ROLE_ENTITY, { readParams: ROLE_READ_PARAMS });
  const rows: RoleRow[] =
    useSelector((s: any) => s?.[ROLE_ENTITY]?.entityDataFromServer) || [];

  const existing = useMemo(
    () => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined),
    [rows, rowGUID]
  );

  const [form, setForm] = useState<RoleRowJSON>(() => ({
    ...emptyRole(),
    ...(existing?.rowJSON || {}),
  }));
  const [errors, setErrors] = useState<RoleErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (existing?.rowJSON) {
      setForm((prev) => ({
        ...prev,
        ...existing.rowJSON,
      }));
    }
  }, [existing]);

  const handleFieldChange = (field: keyof RoleRowJSON, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof RoleErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof RoleErrors];
        return next;
      });
    }
    setSaveError(null);
  };

  const handleSave = () => {
    if (!isAdmin) {
      setSaveError('Permission denied: only roleAppAdmin can edit roles.');
      return;
    }

    const others = rows.filter((r) => (rowGUID ? r.rowGUID !== rowGUID : true));
    const validationErrors = validateRole(form, others);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const actions = SystemMetaData[ROLE_ENTITY]?.actions;
    if (!actions) {
      setSaveError('System entity metadata for roles not available.');
      return;
    }

    const payloadJSON: RoleRowJSON = {
      roleName: form.roleName.trim(),
      roleTitle: form.roleTitle.trim(),
      roleDescription: form.roleDescription?.trim() || '',
      isActive: form.isActive !== false,
    };

    if (isNew) {
      const newGUID = Crypto.randomUUID();
      const nextOrder = (rows.length + 1) * 1000;
      dispatch(
        actions.createOne({
          rowGUID: newGUID,
          rowOwnerGUID: ROLE_CATALOG_OWNER,
          rowParentGUID: 'empty',
          orderInList: nextOrder,
          rowJSON: payloadJSON,
        })
      );
    } else if (existing) {
      dispatch(
        actions.updateOne({
          rowGUID: existing.rowGUID,
          rowOwnerGUID: existing.rowOwnerGUID || ROLE_CATALOG_OWNER,
          rowParentGUID: existing.rowParentGUID || 'empty',
          orderInList: existing.orderInList,
          rowJSON: payloadJSON,
        })
      );
    }

    router.replace(ROLE_ROUTES.list as any);
  };

  const handleDelete = () => {
    if (!isAdmin) return;
    if (!existing) return;
    const actions = SystemMetaData[ROLE_ENTITY]?.actions;
    if (actions?.deleteOne) {
      dispatch(
        actions.deleteOne({
          rowGUID: existing.rowGUID,
          rowOwnerGUID: existing.rowOwnerGUID || ROLE_CATALOG_OWNER,
        })
      );
    }
    router.replace(ROLE_ROUTES.list as any);
  };

  if (!isAdmin) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.background }]} testID="role-edit-admin-denied">
        <IconApp name="lock" size={48} color={c.error} />
        <Text style={[styles.deniedTitle, { color: c.text }]}>Access Denied</Text>
        <Text style={[styles.deniedSub, { color: `${c.text}99` }]}>
          Only users with "roleAppAdmin" can view or edit roles.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={styles.container}
      testID="role-edit-screen"
    >
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>
            {isNew ? 'Create New Role' : `Edit ${existing?.rowJSON?.roleTitle || 'Role'}`}
          </Text>
          <CurrencyRealtimeBadge status={status} />
        </View>

        {saveError && (
          <View style={[styles.errorBanner, { backgroundColor: `${c.error}20`, borderColor: c.error }]}>
            <Text style={{ color: c.error }}>{saveError}</Text>
          </View>
        )}

        <View style={styles.fields}>
          <TextInputApp
            testID="role-name-input"
            label="Role Name (code)"
            placeholder="e.g. roleProjectManager"
            value={form.roleName}
            onChangeText={(v) => handleFieldChange('roleName', v)}
            error={errors.roleName}
            autoCapitalize="none"
          />

          <TextInputApp
            testID="role-title-input"
            label="Role Title (display name)"
            placeholder="e.g. Project Manager"
            value={form.roleTitle}
            onChangeText={(v) => handleFieldChange('roleTitle', v)}
            error={errors.roleTitle}
          />

          <TextInputApp
            testID="role-desc-input"
            label="Description"
            placeholder="Description of role permissions..."
            value={form.roleDescription || ''}
            onChangeText={(v) => handleFieldChange('roleDescription', v)}
            multiline
            numberOfLines={3}
          />

          <SwitchApp
            testID="role-active-switch"
            label="Active role"
            value={form.isActive}
            onValueChange={(v) => handleFieldChange('isActive', v)}
          />
        </View>

        <View style={styles.btnRow}>
          <ButtonTextApp
            testID="role-cancel-btn"
            title="Cancel"
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }} />
          {!isNew && (
            <ButtonTextApp
              testID="role-delete-btn"
              title="Delete"
              color={c.error}
              onPress={handleDelete}
            />
          )}
          <ButtonPrimaryApp
            testID="role-save-btn"
            title={isNew ? 'Create Role' : 'Save Changes'}
            onPress={handleSave}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  deniedTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  deniedSub: { fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 360 },
  container: { padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700' },
  errorBanner: { padding: 10, borderRadius: 8, borderWidth: 1 },
  fields: { gap: 14 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
});
