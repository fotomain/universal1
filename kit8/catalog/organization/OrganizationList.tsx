import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import OrganizationCard from './OrganizationCard';
import {
  ORGANIZATION_CATALOG_OWNER,
  ORGANIZATION_ENTITY,
  ORGANIZATION_READ_PARAMS,
  ORGANIZATION_ROUTES,
  OrganizationRow,
  organizationToCard,
} from './organizationModel';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../ui/components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export default function OrganizationList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const status = useRealtimeEntity(ORGANIZATION_ENTITY, { readParams: ORGANIZATION_READ_PARAMS });

  const rows: OrganizationRow[] =
    useSelector((s: any) => s?.[ORGANIZATION_ENTITY]?.entityDataFromServer) || [];
  const activeUserEmail = useSelector((s: any) => s?.activeUserState?.activeUserEmail);
  const isLoggedIn = useSelector((s: any) => Boolean(s?.activeUserState?.isLoggedIn));
  // 1 user === 1 organization: it is created once at login (ensureUserOrganization, app/_layout.tsx), never here.

  const openNew = () => router.push(ORGANIZATION_ROUTES.edit as any);
  const openEdit = (rowGUID: string) =>
    router.push({ pathname: ORGANIZATION_ROUTES.edit, params: { rowGUID } } as any);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="organization-list">
      <View style={styles.header}>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable
            testID="organization-add"
            onPress={openNew}
            style={[styles.add, { backgroundColor: c.primary }]}
            accessibilityLabel="Add organization"
          >
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={ORGANIZATION_ENTITY}
          entityForArchivationName=""
          crudListTitle="Organizations"
          itemLabel="Organization"
          listOwnerGUID={ORGANIZATION_CATALOG_OWNER}
          CardComponent={OrganizationCard}
          mapItemToCard={organizationToCard}
          onCreateNewItem={openNew}
          onEditCard={(id: string) => openEdit(id)}
          readParams={ORGANIZATION_READ_PARAMS}
          crudCardHeight={76}
          crudListWidth={640}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativeOrganizationList onEdit={openEdit} />
      )}
    </View>
  );
}

function NativeOrganizationList({ onEdit }: { onEdit: (rowGUID: string) => void }) {
  const dispatch = useDispatch();
  const rows: OrganizationRow[] =
    useSelector((s: any) => s?.[ORGANIZATION_ENTITY]?.entityDataFromServer) || [];
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[ORGANIZATION_ENTITY]?.actions;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={
        <Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>
          No organizations in catalog yet.
        </Text>
      }
      renderItem={({ item, index }) => (
        <OrganizationCard
          card={organizationToCard(item, index)}
          onEdit={onEdit}
          onDelete={(id) => actions?.deleteOne && dispatch(actions.deleteOne({ rowGUID: id }))}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
