// BimExampleDemo - BIM example 1 (Structure Walls) or example 2 (Duplex Apartment) WITHOUT a database: the converted chunks + the WBS of kit8/pm/bim/examples/example<N>/example<N>.demo.json (made by py/bim/server/make_demo_bundle.py).
// Route /pm/bim/example (example 1) or /pm/bim/example?example=2; two buttons above the list switch between them. The task list stands at the left (stages and tasks), the 3D view at the right: a press on a list row lights its walls, a press on a wall selects its row - the same
// two-way highlight as the BIM view of a project, with the same viewer (BimViewer) and the same bridge functions, but nothing is read from or written to Supabase.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { parseBimc } from '../bimc/bimcReader';
import { base64ToArrayBuffer } from '../bimc/base64';
import BimViewer from './BimViewer';
import { DEFAULT_STATE_COLORS } from './bimSceneBuilder';
import { elementsByTask, highlightedFor } from './useBimTaskBridge';
import { unionBoxes } from './bimCamera';
import { propertyLines } from './PMProjectBimView';
import { createBimLocalDb } from '../local/bimLocalDb';
import type { BimManifest } from '../model/bimModel';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DEMOS: Record<number, any> = { 1: require('../examples/example1/example1.demo.json'), 2: require('../examples/example2/example2.demo.json') };
const EXAMPLE_TITLES: Record<number, string> = { 1: 'Structure Walls', 2: 'Duplex Apartment' };

export default function BimExampleDemo() {
  const params = useLocalSearchParams<{ example?: string }>();
  const fromRoute = Number(Array.isArray(params.example) ? params.example[0] : params.example) === 2 ? 2 : 1;
  const [n, setN] = useState<number>(fromRoute);
  return <BimExampleView key={n} n={n} onSwitch={setN} />;
}

