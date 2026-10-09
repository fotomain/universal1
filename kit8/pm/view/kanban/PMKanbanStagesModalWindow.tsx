// "Kanban Stages" window (Project settings → Kanban Stages, and the Kanban bar): the columns of ONE
// project = project_kanban_stage_table rows. Rename, recolor, WIP limit, move left / right, sql_for_delete, add.
// Every task of the project uses this stage set; tasks of a deleted stage go back to the first stage.
// Saved at once (optimistic, realtime auto refresh in other browsers). The task progress % is not touched.
//
// Rendered as its own Modal INSIDE whatever hosts it (the Project settings window is itself a Modal,
// and iOS can present a modal only from the top-most one) - so deletes are confirmed inline here
// instead of with PMApproveYesNoCancelModalWindow.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import { useProjectKanbanData } from '../../crud/kanban/kanbanQueries';
import { useKanbanCommands } from '../../crud/kanban/useKanbanCommands';
import { kanbanStageColorOf, PMProjectKanbanStageRow, PM_KANBAN_STAGE_COLORS, PM_KANBAN_STAGE_NAME_MAX } from '../../model/kanbanTypes';
import ActivityIndicatorCircleApp from '../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { pmT } from '../../i18n/pmT';

export interface PMKanbanStagesModalWindowProps {
  projectGUID: string | null;
  projectName?: string;
  visible: boolean;
  onClose: () => void;
}

/** Mounted only while visible (its data hooks need the app providers; closing resets the inputs). */
export default function PMKanbanStagesModalWindow(props: PMKanbanStagesModalWindowProps) {
  if (!props.visible || !props.projectGUID) return null;
  return <StagesWindow {...props} />;
}

