import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import UserRoleCard from './UserRoleCard';
import {
  USER_ROLE_ENTITY,
  USER_ROLE_READ_PARAMS,
  USER_ROLE_ROUTES,
  UserRoleRow,
  userRoleToCard,
} from './userRoleModel';
import { useIsAppAdmin } from '../role/useIsAppAdmin';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export default function UserRoleList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const status = useRealtimeEntity(USER_ROLE_ENTITY, { readParams: USER_ROLE_READ_PARAMS });

  const rows: UserRoleRow[] =
    useSelector((s: any) => s?.[USER_ROLE_ENTITY]?.entityDataFromServer) || [];

  const handleCreate = () => {
    router.push(USER_ROLE_ROUTES.edit as any);
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: USER_ROLE_ROUTES.edit as any, params: { rowGUID: id } });
  };

  const handleDelete = (id: string) => {
    const actions = SystemMetaData[USER_ROLE_ENTITY]?.actions;
    if (!actions) return;
    const target = rows.find((r) => r.rowGUID === id);
    if (!target) return;
    dispatch(
      actions.deleteOne({
        rowGUID: target.rowGUID,
        rowOwnerGUID: target.rowOwnerGUID,
      })
    );
  };

  if (!isAdmin) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.background }]} testID="user-role-admin-denied">
        <IconApp name="lock" size={48} color={c.error} />
        <Text style={[styles.deniedTitle, { color: c.text }]}>Access Denied</Text>
        <Text style={[styles.deniedSub, { color: `${c.text}99` }]}>
          Only users with the "roleAppAdmin" role can access User Roles Management.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="user-role-list-screen">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: c.text }]}>User Roles</Text>
          <CurrencyRealtimeBadge status={status} />
        </View>
        <Pressable
          testID="user-role-create-btn"
          style={[styles.createBtn, { backgroundColor: c.primary }]}
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Assign user role"
        >
          <IconApp name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Assign Role</Text>
        </Pressable>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {Platform.OS === 'web' && ListWebCardsComponent ? (
          <ListWebCardsComponent
            entityName={USER_ROLE_ENTITY}
            entityForArchivationName=""
            crudListTitle="User Roles"
            itemLabel="User Role"
            listOwnerGUID=""
            CardComponent={UserRoleCard}
            mapItemToCard={userRoleToCard}
            onCreateNewItem={handleCreate}
            onEditCard={handleEdit}
            readParams={USER_ROLE_READ_PARAMS}
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
                No user roles assigned yet.
              </Text>
            }
            renderItem={({ item, index }) => (
              <UserRoleCard
                card={userRoleToCard(item, index)}
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
