import React, { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import DepartamentCard from './DepartamentCard';
import DepartamentEditModal from './DepartamentEditModal';
import {
  DEPARTAMENT_ENTITY,
  DepartamentRow,
  departamentToCard,
  flattenDepartamentTree,
} from './departamentModel';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export interface DepartamentListProps {
  organizationGUID?: string;
  testID?: string;
}

export default function DepartamentList({ organizationGUID, testID = 'departament-list-screen' }: DepartamentListProps) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();

  const readParams = organizationGUID ? { match: { rowOwnerGUID: organizationGUID } } : undefined;
  const status = useRealtimeEntity(DEPARTAMENT_ENTITY, { readParams });

  const allRows: DepartamentRow[] =
    useSelector((s: any) => s?.[DEPARTAMENT_ENTITY]?.entityDataFromServer) || [];

  const rows = organizationGUID
    ? allRows.filter((r) => r.rowOwnerGUID === organizationGUID)
    : allRows;

  // Selected organization fallback
  const firstOrgGUID = organizationGUID || rows[0]?.rowOwnerGUID || 'defaultOrg';

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRow, setEditingRow] = useState<DepartamentRow | null>(null);
  const [parentGUIDForNew, setParentGUIDForNew] = useState<string>('empty');

  const handleCreateRoot = () => {
    setEditingRow(null);
    setParentGUIDForNew('empty');
    setModalVisible(true);
  };

  const handleCreateChild = (parentCardId: string) => {
    setEditingRow(null);
    setParentGUIDForNew(parentCardId);
    setModalVisible(true);
  };

  const handleEdit = (id: string) => {
    const target = rows.find((r) => r.rowGUID === id);
    if (target) {
      setEditingRow(target);
      setModalVisible(true);
    }
  };

  const handleDelete = (id: string) => {
    const actions = SystemMetaData[DEPARTAMENT_ENTITY]?.actions;
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

  // For native flatlist, flatten tree
  const hierarchicalItems = flattenDepartamentTree(rows);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID={testID}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: c.text }]}>Departments</Text>
          <CurrencyRealtimeBadge status={status} />
        </View>
        <Pressable
          testID="departament-create-btn"
          style={[styles.createBtn, { backgroundColor: c.primary }]}
          onPress={handleCreateRoot}
          accessibilityRole="button"
          accessibilityLabel="Add department"
        >
          <IconApp name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Add Department</Text>
        </Pressable>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {Platform.OS === 'web' && ListWebCardsComponent ? (
          <ListWebCardsComponent
            entityName={DEPARTAMENT_ENTITY}
            crudListTitle="Departments"
            crudCardHeight={84}
            crudListWidth={640}
            crudGapBetweenCards={10}
            listOwnerGUID={firstOrgGUID}
            realtime={true}
            readParams={readParams}
            itemLabel="Department"
            hierarchyEnabled={true}
            mapItemToCard={(item: any, index: number) => departamentToCard(item, index)}
            CardComponent={
              <DepartamentCard
                card={{ id: '', title: '', description: '' }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCreateChild={handleCreateChild}
              />
            }
            onCreateNewItem={handleCreateRoot}
            onCreateChildItem={handleCreateChild}
            onEditCard={handleEdit}
          />
        ) : (
          <FlatList
            data={hierarchicalItems}
            keyExtractor={(item) => item.row.rowGUID}
            contentContainerStyle={styles.nativeList}
            renderItem={({ item, index }) => (
              <View style={{ paddingLeft: item.depth * 20 }}>
                <DepartamentCard
                  card={departamentToCard(item.row, index, item.depth, item.hasChildren)}
                  depth={item.depth}
                  hasChildren={item.hasChildren}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onCreateChild={handleCreateChild}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <IconApp name="schema" size={48} color={c.text + '99'} />
                <Text style={[styles.emptyText, { color: c.text + '99' }]}>
                  No departments found. Click "Add Department" to start your hierarchy.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Edit / Create Modal */}
      <DepartamentEditModal
        visible={modalVisible}
        organizationGUID={firstOrgGUID}
        initialRow={editingRow}
        initialParentGUID={parentGUIDForNew}
        onClose={() => setModalVisible(false)}
      />
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
    alignItems: 'center',
    gap: 12,
  },
  headerLeft: {
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
