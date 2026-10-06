// PMTaskKanbanStateEditModal - modal for adding or editing a project_task_kanban_state_table entry
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDispatch } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../../../../providers/WithDesignSystem';
import IconApp from '../../../../../components/common/IconApp';
import { SystemMetaData } from '../../../../../redux/SystemMetaData';
import { PROJECT_TASK_KANBAN_STATE_ENTITY } from '../../../../model/constants';
import { usePMStore } from '../../../../store/store_pm';
import { usePMKanbanStore } from '../../../../store/store_kanban';
import { pmT } from '../../../../i18n/pmT';

export interface PMTaskKanbanStateEditModalProps {
  visible: boolean;
  projectGUID: string;
  initialRow?: any | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PMTaskKanbanStateEditModal({
  visible,
  projectGUID,
  initialRow,
  onClose,
  onSaved,
}: PMTaskKanbanStateEditModalProps) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[PROJECT_TASK_KANBAN_STATE_ENTITY]?.actions;

  // Retrieve project tasks from store
  const tasksById = usePMStore((s) => s.tasksById || {});
  const projectTasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (t: any) => t.projectGUID === projectGUID || t.rowOwnerGUID === projectGUID
    );
  }, [tasksById, projectGUID]);

  // Retrieve kanban stages from store
  const stages = usePMKanbanStore((s) => s.stages || []);

  const [selectedTaskGUID, setSelectedTaskGUID] = useState<string>('');
  const [selectedStageGUID, setSelectedStageGUID] = useState<string>('');
  const [progressPct, setProgressPct] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialRow) {
        setSelectedTaskGUID(initialRow.rowParentGUID || '');
        setSelectedStageGUID(initialRow.rowJSON?.stageGUID || '');
        setProgressPct(String(initialRow.rowJSON?.kanbanStageProgressPercent ?? 0));
      } else {
        setSelectedTaskGUID(projectTasks[0]?.rowGUID || '');
        setSelectedStageGUID(stages[0]?.rowGUID || '');
        setProgressPct('0');
      }
      setError(null);
    }
  }, [visible, initialRow, projectTasks, stages]);

  if (!visible) return null;

  const handleSave = () => {
    if (!selectedTaskGUID) {
      setError('Please select a task.');
      return;
    }
    if (!selectedStageGUID) {
      setError('Please select a Kanban stage.');
      return;
    }

    const pct = Math.min(100, Math.max(0, parseInt(progressPct, 10) || 0));

    if (initialRow?.rowGUID) {
      if (actions?.updateOne) {
        dispatch(
          actions.updateOne({
            rowGUID: initialRow.rowGUID,
            rowOwnerGUID: projectGUID,
            rowParentGUID: selectedTaskGUID,
            orderInList: initialRow.orderInList ?? 0,
            rowJSON: {
              ...initialRow.rowJSON,
              stageGUID: selectedStageGUID,
              kanbanStageProgressPercent: pct,
            },
          })
        );
      }
    } else {
      if (actions?.createOne) {
        const newRowGUID = Crypto.randomUUID();
        dispatch(
          actions.createOne({
            rowGUID: newRowGUID,
            rowOwnerGUID: projectGUID,
            rowParentGUID: selectedTaskGUID,
            orderInList: 0,
            rowJSON: {
              stageGUID: selectedStageGUID,
              kanbanStageProgressPercent: pct,
            },
          })
        );
      }
    }

    onSaved?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {initialRow ? 'Edit Task Kanban State' : 'Set Task Kanban State'}
            </Text>
            <Pressable testID="kanban-state-modal-close" onPress={onClose} style={styles.closeBtn}>
              <IconApp name="close" size={20} color={c.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Task selector */}
            <Text style={[styles.fieldLabel, { color: c.text }]}>{pmT('Task')}</Text>
            <View style={styles.chipsRow}>
              {projectTasks.map((t: any) => {
                const active = selectedTaskGUID === t.rowGUID;
                return (
                  <Pressable
                    key={t.rowGUID}
                    testID={`kanban-state-task-chip-${t.rowGUID}`}
                    onPress={() => setSelectedTaskGUID(t.rowGUID)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? `${c.primary}20` : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? c.primary : c.text, fontWeight: active ? '700' : '400' },
                      ]}
                      numberOfLines={1}
                    >
                      {t.rowJSON?.name || t.rowGUID.slice(0, 8)}
                    </Text>
                  </Pressable>
                );
              })}
              {projectTasks.length === 0 && (
                <Text style={[styles.hintText, { color: `${c.text}88` }]}>
                  {pmT('No tasks found in this project.')}
                </Text>
              )}
            </View>

            {/* Stage selector */}
            <Text style={[styles.fieldLabel, { color: c.text, marginTop: 12 }]}>{pmT('Kanban Stage')}</Text>
            <View style={styles.chipsRow}>
              {stages.map((st: any) => {
                const stId = st.rowGUID || st.id;
                const active = selectedStageGUID === stId;
                const color = st.rowJSON?.color || st.color || c.primary;
                return (
                  <Pressable
                    key={stId}
                    testID={`kanban-state-stage-chip-${stId}`}
                    onPress={() => setSelectedStageGUID(stId)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? color : c.border,
                        backgroundColor: active ? `${color}25` : 'transparent',
                      },
                    ]}
                  >
                    <View style={[styles.stageDot, { backgroundColor: color }]} />
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? color : c.text, fontWeight: active ? '700' : '400' },
                      ]}
                      numberOfLines={1}
                    >
                      {st.rowJSON?.name || st.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Progress percent */}
            <Text style={[styles.fieldLabel, { color: c.text, marginTop: 12 }]}>
              {pmT('Progress % (0–100)')}
            </Text>
            <TextInput
              testID="kanban-state-progress-input"
              value={progressPct}
              onChangeText={setProgressPct}
              keyboardType="numeric"
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />

            {!!error && <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              testID="kanban-state-cancel"
              onPress={onClose}
              style={[styles.footerBtn, { borderColor: c.border, borderWidth: 1 }]}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>{pmT('Cancel')}</Text>
            </Pressable>
            <Pressable
              testID="kanban-state-save"
              onPress={handleSave}
              style={[styles.footerBtn, { backgroundColor: c.primary }]}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{pmT('Save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: 560,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
      default: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  chipText: {
    fontSize: 12,
  },
  hintText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
