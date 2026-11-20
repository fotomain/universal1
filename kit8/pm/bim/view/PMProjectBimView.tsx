// PMProjectBimView - the BIM view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showBimView'; the task tree stays on the left).
//   toolbar   BIM · Fit · Dim the rest · Zoom to selection · the state of the loading
//   3D        the model of the last import (chunks per storey), a press on an element scrolls the tree to its task or stage
//   under it  the element that was pressed: name, class, type, and its IFC properties (read from the cloud when asked: bim_property_table)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PMPalette } from '../../view/theme';
import type { PMCrud } from '../../crud/usePMCrud';
import { pmT } from '../../i18n/pmT';
import { usePMStore } from '../../store/store_pm';
import { createBimCloud } from '../cloud/bimCloud';
import { useSupabase } from '../../../providers/WithSupabase';
import BimViewer from './BimViewer';
import { useBimModel } from './useBimModel';
import { useBimTaskBridge } from './useBimTaskBridge';
import { DEFAULT_STATE_COLORS } from './bimSceneBuilder';

export interface PMProjectBimViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud?: PMCrud;
}

const TOOLBAR_H = 40;
const PANEL_H = 150;

export const hexToRgb = (hex: string, fallback: [number, number, number] = DEFAULT_STATE_COLORS.highlight): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function Chip({ label, on, onPress, palette, testID }: { label: string; on?: boolean; onPress: () => void; palette: PMPalette; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[styles.chip, { borderColor: on ? palette.primary : palette.border, backgroundColor: on ? palette.selected : 'transparent' }]}>
      <Text style={{ color: palette.text, fontSize: 12 }}>{on === undefined ? label : `${on ? '✓ ' : ''}${label}`}</Text>
    </Pressable>
  );
}

export default function PMProjectBimView({ projectGUID, width, height, palette }: PMProjectBimViewProps) {
  const [dimRest, setDimRest] = useState(true);
  const [zoomToSelection, setZoomToSelection] = useState(true);
  const [fitNonce, setFitNonce] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const [props, setProps] = useState<{ guid: string; json: Record<string, any> | null } | null>(null);
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const selectedStorey = null as string | null;
  const { model, reload } = useBimModel(projectGUID, selectedStorey);
  const manifest = model.state === 'ready' ? model.manifest : null;
  const elements = model.state === 'ready' ? model.elements : [];
  const bridge = useBimTaskBridge(manifest, elements, zoomToSelection);
  const { supabase } = useSupabase();
  const cloud = useMemo(() => createBimCloud(supabase), [supabase]);
  const colors = useMemo(() => ({ ...DEFAULT_STATE_COLORS, highlight: hexToRgb(palette.primary) }), [palette.primary]);

  const onElementPress = useCallback(
    (g: string) => {
      setPressed(g);
      bridge.onElementPress(g);
    },
    [bridge]
  );

  // the properties of the pressed element, read when it is pressed (not with the model)
  useEffect(() => {
    if (!pressed || !manifest) return setProps(null);
    let off = false;
    cloud.property(manifest.model.modelGUID, pressed).then((j) => !off && setProps({ guid: pressed, json: j })).catch(() => !off && setProps({ guid: pressed, json: null }));
    return () => {
      off = true;
    };
  }, [pressed, manifest, cloud]);
  void selectedGUID;

  const el = pressed ? bridge.elementOf(pressed) : undefined;
  const viewerH = Math.max(80, height - TOOLBAR_H - (pressed ? PANEL_H : 0));
  const status =
    model.state === 'loading' ? model.text : model.state === 'ready' ? (model.chunks.length < model.chunksTotal ? `${pmT('Loading the model')} ${model.chunks.length}/${model.chunksTotal}` : `${model.elements.length} ${pmT('elements')}`) : '';

  return (
    <View testID="pm-bim-view" style={{ width, height, backgroundColor: palette.background }}>
      <View style={[styles.toolbar, { height: TOOLBAR_H, borderBottomColor: palette.border }]}>
        <Text style={{ color: palette.text, fontWeight: '700', marginRight: 8 }}>{pmT('BIM')}</Text>
        <Chip testID="pm-bim-fit" label={pmT('Fit')} onPress={() => setFitNonce((n) => n + 1)} palette={palette} />
        <Chip testID="pm-bim-dim" label={pmT('Dim the rest')} on={dimRest} onPress={() => setDimRest((v) => !v)} palette={palette} />
        <Chip testID="pm-bim-zoom" label={pmT('Zoom to selection')} on={zoomToSelection} onPress={() => setZoomToSelection((v) => !v)} palette={palette} />
        <Text testID="pm-bim-status" style={{ color: palette.textMuted, fontSize: 12, marginLeft: 8 }}>{status}</Text>
      </View>
      {model.state === 'none' ? (
        <Centered palette={palette} text={pmT('This project has no BIM model. Import one: Project settings -> BIM, or Import / Export -> Import BIM (IFC).')} />
      ) : model.state === 'error' ? (
        <Centered palette={palette} text={model.text} action={{ label: pmT('Try again'), onPress: reload }} />
      ) : model.state === 'loading' ? (
        <Centered palette={palette} text={model.text} />
      ) : (
        <>
          <BimViewer
            testID="pm-bim-viewer"
            width={width}
            height={viewerH}
            chunks={model.chunks}
            modelBox={model.manifest.model.bbox}
            highlighted={bridge.highlighted}
            dimRest={dimRest}
            colors={colors}
            background={palette.background}
            zoomBox={bridge.zoomBox}
            zoomNonce={bridge.zoomNonce}
            fitNonce={fitNonce}
            onElementPress={onElementPress}
            onEmptyPress={() => {
              setPressed(null);
              bridge.onEmptyPress();
            }}
          />
          {pressed ? (
            <View testID="pm-bim-panel" style={[styles.panel, { height: PANEL_H, borderTopColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>{el?.name || pressed}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>{[el?.ifcClass, el?.typeName].filter(Boolean).join(' · ')}</Text>
              <ScrollView style={{ marginTop: 4 }}>
                {propertyLines(props?.guid === pressed ? props.json : null).map((l, i) => (
                  <Text key={i} style={{ color: l.head ? palette.text : palette.textMuted, fontSize: 12, fontWeight: l.head ? '700' : '400' }}>{l.text}</Text>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/** the property sets of an element as plain lines: a head line per set, a line per value */
export function propertyLines(json: Record<string, any> | null): Array<{ head: boolean; text: string }> {
  if (!json || !json.sets) return [];
  const out: Array<{ head: boolean; text: string }> = [];
  for (const [set, vals] of Object.entries<any>(json.sets)) {
    out.push({ head: true, text: set });
    for (const [k, v] of Object.entries<any>(vals || {})) out.push({ head: false, text: `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}` });
  }
  return out;
}

function Centered({ palette, text, action }: { palette: PMPalette; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.centered}>
      <Text style={{ color: palette.textMuted, textAlign: 'center', maxWidth: 420 }}>{text}</Text>
      {action ? <Chip label={action.label} onPress={action.onPress} palette={palette} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, minHeight: 28, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  panel: { padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
