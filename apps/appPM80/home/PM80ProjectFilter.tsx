import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import PM80Tip from './PM80Tip';
import {
  PM80_PROJECTS,
  PM80ProjectSelection,
  normalizeProjectSelection,
  projectFilterLabel,
} from './pm80HomeModel';

export interface PM80ProjectFilterProps {
  /** null = ALL projects, else the checked project ids */
  selection: PM80ProjectSelection;
  onChange: (selection: PM80ProjectSelection) => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  /** the main color of the check boxes and the Apply button */
  accent: string;
  surface: string;
  borderColor: string;
  testID?: string;
}

const allIds = PM80_PROJECTS.map((p) => p.id);

/**
 * Project filter of the home: a button with the state ("All projects (12)", "3 of 12 projects", a project name)
 * that opens a list with CHECK BOXES. Check a SUBSET of the projects, or all of them (= ALL projects); Apply keeps it.
 * Used by the Paper and the Tamagui home.
 */
export default function PM80ProjectFilter({
  selection,
  onChange,
  isDark,
  textStrong,
  textMuted,
  accent,
  surface,
  borderColor,
  testID = 'pm80-project-filter',
}: PM80ProjectFilterProps) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeProjectSelection(selection);
  const [draft, setDraft] = useState<string[]>(normalized ?? allIds);

  // every time the list opens it starts from the filter in force
  useEffect(() => {
    if (open) setDraft(normalizeProjectSelection(selection) ?? allIds);
  }, [open, selection]);

  const allChecked = draft.length === allIds.length;
  const noneChecked = draft.length === 0;
  const masterIcon = allChecked ? 'checkbox-marked' : noneChecked ? 'checkbox-blank-outline' : 'minus-box';

  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const toggleAll = () => setDraft(allChecked ? [] : allIds);

  const apply = () => {
    if (noneChecked) return;
    onChange(normalizeProjectSelection(draft));
    setOpen(false);
  };

  const isFiltered = normalized !== null;
  const buttonLabel = projectFilterLabel(selection);
  const tip = isFiltered
    ? 'Project filter: only the checked projects are counted. Tap to change or to show all projects.'
    : 'Project filter: all projects are counted. Tap to check a subset of the projects.';

  const sheetBg = isDark ? '#1D1B20' : '#FFFFFF';
  const rowBg = isDark ? '#2B2930' : '#F7F2FA';

  const checkIcon = (checked: boolean) => (checked ? 'checkbox-marked' : 'checkbox-blank-outline');

  const checkedItems = useMemo(() => new Set(draft), [draft]);

  return (
    <>
      <PM80Tip tip={tip}>
        <TouchableOpacity
          testID={testID}
          accessibilityLabel={`Project filter: ${buttonLabel}`}
          activeOpacity={0.8}
          onPress={() => setOpen(true)}
          style={[
            styles.button,
            {
              borderColor: isFiltered ? accent : borderColor,
              backgroundColor: isFiltered ? `${accent}22` : 'transparent',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={(isFiltered ? 'filter-check-outline' : 'filter-variant') as any}
            size={15}
            color={isFiltered ? accent : textMuted}
          />
          <Text
            testID={`${testID}-label`}
            numberOfLines={1}
            style={[styles.buttonText, { color: isFiltered ? accent : textMuted }]}
          >
            {buttonLabel}
          </Text>
          <MaterialCommunityIcons
            name={'chevron-down' as any}
            size={16}
            color={isFiltered ? accent : textMuted}
          />
        </TouchableOpacity>
      </PM80Tip>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} testID={`${testID}-backdrop`}>
          {/* the sheet swallows the taps so only the backdrop closes the list */}
          <Pressable
            testID={`${testID}-modal`}
            onPress={() => undefined}
            style={[styles.sheet, { backgroundColor: sheetBg, borderColor }]}
          >
            <Text style={[styles.title, { color: textStrong }]}>Projects</Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>
              The numbers of the home are the sums of the checked projects.
            </Text>

            <TouchableOpacity
              testID={`${testID}-all`}
              activeOpacity={0.8}
              onPress={toggleAll}
              style={[styles.row, styles.masterRow, { backgroundColor: rowBg, borderColor }]}
            >
              <MaterialCommunityIcons name={masterIcon as any} size={24} color={accent} />
              <View style={styles.rowTexts}>
                <Text style={[styles.rowTitle, { color: textStrong }]}>
                  All projects ({PM80_PROJECTS.length})
                </Text>
                <Text style={[styles.rowSub, { color: textMuted }]}>
                  {allChecked
                    ? 'Everything is counted'
                    : noneChecked
                    ? 'Check at least one project'
                    : `${draft.length} of ${PM80_PROJECTS.length} checked`}
                </Text>
              </View>
            </TouchableOpacity>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {PM80_PROJECTS.map((pr) => {
                const checked = checkedItems.has(pr.id);
                return (
                  <TouchableOpacity
                    key={pr.id}
                    testID={`${testID}-item-${pr.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    activeOpacity={0.8}
                    onPress={() => toggle(pr.id)}
                    style={styles.row}
                  >
                    <MaterialCommunityIcons
                      name={checkIcon(checked) as any}
                      size={22}
                      color={checked ? accent : textMuted}
                    />
                    <View style={styles.rowTexts}>
                      <Text style={[styles.rowTitle, { color: textStrong }]}>{pr.name}</Text>
                      <Text style={[styles.rowSub, { color: textMuted }]}>{pr.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                testID={`${testID}-cancel`}
                onPress={() => setOpen(false)}
                style={styles.footerBtn}
              >
                <Text style={[styles.footerBtnText, { color: textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`${testID}-apply`}
                accessibilityState={{ disabled: noneChecked }}
                disabled={noneChecked}
                onPress={apply}
                style={[
                  styles.footerBtn,
                  styles.applyBtn,
                  { backgroundColor: accent, opacity: noneChecked ? 0.4 : 1 },
                ]}
              >
                <Text style={[styles.footerBtnText, { color: '#FFFFFF' }]}>
                  {allChecked ? 'Show all projects' : `Apply (${draft.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 220,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  masterRow: {
    borderWidth: 1,
    marginBottom: 6,
  },
  rowTexts: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 1,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  footerBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  applyBtn: {
    minWidth: 130,
    alignItems: 'center',
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
