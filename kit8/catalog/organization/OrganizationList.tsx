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
import OrganizationCard from './OrganizationCard';
import {
  ORGANIZATION_CATALOG_OWNER,
  ORGANIZATION_ENTITY,
  ORGANIZATION_READ_PARAMS,
  ORGANIZATION_ROUTES,
  OrganizationRow,
  emptyOrganization,
  organizationToCard,
} from './organizationModel';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent
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
  const autoCreatedRef = useRef(false);

  // Auto-creation requirement:
  // "Automatically created upon first user login with createdByUser: userState.activeUserEmail"
  useEffect(() => {
    if (
      !isLoggedIn ||
      !activeUserEmail ||
      activeUserEmail === 'user@example.com' ||
      autoCreatedRef.current
    ) {
      return;
    }

    // Check if user already has an organization
    const hasOrg = rows.some(
      (r) =>
        r?.rowJSON?.createdByUser &&
        r.rowJSON.createdByUser.toLowerCase() === activeUserEmail.toLowerCase()
    );

    if (!hasOrg && rows.length >= 0 && (status === 'synced' || status === 'idle')) {
      const actions = SystemMetaData[ORGANIZATION_ENTITY]?.actions;
      if (actions?.createOne) {
        autoCreatedRef.current = true;
        const newRowGUID = Crypto.randomUUID();
        const initialOrg = emptyOrganization(activeUserEmail);
        const namePart = activeUserEmail.split('@')[0] || 'User';
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        initialOrg.organizationTitle = `${formattedName}'s Organization`;
        initialOrg.organizationLegalName = `${formattedName} Organization SIA`;

        dispatch(
          actions.createOne({
            rowGUID: newRowGUID,
            rowOwnerGUID: ORGANIZATION_CATALOG_OWNER,
            rowParentGUID: 'empty',
            orderInList: Date.now(),
            rowJSON: initialOrg,
          })
        );
      }
    }
  }, [isLoggedIn, activeUserEmail, rows, status, dispatch]);

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
