// MoneyAccountCRUD - the money accounts (moneyAccountTable): a ReusableTable with CRUD and a tree of FOLDERS = LEGAL ENTITIES on the left, and below it the REST of the account picked in the list.
//   Columns: Title · Kind (Bank | Cash) · Currency · Account no. · Bank · Opening date · Opening balance · Legal entity (the folder) · Active
//   A new account goes into the picked legal entity folder. The currency, the opening date and the opening balance of an account with posted payments cannot change (the database refuses).
//   SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 38. Route: /catalog/money/account (drawer: Catalogs > Money accounts)
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../pm/store/store_pm';
import { pmNumberColumn } from '../../pm/components/pmNumberColumn';
import { pmT } from '../../pm/i18n/pmT';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../ui/components/tree/folderTreeModel';
import { legalEntityTitle } from '../legal_entity/legalEntityModel';
import { MONEY_ACCOUNT_KINDS, MONEY_ACCOUNT_NO_FOLDER, MONEY_ACCOUNT_TABLE, moneyAccountFolderNodes, moneyAccountLabel } from './moneyAccountModel';
import { useMoneyAccountData } from './useMoneyAccountData';
import MoneyAccountRests from './MoneyAccountRests';

export default function MoneyAccountCRUD({ testID = 'money-account' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const def = MONEY_ACCOUNT_TABLE;
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const [picked, setPicked] = useState<string>('');
  const { rows, legalEntities, loaded, error, reload } = useMoneyAccountData(true);
  const [allEntities, setAllEntities] = useState(false);

  const nodes = useMemo(() => moneyAccountFolderNodes(legalEntities, rows, allEntities), [legalEntities, rows, allEntities]);
  const foldersTree = useMemo(() => ({ nodes, folderTarget: 'rowParentGUID' as const, noFolderValue: MONEY_ACCOUNT_NO_FOLDER }), [nodes]);
  const entityOptions = useMemo(() => legalEntities.map((x) => ({ value: x.rowGUID, label: legalEntityTitle(x) })).sort((a, b) => a.label.localeCompare(b.label)), [legalEntities]);
  const accountItems = useMemo(() => rows.map((r) => ({ value: r.rowGUID, label: moneyAccountLabel(r) })).sort((a, b) => a.label.localeCompare(b.label)), [rows]);
  const newRowDefaults = useMemo(() => () => ({
    rowOwnerGUID: def.catalogOwner as string,
    rowParentGUID: legalEntities.some((x) => x.rowGUID === folder) ? folder : MONEY_ACCOUNT_NO_FOLDER,
    rowJSON: {},
  }), [def.catalogOwner, legalEntities, folder]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: pmT('Title'), type: 'text', field: 'moneyAccountTitle', width: 220, placeholder: pmT('Money account') },
    { key: 'kind', title: pmT('Kind'), type: 'select', field: 'moneyAccountKind', width: 110, allowEmpty: false, options: MONEY_ACCOUNT_KINDS.map((k) => ({ value: k.value, label: pmT(k.label) })) },
    { key: 'currency', title: pmT('Currency'), type: 'text', field: 'moneyAccountCurrency', width: 100, placeholder: 'EUR' },
    { key: 'number', title: pmT('Account no.'), type: 'text', field: 'moneyAccountNumber', width: 220 },
    { key: 'bank', title: pmT('Bank'), type: 'text', field: 'moneyAccountBank', width: 180 },
    { key: 'openingDate', title: pmT('Opening date'), type: 'date', field: 'moneyAccountOpeningDate', width: 150, picker: true },
    { key: 'openingBalance', title: pmT('Opening balance'), type: 'number', field: 'moneyAccountOpeningBalance', width: 160, total: false, stepper: false, ...pmNumberColumn(MONEY_ACCOUNT_TABLE.table, 'moneyAccountOpeningBalance', false) },
    { key: 'entity', title: pmT('Legal entity'), type: 'select', target: 'rowParentGUID', width: 200, allowEmpty: true, placeholder: pmT('No folder'), options: entityOptions },
    { key: 'isActive', title: pmT('Active'), type: 'boolean', field: 'isActive', width: 70 },
  ], [entityOptions]);

  const account = rows.find((r) => r.rowGUID === picked) ?? null;

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="account_balance" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>{pmT('Money accounts')}</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{def.purpose} · {rows.length} {pmT('money accounts')}</Text>
        </View>
        <PMIconButton tipScope="app" testID={`${testID}-all-entities`} icon={allEntities ? 'visibility_off' : 'domain'} title={allEntities ? 'Show only the legal entities that have a money account' : 'Show all the legal entities as folders'} color={c.text} onPress={() => setAllEntities((v) => !v)} />
        <PMIconButton tipScope="app" testID={`${testID}-reload`} icon="refresh" title="Read the money accounts again" color={c.text} onPress={reload} />
      </View>
      {!!error && (
        <View testID={`${testID}-setup`} style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>The money accounts could not be read ({error}). Run kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql (PART 38) in the Supabase SQL editor and sign in.</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName={def.entity}
          crudListTitle={pmT('Money accounts')}
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          newRowDefaults={newRowDefaults}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          emptyText={loaded ? pmT('No money accounts yet. Press "+" to add one.') : pmT('Loading…')}
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 250 }}
        />
        {/* the rest of the account picked here (read only: the database builds it from the posted payment facts) */}
        <View style={{ width: 360, marginTop: 12 }}>
          <SelectItemFromListApp testID={`${testID}-pick`} items={accountItems} value={picked} onSelect={setPicked} placeholder={pmT('Rests of the money account…')} clearable searchPlaceholder={pmT('Money account')} fieldHeight={42} fieldRadius={4} />
        </View>
        <MoneyAccountRests account={account} testID={`${testID}-rests`} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  setup: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 16, paddingBottom: 12, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
});
