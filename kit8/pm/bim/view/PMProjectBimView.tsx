// PMProjectBimView - the BIM view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showBimView'; the task tree stays on the left).
//   toolbar   BIM · Fit · Dim the rest · Zoom to selection · − [± %] Zoom + level · the state of the loading
//             − / + = 25 % smaller / bigger; the field takes a change in percent (50 = 1.5x bigger, -50 = half; Enter or Zoom applies); the level shows 100 % = the whole model fits
//   3D        the model of the last import (chunks per storey), a press on an element scrolls the tree to its task or stage
//   under it  the element that was pressed: name, class, type, and its IFC properties (read from the cloud when asked: bim_property_table)
//   right click (web) / long press (phone) on an element = a menu: Share (picture + details text) · Go to component (the screen of ONE component, ../component); the same two items are in the Task menu of a task with ONE component
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BIM_ZOOM_STEP_PERCENT, parseZoomPercent } from './bimCamera';
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
import PMContextMenu from '../../inner/menu/PMContextMenu';
import { makeBimViewRegistration, useBimViewRegistry } from '../component/bimComponentRegistry';
import { propertyLines } from '../component/bimComponentModel';
import { useBimComponentActions } from '../component/useBimComponentActions';
import { shareScreenshotResultText } from '../../../lib/shareScreenshot';

