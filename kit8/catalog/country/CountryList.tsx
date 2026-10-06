import React, { useEffect, useRef } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import CountryCard from './CountryCard';
import {
  COUNTRY_CATALOG_OWNER,
  COUNTRY_ENTITY,
  COUNTRY_READ_PARAMS,
  COUNTRY_ROUTES,
  CountryRow,
  DEFAULT_COUNTRIES,
  countryToCard,
} from './countryModel';

import { useIsAppAdmin } from '../role/useIsAppAdmin';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../ui/components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export default function CountryList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isAdmin = useIsAppAdmin();
  const status = useRealtimeEntity(COUNTRY_ENTITY, { readParams: COUNTRY_READ_PARAMS });

  const rows: CountryRow[] =
    useSelector((s: any) => s?.[COUNTRY_ENTITY]?.entityDataFromServer) || [];
  const autoSeededRef = useRef(false);

  // Client-side auto-seed fallback:
  // "Must be Automatically created if the first user login. Default countries needed."
  useEffect(() => {
    if (autoSeededRef.current) return;
    if (rows.length === 0 && (status === 'subscribed' || status === 'idle')) {
      const actions = SystemMetaData[COUNTRY_ENTITY]?.actions;
      if (actions?.createOne) {
        autoSeededRef.current = true;
        DEFAULT_COUNTRIES.forEach((def, idx) => {
          const newRowGUID = Crypto.randomUUID();
          dispatch(
            actions.createOne({
              rowGUID: newRowGUID,
              rowOwnerGUID: COUNTRY_CATALOG_OWNER,
              rowParentGUID: 'empty',
              orderInList: (idx + 1) * 1000,
              rowJSON: {
                ...def,
                isActive: true,
              },
            })
          );
        });
      }
    }
  }, [rows.length, status, dispatch]);

  const handleCreate = () => {
    if (!isAdmin) return;
    router.push(COUNTRY_ROUTES.edit as any);
  };

  const handleEdit = (id: string) => {
    if (!isAdmin) return;
    router.push({ pathname: COUNTRY_ROUTES.edit as any, params: { rowGUID: id } });
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    const actions = SystemMetaData[COUNTRY_ENTITY]?.actions;
    if (!actions) return;
    const target = rows.find((r) => r.rowGUID === id);
    if (!target) return;
    dispatch(
      actions.deleteOne({
        rowGUID: target.rowGUID,
        rowOwnerGUID: target.rowOwnerGUID || COUNTRY_CATALOG_OWNER,
      })
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="country-list-screen">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: c.text }]}>Countries</Text>
          <CurrencyRealtimeBadge status={status} />
        </View>
        {isAdmin && (
          <Pressable
            testID="country-create-btn"
            style={[styles.createBtn, { backgroundColor: c.primary }]}
            onPress={handleCreate}
            accessibilityRole="button"
            accessibilityLabel="Add country"
          >
            <IconApp name="add" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Add Country</Text>
          </Pressable>
        )}
      </View>

      {/* Body: Web ListWebCardsComponent or Native FlatList */}
      <View style={styles.body}>
        {Platform.OS === 'web' && ListWebCardsComponent ? (
          <ListWebCardsComponent
            entityName={COUNTRY_ENTITY}
            crudListTitle="Countries"
            crudCardHeight={80}
            crudListWidth={640}
            crudGapBetweenCards={10}
            realtime={true}
            readParams={COUNTRY_READ_PARAMS}
            itemLabel="Country"
            mapItemToCard={(item: any, index: number) => countryToCard(item, index)}
            CardComponent={
              <CountryCard
                card={{ id: '', title: '', description: '' }}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            }
            onCreateNewItem={handleCreate}
            onEditCard={handleEdit}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.rowGUID}
            contentContainerStyle={styles.nativeList}
            renderItem={({ item, index }) => (
              <CountryCard
                card={countryToCard(item, index)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <IconApp name="public" size={48} color={c.text + '99'} />
                <Text style={[styles.emptyText, { color: c.text + '99' }]}>
                  No countries found. Click "Add Country" to create one.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  headerLeft: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
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
    fontWeight: '600',
    fontSize: 14,
  },
  body: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  nativeList: {
    gap: 10,
    paddingBottom: 40,
    maxWidth: 640,
    width: '100%',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
