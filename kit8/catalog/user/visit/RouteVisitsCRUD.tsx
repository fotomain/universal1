// RouteVisitsCRUD - "System settings -> Routes visits": the routes the user opened and how often (app_route_visits_turnover), a ReusableTable.
//   Columns: Route (rowParentGUID) · Visits (rowJSON.number_of_route_visits) · Last visit. Read only: the app counts (route_visit_register); the user can delete rows (crud panel) or CLEAR the whole table (route_visits_clear: his rows only).
//   The counting is a switch of the Organization (Organization edit -> System -> Number of visits, on by default).
//   SQL: PART 41 of kit8/sql/start. Route: /user/visits (drawer: System settings > Routes visits)
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import IconApp from '../../../ui/components/common/IconApp';
import ModalAskComponent from '../../../ui/components/common/ModalAskComponent';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import { pmNumberColumn } from '../../../pm/components/pmNumberColumn';
import { pmT } from '../../../pm/i18n/pmT';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { useMyOrganization } from '../../organization/useMyOrganization';
import { ROUTE_VISIT_TABLE, formatLastVisit } from './routeVisitModel';
import { useRouteVisitData } from './useRouteVisitData';

export default function RouteVisitsCRUD({ testID = 'route-visits' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const { numberOfVisitsEnabled } = useMyOrganization();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const def = ROUTE_VISIT_TABLE;
  const { rows, loaded, error, reload } = useRouteVisitData(true);
  const [askClear, setAskClear] = useState(false);
  const [clearError, setClearError] = useState('');

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'route', title: pmT('Route'), type: 'text', target: 'rowParentGUID', editable: false, width: 420 },
    { key: 'visits', title: pmT('Visits'), type: 'number', field: 'number_of_route_visits', editable: false, width: 120, total: false, stepper: false, ...pmNumberColumn(ROUTE_VISIT_TABLE.table, 'number_of_route_visits', false) },
    { key: 'last', title: pmT('Last visit'), type: 'text', field: 'last_visit_at', editable: false, width: 180, fromStored: (stored: any) => formatLastVisit(stored) },
  ], []);

  const clearAll = async () => {
    setAskClear(false);
    try {
      const { error: e } = await (supabase as any).rpc('route_visits_clear');
      if (e) throw e;
      setClearError('');
      reload();
    } catch (e: any) {
      setClearError(e?.message || String(e));
    }
  };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="route" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>{pmT('Routes visits')}</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{def.purpose} · {rows.length} {pmT('routes')}</Text>
        </View>
        <PMIconButton tipScope="app" testID={`${testID}-reload`} icon="refresh" title="Read the visits again" color={c.text} onPress={reload} />
        <PMIconButton tipScope="app" testID={`${testID}-clear`} icon="delete_sweep" title="Clear the table: delete all your visits" color={c.text} onPress={() => setAskClear(true)} />
      </View>
      {!numberOfVisitsEnabled && (
        <View testID={`${testID}-off`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
          <IconApp name="info" size={18} color={c.text} />
          <Text style={{ color: c.text, flex: 1 }}>{pmT('Counting is switched off in your organization (Organization edit -> System -> Number of visits).')}</Text>
        </View>
      )}
      {!!(error || clearError) && (
        <View testID={`${testID}-setup`} style={[styles.note, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>The visits could not be read or cleared ({clearError || error}). Run kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql (PART 41) in the Supabase SQL editor and sign in.</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName={def.entity}
          crudListTitle={pmT('Routes visits')}
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          addEnabled={false}
          resizeColumnWidth
          realtime
          emptyText={loaded ? pmT('No visits yet.') : pmT('Loading…')}
        />
      </ScrollView>
      <ModalAskComponent
        visible={askClear}
        testID={`${testID}-ask-clear`}
        modalTopBar={pmT('Clear the table?')}
        modalBody={pmT('All your route visits will be deleted. The counting starts again from 1.')}
        confirmLabel={pmT('Clear')}
        onCancel={() => setAskClear(false)}
        onConfirm={clearAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 16, paddingBottom: 12, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
});