export { propertyLines };

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
  // zoom: the buttons + / - and the percent field send a command (nonce + percent) to the viewer, the viewer tells the level back (100 = the whole model fits)
  const [zoomCmd, setZoomCmd] = useState({ nonce: 0, percent: 0 });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomText, setZoomText] = useState('');
  const [zoomBad, setZoomBad] = useState(false);
  const zoomByStep = (percent: number) => setZoomCmd((c) => ({ nonce: c.nonce + 1, percent: percent > 0 ? percent : (1 / (1 + BIM_ZOOM_STEP_PERCENT / 100) - 1) * 100 }));
  const applyZoomText = () => {
    const p = parseZoomPercent(zoomText);
    setZoomBad(p === null);
    if (p === null || p === 0) return;
    setZoomCmd((c) => ({ nonce: c.nonce + 1, percent: p }));
    setZoomText('');
  };
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
  const { goTo, share } = useBimComponentActions();
  const [menu, setMenu] = useState<{ x: number; y: number; ifcGuid: string } | null>(null);
  const [shareNote, setShareNote] = useState('');
  // Share: for the moment of the picture the component alone is lit (and the rest dimmed), whatever the selection is
  const [captureGuid, setCaptureGuid] = useState<string | null>(null);
  const captureRef = useRef<((box: number[] | null) => string | null) | null>(null);
  const highlightedNow = useMemo(() => (captureGuid ? new Set([captureGuid]) : bridge.highlighted), [captureGuid, bridge.highlighted]);

  const onElementPress = useCallback(
    (g: string) => {
      setPressed(g);
      bridge.onElementPress(g);
    },
    [bridge]
  );

  // the menus of the task (PMTaskRowMenu) find the components and the picture of this view through the registry
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  useEffect(() => {
    if (!manifest) return;
    const modelGUID = manifest.model.modelGUID;
    const view = makeBimViewRegistration({
      projectGUID,
      modelGUID,
      elements,
      storeys: manifest.storeys,
      properties: (g) => cloudRef.current.property(modelGUID, g).catch(() => null),
      capture: async (g) => {
        const el = elements.find((e) => e.ifcGuid === g);
        if (!el) return null;
        setCaptureGuid(g);
        await new Promise((r) => setTimeout(r, 80)); // the lit state reaches the canvas
        try {
          return captureRef.current ? captureRef.current(el.bbox) : null;
        } finally {
          setCaptureGuid(null);
        }
      },
    });
    useBimViewRegistry.getState().set(view);
    return () => {
      if (useBimViewRegistry.getState().view === view) useBimViewRegistry.getState().set(null);
    };
  }, [projectGUID, manifest, elements]);

  // right click / long press on an element: select it like a press, then the menu
  const onElementContextMenu = useCallback(
    (g: string | null, x: number, y: number) => {
      if (!g) return;
      setPressed(g);
      bridge.onElementPress(g);
      setMenu({ x, y, ifcGuid: g });
    },
    [bridge]
  );
  const menuElement = menu ? bridge.elementOf(menu.ifcGuid) : undefined;

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: TOOLBAR_H, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }} contentContainerStyle={styles.toolbar}>
        <Text style={{ color: palette.text, fontWeight: '700', marginRight: 8 }}>{pmT('BIM')}</Text>
        <Chip testID="pm-bim-fit" label={pmT('Fit')} onPress={() => setFitNonce((n) => n + 1)} palette={palette} />
        <Chip testID="pm-bim-dim" label={pmT('Dim the rest')} on={dimRest} onPress={() => setDimRest((v) => !v)} palette={palette} />
        <Chip testID="pm-bim-zoom" label={pmT('Zoom to selection')} on={zoomToSelection} onPress={() => setZoomToSelection((v) => !v)} palette={palette} />
        <Chip testID="pm-bim-zoom-out" label="−" onPress={() => zoomByStep(-BIM_ZOOM_STEP_PERCENT)} palette={palette} />
        <TextInput
          testID="pm-bim-zoom-input"
          accessibilityLabel={pmT('Zoom change in percent: + bigger, - smaller')}
          value={zoomText}
          onChangeText={setZoomText}
          onSubmitEditing={applyZoomText}
          onBlur={() => !zoomText.trim() && setZoomBad(false)}
          placeholder="± %"
          placeholderTextColor={palette.textMuted}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          style={[styles.zoomInput, { color: palette.text, borderColor: zoomBad ? '#dc2626' : palette.border }]}
        />
        <Chip testID="pm-bim-zoom-apply" label={pmT('Zoom')} onPress={applyZoomText} palette={palette} />
        <Chip testID="pm-bim-zoom-in" label="+" onPress={() => zoomByStep(BIM_ZOOM_STEP_PERCENT)} palette={palette} />
        <Text testID="pm-bim-zoom-level" style={{ color: palette.textMuted, fontSize: 12 }}>{`${zoomLevel}%`}</Text>
        <Text testID="pm-bim-status" style={{ color: palette.textMuted, fontSize: 12, marginLeft: 8 }}>{status}</Text>
      </ScrollView>
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
            highlighted={highlightedNow}
            dimRest={dimRest || !!captureGuid}
            captureRef={captureRef}
            onElementContextMenu={onElementContextMenu}
            colors={colors}
            background={palette.background}
            zoomBox={bridge.zoomBox}
            zoomNonce={bridge.zoomNonce}
            fitNonce={fitNonce}
            zoomPercentNonce={zoomCmd.nonce}
            zoomPercent={zoomCmd.percent}
            onZoomLevel={setZoomLevel}
            onElementPress={onElementPress}
            onEmptyPress={() => {
              setPressed(null);
              bridge.onEmptyPress();
            }}
          />
          {pressed ? (
            <View testID="pm-bim-panel" style={[styles.panel, { height: PANEL_H, borderTopColor: palette.border, backgroundColor: palette.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: palette.text, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{el?.name || pressed}</Text>
                {el ? <Chip testID="pm-bim-open-component" label={pmT('Go to component')} onPress={() => goTo(projectGUID, el)} palette={palette} /> : null}
              </View>
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
      {menu && menuElement ? (
        <PMContextMenu
          testID="pm-bim-menu"
          x={menu.x}
          y={menu.y}
          caption={menuElement.name || menuElement.ifcGuid}
          onClose={() => setMenu(null)}
          items={[
            {
              testID: 'pm-bim-menu-share',
              label: 'Share (image + details)',
              icon: 'share',
              onPress: () => {
                setMenu(null);
                // (read when pressed: this view only WRITES the registry, it never re-renders because of it)
                const registration = useBimViewRegistry.getState().view;
                if (registration) void share(registration, menuElement).then((r) => setShareNote(pmT(shareScreenshotResultText(r, false))));
              },
            },
            { testID: 'pm-bim-menu-goto', label: 'Go to component', icon: 'open_in_new', onPress: () => { setMenu(null); goTo(projectGUID, menuElement); } },
          ]}
        />
      ) : null}
      {shareNote ? <Text testID="pm-bim-share-note" onPress={() => setShareNote('')} style={{ position: 'absolute', left: 8, bottom: 8, color: palette.textMuted, fontSize: 12, backgroundColor: palette.surface, padding: 4, borderRadius: 6 }}>{shareNote}</Text> : null}
    </View>
  );
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
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6, minHeight: TOOLBAR_H },
  zoomInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 2, minHeight: 28, width: 64, fontSize: 12, textAlign: 'center' },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, minHeight: 28, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  panel: { padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