function StagesWindow({ projectGUID, projectName, onClose }: PMKanbanStagesModalWindowProps) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();
  const query = useProjectKanbanData(projectGUID);
  const kanban = useKanbanCommands(projectGUID);
  const stages = useMemo(() => [...(query.data?.stages ?? [])].sort((a, b) => a.orderInList - b.orderInList), [query.data]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PM_KANBAN_STAGE_COLORS[1]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameTaken = (name: string, except?: string) =>
    stages.some((s) => s.rowGUID !== except && s.rowJSON.stageName.trim().toLowerCase() === name.trim().toLowerCase());

  const add = () => {
    const name = newName.trim();
    if (!name) return setError('Enter the stage name.');
    if (nameTaken(name)) return setError(`"${name}" already exists.`);
    setError(null);
    kanban.createStage(name, newColor);
    setNewName('');
  };

  const missing = !!query.data?.missing;
  const height = Math.max(360, Math.min(620, Math.round(win.height * 0.9)));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { height, backgroundColor: c.surface }]} testID="pm-kanban-stages-window">
          <Text style={[styles.title, { color: c.text }]}>Kanban Stages{projectName ? ` · ${projectName}` : ''}</Text>
          <Text style={[styles.hint, { color: c.text }]}>
            {pmT('Every task of the project is in one of these stages (new tasks: the first one). The stage is independent of the task progress %.')}
          </Text>

          {query.isLoading || (!missing && !stages.length && !query.isError) ? (
            <View style={styles.center}>
              <ActivityIndicatorCircleApp testID="pm-kanban-stages-loading" />
            </View>
          ) : missing ? (
            <View style={styles.center}>
              <Text style={{ color: c.error, textAlign: 'center' }}>
                The Kanban tables are missing.{'\n'}Run kit8/sql/init/done/create_tables.sql in Supabase.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {stages.map((s, i) => (
                <StageRow
                  key={s.rowGUID}
                  stage={s}
                  first={i === 0}
                  last={i === stages.length - 1}
                  onlyOne={stages.length <= 1}
                  colors={c}
                  pickingColor={colorFor === s.rowGUID}
                  confirmingDelete={confirmDelete === s.rowGUID}
                  onRename={(name) => {
                    if (!name.trim()) return setError('A stage needs a name.');
                    if (nameTaken(name, s.rowGUID)) return setError(`"${name.trim()}" already exists.`);
                    setError(null);
                    if (name.trim() !== s.rowJSON.stageName) kanban.updateStage(s.rowGUID, { stageName: name });
                  }}
                  onWip={(n) => kanban.updateStage(s.rowGUID, { wipLimit: n })}
                  onColorToggle={() => setColorFor(colorFor === s.rowGUID ? null : s.rowGUID)}
                  onColor={(color) => {
                    setColorFor(null);
                    kanban.updateStage(s.rowGUID, { stageColor: color });
                  }}
                  onMove={(dir) => kanban.moveStage(s.rowGUID, dir)}
                  onAskDelete={() => setConfirmDelete(s.rowGUID)}
                  onCancelDelete={() => setConfirmDelete(null)}
                  onDelete={() => {
                    setConfirmDelete(null);
                    kanban.deleteStage(s.rowGUID);
                  }}
                />
              ))}

              <Text style={[styles.section, { color: c.text }]}>{pmT('Add a stage')}</Text>
              <View style={styles.row}>
                <TextInput
                  testID="pm-kanban-stage-new-name"
                  value={newName}
                  onChangeText={setNewName}
                  placeholder={pmT('Stage name')}
                  placeholderTextColor={c.border}
                  maxLength={PM_KANBAN_STAGE_NAME_MAX}
                  onSubmitEditing={add}
                  style={[styles.input, { color: c.text, borderColor: c.border, flex: 1 }]}
                />
                <PMIconButton testID="pm-kanban-stage-add" icon="add" label={pmT('Add')} color={c.primary} onPress={add} />
              </View>
              <Swatches value={newColor} onChange={setNewColor} border={c.border} testID="pm-kanban-stage-new-color" />
            </ScrollView>
          )}

          {!!error && <Text style={{ color: c.error, marginTop: 6 }}>{error}</Text>}
          <View style={styles.footer}>
            <PMDialogButton testID="pm-kanban-stages-close" kind="primary" title={pmT('Close')} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StageRow({
  stage,
  first,
  last,
  onlyOne,
  colors: c,
  pickingColor,
  confirmingDelete,
  onRename,
  onWip,
  onColorToggle,
  onColor,
  onMove,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  stage: PMProjectKanbanStageRow;
  first: boolean;
  last: boolean;
  onlyOne: boolean;
  colors: { text: string; border: string; primary: string; error: string };
  pickingColor: boolean;
  confirmingDelete: boolean;
  onRename: (name: string) => void;
  onWip: (n: number) => void;
  onColorToggle: () => void;
  onColor: (color: string) => void;
  onMove: (dir: -1 | 1) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(stage.rowJSON.stageName);
  const [wip, setWip] = useState(stage.rowJSON.wipLimit ? String(stage.rowJSON.wipLimit) : '');
  // realtime / other window changed it
  useEffect(() => setName(stage.rowJSON.stageName), [stage.rowJSON.stageName]);
  useEffect(() => setWip(stage.rowJSON.wipLimit ? String(stage.rowJSON.wipLimit) : ''), [stage.rowJSON.wipLimit]);
  const color = kanbanStageColorOf(stage.rowJSON);
  const commitWip = () => {
    const n = Math.max(0, Math.min(999, parseInt(wip, 10) || 0));
    if (n !== (stage.rowJSON.wipLimit || 0)) onWip(n);
    setWip(n ? String(n) : '');
  };
  const id = stage.rowGUID;
  return (
    <View style={[styles.stageBox, { borderColor: c.border }]}>
      <View style={styles.row}>
        <Pressable
          testID={`pm-kanban-stage-color-${id}`}
          accessibilityLabel={pmT('Stage color')}
          onPress={onColorToggle}
          style={[styles.swatch, { backgroundColor: color, borderColor: c.border }]}
        />
        <TextInput
          testID={`pm-kanban-stage-name-${id}`}
          value={name}
          onChangeText={setName}
          onBlur={() => onRename(name)}
          onSubmitEditing={() => onRename(name)}
          maxLength={PM_KANBAN_STAGE_NAME_MAX}
          style={[styles.input, { color: c.text, borderColor: c.border, flex: 1 }]}
        />
        <TextInput
          testID={`pm-kanban-stage-wip-${id}`}
          value={wip}
          onChangeText={(v) => setWip(v.replace(/[^0-9]/g, ''))}
          onBlur={commitWip}
          onSubmitEditing={commitWip}
          placeholder="WIP"
          placeholderTextColor={c.border}
          keyboardType="number-pad"
          style={[styles.input, styles.wip, { color: c.text, borderColor: c.border }]}
        />
        <PMIconButton testID={`pm-kanban-stage-left-${id}`} icon="arrow_upward" title={pmT('Move up = earlier stage (column to the left)')} color={c.text} compact disabled={first} onPress={() => onMove(-1)} />
        <PMIconButton testID={`pm-kanban-stage-right-${id}`} icon="arrow_downward" title={pmT('Move down = later stage (column to the right)')} color={c.text} compact disabled={last} onPress={() => onMove(1)} />
        <PMIconButton testID={`pm-kanban-stage-delete-${id}`} icon="delete" title={pmT('Delete stage')} color={c.error} compact disabled={onlyOne} onPress={onAskDelete} />
      </View>
      {pickingColor && <Swatches value={color} onChange={onColor} border={c.border} testID={`pm-kanban-stage-colors-${id}`} />}
      {confirmingDelete && (
        <View style={[styles.row, { marginTop: 6 }]}>
          <Text style={{ color: c.error, flex: 1, fontSize: 12 }}>Delete "{stage.rowJSON.stageName}"? Its tasks move to the first stage.</Text>
          <PMDialogButton testID={`pm-kanban-stage-delete-no-${id}`} kind="text" title={pmT('No')} color={c.text} onPress={onCancelDelete} />
          <PMDialogButton testID={`pm-kanban-stage-delete-yes-${id}`} kind="dangerContained" title={pmT('Delete')} onPress={onDelete} />
        </View>
      )}
    </View>
  );
}

function Swatches({ value, onChange, border, testID }: { value: string; onChange: (c: string) => void; border: string; testID: string }) {
  return (
    <View style={[styles.row, { flexWrap: 'wrap', marginTop: 6 }]} testID={testID}>
      {PM_KANBAN_STAGE_COLORS.map((color) => (
        <Pressable
          key={color}
          testID={`${testID}-${color}`}
          accessibilityLabel={color}
          onPress={() => onChange(color)}
          style={[styles.swatch, { backgroundColor: color, borderColor: value.toLowerCase() === color.toLowerCase() ? '#000' : border, borderWidth: value.toLowerCase() === color.toLowerCase() ? 2 : StyleSheet.hairlineWidth, marginBottom: 6 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 520, borderRadius: 12, padding: 16 },
  title: { fontWeight: '700', fontSize: 16 },
  hint: { opacity: 0.7, fontSize: 12, marginTop: 4, marginBottom: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  section: { fontWeight: '700', marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  stageBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 8, marginBottom: 8 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginRight: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 8, paddingVertical: Platform.OS === 'web' ? 6 : 4, marginRight: 6, fontSize: 13 },
  wip: { width: 52, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
});
