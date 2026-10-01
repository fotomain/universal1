import React, { useEffect, useRef } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import RoleCard from './RoleCard';
import {
  DEFAULT_ROLES,
  ROLE_CATALOG_OWNER,
  ROLE_ENTITY,
  ROLE_READ_PARAMS,
  ROLE_ROUTES,
  RoleRow,
  roleToCard,
} from './roleModel';
import { useIsAppAdmin } from './useIsAppAdmin';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export default function RoleList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const status = useRealtimeEntity(ROLE_ENTITY, { readParams: ROLE_READ_PARAMS });

  const rows: RoleRow[] =
    useSelector((s: any) => s?.[ROLE_ENTITY]?.entityDataFromServer) || [];
  const autoSeededRef = useRef(false);

  // Auto-seed default roles if table empty
  useEffect(() => {
    if (autoSeededRef.current) return;
    if (rows.length === 0 && (status === 'subscribed' || status === 'idle')) {
      const actions = SystemMetaData[ROLE_ENTITY]?.actions;
      if (actions?.createOne) {
        autoSeededRef.current = true;
        DEFAULT_ROLES.forEach((def, idx) => {
          const newRowGUID = Crypto.randomUUID();
          dispatch(
            actions.createOne({
              rowGUID: newRowGUID,
              rowOwnerGUID: ROLE_CATALOG_OWNER,
              rowParentGUID: 'empty',
              orderInList: (idx + 1) * 1000,
              rowJSON: {
                ...def,
              },
            })
          );
        });
      }
    }
  }, [rows.length, status, dispatch]);

  const handleCreate = () => {
    router.push(ROLE_ROUTES.edit as any);
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: ROLE_ROUTES.edit as any, params: { rowGUID: id } });
  };

  const handleDelete = (id: string) => {
    const actions = SystemMetaData[ROLE_ENTITY]?.actions;
    if (!actions) return;
    const target = rows.find((r) => r.rowGUID === id);
    if (!target) return;
    dispatch(
      actions.deleteOne({
        rowGUID: target.rowGUID,
        rowOwnerGUID: target.rowOwnerGUID || ROLE_CATALOG_OWNER,
      })
    );
  };

  if (!isAdmin) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.background }]} testID="role-admin-denied">
        <IconApp name="lock" size={48} color={c.error} />
        <Text style={[styles.deniedTitle, { color: c.text }]}>Access Denied</Text>
        <Text style={[styles.deniedSub, { color: `${c.text}99` }]}>
          Only users with the "roleAppAdmin" role can access Role Management.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="role-list-screen">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: c.text }]}>Roles Catalog</Text>
          <CurrencyRealtimeBadge status={status} />
        </View>
        <Pressable
          testID="role-create-btn"
          style={[styles.createBtn, { backgroundColor: c.primary }]}
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Add role"
        >
          <IconApp name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Add Role</Text>
        </Pressable>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {Platform.OS === 'web' && ListWebCardsComponent ? (
          <ListWebCardsComponent
            entityName={ROLE_ENTITY}
            entityForArchivationName=""
            crudListTitle="Roles"
            itemLabel="Role"
            listOwnerGUID={ROLE_CATALOG_OWNER}
            CardComponent={RoleCard}
            mapItemToCard={roleToCard}
            onCreateNewItem={handleCreate}
            onEditCard={handleEdit}
            readParams={ROLE_READ_PARAMS}
            crudCardHeight={68}
            crudListWidth={640}
            crudGapBetweenCards={8}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.rowGUID}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: `${c.text}88` }]}>
                No roles defined in the catalog.
              </Text>
            }
            renderItem={({ item, index }) => (
              <RoleCard
                card={roleToCard(item, index)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  deniedTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  deniedSub: { fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 360 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
});
