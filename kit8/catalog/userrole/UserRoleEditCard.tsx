import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../ui/components/common';
import IconApp from '../../ui/components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import {
  USER_ROLE_ENTITY,
  USER_ROLE_READ_PARAMS,
  USER_ROLE_ROUTES,
  UserRoleErrors,
  UserRoleRow,
  UserRoleRowJSON,
  emptyUserRole,
  validateUserRole,
} from './userRoleModel';
import { ROLE_ENTITY, ROLE_READ_PARAMS, RoleRow } from '../role/roleModel';
import { useIsAppAdmin } from '../role/useIsAppAdmin';

export default function UserRoleEditCard() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const { rowGUID } = useLocalSearchParams<{ rowGUID?: string }>();
  const isNew = !rowGUID;

  const status = useRealtimeEntity(USER_ROLE_ENTITY, { readParams: USER_ROLE_READ_PARAMS });
  useRealtimeEntity(ROLE_ENTITY, { readParams: ROLE_READ_PARAMS });

  const rows: UserRoleRow[] =
    useSelector((s: any) => s?.[USER_ROLE_ENTITY]?.entityDataFromServer) || [];
  const availableRoles: RoleRow[] =
    useSelector((s: any) => s?.[ROLE_ENTITY]?.entityDataFromServer) || [];

  const existing = useMemo(
    () => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined),
    [rows, rowGUID]
  );

  const [form, setForm] = useState<UserRoleRowJSON>(() => ({
    ...emptyUserRole(),
    ...(existing?.rowJSON || {}),
  }));
  const [errors, setErrors] = useState<UserRoleErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (existing?.rowJSON) {
      setForm((prev) => ({
        ...prev,
        ...existing.rowJSON,
      }));
    }
  }, [existing]);

  const handleFieldChange = (field: keyof UserRoleRowJSON, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof UserRoleErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof UserRoleErrors];
        return next;
      });
    }
    setSaveError(null);
  };

  const handleSelectRole = (role: RoleRow) => {
    setForm((prev) => ({
      ...prev,
      roleName: role.rowJSON?.roleName || '',
      roleTitle: role.rowJSON?.roleTitle || role.rowJSON?.roleName || '',
      roleGUID: role.rowGUID,
    }));
    if (errors.roleName) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.roleName;
        return next;
      });
    }
  };

  const handleSave = () => {
    if (!isAdmin) {
      setSaveError('Permission denied: only roleAppAdmin can modify user roles.');
      return;
    }

    const others = rows.filter((r) => (rowGUID ? r.rowGUID !== rowGUID : true));
    const validationErrors = validateUserRole(form, others);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const actions = SystemMetaData[USER_ROLE_ENTITY]?.actions;
    if (!actions) {
      setSaveError('System entity metadata for user roles not available.');
      return;
    }

    const email = form.userEmail.trim();
    const payloadJSON: UserRoleRowJSON = {
      userEmail: email,
      roleName: form.roleName.trim(),
      roleTitle: form.roleTitle?.trim() || form.roleName.trim(),
      roleGUID: form.roleGUID || '',
      isActive: form.isActive !== false,
    };

    if (isNew) {
      const newGUID = Crypto.randomUUID();
      const nextOrder = (rows.length + 1) * 1000;
      dispatch(
        actions.createOne({
          rowGUID: newGUID,
          rowOwnerGUID: email,
          rowParentGUID: form.roleGUID || 'empty',
          orderInList: nextOrder,
          rowJSON: payloadJSON,
        })
      );
    } else if (existing) {
      dispatch(
        actions.updateOne({
          rowGUID: existing.rowGUID,
          rowOwnerGUID: existing.rowOwnerGUID || email,
          rowParentGUID: existing.rowParentGUID || 'empty',
          orderInList: existing.orderInList,
          rowJSON: payloadJSON,
        })
      );
    }

    router.replace(USER_ROLE_ROUTES.list as any);
  };

  const handleDelete = () => {
    if (!isAdmin) return;
    if (!existing) return;
    const actions = SystemMetaData[USER_ROLE_ENTITY]?.actions;
    if (actions?.deleteOne) {
      dispatch(
        actions.deleteOne({
          rowGUID: existing.rowGUID,
          rowOwnerGUID: existing.rowOwnerGUID,
        })
      );
    }
    router.replace(USER_ROLE_ROUTES.list as any);
  };

  if (!isAdmin) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.background }]} testID="user-role-edit-admin-denied">
        <IconApp name="lock" size={48} color={c.error} />
        <Text style={[styles.deniedTitle, { color: c.text }]}>Access Denied</Text>
        <Text style={[styles.deniedSub, { color: `${c.text}99` }]}>
          Only users with "roleAppAdmin" can view or edit user roles.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={styles.container}
      testID="user-role-edit-screen"
    >
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>
            {isNew ? 'Assign User Role' : `Edit Role for ${existing?.rowJSON?.userEmail || 'User'}`}
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
            testID="user-role-email-input"
            label="User Email"
            placeholder="user@example.com"
            value={form.userEmail}
            onChangeText={(v) => handleFieldChange('userEmail', v)}
            error={errors.userEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[styles.sectionLabel, { color: c.text }]}>Select Role</Text>
          {errors.roleName && (
            <Text style={{ color: c.error, fontSize: 12 }}>{errors.roleName}</Text>
          )}

          <View style={styles.roleGrid}>
            {availableRoles.map((r) => {
              const rName = r.rowJSON?.roleName;
              const isSelected = form.roleName === rName;
              return (
                <Pressable
                  key={r.rowGUID}
                  testID={`role-select-${rName}`}
                  onPress={() => handleSelectRole(r)}
                  style={[
                    styles.roleChip,
                    {
                      borderColor: isSelected ? c.primary : c.border,
                      backgroundColor: isSelected ? `${c.primary}20` : 'transparent',
                    },
                  ]}
                >
                  <IconApp
                    name={isSelected ? 'check_circle' : 'radio_button_unchecked'}
                    size={18}
                    color={isSelected ? c.primary : c.border}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.roleChipTitle,
                        { color: isSelected ? c.primary : c.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {r.rowJSON?.roleTitle || rName}
                    </Text>
                    <Text style={[styles.roleChipCode, { color: `${c.text}88` }]}>
                      {rName}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <SwitchApp
            testID="user-role-active-switch"
            label="Active assignment"
            value={form.isActive}
            onValueChange={(v) => handleFieldChange('isActive', v)}
          />
        </View>

        <View style={styles.btnRow}>
          <ButtonTextApp
            testID="user-role-cancel-btn"
            title="Cancel"
            onPress={() => router.back()}
          />
          <View style={{ flex: 1 }} />
          {!isNew && (
            <ButtonTextApp
              testID="user-role-delete-btn"
              title="Delete"
              color={c.error}
              onPress={handleDelete}
            />
          )}
          <ButtonPrimaryApp
            testID="user-role-save-btn"
            title={isNew ? 'Assign Role' : 'Save Changes'}
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
  sectionLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  roleGrid: { gap: 8 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  roleChipTitle: { fontSize: 14 },
  roleChipCode: { fontSize: 12 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
});
