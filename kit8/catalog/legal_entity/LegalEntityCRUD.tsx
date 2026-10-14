// LegalEntityCRUD - the legal entities (legalEntityTable): a ReusableTable with CRUD and a tree of FOLDERS = COUNTRIES on the left (derived from the country catalog).
//   Columns: Title · Legal name · Registration no. · VAT no. · Country (the folder; pick or drag a row onto a folder) · Address · Active
//   A new legal entity goes into the picked country folder. SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 26. Route: /catalog/legal/entity (drawer: Catalogs > Legal entities)
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../pm/store/store_pm';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../ui/components/tree/folderTreeModel';
import { LEGAL_ENTITY_NO_FOLDER, LEGAL_ENTITY_TABLE, emptyLegalEntity, legalEntityFolderNodes } from './legalEntityModel';
import { useLegalEntityData } from './useLegalEntityData';

export default function LegalEntityCRUD({ testID = 'legal-entity' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const def = LEGAL_ENTITY_TABLE;
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);
  const { rows, countries, loaded, error, reload } = useLegalEntityData(true);
  const [allCountries, setAllCountries] = useState(false);

  // the folders = the countries that have a legal entity (all of them on demand: the button in the header); the picked folder also shows when it has no entity
  const nodes = useMemo(() => legalEntityFolderNodes(countries, rows, allCountries), [countries, rows, allCountries]);
  const foldersTree = useMemo(() => ({ nodes, folderTarget: 'rowParentGUID' as const, noFolderValue: LEGAL_ENTITY_NO_FOLDER }), [nodes]);
  const countryOptions = useMemo(() => countries.map((x) => ({ value: x.rowGUID, label: String(x.rowJSON?.countryName ?? x.rowGUID) })).sort((a, b) => a.label.localeCompare(b.label)), [countries]);
  const newRowDefaults = useMemo(() => () => ({
    rowOwnerGUID: def.catalogOwner as string,
    rowParentGUID: countries.some((x) => x.rowGUID === folder) ? folder : LEGAL_ENTITY_NO_FOLDER,
    rowJSON: {},
  }), [def.catalogOwner, countries, folder]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'title', title: 'Title', type: 'text', width: 220, placeholder: 'Legal entity' },
    { key: 'legalName', title: 'Legal name', type: 'text', width: 240 },
    { key: 'registrationNo', title: 'Registration no.', type: 'text', width: 150 },
    { key: 'vatNo', title: 'VAT no.', type: 'text', width: 150 },
    { key: 'country', title: 'Country', type: 'select', target: 'rowParentGUID', width: 190, allowEmpty: true, placeholder: 'No folder', options: countryOptions },
    { key: 'legalAddress', title: 'Address', type: 'text', width: 280 },
    { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
  ], [countryOptions]);

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="domain" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Legal entities</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{def.purpose} · {rows.length} legal entities</Text>
        </View>
        <PMIconButton tipScope="app" testID={`${testID}-all-countries`} icon={allCountries ? 'visibility_off' : 'public'} title={allCountries ? 'Show only the countries that have a legal entity' : 'Show all the countries as folders'} color={c.text} onPress={() => setAllCountries((v) => !v)} />
        <PMIconButton tipScope="app" testID={`${testID}-reload`} icon="refresh" title="Read the legal entities again" color={c.text} onPress={reload} />
      </View>
      {!!error && (
        <View testID={`${testID}-setup`} style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>The legal entities could not be read ({error}). Run kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql (PART 26) in the Supabase SQL editor and sign in.</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReusableTable
          testID={`${testID}-table`}
          entityName={def.entity}
          crudListTitle="Legal entities"
          itemLabel={def.itemLabel}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={def.emptyRowJSON}
          newRowDefaults={newRowDefaults}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          resizeColumnWidth
          realtime
          emptyText={loaded ? 'No legal entities yet. Press "+" to add one.' : 'Loading…'}
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 250 }}
        />
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
