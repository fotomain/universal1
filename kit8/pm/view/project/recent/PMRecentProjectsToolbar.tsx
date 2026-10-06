// PMRecentProjectsToolbar - the project bar: [ SelectProjectFromList ] [ ‹ ribbon of recent projects › ] [actions] [+ Project]
//
//  * SelectProjectFromList - search any project in the database by substring
//  * ribbon                - only the LAST SELECTED projects (per user, AsyncStorage - see
//                            recentProjects.ts), sorted by name, horizontally scrollable with
//                            chevron arrows; hover a chip -> "Close" (x) in its right corner
//                            removes the project from the ribbon (not from the database)
//  * project CRUD          - create / settings / delete (demo data: only in the empty state)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useDesignSystem } from "../../../../providers/WithDesignSystem";
import IconApp from "../../../../components/common/IconApp";
import { usePMStore } from "../../../store/store_pm";
import {
  useBuildProjectRow,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useUpdateProjectMutation,
} from "../../../crud/queries";
import {
  formatDateISO,
  formatDateShort,
  parseDateISO,
  todayUTC,
} from "../scheduling";
import { approvePM } from "../../../inner/PMApproveYesNoCancelModalWindow";
import { PMDialogButton, PMIconButton, PMTipIcon } from "../../../inner/buttons";
import { PMToolbarDivider } from "../../../inner/toolbars/PMToolbarPrimitives";
import { PM_DIALOG_BUTTON_WIDTH, PM_EXPORT_BUTTON_WIDTH, PM_SETTINGS_BUTTON_WIDTH, PM_SETTINGS_ICON_SIZE } from "../../../model/constants";
import { exportProjectDashboardToPdf } from "../../../crud/exchange/pdf/exportDashboardToPdf";
import { pmT } from "../../../i18n/pmT";
import PMDateInput from "../../../inner/inputs/PMDateInput";
import PMAddProjectButton from "../buttons/PMAddProjectButton";
import { usePMTip } from "../../../inner/tooltip/PMTooltip";
import SelectProjectFromList from "../SelectProjectFromList";
import ImportExportProject from "../../../crud/exchange/project/ImportExportProject";
import SwitchApp from "../../../../components/common/SwitchApp";
import PMKanbanStagesModalWindow from "../../kanban/PMKanbanStagesModalWindow";
import type { PMProjectRow, PMRowJSON, PMPlanDateInputFormat } from "../../../model/types";
import { PM_PLAN_DATE_INPUT_FORMATS } from "../../../model/types";
import { withAlpha } from "../../theme";
import SelectElementFromCatalog from "../../../../catalog/inner/select_element/SelectElementFromCatalog";
import { PARTNER_ENTITY } from "../../../../catalog/partner/partnerModel";
import { CONTRACT_ENTITY } from "../../../../catalog/contract/contractModel";
import PMProjectKanbanStateList from "../settings/kanban/PMProjectKanbanStateList";
import { formatPlanDate, parsePlanDate } from "../../../model/types";
import CreateTemplateFromProject from "../CreateTemplateFromProject";
import CreateProjectFromTemplate from "../CreateProjectFromTemplate";
import PMGanttVersionButtons from "../../../version/view/buttons/PMGanttVersionButtons";
import PMContextMenu from "../../../inner/menu/PMContextMenu";
import { usePMVersionStore } from "../../../version/store/store_version";
import { useUxuiCurrentJSON } from "../../../../redux/useUxuiCurrentJSON";
import ShareScreenshotButton from "../../../../components/common/ShareScreenshotButton";

export type ProjectSettingsTab = 'TabMain' | 'TabUXUI' | 'TabPartners' | 'TabKanban';

interface Draft {
  rowGUID: string | null; // null = new project
  name: string;
  start: string;
  projectStartDate: string;
  projectFinishDate: string;
  skipWeekends: boolean;
  planDay: boolean;
  planHour: boolean;
  planMinute: boolean;
  planSecond: boolean;
  planDateInputFormat: PMPlanDateInputFormat;
  mainSupplierGUID?: string | null;
  mainSupplierContractGUID?: string | null;
  mainCustomerGUID?: string | null;
  mainCustomerContractGUID?: string | null;
}

