// ResourceRolesWithTree - the Roles table with the role FOLDERS tree beside it (a tab of ResourceRoleDashboard).
//   tree    resourceRoleFolderTable: create / rename / duplicate / delete / reorder / nest folders (FolderTreeReusable)
//   table   resourceRoleTable (ReusableTable, all-rows mode): picking a folder shows its roles (with subfolders), "Add" inside a
//           folder creates the role in it, drag the ⠿ of a row (or of all selected rows) onto a folder = the role's folder changes
//           (rowParentGUID); drop on "No folder" = no folder. Right-click -> Edit opens the role card (Main, Rates, Variants, Properties).
//   layout  uxuiTable.showFoldersTree + foldersTree* (position, width, splitter, heights aligned with the table rows, stacked above
//           the table on a narrow screen) - see ReusableTableUxUi
// Route: /catalog/resourcerole/dashboard?tab=rolesTree
import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { EditRowModalCardProps, ReusableTableUxUi } from '../../../ui/components/table/reusable/reusableTableTypes';
import { RESOURCE_ROLE_OWN_TABLES, ResourceRoleTableKey } from '../resourceRoleModel';
import ResourceRoleEditModalCard from '../card/ResourceRoleEditModalCard';
import type { ResourceRoleCatalogData } from '../crud/resourceRoleCatalogTools';
import type { ResourceRoleTableConfig } from './resourceRoleDashboardTables';
import { useResourceRoleFolderTree } from '../tree/useResourceRoleFolderTree';

export interface ResourceRolesWithTreeProps {
  data: ResourceRoleCatalogData;
  /** the Roles table of buildResourceRoleTables(): columns + row menu */
  cfg: ResourceRoleTableConfig;
  /** every table of buildResourceRoleTables(): the Rates / Variants / Properties tabs of the role card reuse their columns */
  tables: Record<ResourceRoleTableKey, ResourceRoleTableConfig>;
  onReload?: () => void;
  /** the picked folder (controlled by the dashboard, so it survives opening another table and coming back) */
  selectedFolderId?: string;
  onSelectedFolderChange?: (folderId: string) => void;
  selectRowCheckBoxForm?: 'formRound' | 'formSquare';
  /** calibration of table + tree (uxuiTable.foldersTree*) */
  uxuiTable?: ReusableTableUxUi;
}

export default function ResourceRolesWithTree({ data, cfg, tables, onReload, selectRowCheckBoxForm, uxuiTable, selectedFolderId, onSelectedFolderChange }: ResourceRolesWithTreeProps) {
  const { themeColors: c } = useDesignSystem();
  const { foldersTree } = useResourceRoleFolderTree(data, onReload);
  const def = RESOURCE_ROLE_OWN_TABLES.resourceRole;
  // the role card of a row (right-click -> Edit). One stable component (no remount, so the open tab survives); it reads the
  // latest data / tables from a ref, and the table re-renders it on every change
  const live = useRef({ data, tables });
  live.current = { data, tables };
  const EditRowModalCard = useMemo(() => function ResourceRoleRowCard(p: EditRowModalCardProps) {
    return <ResourceRoleEditModalCard {...p} data={live.current.data} tables={live.current.tables} />;
  }, []);
  return (
    <View testID="roles-with-tree" style={{ gap: 10 }}>
      <View style={styles.head}>
        <IconApp name="account_tree" size={22} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="roles-with-tree-title" style={[styles.h2, { color: c.text }]}>Roles &amp; folders</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 13 }}>
            Pick a folder to see its roles · right-click a role to edit it (Main, Rates, Variants, Properties) · drag the ⠿ of a role (or of all checked roles) onto a folder to move it · right-click a folder for its menu
          </Text>
        </View>
      </View>
      <ReusableTable
        testID="roles-tree-table"
        entityName={def.entity}
        crudListTitle={cfg.title}
        itemLabel={def.itemLabel}
        listOwnerGUID={REUSABLE_TABLE_ALL}
        listParentGUID={REUSABLE_TABLE_ALL}
        visualColumns={cfg.columns}
        defaultRowJSON={def.emptyRowJSON}
        extraMenuItems={cfg.extraMenuItems}
        EditRowModalCard={EditRowModalCard}
        selectRowCheckBoxForm={selectRowCheckBoxForm}
        dragAndDropColumns
        resizeColumnWidth
        realtime
        foldersTree={selectedFolderId !== undefined ? { ...foldersTree, selectedFolderId, onSelectedFolderChange } : foldersTree}
        uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 270, ...uxuiTable }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  h2: { fontSize: 18, fontWeight: '800' },
});
