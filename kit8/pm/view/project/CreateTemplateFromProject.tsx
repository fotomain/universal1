// CreateTemplateFromProject - Modal window to save an existing project as a template.
// Copies tasks, dependencies, closure, stages, and settings to templates_project_* tables.
// Explicitly excludes task kanban state records (no stages set on tasks).

import React, { useEffect, useMemo, useState } from 'react';
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
import { useCreateTemplateFromProjectMutation } from '../../crud/template/templateQueries';
import { PMDialogButton } from '../../inner/buttons';
import IconApp from '../../../ui/components/common/IconApp';
import ActivityIndicatorCircleApp from '../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { PMProjectRow } from '../../model/types';
import { pmT } from '../../i18n/pmT';

export interface CreateTemplateFromProjectProps {
  visible: boolean;
  onClose: () => void;
  ownerGUID: string;
  sourceProjectGUID?: string;
  onCreated?: (template: PMProjectRow) => void;
}

export default function CreateTemplateFromProject({
  visible,
  onClose,
  ownerGUID,
  sourceProjectGUID,
  onCreated,
}: CreateTemplateFromProjectProps) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();
  const projectsById = usePMStore((s) => s.projectsById);
  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const projectOrder = usePMStore((s) => s.projectOrder);

  const activeSourceGUID = sourceProjectGUID || selectedProjectGUID || projectOrder[0] || '';
  const [selectedSource, setSelectedSource] = useState(activeSourceGUID);

  const sourceProject = projectsById[selectedSource];
  const sourceName = sourceProject?.rowJSON?.name || 'Untitled Project';

  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createTemplateMutation = useCreateTemplateFromProjectMutation(ownerGUID);

  useEffect(() => {
    if (visible) {
      setSelectedSource(activeSourceGUID);
      setTemplateName(sourceName ? `${sourceName} Template` : 'New Template');
      setDescription(sourceProject?.rowJSON?.notes || '');
      setError(null);
    }
  }, [visible, activeSourceGUID, sourceName, sourceProject]);

  if (!visible) return null;

  const handleSubmit = async () => {
    const trimmed = templateName.trim();
    if (!trimmed) {
      setError('Template name is required.');
      return;
    }
    if (!selectedSource) {
      setError('No source project selected.');
      return;
    }

    setError(null);
    try {
      const created = await createTemplateMutation.mutateAsync({
        sourceProjectGUID: selectedSource,
        ownerGUID,
        templateName: trimmed,
        templateDescription: description.trim(),
      });
      if (onCreated) {
        onCreated(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create template from project.');
    }
  };

  const cardWidth = Math.min(520, Math.round(win.width * 0.94));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          testID="pm-create-template-modal"
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
              <IconApp name="bookmark_add" size={22} color={c.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.title, { color: c.text }]}>{pmT('Create Template from Project')}</Text>
            </View>
            <Pressable
              testID="pm-template-close-btn"
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={pmT('Close')}
            >
              <IconApp name="close" size={20} color={c.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Source Project Selector */}
            <Text style={[styles.label, { color: c.text }]}>{pmT('Source Project')}</Text>
            <View style={[styles.sourceBox, { borderColor: c.border, backgroundColor: c.background }]}>
              <Text style={[styles.sourceText, { color: c.text }]} numberOfLines={1}>
                {sourceName}
              </Text>
            </View>

            {/* Template Name */}
            <Text style={[styles.label, { color: c.text, marginTop: 14 }]}>{pmT('Template Name *')}</Text>
            <TextInput
              testID="pm-template-name-input"
              value={templateName}
              onChangeText={(t) => {
                setTemplateName(t);
                if (error) setError(null);
              }}
              placeholder={pmT('e.g. Standard Web App Template')}
              placeholderTextColor={c.text + '66'}
              style={[
                styles.input,
                {
                  color: c.text,
                  borderColor: error && !templateName.trim() ? c.error : c.border,
                  backgroundColor: c.background,
                },
              ]}
              autoFocus
            />

            {/* Description */}
            <Text style={[styles.label, { color: c.text, marginTop: 14 }]}>{pmT('Description / Notes')}</Text>
            <TextInput
              testID="pm-template-description-input"
              value={description}
              onChangeText={setDescription}
              placeholder={pmT('Optional notes or instructions for this template...')}
              placeholderTextColor={c.text + '66'}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.textArea,
                {
                  color: c.text,
                  borderColor: c.border,
                  backgroundColor: c.background,
                },
              ]}
            />

            {/* Informational note */}
            <View
              style={[
                styles.infoBox,
                {
                  borderColor: c.border,
                  backgroundColor: c.surface,
                },
              ]}
            >
              <IconApp name="info" size={16} color={c.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.infoText, { color: c.text + 'CC' }]}>
                {pmT('Stores template structure, tasks, dependencies, closure, stages, and settings in template tables. Task Kanban stage values are excluded.')}
              </Text>
            </View>

            {/* Error Message */}
            {!!error && (
              <View testID="pm-template-error" style={[styles.errorBox, { borderColor: c.error }]}>
                <IconApp name="error_outline" size={16} color={c.error} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <PMDialogButton
              testID="pm-template-cancel-btn"
              title={pmT('Cancel')}
              variant="outline"
              color={c.text}
              onPress={onClose}
              disabled={createTemplateMutation.isPending}
            />
            <PMDialogButton
              testID="pm-template-submit-btn"
              title={
                createTemplateMutation.isPending ? 'Saving...' : 'Save as Template'
              }
              variant="filled"
              color={c.primary}
              onPress={handleSubmit}
              disabled={createTemplateMutation.isPending || !templateName.trim()}
            />
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
  sourceBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