function BimExampleView({ n, onSwitch }: { n: number; onSwitch: (n: number) => void }) {
  const DEMO = DEMOS[n];
  const win = useWindowDimensions();
  const wide = win.width >= 760;
  const listW = wide ? 300 : win.width;
  const viewW = wide ? win.width - listW : win.width;
  const viewH = wide ? win.height - 56 : Math.round((win.height - 56) * 0.55);
  const [selected, setSelected] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const chunks = useMemo(() => DEMO.chunks.map((c: any) => ({ hash: c.hash, chunk: parseBimc(base64ToArrayBuffer(c.base64)) })), []);
  const byTask = useMemo(() => elementsByTask(DEMO.elements.map((e: any) => ({ ...e, storeyGUID: e.storeyIfcGuid }))), []);
  const tasksById = useMemo(() => Object.fromEntries(DEMO.tasks.map((t: any) => [t.guid, { treePath: t.path }])), []);
  const highlighted = useMemo(() => (selected ? highlightedFor([selected], tasksById, byTask) : new Set<string>()), [selected, tasksById, byTask]);
  const byGuid = useMemo(() => new Map<string, any>(DEMO.elements.map((e: any) => [e.ifcGuid, e])), []);
  const zoomBox = useMemo(() => (highlighted.size ? unionBoxes([...highlighted].map((g) => byGuid.get(g)?.bbox)) : null), [highlighted, byGuid]);
  const [zoomNonce, setZoomNonce] = useState(0);
  // the local database of this device / browser (kit8bimdb_<organization>): the example is saved there and read back, so the platform's SQLite can be seen working
  const [localInfo, setLocalInfo] = useState('');
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const db = await createBimLocalDb('demo');
        const before = await db.cachedModel(`example${n}`);
        const manifest: BimManifest = { model: { modelGUID: `demo-example${n}`, revision: before ? before.revision + 1 : 1, sourceName: DEMO.model.sourceName, originShift: DEMO.model.originShift, bbox: DEMO.model.bbox, counts: DEMO.model.counts }, storeys: [], chunks: [] };
        const rows = DEMO.elements.map((e: any) => ({ ...e, storeyGUID: e.storeyIfcGuid }));
        await db.saveModel(`example${n}`, manifest, rows);
        const back = await db.loadElements(`demo-example${n}`);
        const of = await db.elementsOfTasks(`demo-example${n}`, [rows[0].taskGUID]);
        if (!off) setLocalInfo(`local database: ${db.kind} · ${before ? `cached before (revision ${before.revision} -> ${manifest.model.revision})` : 'first run'} · ${back.length} elements read back · ${of.length} for the first task`);
      } catch (e) {
        if (!off) setLocalInfo(`local database failed: ${(e as Error).message}`);
      }
    })();
    return () => {
      off = true;
    };
  }, [n, DEMO]);
  // a press on a wall scrolls the list to its row (in a project the tree does it: requestFocus)
  const listRef = useRef<ScrollView>(null);
  const rowY = useRef<Record<string, number>>({});
  useEffect(() => {
    if (selected && rowY.current[selected] != null) listRef.current?.scrollTo({ y: Math.max(0, rowY.current[selected] - 60), animated: true });
  }, [selected]);
  const el = pressed ? byGuid.get(pressed) : null;
  const rows = useMemo(() => [...DEMO.tasks].sort((a: any, b: any) => a.path.localeCompare(b.path)), []);

  const select = (g: string | null, zoom = true) => {
    setSelected(g);
    if (zoom) setZoomNonce((n) => n + 1);
  };

  return (
    <View testID="bim-example" style={[styles.page, { flexDirection: wide ? 'row' : 'column' }]}>
      <ScrollView ref={listRef} testID="bim-example-list" style={{ width: listW, maxHeight: wide ? undefined : win.height - 56 - viewH }} contentContainerStyle={{ padding: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          {[1, 2].map((k) => (
            <Pressable key={k} testID={`bim-example-switch-${k}`} onPress={() => onSwitch(k)} style={[styles.switch, { backgroundColor: n === k ? '#ffe2b8' : '#eee' }]}>
              <Text style={{ fontSize: 12, color: '#222' }}>Example {k}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.title}>BIM example {n} - {EXAMPLE_TITLES[n]}</Text>
        <Text style={styles.sub}>{DEMO.model.counts.elements} {n === 1 ? 'walls' : 'elements'} · {DEMO.model.counts.stages} stages · {DEMO.model.counts.tasks} tasks · unit scale {DEMO.model.unitScale}</Text>
        <Text testID="bim-example-local" style={styles.sub}>{localInfo}</Text>
        {rows.map((t: any) => (
          <Pressable key={t.guid} testID={`bim-example-row-${t.kind}`} onLayout={(e) => { rowY.current[t.guid] = e.nativeEvent.layout.y; }} onPress={() => select(selected === t.guid ? null : t.guid)} style={[styles.row, { paddingLeft: t.kind === 'task' ? 22 : 6, backgroundColor: selected === t.guid ? '#ffe2b8' : 'transparent' }]}>
            <Text style={{ fontWeight: t.kind === 'stage' ? '700' : '400', color: '#222' }}>{t.text}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ width: viewW }}>
        <BimViewer
          testID="bim-example-viewer"
          width={viewW}
          height={viewH}
          chunks={chunks}
          modelBox={DEMO.model.bbox}
          highlighted={highlighted}
          dimRest
          colors={DEFAULT_STATE_COLORS}
          background="#f4f5f7"
          zoomBox={zoomBox}
          zoomNonce={zoomNonce}
          onElementPress={(g) => {
            setPressed(g);
            const e = byGuid.get(g);
            if (e?.taskGUID) select(e.taskGUID, false); // a press on the 3D view does not move the camera
          }}
          onEmptyPress={() => {
            setPressed(null);
            setSelected(null);
          }}
        />
        {el ? (
          <View testID="bim-example-panel" style={styles.panel}>
            <Text style={{ fontWeight: '700' }}>{el.name}</Text>
            <Text style={{ fontSize: 12, color: '#555' }}>{el.ifcClass} · {el.typeName}</Text>
            <ScrollView style={{ maxHeight: 90 }}>
              {propertyLines(DEMO.properties[el.ifcGuid] ?? null).slice(0, 40).map((l, i) => (
                <Text key={i} style={{ fontSize: 11, fontWeight: l.head ? '700' : '400', color: l.head ? '#222' : '#555' }}>{l.text}</Text>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  title: { fontWeight: '700', fontSize: 15, color: '#222' },
  sub: { fontSize: 12, color: '#666', marginBottom: 8 },
  switch: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  row: { paddingVertical: 6, paddingRight: 6, borderRadius: 4 },
  panel: { position: 'absolute', left: 112, bottom: 8, right: 8, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#ddd' },
});
