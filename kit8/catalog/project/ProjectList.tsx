import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import ProjectCard from './ProjectCard';
import { PROJECT_ENTITY, projectToCard } from './projectCatalogModel';
import { usePMStore } from '../../pm/store/store_pm';
import { useBuildProjectRow, useCreateProjectMutation, usePMOwnerGUID } from '../../pm/crud/queries';

const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export interface ProjectListProps {
  ownerGUID?: string;
  onSelectProject?: (projectGUID: string) => void;
  width?: number | string;
}

export default function ProjectList({
  ownerGUID: propOwnerGUID,
  onSelectProject,
  width,
}: ProjectListProps) {
  const router = useRouter();
  const authOwnerGUID = usePMOwnerGUID();
  const ownerGUID = propOwnerGUID || authOwnerGUID;
  const { themeColors: c } = useDesignSystem();
  const status = useRealtimeEntity(PROJECT_ENTITY, {
    readParams: { match: ownerGUID ? { rowOwnerGUID: ownerGUID } : undefined },
  });

  const rows: any[] =
    useSelector((s: any) => s?.[PROJECT_ENTITY]?.entityDataFromServer) || [];

  const createProject = useCreateProjectMutation(ownerGUID);
  const buildRow = useBuildProjectRow(ownerGUID);

  const handleCreateNew = () => {
    if (!ownerGUID) return;
    const name = `Project ${rows.length + 1}`;
    const row = buildRow(name);
    createProject.mutate(row, {
      onSuccess: (created) => {
        const s = usePMStore.getState();
        s.addRecentProject(created.rowGUID);
        s.selectProject(created.rowGUID);
      },
    });
  };

  const handleSelect = (projectGUID: string) => {
    const s = usePMStore.getState();
    s.addRecentProject(projectGUID);
    s.selectProject(projectGUID);
    onSelectProject?.(projectGUID);
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.background },
        width ? { width: width as any } : { flex: 1 },
      ]}
      testID="catalog-project-list"
    >
      <View style={styles.header}>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable
            testID="project-add"
            onPress={handleCreateNew}
            style={[styles.add, { backgroundColor: c.primary }]}
            accessibilityLabel="Add project"
          >
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={PROJECT_ENTITY}
          entityForArchivationName=""
          crudListTitle="Projects"
          itemLabel="Project"
          listOwnerGUID={ownerGUID}
          CardComponent={ProjectCard}
          mapItemToCard={projectToCard}
          onCreateNewItem={handleCreateNew}
          onEditCard={handleSelect}
          crudCardHeight={76}
          crudListWidth={typeof width === 'number' ? width : 460}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativeProjectList onSelect={handleSelect} />
      )}
    </View>
  );
}

function NativeProjectList({ onSelect }: { onSelect: (id: string) => void }) {
  const dispatch = useDispatch();
  const rows: any[] = useSelector((s: any) => s?.[PROJECT_ENTITY]?.entityDataFromServer) || [];
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[PROJECT_ENTITY]?.actions;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={
        <Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>
          No projects yet. Create one to get started.
        </Text>
      }
      renderItem={({ item, index }) => (
        <ProjectCard
          card={projectToCard(item, index)}
          onSelect={onSelect}
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
    flexWrap: 'wrap',
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
