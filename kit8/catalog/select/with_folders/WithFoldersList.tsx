// WithFoldersList - the List view: every item once, flat, in cards (title + a line of details; the chosen one has the ACTIVE badge and a check) - the look of
// SelectElementFromCatalog. The details line = the folder path unless the caller gives `subtitleOf`.
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { folderPathText, rowMatches } from './withFoldersModel';
import type { WithFoldersViewProps } from './withFoldersViewTypes';

export default function WithFoldersList({ rows, isFolder, titleOf, subtitleOf, columns, value, query, onPick, testID }: WithFoldersViewProps) {
  const { themeColors: c } = useDesignSystem();
  const subtitle = (r: (typeof rows)[number]) => (subtitleOf ? subtitleOf(r) : folderPathText(rows, r.rowParentGUID, titleOf));
  const items = useMemo(() => rows.filter((r) => !isFolder(r) && (rowMatches(r, columns, query) || (!!query.trim() && (subtitle(r) ?? '').toLowerCase().includes(query.trim().toLowerCase())))), [rows, isFolder, columns, query]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FlatList
      testID={testID}
      data={items}
      keyExtractor={(r) => r.rowGUID}
      initialNumToRender={40}
      style={{ flex: 1 }}
      ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', padding: 16 }}>{query.trim() ? 'No matches found.' : 'Nothing to choose.'}</Text>}
      renderItem={({ item: r }) => {
        const chosen = r.rowGUID === value;
        const sub = subtitle(r);
        return (
          <Pressable
            testID={`${testID}-item-${r.rowGUID}`}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            onPress={() => onPick(r)}
            style={[styles.card, { borderColor: chosen ? c.primary : `${c.border}66`, borderWidth: chosen ? 2 : 1, backgroundColor: chosen ? `${c.primary}15` : 'transparent' }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={{ color: chosen ? c.primary : c.text, fontWeight: chosen ? '700' : '500', fontSize: 15, flexShrink: 1 }}>{titleOf(r)}</Text>
                {chosen && <View style={[styles.badge, { backgroundColor: `${c.primary}25` }]}><Text style={{ color: c.primary, fontSize: 10, fontWeight: '800' }}>ACTIVE</Text></View>}
              </View>
              {!!sub && <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>}
            </View>
            {chosen && <IconApp name="check_circle" size={18} color={c.primary} />}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
});
