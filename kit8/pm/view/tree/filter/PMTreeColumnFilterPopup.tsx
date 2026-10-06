// PMTreeColumnFilterPopup - "Filter & sort" card of ONE task tree column (D365 / Excel style):
//
//   ┌ Task name ▾ ─────────────── ✕ ┐   opened by the ▾ / funnel at the right of the header, or by
//   │ ↑ Sort A to Z              ✓  │   header right-click (touch: long-press) -> "Filter & sort"
//   │ ↓ Sort Z to A                 │
//   │ ───────────────────────────── │   sort = applied at once (press the active one again = tree order)
//   │ Task name        begins with ⌄│   filterVariantForColumn = SelectItemFromListApp (link trigger)
//   │ [ value                     ] │   TextInputApp; Between = two inputs (A and B); Boolean = Yes / No
//   │ 12 matching rows              │   live preview (other column filters included)
//   │ [ Clear ]          [ Apply ]  │   web: Enter = Apply, Esc = close
//   └───────────────────────────────┘
//
// Commands: crud.setTreeColumnFilter / setTreeColumnSort / closeTreeColumnFilter (crud/project/useProjectTreeFilters.ts).
// Mount once per screen (dashboard), like PMTreeHeaderMenu.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../components/common/IconApp';
import TextInputApp from '../../../../components/common/TextInputApp';
import SelectItemFromListApp, { SelectItemFromListItem } from '../../../../components/common/SelectItemFromListApp';
import { usePMStore } from '../../../store/store_pm';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { treeColumnTitle } from '../columns/treeColumns';
import {
  compileTreeColumnFilter,
  defaultFilterVariant,
  filterAndSortTreeRows,
  filterInputPlaceholder,
  filterVariantDescription,
  filterVariantInputs,
  filterVariantLabel,
  filterVariantsForColumn,
  PMFilterVariantForColumn,
  PMSortDirection,
  PMTreeColumnDataType,
  PMTreeColumnFilter,
  sortLabels,
  treeColumnCanBeEmpty,
  treeColumnDataType,
} from './treeColumnFilter';
import { pmT } from '../../../i18n/pmT';

export const PM_TREE_FILTER_POPUP_WIDTH = 300;
const EST_HEIGHT = 380;

const TYPE_ICON: Record<PMTreeColumnDataType, string> = { text: 'text_fields', number: 'pin', date: 'calendar_today', boolean: 'check_box' };

/** Syntax lines of "Matches" (old AX / D365 filtering). */
const MATCHES_HELP: { code: string; text: string; types?: PMTreeColumnDataType[] }[] = [
  { code: 'A*', text: 'begins with A (* = any, ? = one character)', types: ['text'] },
  { code: '!value', text: 'not this value' },
  { code: '10..20', text: 'from 10 to 20 · ..20 up to · 10.. from' },
  { code: '>5  <5', text: 'greater / less than' },
  { code: 'a, b, !c', text: '(a or b) and not c' },
  { code: '""  !""', text: 'empty / not empty' },
  { code: 't  (day(-1))', text: 'today · yesterday', types: ['date'] },
];

