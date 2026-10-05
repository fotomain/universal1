// ContractList - embedded contract list component for PersonEdit and PartnerEdit.
// Scoped by rowOwnerGUID (the Person or Partner rowGUID) and synchronized via Supabase Realtime.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import { matchRow } from '../../redux/reusable/realtimeRows';
import ContractCard from './ContractCard';
import ContractEdit from './ContractEdit';
import { CONTRACT_ENTITY, ContractRow, contractToCard } from './contractModel';

export interface ContractListProps {
  ownerGUID: string;
  partyType: 'person' | 'partner';
  defaultCurrency?: string;
  disabled?: boolean;
}

export default function ContractList({ ownerGUID, partyType, defaultCurrency = 'EUR', disabled }: ContractListProps) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[CONTRACT_ENTITY]?.actions;

  const readParams = useMemo(() => ({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: ownerGUID } }), [ownerGUID]);
  useRealtimeEntity(CONTRACT_ENTITY, { readParams, enabled: !!ownerGUID && !disabled });

  const allRows: ContractRow[] = useSelector((s: any) => s?.[CONTRACT_ENTITY]?.entityDataFromServer) || [];
  const contracts = useMemo(() => {
    if (!ownerGUID) return [];
    return allRows
      .filter((r) => matchRow(r, { rowOwnerGUID: ownerGUID }))
      .sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  }, [allRows, ownerGUID]);

  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const openNew = () => {
    setEditingContract(null);
    setModalVisible(true);
  };

  const openEdit = (id: string) => {
    const found = contracts.find((r) => r.rowGUID === id);
    if (found) {
      setEditingContract(found);
      setModalVisible(true);
    }
  };

  const deleteContract = (id: string) => {
    if (actions?.deleteOne) {
      dispatch(actions.deleteOne({ rowGUID: id, rowOwnerGUID: ownerGUID }));
    }
  };

  if (disabled || !ownerGUID) {
    return (
      <View style={[styles.container, { backgroundColor: `${c.border}20`, borderColor: c.border }]}>
        <Text style={[styles.hintText, { color: c.text }]}>
          Save this {partyType} record first to manage contracts.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: c.border }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconApp name="description" size={18} color={c.primary} />
          <Text style={[styles.headerTitle, { color: c.text }]}>
            Contracts ({contracts.length})
          </Text>
        </View>

        <Pressable
          testID="contract-list-add"
          onPress={openNew}
          style={[styles.addButton, { backgroundColor: c.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Add contract"
        >
          <IconApp name="add" size={16} color="#fff" />
          <Text style={styles.addText}>Add Contract</Text>
        </Pressable>
      </View>

      {contracts.length === 0 ? (
        <Text style={[styles.emptyText, { color: c.text }]}>No contracts added yet.</Text>
      ) : (
        <View style={styles.list}>
          {contracts.map((item, index) => (
            <ContractCard
              key={item.rowGUID}
              card={contractToCard(item, index)}
              onEdit={openEdit}
              onDelete={deleteContract}
            />
          ))}
        </View>
      )}

      <ContractEdit
        visible={modalVisible}
        contractRow={editingContract}
        ownerGUID={ownerGUID}
        partyType={partyType}
        defaultCurrency={defaultCurrency}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  addText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 12,
    opacity: 0.6,
    fontSize: 13,
  },
  list: {
    gap: 8,
  },
  hintText: {
    textAlign: 'center',
    padding: 12,
    opacity: 0.7,
    fontStyle: 'italic',
    fontSize: 13,
  },
});
