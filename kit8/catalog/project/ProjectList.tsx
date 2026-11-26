// The Projects list of /catalog/project = a ReusableList (iOS, Android, web) of the project rows, drawn by ProjectCardForList.
// What every ReusableList card has comes from the list: the three dots menu, the card FAB, the swipe + Archive (`rowJSON.rowIsArchived`), Delete, the drag grip.
// Project-specific: Add makes a project the project way (`onAdd`, so the generic Add above / below / Duplicate are hidden), Copy / Copy with Tasks / Copy with BIM + Open dashboard
// + Project settings are added to the menu and the FAB (`extraMenuItems`, `cardFabActions`), a READ-ONLY project is not archived (the database refuses every change but its switch).
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ReusableList from '../../ui/components/list/reusable/ReusableList';
import type { ReusableListItemState } from '../../ui/components/list/reusable/reusableListTypes';
import { REUSABLE_TABLE_ALL, type ReusableTableRow } from '../../ui/components/table/reusable/reusableTableTypes';
import type { PMMenuItemProps } from '../../pm/inner/menu/PMMenuItem';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import ProjectCardForList, { PROJECT_CARD_INSET, PROJECT_CARD_ITEM_HEIGHT } from './ProjectCardForList';
import { useCopyProject } from './copy/useCopyProject';
import { PROJECT_ENTITY } from './projectCatalogModel';
import { PROJECT_LIST_COLUMNS } from './projectListColumns';
import { projectCommands, type ProjectCommandHandlers } from './projectCommandsModel';
import { usePMStore } from '../../pm/store/store_pm';
import { projectIsReadonly } from '../../pm/model/projectReadonly';
import { useBuildProjectRow, useCreateProjectMutation, usePMOwnerGUID } from '../../pm/crud/queries';

export const PROJECT_LIST_GUID = 'catalog.projects.list';

export interface ProjectListProps {
  ownerGUID?: string;
  onSelectProject?: (projectGUID: string) => void;
  width?: number | string;
}

/** a read-only project cannot be changed (not even archived): the database refuses everything but its switch */
export const canArchiveProject = (row: ReusableTableRow): boolean => !projectIsReadonly(row.rowJSON);

export default function ProjectList({ ownerGUID: propOwnerGUID, onSelectProject, width }: ProjectListProps) {
  const router = useRouter();
  const authOwnerGUID = usePMOwnerGUID();
  const ownerGUID = propOwnerGUID || authOwnerGUID;
  const { themeColors: c } = useDesignSystem();
  const status = useSelector((s: any) => s?.[PROJECT_ENTITY]?.realtimeStatus ?? 'idle');
  const rowCount = useSelector((s: any) => (s?.[PROJECT_ENTITY]?.entityDataFromServer || []).length) as number;

  const createProject = useCreateProjectMutation(ownerGUID);
  const buildRow = useBuildProjectRow(ownerGUID);

  /** the Add button of the list: a project made the project way (name, dates, organization), then selected */
  const handleCreateNew = useCallback(() => {
    if (!ownerGUID) return;
    const row = buildRow(`Project ${rowCount + 1}`);
    createProject.mutate(row, {
      onSuccess: (created) => {
        const s = usePMStore.getState();
        s.addRecentProject(created.rowGUID);
        s.selectProject(created.rowGUID);
      },
    });
  }, [ownerGUID, buildRow, createProject, rowCount]);

  const { copy, busy: copyBusy } = useCopyProject(ownerGUID);

  const handleSelect = useCallback((projectGUID: string) => {
    const s = usePMStore.getState();
    s.addRecentProject(projectGUID);
    s.selectProject(projectGUID);
    onSelectProject?.(projectGUID);
  }, [onSelectProject]);

  /** the Dashboard button / menu item: select the project and open the full Gantt dashboard */
  const handleDashboard = useCallback((projectGUID: string) => {
    const s = usePMStore.getState();
    s.addRecentProject(projectGUID);
    s.selectProject(projectGUID);
    router.push('/pm/project/dashboard' as any);
  }, [router]);

  /** the gear: the Project settings window (PMRecentProjectsToolbar of ProjectCatalogView) */
  const handleSettings = useCallback((projectGUID: string) => {
    const s = usePMStore.getState();
    s.addRecentProject(projectGUID);
    s.selectProject(projectGUID);
    s.openProjectSettings(projectGUID);
  }, []);

  const handlers = useMemo<ProjectCommandHandlers>(() => ({
    onDashboard: handleDashboard,
    onSettings: handleSettings,
    onCopy: (row) => { void copy(row as any, false, false); },
    onCopyWithTasks: (row) => { void copy(row as any, true, false); },
    onCopyWithBim: (row) => { void copy(row as any, true, true); },
  }), [handleDashboard, handleSettings, copy]);

  // the three dots menu and the FAB of a card show the same project commands
  const extraMenuItems = useCallback((row: ReusableTableRow, close: () => void): PMMenuItemProps[] => (
    projectCommands(row, handlers).map((cmd) => ({ testID: `project-menu-${cmd.key}-${row.rowGUID}`, label: cmd.label, icon: cmd.menuIcon, onPress: () => { close(); cmd.run(); } })) as PMMenuItemProps[]
  ), [handlers]);
  const cardFabActions = useCallback((row: ReusableTableRow) => (
    projectCommands(row, handlers).map((cmd) => ({ testID: `project-fab-${cmd.key}-${row.rowGUID}`, label: cmd.label, icon: cmd.fabIcon, onPress: cmd.run }))
  ), [handlers]);

  const renderItem = useCallback((row: ReusableTableRow, state: ReusableListItemState) => (
    <ProjectCardForList row={row} state={state} onSelect={handleSelect} onDashboard={handleDashboard} onSettings={handleSettings} />
  ), [handleSelect, handleDashboard, handleSettings]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }, width ? { width: width as any } : { flex: 1 }]} testID="catalog-project-list">
      <View style={styles.header}>
        <CurrencyRealtimeBadge status={status} />
      </View>
      <ReusableList
        testID="catalog-project-reusable-list"
        reusableListGUID={PROJECT_LIST_GUID}
        entityName={PROJECT_ENTITY}
        itemLabel="Project"
        crudListTitle="Projects"
        listOwnerGUID={ownerGUID}
        listParentGUID={REUSABLE_TABLE_ALL}
        visualColumns={PROJECT_LIST_COLUMNS}
        itemHeight={PROJECT_CARD_ITEM_HEIGHT}
        reusableListWidth={typeof width === 'number' ? width : undefined}
        renderItem={renderItem}
        renderItemDeps={handlers}
        onAdd={handleCreateNew}
        extraMenuItems={extraMenuItems}
        cardFabActions={cardFabActions}
        swipeActions
        swipeInset={PROJECT_CARD_INSET}
        canArchiveRow={canArchiveProject}
        emptyText="No projects yet. Create one to get started."
      />
      {copyBusy && (
        <Text testID="project-copy-busy" style={{ color: c.text, opacity: 0.7, textAlign: 'center', paddingVertical: 4 }}>
          Copying the project…
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' },
});
