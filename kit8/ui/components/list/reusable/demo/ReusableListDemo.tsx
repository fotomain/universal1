// ReusableList demo (route /demo/list/reusable): the media posts of the signed-in user in BOTH data modes, or generated rows for the big-list test.
//   Data mode   clientDataMode (all rows in memory) | serverDataMode (pages from the database, search / sort / filter in the database)
//   Source      Media posts (needs a sign in) | Generated rows 1 000 / 10 000 / 100 000 / 500 000 (clientDataMode only: a list held by the screen, nothing is saved)
//   Try         hold the ⠿ grip of an item and drag it (the list scrolls by itself at its edges) · search · Sort and filter · long press / ⋮ menu · select
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../../providers/WithDesignSystem';
import { mediaPostOwnerGUID } from '../../../../../redux/mediaPostOwner';
import type { ReusableTableRow } from '../../../table/reusable/reusableTableTypes';
import ReusableList from '../ReusableList';
import type { ReusableListDataMode } from '../reusableListTypes';
import { generateDemoRows, MEDIA_POST_LIST_COLUMNS, MEDIA_POSTS_ENTITY } from './demoData';

const SIZES = [1_000, 10_000, 100_000, 500_000];
const fmt = (n: number) => n.toLocaleString('en-US');

function Chip({ label, active, onPress, testID, color }: { label: string; active: boolean; onPress: () => void; testID: string; color: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}
      style={[styles.chip, { borderColor: color, backgroundColor: active ? color : 'transparent' }]}>
      <Text style={{ color: active ? '#fff' : color, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function ReusableListDemo() {
  const { themeColors: c } = useDesignSystem();
  const ownerGUID = useSelector(mediaPostOwnerGUID);
  const [mode, setMode] = useState<ReusableListDataMode>('clientDataMode');
  const [source, setSource] = useState<'mediaPosts' | 'generated'>('mediaPosts');
  const [size, setSize] = useState(10_000);
  const generated = source === 'generated';
  // generated rows live in the screen (local rows mode of the table's data layer); a change of the user comes back through onLocalRowsChange
  const [localRows, setLocalRows] = useState<ReusableTableRow[]>(() => generateDemoRows(10_000));
  const pickSize = useCallback((n: number) => { setSize(n); setLocalRows(generateDemoRows(n)); }, []);
  const effectiveMode: ReusableListDataMode = generated ? 'clientDataMode' : mode;
  const hint = useMemo(() => {
    if (generated) return `${fmt(localRows.length)} generated rows in memory (clientDataMode). Nothing is saved.`;
    if (!ownerGUID) return 'Sign in to see your media posts, or pick "Generated rows".';
    return effectiveMode === 'serverDataMode' ? 'Server data mode: 50 posts per page, the next page loads at the end of the list; search / sort / filter run in the database.' : 'Client data mode: all your media posts are read once; search / sort / filter run on this device.';
  }, [generated, localRows.length, ownerGUID, effectiveMode]);

  return (
    <View testID="reusable-list-demo" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.panel, { borderBottomColor: c.border }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: c.text }]}>Data mode</Text>
          <Chip testID="demo-mode-client" label="clientDataMode" active={effectiveMode === 'clientDataMode'} onPress={() => setMode('clientDataMode')} color={c.primary} />
          <Chip testID="demo-mode-server" label="serverDataMode" active={effectiveMode === 'serverDataMode'} onPress={() => { setSource('mediaPosts'); setMode('serverDataMode'); }} color={c.primary} />
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: c.text }]}>Rows</Text>
          <Chip testID="demo-source-media" label="Media posts" active={!generated} onPress={() => setSource('mediaPosts')} color={c.primary} />
          <Chip testID="demo-source-generated" label="Generated rows" active={generated} onPress={() => setSource('generated')} color={c.primary} />
          {generated ? SIZES.map((n) => <Chip key={n} testID={`demo-size-${n}`} label={fmt(n)} active={size === n} onPress={() => pickSize(n)} color={c.primary} />) : null}
        </View>
        <Text testID="demo-hint" style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{hint} Hold ⠿ and drag an item to reorder.</Text>
      </View>
      <View style={styles.list}>
        {/* a new key starts a fresh list when the data mode or the source changes */}
        {generated ? (
          <ReusableList
            key={`generated-${size}`}
            testID="demo-list" entityName="reusableListDemoRows" itemLabel="Post" crudListTitle="Generated posts" visualColumns={MEDIA_POST_LIST_COLUMNS}
            reusableListDataMode="clientDataMode" localRows={localRows} onLocalRowsChange={setLocalRows} orderDirection="asc" itemHeight={72}
          />
        ) : (
          <ReusableList
            key={`media-${effectiveMode}`}
            testID="demo-list" entityName={MEDIA_POSTS_ENTITY} itemLabel="Post" crudListTitle="Media posts" visualColumns={MEDIA_POST_LIST_COLUMNS}
            reusableListDataMode={effectiveMode} serverPageSize={50} orderDirection="desc" itemHeight={72}
            listOwnerGUID={ownerGUID || undefined} listParentGUID="empty" readParams={{ paginationSize: 5000, originationCurrentPage: 0 }}
            emptyText={ownerGUID ? 'No media posts yet. Record one, or press +.' : 'Sign in to see your media posts.'}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { padding: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  label: { fontWeight: '700', width: 74, fontSize: 13 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  list: { flex: 1, minHeight: 0 },
});
