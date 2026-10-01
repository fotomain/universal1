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

export type ProjectSettingsTab = 'TabMain' | 'TabUXUI' | 'TabPartners' | 'TabKanban';

interface Draft {
  rowGUID: string | null; // null = new project
  name: string;
  start: string;
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
}: {
  ownerGUID: string;
}) {
  const { themeColors } = useDesignSystem();
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
    const start = project.rowJSON.projectStartAt
      ? Date.parse(project.rowJSON.projectStartAt)
      : todayUTC();
    setDraft({
      rowGUID: project.rowGUID,
      name: project.rowJSON.name || "",
      start: formatDateISO(start),
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
    openEditFor(s.projectsById[settingsRequest.guid]);
    s.openProjectSettings(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRequest]);

  /** after an import the project's start / calendar come from the file: show them (Save keeps them) */
  const onImported = (json: PMRowJSON) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            start: json.projectStartAt ? formatDateISO(Date.parse(json.projectStartAt)) : d.start,
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

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const startMs = parseDateISO(draft.start);
    if (!name) return setDraftError("Name is required.");
    if (startMs === null) return setDraftError("Start must be YYYY-MM-DD.");
    if (draft.rowGUID) {
      const cur = projectsById[draft.rowGUID];
      updateProject.mutate({
        rowGUID: draft.rowGUID,
        patch: {
          rowJSON: {
            ...cur.rowJSON,
            name,
            projectStartAt: new Date(startMs).toISOString(),
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
        },
      });
    } else {
      const row = buildRow(name, startMs);
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
      // no uxuiSettings here: the Gantt / tree settings are per user (project_user_settings_table), defaults until saved
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
      ]}
    >
      {!compact && (
        <PMTipIcon
          tip="Projects"
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

      <PMIconButton
        compact
        testID="pm-project-ribbon-left"
        icon="chevron_left"
        title="Scroll the projects left"
        color={themeColors.text}
        disabled={!canLeft}
        onPress={() => scrollBy(-1)}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
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
        title="Scroll the projects right"
        color={themeColors.text}
        disabled={!canRight}
        onPress={() => scrollBy(1)}
      />

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
        testID="pm-project-edit"
        icon="settings"
        title="Project settings"
        color={themeColors.text}
        disabled={!selected}
        onPress={openEdit}
      />
      <PMIconButton
        testID="pm-project-delete"
        icon="delete"
        title="Delete project"
        color={themeColors.error}
        disabled={!selected}
        onPress={remove}
      />
      <PMAddProjectButton compact={compact} onPress={openNew} />

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
              <Text
                style={{
                  color: themeColors.text,
                  fontWeight: "700",
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                {draft?.rowGUID ? "Project settings" : "New project"}
              </Text>

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
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView style={styles.modalBody} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                {activeTab === 'TabMain' && (
                  <View testID="pm-project-tab-main-content">
                    <Text style={[styles.label, { color: themeColors.text }]}>
                      Name
                    </Text>
                    <TextInput
                      testID="pm-project-name"
                      value={draft?.name || ""}
                      onChangeText={(v) =>
                        setDraft((d) => (d ? { ...d, name: v } : d))
                      }
                      placeholder="Project name"
                      placeholderTextColor={themeColors.border}
                      style={[
                        styles.input,
                        { color: themeColors.text, borderColor: themeColors.border },
                      ]}
                      autoFocus
                      onSubmitEditing={saveDraft}
                    />
                    <Text style={[styles.label, { color: themeColors.text, marginTop: 10 }]}>
                      Start (YYYY-MM-DD)
                    </Text>
                    <TextInput
                      testID="pm-project-start"
                      value={draft?.start || ""}
                      onChangeText={(v) =>
                        setDraft((d) => (d ? { ...d, start: v } : d))
                      }
                      style={[
                        styles.input,
                        { color: themeColors.text, borderColor: themeColors.border },
                      ]}
                      autoCapitalize="none"
                    />
                    <SwitchApp
                      testID="pm-project-weekends"
                      label="Working days only (skip weekends)"
                      value={!!draft?.skipWeekends}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, skipWeekends: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    {!!draft?.rowGUID && (
                      <ImportExportProject
                        ownerGUID={ownerGUID}
                        projectGUID={draft.rowGUID}
                        colors={{ text: themeColors.text, primary: themeColors.primary, error: themeColors.error, border: themeColors.border }}
                        onImported={onImported}
                      />
                    )}
                  </View>
                )}

                {activeTab === 'TabUXUI' && (
                  <View testID="pm-project-tab-uxui-content">
                    <SwitchApp
                      testID="pm-project-plan-day"
                      label="Plan in days (planDay)"
                      value={draft?.planDay ?? true}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planDay: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <SwitchApp
                      testID="pm-project-plan-hour"
                      label="Plan in hours (planHour)"
                      value={!!draft?.planHour}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planHour: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <SwitchApp
                      testID="pm-project-plan-minute"
                      label="Plan in minutes (planMinute)"
                      value={!!draft?.planMinute}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planMinute: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <SwitchApp
                      testID="pm-project-plan-second"
                      label="Plan in seconds (planSecond)"
                      value={!!draft?.planSecond}
                      onValueChange={(v) =>
                        setDraft((d) => (d ? { ...d, planSecond: v } : d))
                      }
                      style={styles.switchRow}
                    />
                    <Text style={[styles.label, { color: themeColors.text, marginTop: 14 }]}>
                      Date format (planDateInputFormat)
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
                      label="Main Supplier (mainSupplierGUID)"
                      placeholder="Select main supplier..."
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
                      label="Main Supplier Contract (mainSupplierContractGUID)"
                      placeholder="Select supplier contract..."
                      entityName={CONTRACT_ENTITY}
                      value={draft?.mainSupplierContractGUID}
                      rowOwnerGUID={draft?.mainSupplierGUID ? draft.mainSupplierGUID : undefined}
                      rowParentGUID="partner"
                      filterItem={(item) =>
                        Boolean(item.rowJSON?.supplierRole) &&
                        (!draft?.mainSupplierGUID || item.rowOwnerGUID === draft.mainSupplierGUID)
                      }
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
                      label="Main Customer (mainCustomerGUID)"
                      placeholder="Select main customer..."
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
                      label="Main Customer Contract (mainCustomerContractGUID)"
                      placeholder="Select customer contract..."
                      entityName={CONTRACT_ENTITY}
                      value={draft?.mainCustomerContractGUID}
                      rowOwnerGUID={draft?.mainCustomerGUID ? draft.mainCustomerGUID : undefined}
                      rowParentGUID="partner"
                      filterItem={(item) =>
                        Boolean(item.rowJSON?.customerRole) &&
                        (!draft?.mainCustomerGUID || item.rowOwnerGUID === draft.mainCustomerGUID)
                      }
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
                  title="Cancel"
                  color={themeColors.text}
                  onPress={() => setDraft(null)}
                />
                <PMDialogButton
                  testID="pm-project-save"
                  kind="primary"
                  title={draft?.rowGUID ? "Save" : "Create"}
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
          accessibilityLabel="Close"
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 20,
  },
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
