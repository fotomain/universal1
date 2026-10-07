// ReusableTableDemo - route /demo/reusabletable. Shows ReusableTable with local sample data:
// sortable columns, search, pagination, row selection and custom cells (status badge, money).
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import ReusableTable from './ReusableTable';
import type { ReusableTableColumn } from './reusableTableTypes';

interface DemoRow {
  rowGUID: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
  updated: string;
}

const CATEGORIES = ['Timber', 'Panels', 'Hardware', 'Finishes'];
const NAMES = ['Pine board', 'Oak plank', 'Birch plywood', 'MDF sheet', 'Deck screw', 'Hinge', 'Wood oil', 'Varnish', 'Spruce beam', 'OSB panel', 'Corner bracket', 'Wax'];
const STATUSES: DemoRow['status'][] = ['active', 'draft', 'archived'];

export const DEMO_ROWS: DemoRow[] = Array.from({ length: 37 }, (_, i) => ({
  rowGUID: `demo-${i + 1}`,
  name: `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
  category: CATEGORIES[i % CATEGORIES.length],
  price: Math.round((4.5 + ((i * 37) % 190)) * 100) / 100,
  stock: (i * 13) % 85,
  status: STATUSES[i % STATUSES.length],
  updated: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String(((i * 7) % 27) + 1).padStart(2, '0')}`,
}));

const STATUS_COLOR: Record<DemoRow['status'], string> = { active: '#16a34a', draft: '#d97706', archived: '#6b7280' };

export default function ReusableTableDemo() {
  const { themeColors: c } = useDesignSystem();
  const [selected, setSelected] = useState<string[]>([]);
  const [pressed, setPressed] = useState<string>('');

  const columns: ReusableTableColumn<DemoRow>[] = [
    { key: 'name', title: 'Name', width: 190, sortable: true },
    { key: 'category', title: 'Category', width: 130, sortable: true },
    {
      key: 'price', title: 'Price', width: 110, align: 'right', sortable: true,
      renderCell: (r) => <Text style={{ color: c.text, fontVariant: ['tabular-nums'] }}>{r.price.toFixed(2)} €</Text>,
    },
    { key: 'stock', title: 'Stock', width: 90, align: 'right', sortable: true },
    {
      key: 'status', title: 'Status', width: 120, sortable: true,
      renderCell: (r) => (
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[r.status] + '22' }]}>
          <Text style={{ color: STATUS_COLOR[r.status], fontSize: 12, fontWeight: '700' }}>{r.status}</Text>
        </View>
      ),
    },
    { key: 'updated', title: 'Updated', width: 120, sortable: true, searchable: false },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={styles.content} testID="reusable-table-demo">
      <ReusableTable
        title="Reusable table"
        data={DEMO_ROWS}
        columns={columns}
        keyExtractor={(r) => r.rowGUID}
        pageSize={10}
        initialSort={{ key: 'name', direction: 'asc' }}
        selectable
        onSelectionChange={setSelected}
        onRowPress={(r) => setPressed(r.name)}
      />
      <Text testID="reusable-table-demo-info" style={{ color: c.text, opacity: 0.7, marginTop: 12 }}>
        Selected: {selected.length}{pressed ? ` · last pressed: ${pressed}` : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 900, width: '100%', alignSelf: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
