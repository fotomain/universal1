// CreateProjectFromTemplate - Modal window to instantiate a new project from a template.
// Copies tasks, dependencies, closure, stages, and settings from templates_project_* tables.
// Automatically shifts task dates to align with the new project start date.
// Explicitly excludes task kanban states (tasks start unassigned to stages).

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { usePMStore } from '../../store/store_pm';
import {
  useCreateProjectFromTemplateMutation,
  useReadTemplatesQuery,
} from '../../crud/template/templateQueries';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import IconApp from '../../../components/common/IconApp';
import ActivityIndicatorCircleApp from '../../../components/activityindicator/ActivityIndicatorCircleApp';
import PMDateInput from '../../inner/inputs/PMDateInput';
import { formatDateISO, parseDateISO, todayUTC } from './scheduling';
import { PMProjectRow } from '../../model/types';
import { pmT } from '../../i18n/pmT';

export interface CreateProjectFromTemplateProps {
  visible: boolean;
  onClose: () => void;
  ownerGUID: string;
  onCreated?: (project: PMProjectRow) => void;
}

export default function CreateProjectFromTemplate({
  visible,
  onClose,
  ownerGUID,
  onCreated,
}: CreateProjectFromTemplateProps) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();

  const templatesQuery = useReadTemplatesQuery(ownerGUID);
  const templates = templatesQuery.data || [];

  const [selectedTemplateGUID, setSelectedTemplateGUID] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [startDateStr, setStartDateStr] = useState(formatDateISO(todayUTC()));
  const [error, setError] = useState<string | null>(null);

  const createProjectMutation = useCreateProjectFromTemplateMutation(ownerGUID);

  useEffect(() => {
    if (visible) {
      setError(null);
      setStartDateStr(formatDateISO(todayUTC()));
      if (templates.length > 0 && !selectedTemplateGUID) {
        setSelectedTemplateGUID(templates[0].rowGUID);
        setProjectName(templates[0].rowJSON?.name?.replace(/\s+Template$/i, '') || 'New Project');
      }
    }
  }, [visible, templates, selectedTemplateGUID]);

  const onSelectTemplate = (template: PMProjectRow) => {
    setSelectedTemplateGUID(template.rowGUID);
    const baseName = template.rowJSON?.name?.replace(/\s+Template$/i, '') || 'New Project';
    setProjectName(baseName);
    if (error) setError(null);
  };

  if (!visible) return null;

  const handleSubmit = async () => {
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }
    if (!selectedTemplateGUID) {
      setError('Please select a template.');
      return;
    }

    const startMs = parseDateISO(startDateStr);
    if (startMs === null) {
      setError('Please enter a valid start date (YYYY-MM-DD).');
      return;
    }

    setError(null);
    try {
      const created = await createProjectMutation.mutateAsync({
        templateGUID: selectedTemplateGUID,
        ownerGUID,
        projectName: trimmedName,
        startMs,
      });
      if (onCreated) {
        onCreated(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create project from template.');
    }
  };

  const cardWidth = Math.min(560, Math.round(win.width * 0.94));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          testID="pm-create-from-template-modal"
          style={[
            styles.card,
            {
              width: cardWidth,
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <IconApp name="library_add" size={22} color={c.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.title, { color: c.text }]}>{pmT('New Project from Template')}</Text>
            </View>
            <Pressable
              testID="pm-create-from-template-close-btn"
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={pmT('Close')}
            >
              <IconApp name="close" size={20} color={c.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Template Selection */}
            <Text style={[styles.label, { color: c.text }]}>{pmT('Select Template *')}</Text>
            {templatesQuery.isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicatorCircleApp size={24} color={c.primary} />
                <Text style={[styles.loadingText, { color: c.text }]}>{pmT('Loading templates...')}</Text>
              </View>
            ) : templates.length === 0 ? (
              <View
                testID="pm-no-templates-notice"
                style={[styles.emptyBox, { borderColor: c.border, backgroundColor: c.background }]}
              >
                <IconApp name="folder_open" size={28} color={c.text + '80'} style={{ marginBottom: 6 }} />
                <Text style={[styles.emptyText, { color: c.text }]}>
                  {pmT('No project templates found.')}
                </Text>
                <Text style={[styles.emptySubtext, { color: c.text + '99' }]}>
                  {pmT('Save any active project as a template first using "Save as Template".')}
                </Text>
              </View>
            ) : (
              <View testID="pm-templates-list" style={styles.templatesList}>
                {templates.map((tpl) => {
                  const isSelected = tpl.rowGUID === selectedTemplateGUID;
                  return (
                    <Pressable
                      key={tpl.rowGUID}
                      testID={`pm-template-card-${tpl.rowGUID}`}
                      onPress={() => onSelectTemplate(tpl)}
                      style={[
                        styles.templateCard,
                        {
                          borderColor: isSelected ? c.primary : c.border,
                          backgroundColor: isSelected ? c.primary + '15' : c.background,
                        },
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <IconApp
                          name={isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}
                          size={18}
                          color={isSelected ? c.primary : c.text + '80'}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.templateName,
                            { color: isSelected ? c.primary : c.text, fontWeight: isSelected ? '700' : '500' },
                          ]}
                          numberOfLines={1}
                        >
                          {tpl.rowJSON?.name || 'Untitled Template'}
                        </Text>
                      </View>
                      {!!tpl.rowJSON?.notes && (
                        <Text
                          style={[styles.templateNotes, { color: c.text + 'B3' }]}
                          numberOfLines={2}
                        >
                          {tpl.rowJSON.notes}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Project Name */}
            {templates.length > 0 && (
              <>
                <Text style={[styles.label, { color: c.text, marginTop: 14 }]}>{pmT('Project Name *')}</Text>
                <TextInput
                  testID="pm-new-project-name-input"
                  value={projectName}
                  onChangeText={(t) => {
                    setProjectName(t);
                    if (error) setError(null);
                  }}
                  placeholder={pmT('e.g. Q4 Website Redesign')}
                  placeholderTextColor={c.text + '66'}
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      borderColor: error && !projectName.trim() ? c.error : c.border,
                      backgroundColor: c.background,
                    },
                  ]}
                />

                {/* Project Start Date */}
                <PMDateInput
                  testID="pm-new-project-start-input"
                  pickerTestID="pm-new-project-date"
                  label={pmT('Project Start Date *')}
                  value={startDateStr}
                  onChangeText={(t) => {
                    setStartDateStr(t);
                    if (error) setError(null);
                  }}
                  style={{ marginTop: 10 }}
                />
              </>
            )}

            {/* Error Message */}
            {!!error && (
              <View testID="pm-create-from-template-error" style={[styles.errorBox, { borderColor: c.error }]}>
                <IconApp name="error_outline" size={16} color={c.error} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <PMDialogButton
              testID="pm-create-from-template-cancel-btn"
              title={pmT('Cancel')}
              variant="outline"
              color={c.text}
              onPress={onClose}
              disabled={createProjectMutation.isPending}
            />
            {templates.length > 0 && (
              <PMDialogButton
                testID="pm-create-from-template-submit-btn"
                title={
                  createProjectMutation.isPending ? 'Creating Project...' : 'Create Project'
                }
                variant="filled"
                color={c.primary}
                onPress={handleSubmit}
                disabled={
                  createProjectMutation.isPending || !projectName.trim() || !selectedTemplateGUID
                }
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  templatesList: {
    gap: 8,
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateName: {
    fontSize: 14,
    flex: 1,
  },
  templateNotes: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 26,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
