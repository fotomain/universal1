// PMRecentProjectsToolbar - the project bar: [ SelectProjectFromList ] [ ‹ ribbon of recent projects › ] [actions] [+ Project]
//
//  * SelectProjectFromList - search any project in the database by substring
//  * ribbon                - only the LAST SELECTED projects (per user, AsyncStorage - see
//                            recentProjects.ts), sorted by name, horizontally scrollable with
//                            chevron arrows; hover a chip -> "Close" (x) in its right corner
//                            removes the project from the ribbon (not from the database)
//  * project CRUD          - create / settings / delete (demo data: only in the empty state)

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useDesignSystem } from "../../../providers/WithDesignSystem";
import IconApp from "../../../components/common/IconApp";
import { usePMStore } from "../../store";
import {
  useBuildProjectRow,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useUpdateProjectMutation,
} from "../../queries";
import {
  formatDateISO,
  formatDateShort,
  parseDateISO,
  todayUTC,
} from "../../scheduling";
import { uxuiSettingsOf } from "../../types";
import { approvePM } from "../../PMApproveYesNoCancelModalWindow";
import { PMDialogButton, PMIconButton, PMTipIcon } from "../../inner/buttons";
import PMAddProjectButton from "../buttons/PMAddProjectButton";
import { usePMTip } from "../../inner/tooltip/PMTooltip";
import SelectProjectFromList from "../SelectProjectFromList";

interface Draft {
  rowGUID: string | null; // null = new project
  name: string;
  start: string;
  skipWeekends: boolean;
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

  const compact = useWindowDimensions().width < 640;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
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
    setDraft({
      rowGUID: null,
      name: "",
      start: formatDateISO(todayUTC()),
      skipWeekends: false,
    });
  };
  const openEdit = () => {
    if (!selected) return;
    setDraftError(null);
    const start = selected.rowJSON.projectStartAt
      ? Date.parse(selected.rowJSON.projectStartAt)
      : todayUTC();
    setDraft({
      rowGUID: selected.rowGUID,
      name: selected.rowJSON.name || "",
      start: formatDateISO(start),
      skipWeekends: !!selected.rowJSON.skipWeekends,
    });
  };

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
          },
        },
      });
    } else {
      const row = buildRow(name, startMs);
      row.rowJSON.skipWeekends = draft.skipWeekends;
      row.rowJSON.uxuiSettings = uxuiSettingsOf(undefined);
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
              style={[
                styles.modalCard,
                { backgroundColor: themeColors.surface },
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
              <Text style={[styles.label, { color: themeColors.text }]}>
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
              <View style={styles.switchRow}>
                <Text style={{ color: themeColors.text, flex: 1 }}>
                  Working days only (skip weekends)
                </Text>
                <Switch
                  testID="pm-project-weekends"
                  value={!!draft?.skipWeekends}
                  onValueChange={(v) =>
                    setDraft((d) => (d ? { ...d, skipWeekends: v } : d))
                  }
                />
              </View>
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
        </Modal>
      )}
    </View>
  );
}

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
  modalCard: { width: "100%", maxWidth: 360, borderRadius: 12, padding: 16 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
});