export default function PMTreeColumnFilterPopup({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();
  const popup = usePMStore((s) => s.treeColumnFilterPopup);
  const customColumns = usePMStore((s) => s.customColumns);
  const filters = usePMStore((s) => s.treeColumnsFilters);
  const sort = usePMStore((s) => s.treeColumnSort);
  const iconColor = usePMStore((s) => s.columnFilterIconColor);
  const tasksById = usePMStore((s) => s.tasksById);
  const schedule = usePMStore((s) => s.schedule);
  const tree = usePMStore((s) => s.tree);

  const key = popup?.key ?? null;
  const type = key ? treeColumnDataType(key, customColumns) : null;
  const saved = key ? filters[key] : undefined;

  const [variant, setVariant] = useState<PMFilterVariantForColumn>('beginsWith');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  // fresh draft whenever the popup opens on a column
  useEffect(() => {
    if (!popup || !type) return;
    setVariant(saved?.filterVariantForColumn ?? defaultFilterVariant(type));
    setValue(saved?.value ?? '');
    setValue2(saved?.value2 ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, type]);

  const inputs = filterVariantInputs(variant);
  const draft: PMTreeColumnFilter = useMemo(() => {
    const f: PMTreeColumnFilter = { filterVariantForColumn: variant };
    if (inputs >= 1) f.value = value;
    if (inputs === 2) f.value2 = value2;
    return f;
  }, [variant, value, value2, inputs]);
  const compiled = useMemo(() => (type ? compileTreeColumnFilter(draft, type) : null), [draft, type]);

  /** live preview: rows matching this draft + the other column filters */
  const preview = useMemo(() => {
    if (!key || !type || !compiled || 'error' in compiled) return null;
    const others = { ...filters, [key]: draft };
    return filterAndSortTreeRows(tree, {}, { tasksById, schedule, tree, customColumns }, others, null).matchCount;
  }, [key, type, compiled, filters, draft, tree, tasksById, schedule, customColumns]);

  const close = () => crud.closeTreeColumnFilter();
  const apply = () => {
    if (!key || !compiled) return;
    if ('error' in compiled) {
      setError(compiled.error);
      return;
    }
    crud.setTreeColumnFilter(key, draft);
    close();
  };
  const clear = () => {
    if (!key) return;
    crud.setTreeColumnFilter(key, null);
    close();
  };
  const sortBy = (direction: PMSortDirection) => {
    if (!key) return;
    const same = sort?.key === key && sort.direction === direction;
    crud.setTreeColumnSort(same ? null : { key, direction });
    close();
  };

  // web: Enter = Apply, Esc = close (not while the variant list is open - it handles its own keys)
  const keysRef = useRef({ apply, close, listOpen });
  keysRef.current = { apply, close, listOpen };
  useEffect(() => {
    if (!popup || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (keysRef.current.listOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        keysRef.current.close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        keysRef.current.apply();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup]);

  if (!popup || !key || !type) return null;

  const title = treeColumnTitle(key, customColumns);
  const labels = sortLabels(type);
  const items: SelectItemFromListItem<PMFilterVariantForColumn>[] = filterVariantsForColumn(type, treeColumnCanBeEmpty(key)).map((v) => ({
    value: v,
    label: filterVariantLabel(v, type),
    description: filterVariantDescription(v, type),
  }));
  const width = Math.min(PM_TREE_FILTER_POPUP_WIDTH, win.width - 16);
  const left = Math.max(8, Math.min(popup.x, win.width - width - 8));
  const top = Math.max(8, Math.min(popup.y, win.height - EST_HEIGHT - 8));
  const filtered = !!saved;
  const onEdit = (fn: (t: string) => void) => (t: string) => {
    fn(t);
    setError(null);
  };
  const inputProps = (testID: string, v: string, set: (t: string) => void, autoFocus: boolean) => ({
    testID,
    value: v,
    onChangeText: onEdit(set),
    placeholder: filterInputPlaceholder(type, variant),
    autoFocus: autoFocus && Platform.OS === 'web',
    onSubmitEditing: apply,
    style: { marginBottom: 0 },
    error: !!error,
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Pressable testID="pm-tree-filter-backdrop" style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={pmT('Close')} />
      <View
        testID="pm-tree-filter-popup"
        accessibilityRole={'dialog' as any}
        accessibilityLabel={`Filter and sort ${title}`}
        style={[styles.card, { left, top, width, maxHeight: win.height - 16, backgroundColor: c.surface, borderColor: c.border }]}
      >
        {/* ---- header: the column (like the highlighted header of the grid) ---- */}
        <View style={[styles.head, { backgroundColor: c.primary }]}>
          <IconApp testID="pm-tree-filter-type-icon" name={TYPE_ICON[type]} size={16} color="#ffffff" />
          <Text testID="pm-tree-filter-title" numberOfLines={1} style={styles.headText}>
            {title}
          </Text>
          {filtered && <IconApp testID="pm-tree-filter-active-icon" name="filter_alt" size={16} color={iconColor} />}
          <Pressable testID="pm-tree-filter-close" accessibilityLabel={pmT('Close')} onPress={close} hitSlop={8} style={styles.headClose}>
            <IconApp testID="pm-tree-filter-close-icon" name="close" size={18} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {/* ---- sort ---- */}
          {(['asc', 'desc'] as const).map((dir) => {
            const on = sort?.key === key && sort.direction === dir;
            return (
              <Pressable
                key={dir}
                testID={`pm-tree-filter-sort-${dir}`}
                accessibilityRole="menuitem"
                accessibilityState={{ checked: on }}
                accessibilityLabel={on ? `${labels[dir]} (active, press to clear)` : labels[dir]}
                onPress={() => sortBy(dir)}
                style={({ hovered, pressed }: any) => [styles.sortRow, { backgroundColor: on ? `${c.primary}1c` : hovered || pressed ? `${c.primary}10` : 'transparent' }]}
              >
                <View style={[styles.sortIcon, on ? { backgroundColor: c.primary } : null]}>
                  <IconApp testID={`pm-tree-filter-sort-${dir}-icon`} name={dir === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={16} color={on ? '#ffffff' : c.text} />
                </View>
                <Text style={[styles.sortText, { color: c.text, fontWeight: on ? '700' : '600' }]}>{labels[dir]}</Text>
                {on && <IconApp testID={`pm-tree-filter-sort-${dir}-checked`} name="check" size={16} color={c.primary} />}
              </Pressable>
            );
          })}

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* ---- filter: column + filterVariantForColumn ---- */}
          <View style={styles.variantRow}>
            <Text numberOfLines={1} style={[styles.fieldLabel, { color: c.text }]}>
              {title}
            </Text>
            <SelectItemFromListApp
              testID="pm-tree-filter-variant"
              trigger="link"
              align="right"
              listWidth={240}
              items={items}
              value={variant}
              onSelect={(v) => {
                setVariant(v);
                setError(null);
              }}
              onOpenChange={setListOpen}
            />
          </View>

          {type === 'boolean' && inputs === 1 ? (
            <View style={styles.boolRow} testID="pm-tree-filter-bool">
              {(['yes', 'no'] as const).map((b) => {
                const on = value.trim().toLowerCase() === b;
                return (
                  <Pressable
                    key={b}
                    testID={`pm-tree-filter-bool-${b}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => onEdit(setValue)(b)}
                    style={[styles.boolChip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? `${c.primary}1c` : c.background }]}
                  >
                    <IconApp testID={`pm-tree-filter-bool-${b}-icon`} name={b === 'yes' ? 'check_box' : 'check_box_outline_blank'} size={16} color={on ? c.primary : c.text} />
                    <Text style={{ color: on ? c.primary : c.text, fontWeight: '600', marginLeft: 6 }}>{b === 'yes' ? 'Yes' : 'No'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : inputs >= 1 ? (
            <View>
              <TextInputApp {...inputProps('pm-tree-filter-value', value, setValue, true)} />
              {inputs === 2 && (
                <>
                  <Text style={[styles.and, { color: c.text }]}>{pmT('and')}</Text>
                  <TextInputApp {...inputProps('pm-tree-filter-value2', value2, setValue2, false)} />
                </>
              )}
            </View>
          ) : null}

          {variant === 'isOneOf' && <Text style={[styles.hint, { color: c.text }]}>{pmT('Separate the values with commas.')}</Text>}
          {variant === 'matches' && (
            <View testID="pm-tree-filter-matches-help" style={[styles.help, { borderColor: c.border }]}>
              {MATCHES_HELP.filter((h) => !h.types || h.types.includes(type)).map((h) => (
                <Text key={h.code} style={[styles.helpLine, { color: c.text }]} numberOfLines={1}>
                  <Text style={styles.code}>{h.code}</Text>  {h.text}
                </Text>
              ))}
            </View>
          )}

          {!!error && (
            <Text testID="pm-tree-filter-error" style={[styles.error, { color: c.error }]}>
              {error}
            </Text>
          )}
          {!error && preview !== null && (
            <Text testID="pm-tree-filter-preview" style={[styles.hint, { color: c.text }]}>
              {preview === 0 ? 'No matching rows' : `${preview} matching row${preview === 1 ? '' : 's'}`}
            </Text>
          )}

          <View style={styles.actions}>
            <PMDialogButton testID="pm-tree-filter-clear" kind="secondary" title={pmT('Clear')} icon="filter_alt_off" color={c.text} disabled={!filtered} onPress={clear} style={{ flex: 1 }} />
            <View style={{ width: 10 }} />
            <PMDialogButton testID="pm-tree-filter-apply" kind="primary" title={pmT('Apply')} icon="filter_alt" onPress={apply} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', height: 40, paddingLeft: 12, paddingRight: 6 },
  headText: { flex: 1, color: '#ffffff', fontSize: 14, fontWeight: '700', marginLeft: 8, marginRight: 6 },
  headClose: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  body: { padding: 10, paddingTop: 6 },
  sortRow: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 8, paddingHorizontal: 6 },
  sortIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  sortText: { flex: 1, fontSize: 14, marginLeft: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  variantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fieldLabel: { flex: 1, fontSize: 13, opacity: 0.7, marginRight: 8 },
  and: { fontSize: 12, opacity: 0.6, marginVertical: 6, marginLeft: 2 },
  boolRow: { flexDirection: 'row' },
  boolChip: { flexDirection: 'row', alignItems: 'center', height: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  hint: { fontSize: 12, opacity: 0.65, marginTop: 8 },
  help: { marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 8 },
  helpLine: { fontSize: 11, opacity: 0.8, lineHeight: 17 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700' },
  error: { fontSize: 12, marginTop: 8 },
  actions: { flexDirection: 'row', marginTop: 14 },
});
