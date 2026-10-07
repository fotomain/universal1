import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import ActivityIndicatorCircleApp from '../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import PMUndoProvider from '../../pm/view/undo/PMUndoProvider';
import PMGanttSurfaceLoader from '../../pm/view/gantt/PMGanttSurfaceLoader';
import { usePMStore } from '../../pm/store/store_pm';
import {
  usePMOwnerGUID,
  useProjectRealtime,
  useReadProjectDataQuery,
  useReadProjectsQuery,
  useReadProjectUserSettingsQuery,
} from '../../pm/crud/queries';
import ProjectList from './ProjectList';
import PMRecentProjectsToolbar from '../../pm/view/project/recent/PMRecentProjectsToolbar';

export default function ProjectCatalogView() {
  return (
    <PMUndoProvider>
      <ProjectCatalogViewInner />
    </PMUndoProvider>
  );
}

function ProjectCatalogViewInner() {
  const { themeColors: c } = useDesignSystem();
  const ownerGUID = usePMOwnerGUID();
  const { width: windowWidth } = useWindowDimensions();
  const isSplitScreen = windowWidth >= 800;

  const [mobileTab, setMobileTab] = useState<'list' | 'gantt'>('list');

  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const projectOrder = usePMStore((s) => s.projectOrder);
  const projectsById = usePMStore((s) => s.projectsById);

  const projectsQuery = useReadProjectsQuery(ownerGUID);
  useReadProjectUserSettingsQuery(ownerGUID);
  const dataQuery = useReadProjectDataQuery(selectedProjectGUID);
  useProjectRealtime(ownerGUID, selectedProjectGUID);

  // Auto-select first project if none is currently selected
  useEffect(() => {
    if (!selectedProjectGUID && projectOrder.length > 0) {
      usePMStore.getState().selectProject(projectOrder[0]);
    }
  }, [selectedProjectGUID, projectOrder]);

  const selectedProject = selectedProjectGUID ? projectsById[selectedProjectGUID] : null;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="catalog-project-screen">
      {/* Mobile Tab Toggle */}
      {!isSplitScreen && (
        <View style={[styles.mobileTabBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <Pressable
            testID="catalog-project-tab-list"
            onPress={() => setMobileTab('list')}
            style={[
              styles.tabBtn,
              mobileTab === 'list' && { borderBottomColor: c.primary, borderBottomWidth: 2 },
            ]}
          >
            <IconApp
              name="list"
              size={18}
              color={mobileTab === 'list' ? c.primary : c.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: mobileTab === 'list' ? c.primary : c.text, fontWeight: mobileTab === 'list' ? '700' : '400' },
              ]}
            >
              Projects List
            </Text>
          </Pressable>

          <Pressable
            testID="catalog-project-tab-gantt"
            onPress={() => setMobileTab('gantt')}
            style={[
              styles.tabBtn,
              mobileTab === 'gantt' && { borderBottomColor: c.primary, borderBottomWidth: 2 },
            ]}
          >
            <IconApp
              name="timeline"
              size={18}
              color={mobileTab === 'gantt' ? c.primary : c.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: mobileTab === 'gantt' ? c.primary : c.text, fontWeight: mobileTab === 'gantt' ? '700' : '400' },
              ]}
            >
              Gantt Preview
            </Text>
          </Pressable>
        </View>
      )}

      {/* hidden project bar: only its windows (Project settings - the gear of a project card) */}
      {!!ownerGUID && <PMRecentProjectsToolbar ownerGUID={ownerGUID} hidden />}

      {/* Content Area */}
      <View style={styles.mainLayout}>
        {/* Left Side: Projects List */}
        {(isSplitScreen || mobileTab === 'list') && (
          <View
            style={[
              styles.leftPane,
              isSplitScreen ? { width: 440, borderRightColor: c.border, borderRightWidth: 1 } : { flex: 1 },
            ]}
          >
            <ProjectList
              ownerGUID={ownerGUID}
              onSelectProject={() => {
                if (!isSplitScreen) setMobileTab('gantt');
              }}
            />
          </View>
        )}

        {/* Right Side: Read-Only Skia Gantt Chart */}
        {(isSplitScreen || mobileTab === 'gantt') && (
          <View style={styles.rightPane}>
            {selectedProjectGUID ? (
              <View style={styles.ganttContainer} testID="catalog-project-gantt-pane">
                <View
                  style={[
                    styles.ganttHeader,
                    { backgroundColor: c.surface, borderBottomColor: c.border },
                  ]}
                >
                  <IconApp name="view_timeline" size={18} color={c.primary} />
                  <Text style={[styles.ganttTitle, { color: c.text }]} numberOfLines={1}>
                    {selectedProject?.rowJSON?.name || 'Project'} (Read-Only Preview)
                  </Text>
                  <View style={[styles.readOnlyBadge, { backgroundColor: `${c.primary}20` }]}>
                    <Text style={[styles.readOnlyText, { color: c.primary }]}>Read-Only</Text>
                  </View>
                </View>

                {dataQuery.isLoading ? (
                  <View style={styles.centerBox}>
                    <ActivityIndicatorCircleApp testID="pm-gantt-loading" />
                    <Text style={{ color: c.text, opacity: 0.7, marginTop: 12 }}>
                      Loading project Gantt chart...
                    </Text>
                  </View>
                ) : (
                  <PMGanttSurfaceLoader
                    ownerGUID={ownerGUID}
                    projectGUID={selectedProjectGUID}
                    rightPane="gantt"
                    readOnly={true}
                    hideTree={false}
                  />
                )}
              </View>
            ) : (
              <View style={styles.centerBox}>
                <IconApp name="view_timeline" size={48} color={c.primary} />
                <Text style={[styles.emptyTitle, { color: c.text }]}>No project selected</Text>
                <Text style={{ color: c.text, opacity: 0.7, textAlign: 'center', marginTop: 6 }}>
                  Select a project from the left list to preview its Gantt chart.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mobileTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  tabText: { fontSize: 14 },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    height: '100%',
  },
  rightPane: {
    flex: 1,
    height: '100%',
  },
  ganttContainer: {
    flex: 1,
    height: '100%',
  },
  ganttHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ganttTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  readOnlyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readOnlyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
});