export default function PMRecentProjectsToolbar({
  ownerGUID,
  hidden = false,
}: {
  ownerGUID: string;
  /** uxui.hideProjectToolBar: the bar is not shown (its windows - Project settings ... - still open) */
  hidden?: boolean;
}) {
  const { themeColors } = useDesignSystem();
  /** widths for the horizontally scrollable buttons (phones: "+ Project" is always reachable) */
  const [barW, setBarW] = useState(0);
  const [buttonsW, setButtonsW] = useState(0);
  const projectOrder = usePMStore((s) => s.projectOrder);
  const projectsById = usePMStore((s) => s.projectsById);
  const recentProjectGUIDs = usePMStore((s) => s.recentProjectGUIDs);
  // the selected project's % follows task edits at once (same formula as the DB)
  const liveProgress = usePMStore((s) => s.projectProgress);
  const liveProgressFor = usePMStore((s) => s.loadedProjectGUID);
  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const selectProject = usePMStore((s) => s.selectProject);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);

  const buildRow = useBuildProjectRow(ownerGUID);
  const createProject = useCreateProjectMutation(ownerGUID);
  const updateProject = useUpdateProjectMutation(ownerGUID);
  const deleteProject = useDeleteProjectMutation(ownerGUID);

  const win = useWindowDimensions();
  const compact = win.width < 640;
  /** Project settings window: FIXED height (new / edit, any Import / Export tab) - the body scrolls */
  const settingsHeight = Math.max(320, Math.min(PM_PROJECT_SETTINGS_HEIGHT, Math.round(win.height * 0.92)));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>('TabMain');
  /** "Kanban Stages" window of the project being edited (opened from the Project settings window) */
  const [kanbanStagesOpen, setKanbanStagesOpen] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [createFromTemplateOpen, setCreateFromTemplateOpen] = useState(false);
  const addBtnRef = useRef<View>(null);
  const [addMenuCoords, setAddMenuCoords] = useState<{ x: number; y: number } | null>(null);

  const handleOpenAddMenu = (e?: any) => {
    if (e?.currentTarget?.getBoundingClientRect) {
      const rect = e.currentTarget.getBoundingClientRect();
      setAddMenuCoords({ x: rect.left, y: rect.bottom + 4 });
      return;
    }
    const pageX = e?.nativeEvent?.pageX ?? e?.pageX;
    const pageY = e?.nativeEvent?.pageY ?? e?.pageY;
    if (typeof pageX === 'number' && typeof pageY === 'number' && (pageX > 0 || pageY > 0)) {
      setAddMenuCoords({ x: pageX, y: pageY + 8 });
      return;
    }
    setAddMenuCoords({ x: Math.max(10, win.width - 220), y: 50 });
  };

  useEffect(() => {
    if (!draft) setKanbanStagesOpen(false);
  }, [draft]);
  const selected = selectedProjectGUID
    ? projectsById[selectedProjectGUID]
    : undefined;

  // ribbon = recently selected projects only, sorted by name
  const ribbon = useMemo(
    () =>
      recentProjectGUIDs
        .filter((g) => !!projectsById[g])
        .sort((a, b) =>
          (projectsById[a].rowJSON?.name || "").localeCompare(
            projectsById[b].rowJSON?.name || "",
            undefined,
            { numeric: true, sensitivity: "base" },
          ),
        ),
    [recentProjectGUIDs, projectsById],
  );

  // ---- chevron scrolling of the ribbon ----
  const scrollRef = useRef<ScrollView>(null);
  const [scroll, setScroll] = useState({ x: 0, view: 0, content: 0 });
  const canLeft = scroll.x > 2;
  const canRight = scroll.x + scroll.view < scroll.content - 2;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    setScroll({
      x: contentOffset.x,
      view: layoutMeasurement.width,
      content: contentSize.width,
    });
  };
  const scrollBy = (dir: -1 | 1) => {
    const step = Math.max(120, scroll.view * 0.8);
    const x = Math.max(
      0,
      Math.min(scroll.content - scroll.view, scroll.x + dir * step),
    );
    scrollRef.current?.scrollTo({ x, animated: true });
  };

  // uxui.currentJSON while the Project settings window is open: the project row + the values being edited
  useUxuiCurrentJSON(
    draft
      ? { kind: "projectSettings", title: draft.name || "New project", json: { project: draft.rowGUID ? projectsById[draft.rowGUID] ?? null : null, draft } }
      : null,
  );

  const closeChip = useCallback((guid: string) => {
    const s = usePMStore.getState();
    s.removeRecentProject(guid);
    if (s.selectedProjectGUID === guid) {
      const rest = s.recentProjectGUIDs.filter((g) => g !== guid);
      s.selectProject(rest[0] ?? null);
    }
  }, []);

  const openNew = () => {
    setDraftError(null);
    setActiveTab('TabMain');
    setDraft({
      rowGUID: null,
      name: "",
      start: formatDateISO(todayUTC()),
      projectStartDate: formatDateISO(todayUTC()),
      projectFinishDate: "",
      skipWeekends: false,
      planDay: true,
      planHour: false,
      planMinute: false,
      planSecond: false,
      planDateInputFormat: 'YYYY-MM-DD',
      mainSupplierGUID: null,
      mainSupplierContractGUID: null,
      mainCustomerGUID: null,
      mainCustomerContractGUID: null,
    });
  };
  const openEditFor = (project: PMProjectRow | undefined) => {
    if (!project) return;
    setDraftError(null);
    setActiveTab('TabMain');
    const startStr = project.rowJSON.projectStartDate || (project.rowJSON.projectStartAt
      ? formatDateISO(Date.parse(project.rowJSON.projectStartAt))
      : formatDateISO(todayUTC()));
    const finishStr = project.rowJSON.projectFinishDate || (project.rowDuration
      ? formatDateISO(Date.parse(project.rowDuration))
      : "");
    setDraft({
      rowGUID: project.rowGUID,
      name: project.rowJSON.name || "",
      start: startStr,
      projectStartDate: startStr,
      projectFinishDate: finishStr,
      skipWeekends: !!project.rowJSON.skipWeekends,
      planDay: project.rowJSON.planDay ?? true,
      planHour: !!project.rowJSON.planHour,
      planMinute: !!project.rowJSON.planMinute,
      planSecond: !!project.rowJSON.planSecond,
      planDateInputFormat: project.rowJSON.planDateInputFormat || 'YYYY-MM-DD',
      mainSupplierGUID: project.rowJSON.mainSupplierGUID ?? null,
      mainSupplierContractGUID: project.rowJSON.mainSupplierContractGUID ?? null,
      mainCustomerGUID: project.rowJSON.mainCustomerGUID ?? null,
      mainCustomerContractGUID: project.rowJSON.mainCustomerContractGUID ?? null,
    });
  };
  const openEdit = () => openEditFor(selected);

  // ⇅ on the Gantt bar (import / export) asks for this window: store.openProjectSettings(guid)
  const settingsRequest = usePMStore((s) => s.projectSettingsRequest);
  useEffect(() => {
    if (!settingsRequest) return;
    const s = usePMStore.getState();
    // 'new' = the "New project" window (main FAB)
    if (settingsRequest.guid === 'new') openNew();
    else openEditFor(s.projectsById[settingsRequest.guid]);
    s.openProjectSettings(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRequest]);

  /** after an import the project's start / calendar come from the file: show them (Save keeps them) */
  const onImported = (json: PMRowJSON) => {
    const newStart = json.projectStartAt ? formatDateISO(Date.parse(json.projectStartAt)) : undefined;
    const newFinish = json.projectFinishAt ? formatDateISO(Date.parse(json.projectFinishAt)) : undefined;
    setDraft((d) =>
      d
        ? {
            ...d,
            start: newStart ?? d.start,
            projectStartDate: newStart ?? d.projectStartDate,
            finish: newFinish ?? d.finish,
            projectFinishDate: newFinish ?? d.projectFinishDate,
            skipWeekends: !!json.skipWeekends,
            planDay: json.planDay ?? d.planDay,
            planHour: json.planHour ?? d.planHour,
            planMinute: json.planMinute ?? d.planMinute,
            planSecond: json.planSecond ?? d.planSecond,
            planDateInputFormat: json.planDateInputFormat || d.planDateInputFormat,
            mainSupplierGUID: json.mainSupplierGUID ?? d.mainSupplierGUID,
            mainSupplierContractGUID: json.mainSupplierContractGUID ?? d.mainSupplierContractGUID,
            mainCustomerGUID: json.mainCustomerGUID ?? d.mainCustomerGUID,
            mainCustomerContractGUID: json.mainCustomerContractGUID ?? d.mainCustomerContractGUID,
          }
        : d,
    );
  };

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const startDateVal = draft.projectStartDate || draft.start;
    const startMs = parseDateISO(startDateVal) ?? parsePlanDate(startDateVal, draft.planDateInputFormat);
    if (!name) return setDraftError("Name is required.");
    if (startMs === null) return setDraftError("Start must be YYYY-MM-DD.");
    const finishMs = draft.projectFinishDate ? (parseDateISO(draft.projectFinishDate) ?? parsePlanDate(draft.projectFinishDate, draft.planDateInputFormat)) : null;
    if (draft.rowGUID) {
      const cur = projectsById[draft.rowGUID];
      updateProject.mutate({
        rowGUID: draft.rowGUID,
        patch: {
          rowJSON: {
            ...cur.rowJSON,
            name,
            projectStartAt: new Date(startMs).toISOString(),
            projectStartDate: startDateVal,
            projectFinishDate: draft.projectFinishDate || null,
            skipWeekends: draft.skipWeekends,
            planDay: draft.planDay,
            planHour: draft.planHour,
            planMinute: draft.planMinute,
            planSecond: draft.planSecond,
            planDateInputFormat: draft.planDateInputFormat,
            mainSupplierGUID: draft.mainSupplierGUID ?? null,
            mainSupplierContractGUID: draft.mainSupplierContractGUID ?? null,
            mainCustomerGUID: draft.mainCustomerGUID ?? null,
            mainCustomerContractGUID: draft.mainCustomerContractGUID ?? null,
          },
          ...(finishMs ? { rowDuration: new Date(finishMs).toISOString() } : {}),
        },
      });
    } else {
      const row = buildRow(name, startMs);
      row.rowJSON.projectStartDate = startDateVal;
      row.rowJSON.projectFinishDate = draft.projectFinishDate || null;
      if (finishMs) row.rowDuration = new Date(finishMs).toISOString();
      row.rowJSON.skipWeekends = draft.skipWeekends;
      row.rowJSON.planDay = draft.planDay;
      row.rowJSON.planHour = draft.planHour;
      row.rowJSON.planMinute = draft.planMinute;
      row.rowJSON.planSecond = draft.planSecond;
      row.rowJSON.planDateInputFormat = draft.planDateInputFormat;
      row.rowJSON.mainSupplierGUID = draft.mainSupplierGUID ?? null;
      row.rowJSON.mainSupplierContractGUID = draft.mainSupplierContractGUID ?? null;
      row.rowJSON.mainCustomerGUID = draft.mainCustomerGUID ?? null;
      row.rowJSON.mainCustomerContractGUID = draft.mainCustomerContractGUID ?? null;
      createProject.mutate(row);
      selectProject(row.rowGUID);
    }
    setDraft(null);
  };

  const remove = async () => {
    if (!selected) return;
    const ok = await approvePM({
      title: `Delete project "${selected.rowJSON.name}"?`,
      message:
        "All its stages, tasks and dependencies will be deleted. This cannot be undone.",
      yesLabel: "Delete",
      destructive: true,
    });
    if (ok) {
      deleteProject.mutate(selected.rowGUID);
      const s = usePMStore.getState();
      s.removeRecentProject(selected.rowGUID);
      const next =
        s.recentProjectGUIDs.find((g) => g !== selected.rowGUID) ?? null;
      selectProject(next);
    }
  };

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: themeColors.border,
          backgroundColor: themeColors.surface,
        },
        hidden ? { display: "none" } : null,
      ]}
    >
      {!compact && (
        <PMTipIcon
          tip={pmT('Projects')}
          testID="pm-project-icon"
          name="view_timeline"
          size={20}
          color={themeColors.primary}
          style={{ marginRight: 8 }}
        />
      )}
      <SelectProjectFromList
        ownerGUID={ownerGUID}
        width={compact ? 150 : 220}
      />

      {/* everything after the project search scrolls horizontally (like the Gantt bar): on a phone in
          portrait mode every button - "+ Project" too - can be reached */}
      <ScrollView
        testID="pm-project-bar-scroll"
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={styles.barContent}
        onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}
      >
      <PMIconButton
        compact
        testID="pm-project-ribbon-left"
        icon="chevron_left"
        title={pmT('Scroll the projects left')}
        color={themeColors.text}
        disabled={!canLeft}
        onPress={() => scrollBy(-1)}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        style={{ flexGrow: 0, flexShrink: 0, width: Math.max(compact ? 110 : 140, barW - buttonsW - 64) }}
        contentContainerStyle={styles.chips}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          setScroll((v) => ({ ...v, view: w }));
        }}
        onContentSizeChange={(w: number) =>
          setScroll((v) => ({ ...v, content: w }))
        }
      >
        {ribbon.map((guid) => {
          const project = projectsById[guid];
          return (
            <ProjectChip
              key={guid}
              guid={guid}
              name={project.rowJSON?.name || "Project"}
              progress={Math.round(
                guid === selectedProjectGUID && liveProgressFor === guid
                  ? liveProgress
                  : project.rowProgress || 0,
              )}
              finishMs={
                project.rowDuration ? Date.parse(project.rowDuration) : null
              }
              active={guid === selectedProjectGUID}
              colors={themeColors}
              onPress={() => selectProject(guid)}
              onClose={() => closeChip(guid)}
            />
          );
        })}
        {ribbon.length === 0 && (
          <Text style={{ color: themeColors.text, opacity: 0.6 }}>
            {projectOrder.length === 0
              ? "No projects yet - create one or load the demo."
              : "Find a project to open it here."}
          </Text>
        )}
      </ScrollView>
      <PMIconButton
        compact
        testID="pm-project-ribbon-right"
        icon="chevron_right"
        title={pmT('Scroll the projects right')}
        color={themeColors.text}
        disabled={!canRight}
        onPress={() => scrollBy(1)}
      />

      <View style={styles.barButtons} onLayout={(e: LayoutChangeEvent) => setButtonsW(e.nativeEvent.layout.width)}>
      {selected && !compact && (
        <Text
          style={[styles.range, { color: themeColors.text }]}
          numberOfLines={1}
        >
          {formatDateShort(projectStartMs)} –{" "}
          {formatDateShort(projectFinishMs - 1)}
        </Text>
      )}
      <PMIconButton
        testID="pm-project-delete"
        icon="delete"
        title={pmT('Delete project')}
        color={themeColors.error}
        disabled={!selected}
        onPress={remove}
      />
      <PMIconButton
        testID="pm-create-template-btn"
        icon="bookmark_add"
        title={pmT('Create template from project')}
        color={themeColors.text}
        disabled={!selected}
        onPress={() => setCreateTemplateOpen(true)}
      />
      <PMIconButton
        testID="pm-create-from-template-btn"
        icon="library_add"
        title={pmT('Create project from template')}
        color={themeColors.text}
        onPress={() => setCreateFromTemplateOpen(true)}
      />
      <PMToolbarDivider color={themeColors.border} />
      {/* project versions: Save project version · Restore project from version (kit8/pm/version) */}
      <PMGanttVersionButtons palette={{ text: themeColors.text }} />
      <PMToolbarDivider color={themeColors.border} />
      <PMIconButton
        testID="pm-project-edit"
        icon="settings"
        title={pmT('Project settings')}
        color={themeColors.text}
        disabled={!selected}
        width={PM_SETTINGS_BUTTON_WIDTH}
        size={PM_SETTINGS_ICON_SIZE}
        onPress={openEdit}
      />
      <View ref={addBtnRef} collapsable={false}>
        <PMAddProjectButton compact={compact} onPress={handleOpenAddMenu} />
      </View>
      </View>
      </ScrollView>

      {!!addMenuCoords && (
        <PMContextMenu
          testID="pm-project-add-menu"
          caption={pmT('+ Project')}
          x={addMenuCoords.x}
          y={addMenuCoords.y}
          width={200}
          onClose={() => setAddMenuCoords(null)}
          items={[
            {
              testID: "pm-project-add-menu-new",
              label: "New",
              icon: "add",
              onPress: () => {
                setAddMenuCoords(null);
                openNew();
              },
            },
            {
              testID: "pm-project-add-menu-from-template",
              label: "From template",
              icon: "library_add",
              disabled: !selected,
              onPress: () => {
                setAddMenuCoords(null);
                if (!selected) return;
                setCreateFromTemplateOpen(true);
              },
            },
            {
              testID: "pm-project-add-menu-from-version",
              label: "From the version",
              icon: "history",
              disabled: !selected,
              onPress: () => {
                setAddMenuCoords(null);
                if (!selected) return;
                const missing = usePMVersionStore.getState().tablesMissing;
                if (missing) {
                  usePMStore.getState().setError(
                    "Project versions are not installed yet: run kit8/sql/init/done/create_tables.sql in the Supabase SQL editor (it only adds the version_ tables, nothing is deleted), then reload."
                  );
                } else {
                  usePMVersionStore.getState().setRestorePickerOpen(true);
                }
              },
            },
          ]}
        />
      )}

      {!!draft && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setDraft(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              testID="pm-project-settings-window"
              style={[
                styles.modalCard,
                { height: settingsHeight, backgroundColor: themeColors.surface },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Text
                  style={{
                    flex: 1,
                    color: themeColors.text,
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {draft?.rowGUID ? "Project settings" : "New project"}
                </Text>
                <ShareScreenshotButton testID="pm-project-settings-share" color={themeColors.text} />
              </View>

              {/* TopTabs Bar: TabMain, TabUXUI, TabPartners, TabKanban */}
              <View testID="pm-project-settings-toptabs" style={styles.topTabsBar}>
                {[
                  { id: 'TabMain' as const, label: 'Main', icon: 'info' },
                  { id: 'TabUXUI' as const, label: 'UX/UI', icon: 'palette' },
                  { id: 'TabPartners' as const, label: 'Partners', icon: 'handshake' },
                  { id: 'TabKanban' as const, label: 'Kanban', icon: 'view_column' },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      testID={`pm-project-tab-${tab.id}`}
                      accessibilityRole="tab"
                      aria-selected={active}
                      onPress={() => setActiveTab(tab.id)}
                      style={[
                        styles.topTabButton,
                        {
                          borderBottomColor: active ? themeColors.primary : 'transparent',
                          backgroundColor: active ? withAlpha(themeColors.primary, 0.12) : 'transparent',
                        },
                      ]}
                    >
                      <IconApp
                        name={tab.icon}
                        size={15}
                        color={active ? themeColors.primary : themeColors.text}
                      />
                      <Text
                        style={[
                          styles.topTabText,
                          {
                            color: active ? themeColors.primary : themeColors.text,
                            fontWeight: active ? '700' : '500',
                          },
                        ]}
                      >
                        {pmT(tab.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView style={styles.modalBody} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                {activeTab === 'TabMain' && (
                  <View testID="pm-project-tab-main-content">
                    <Text style={[styles.label, { color: themeColors.text }]}>
                      {pmT('Name')}
                    </Text>
                    <TextInput
                      testID="pm-project-name"
                      value={draft?.name || ""}
                      onChangeText={(v) =>
                        setDraft((d) => (d ? { ...d, name: v } : d))
                      }
                      placeholder={pmT('Project name')}
                      placeholderTextColor={themeColors.border}
                      style={[
                        styles.input,
                        { color: themeColors.text, borderColor: themeColors.border },
                      ]}
                      autoFocus
                      onSubmitEditing={saveDraft}
                    />
                    <Text style={[styles.label, { color: themeColors.text, marginTop: 10 }]}>
                      {pmT('Project Start Date (projectStartDate)')}
                    </Text>
                    <PMDateInput
                      testID="pm-project-start"
                      dateFormat={draft?.planDateInputFormat}
                      value={draft?.projectStartDate || draft?.start || ""}
                      onChangeText={(v) => setDraft((d) => (d ? { ...d, projectStartDate: v, start: v } : d))}
                    />

                    <Text style={[styles.label, { color: themeColors.text, marginTop: 10 }]}>
                      {pmT('Project Finish Date (projectFinishDate)')}
                    </Text>
                    <PMDateInput
                      testID="pm-project-finish"
                      dateFormat={draft?.planDateInputFormat}
                      value={draft?.projectFinishDate || ""}
                      onChangeText={(v) => setDraft((d) => (d ? { ...d, projectFinishDate: v } : d))}
                    />
                    <SwitchApp
                      testID="pm-project-weekends"
                      label={pmT('Working days only (skip weekends)')}
                      value={!!draft?.skipWeekends}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, skipWeekends: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    {!!draft?.rowGUID && (
                      <>
                        <ImportExportProject
                          ownerGUID={ownerGUID}
                          projectGUID={draft.rowGUID}
                          colors={{ text: themeColors.text, primary: themeColors.primary, error: themeColors.error, border: themeColors.border }}
                          onImported={onImported}
                          onExportPdf={(guid) => {
                            // the window must not be in the picture: close it, then export the dashboard
                            setDraft(null);
                            exportProjectDashboardToPdf(guid, { delayMs: 450 }).catch((e: any) =>
                              usePMStore.getState().setError(e?.message || pmT('PDF export failed')),
                            );
                          }}
                        />
                        <View style={styles.templateButtonRow}>
                          <PMDialogButton
                            testID="pm-settings-save-as-template"
                            kind="secondary"
                            icon="bookmark_add"
                            title={pmT('Save as template')}
                            width={PM_EXPORT_BUTTON_WIDTH}
                            style={{ marginLeft: 0 }}
                            onPress={() => setCreateTemplateOpen(true)}
                          />
                        </View>
                      </>
                    )}
                    {!draft?.rowGUID && (
                      <View style={styles.templateButtonRow}>
                        <PMDialogButton
                          testID="pm-settings-new-from-template"
                          kind="secondary"
                          icon="content_copy"
                          title={pmT('Or create from template')}
                          width={PM_EXPORT_BUTTON_WIDTH}
                          style={{ marginLeft: 0 }}
                          onPress={() => {
                            setDraft(null);
                            setCreateFromTemplateOpen(true);
                          }}
                        />
                      </View>
                    )}
                  </View>
                )}

                {activeTab === 'TabUXUI' && (
                  <View testID="pm-project-tab-uxui-content">
                    <SwitchApp
                      testID="pm-project-plan-day"
                      label={pmT('Plan in days (planDay)')}
                      value={draft?.planDay ?? true}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planDay: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <SwitchApp
                      testID="pm-project-plan-hour"
                      label={pmT('Plan in hours (planHour)')}
                      value={!!draft?.planHour}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planHour: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <SwitchApp
                      testID="pm-project-plan-minute"
                      label={pmT('Plan in minutes (planMinute)')}
                      value={!!draft?.planMinute}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planMinute: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <SwitchApp
                      testID="pm-project-plan-second"
                      label={pmT('Plan in seconds (planSecond)')}
                      value={!!draft?.planSecond}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planSecond: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <Text style={[styles.label, { color: themeColors.text, marginTop: 14 }]}>
                      {pmT('Date format (planDateInputFormat)')}
                    </Text>
                    <View testID="pm-project-date-format" style={styles.formatRow}>
                      {PM_PLAN_DATE_INPUT_FORMATS.map((fmt) => {
                        const selectedFmt = (draft?.planDateInputFormat || "YYYY-MM-DD") === fmt;
                        return (
                          <Pressable
                            key={fmt}
                            testID={`pm-project-format-${fmt.replace(/[^A-Za-z0-9]/g, "_")}`}
                            onPress={() =>
                              setDraft((d) => (d ? { ...d, planDateInputFormat: fmt } : d))
                            }
                            style={[
                              styles.formatChip,
                              {
                                borderColor: selectedFmt ? themeColors.primary : themeColors.border,
                                backgroundColor: selectedFmt
                                  ? withAlpha(themeColors.primary, 0.15)
                                  : "transparent",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.formatText,
                                {
                                  color: selectedFmt ? themeColors.primary : themeColors.text,
                                  fontWeight: selectedFmt ? "700" : "400",
                                },
                              ]}
                            >
                              {fmt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {activeTab === 'TabPartners' && (
                  <View testID="pm-project-tab-partners-content">
                    <SelectElementFromCatalog
                      testID="pm-project-main-supplier"
                      label={pmT('Main Supplier (mainSupplierGUID)')}
                      placeholder={pmT('Select main supplier...')}
                      entityName={PARTNER_ENTITY}
                      value={draft?.mainSupplierGUID}
                      filterItem={(item) => Boolean(item.rowJSON?.partnerIsSupplier)}
                      onChange={(guid) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                mainSupplierGUID: guid,
                                ...(d.mainSupplierGUID !== guid ? { mainSupplierContractGUID: null } : {}),
                              }
                            : d
                        )
                      }
                    />

                    <SelectElementFromCatalog
                      testID="pm-project-main-supplier-contract"
                      label={pmT('Main Supplier Contract (mainSupplierContractGUID)')}
                      placeholder={pmT('Select supplier contract...')}
                      entityName={CONTRACT_ENTITY}
                      value={draft?.mainSupplierContractGUID}
                      rowOwnerGUID={draft?.mainSupplierGUID ? draft.mainSupplierGUID : undefined}
                      rowParentGUID="partner"
                      scopeFetchByOwner={false}
                      filterItem={(item) => {
                        if (draft?.mainSupplierGUID) {
                          return item.rowOwnerGUID === draft.mainSupplierGUID;
                        }
                        return Boolean(
                          item.rowJSON?.supplierRole === true ||
                          item.rowJSON?.contractType?.toLowerCase().includes('suppl') ||
                          item.rowParentGUID === 'partner' ||
                          item.rowJSON?.contractPartyType === 'partner'
                        );
                      }}
                      onChange={(guid, row) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                mainSupplierContractGUID: guid,
                                ...(row?.rowOwnerGUID && !d.mainSupplierGUID ? { mainSupplierGUID: row.rowOwnerGUID } : {}),
                              }
                            : d
                        )
                      }
                    />

                    <View style={{ height: 16 }} />

                    <SelectElementFromCatalog
                      testID="pm-project-main-customer"
                      label={pmT('Main Customer (mainCustomerGUID)')}
                      placeholder={pmT('Select main customer...')}
                      entityName={PARTNER_ENTITY}
                      value={draft?.mainCustomerGUID}
                      filterItem={(item) => Boolean(item.rowJSON?.partnerIsCustomer)}
                      onChange={(guid) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                mainCustomerGUID: guid,
                                ...(d.mainCustomerGUID !== guid ? { mainCustomerContractGUID: null } : {}),
                              }
                            : d
                        )
                      }
                    />

                    <SelectElementFromCatalog
                      testID="pm-project-main-customer-contract"
                      label={pmT('Main Customer Contract (mainCustomerContractGUID)')}
                      placeholder={pmT('Select customer contract...')}
                      entityName={CONTRACT_ENTITY}
                      value={draft?.mainCustomerContractGUID}
                      rowOwnerGUID={draft?.mainCustomerGUID ? draft.mainCustomerGUID : undefined}
                      rowParentGUID="partner"
                      scopeFetchByOwner={false}
                      filterItem={(item) => {
                        if (draft?.mainCustomerGUID) {
                          return item.rowOwnerGUID === draft.mainCustomerGUID;
                        }
                        return Boolean(
                          item.rowJSON?.customerRole === true ||
                          item.rowJSON?.contractType?.toLowerCase().includes('cust') ||
                          item.rowParentGUID === 'partner' ||
                          item.rowJSON?.contractPartyType === 'partner'
                        );
                      }}
                      onChange={(guid, row) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                mainCustomerContractGUID: guid,
                                ...(row?.rowOwnerGUID && !d.mainCustomerGUID ? { mainCustomerGUID: row.rowOwnerGUID } : {}),
                              }
                            : d
                        )
                      }
                    />
                  </View>
                )}

                {activeTab === 'TabKanban' && (
                  <View testID="pm-project-tab-kanban-content" style={{ flex: 1 }}>
                    <PMProjectKanbanStateList
                      projectGUID={draft?.rowGUID}
                      onOpenKanbanStages={() => setKanbanStagesOpen(true)}
                    />
                  </View>
                )}
              </ScrollView>
              {!!draftError && (
                <Text style={{ color: themeColors.error, marginTop: 6 }}>
                  {draftError}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  marginTop: 14,
                }}
              >
                <PMDialogButton
                  testID="pm-project-cancel"
                  kind="secondary"
                  title={pmT('Cancel')}
                  width={PM_DIALOG_BUTTON_WIDTH}
                  onPress={() => setDraft(null)}
                />
                <PMDialogButton
                  testID="pm-project-save"
                  kind="secondary"
                  title={pmT(draft?.rowGUID ? 'Save' : 'Create')}
                  width={PM_DIALOG_BUTTON_WIDTH}
                  onPress={saveDraft}
                />
              </View>
            </View>
          </View>
          {/* inside the settings Modal: iOS presents a modal only from the top-most one */}
          <PMKanbanStagesModalWindow
            projectGUID={draft?.rowGUID ?? null}
            projectName={draft?.name}
            visible={kanbanStagesOpen && !!draft?.rowGUID}
            onClose={() => setKanbanStagesOpen(false)}
          />
        </Modal>
      )}

      {createTemplateOpen && (
        <CreateTemplateFromProject
          visible={createTemplateOpen}
          onClose={() => setCreateTemplateOpen(false)}
          ownerGUID={ownerGUID}
          sourceProjectGUID={selectedProjectGUID || draft?.rowGUID || undefined}
        />
      )}

      {createFromTemplateOpen && (
        <CreateProjectFromTemplate
          visible={createFromTemplateOpen}
          onClose={() => setCreateFromTemplateOpen(false)}
          ownerGUID={ownerGUID}
        />
      )}
    </View>
  );
}

/** Height (px) of the Project settings window - fixed (max 92 % of the screen), the body scrolls. */
export const PM_PROJECT_SETTINGS_HEIGHT = 600;

function ProjectChip({
  guid,
  name,
  progress,
  finishMs,
  active,
  colors,
  onPress,
  onClose,
}: {
  guid: string;
  name: string;
  progress: number;
  finishMs: number | null;
  active: boolean;
  colors: { primary: string; background: string; border: string; text: string };
  onPress: () => void;
  onClose: () => void;
}) {
  const tip = usePMTip(
    `${name} · ${progress}% done${finishMs ? ` · finishes ${formatDateShort(finishMs - 1)}` : ""}`,
  );
  const closeTip = usePMTip(
    "Close (remove from this bar; the project is not deleted)",
  );
  const [hovered, setHovered] = useState(false);
  // web: the close button appears on hover; touch: always visible
  const showClose = Platform.OS !== "web" || hovered;
  return (
    <View
      style={styles.chipWrap}
      {...(Platform.OS === "web"
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as any)
        : null)}
    >
      <Pressable
        {...tip}
        testID={`pm-project-chip-${guid}`}
        onPress={onPress}
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.primary : colors.background,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            color: active ? "#fff" : colors.text,
            fontWeight: active ? "700" : "500",
            maxWidth: 200,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            color: active ? "#ffffffcc" : colors.text,
            opacity: active ? 1 : 0.6,
            fontSize: 11,
            marginLeft: 6,
          }}
        >
          {progress}%
        </Text>
      </Pressable>
      {showClose && (
        <Pressable
          {...closeTip}
          testID={`pm-project-chip-close-${guid}`}
          accessibilityLabel={pmT('Close')}
          onPress={onClose}
          hitSlop={6}
          style={[
            styles.chipClose,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <IconApp
            testID={`pm-project-chip-close-icon-${guid}`}
            name="close"
            size={11}
            color={colors.text}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 8,
    zIndex: 20,
  },
  // "Save as template" / "Or create from template": centered, same size as the export buttons above
  templateButtonRow: { marginTop: 8, alignItems: "center" },
  barContent: { flexGrow: 1, flexDirection: "row", alignItems: "center" },
  // marginLeft auto: always at the right edge of the bar ("+ Project" above "Critical path")
  barButtons: { flexDirection: "row", alignItems: "center", marginLeft: "auto" },
  chips: {
    alignItems: "center",
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  chipWrap: { marginRight: 10, position: "relative" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipClose: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  range: { fontSize: 12, opacity: 0.7, marginHorizontal: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { width: "100%", maxWidth: 600, borderRadius: 12, padding: 16 },
  modalBody: { flex: 1, minHeight: 0 },
  topTabsBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 10,
    gap: 4,
  },
  topTabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  topTabText: {
    fontSize: 13,
  },
  kanbanStagesButton: { alignSelf: "flex-start", marginLeft: 0, marginTop: 10 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  formatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  formatChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  formatText: { fontSize: 11 },
});
