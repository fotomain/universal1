// PMNetworkDiagram - activity-on-node network diagram (AON / PDM), left to right.
//
// Two variants (toggle in its own bar, saved per project as uxuiSettings.networkDiagramVariant):
//   cpmNodes     ┌────┬────┬────┐   classic CPM box (PMI): top ES · D · EF, name + WBS,
//                │ ES │ D  │ EF │   bottom LS · TF · LF; critical boxes/links in red
//                ├────┴────┴────┤
//                │ name   (WBS) │
//                ├────┬────┬────┤
//                │ LS │ TF │ LF │
//                └────┴────┴────┘
//   compactNodes flow-chart blocks: name, duration, dates, task color stripe
//
// Links follow the Gantt "Dependency arrows" shape (smooth / square), non-FS types and lags
// are labelled ("SS+2"), links set on a stage are dashed. Hover / selection highlights the
// whole upstream + downstream chain. Editable mode: tap = select (+ CRUD panel), double tap /
// long press = edit, tap a link = dependency menu, tap-to-link works like in the Gantt.
// Read-only mode: selection + info card only.

import React, { memo, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { DAY_MS, PM_BAR_PANEL_WIDTH } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';
import { formatDateShort } from '../project/scheduling';
import { PMPalette, withAlpha } from '../theme';
import { depKey } from '../../model/types';
import { PMCrud } from '../../crud/usePMCrud';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../../inner/toolbars/PMToolbarPrimitives';
import PMGanttZoomButtons from '../gantt/buttons/PMGanttZoomButtons';
import DependencyArrowLineFormSelector from '../task/dependency/DependencyArrowLineFormSelector';
import PMSegmentedIconButtons, { PMSegmentOption } from './PMSegmentedIconButtons';
import PMNetworkCanvas, { useNetworkZoom } from './PMNetworkCanvas';
import PMNetworkInfoCard from './PMNetworkInfoCard';
import PMNetworkLegend, { legendItems } from './PMNetworkLegend';
import PMNetworkNodeActionPanel from './PMNetworkNodeActionPanel';
import { arrowHead, edgePath, endAngle, labelAnchor, PMPt, svgPressProps } from './networkGeometry';
import { layeredLayout, linkLabel, NET_FINISH, NET_START, PMActivityNetwork, PMNetActivity } from './networkModel';
import { PMNetworkInteraction, useNetworkInteraction, useNetworkViewSetters } from './useNetworkView';
import { PMNetworkDiagramVariant } from '../../model/types';
import { pmT } from '../../i18n/pmT';

const IS_WEB = Platform.OS === 'web';

export const PM_NETWORK_DIAGRAM_VARIANTS: PMSegmentOption<PMNetworkDiagramVariant>[] = [
  {
    value: 'cpmNodes',
    icon: 'grid_view',
    label: 'CPM',
    title: 'CPM boxes: ES · D · EF / name / LS · TF · LF',
  },
  {
    value: 'compactNodes',
    icon: 'schema',
    label: 'Compact',
    title: 'Compact blocks: name, duration, dates',
  },
];

const SIZES = {
  cpmNodes: { w: 176, h: 84, gapX: 58, gapY: 24 },
  compactNodes: { w: 158, h: 58, gapX: 50, gapY: 20 },
} as const;
const END_W = 58;
const END_H = 30;
const CELL_H = 22;
const MARGIN = 24;

export default function PMNetworkDiagram({ net, palette, crud, readOnly }: { net: PMActivityNetwork; palette: PMPalette; crud?: PMCrud; readOnly?: boolean }) {
  const variant = usePMStore((s) => s.networkDiagramVariant);
  const form = usePMStore((s) => s.linkLineForm);
  const showCritical = usePMStore((s) => s.showCriticalPath);
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const skipWeekends = usePMStore((s) => !!(s.selectedProjectGUID && s.projectsById[s.selectedProjectGUID]?.rowJSON.skipWeekends));
  const deps = usePMStore((s) => s.deps);
  const setters = useNetworkViewSetters(crud, readOnly);
  const ix = useNetworkInteraction(net, crud, readOnly);

  const size = SIZES[variant];
  const layout = useMemo(() => {
    const nodes = [
      { id: NET_START, w: END_W, h: END_H, rank: -1 },
      ...net.activities.map((a) => ({
        id: a.guid,
        w: size.w,
        h: size.h,
        rank: a.seq,
      })),
      { id: NET_FINISH, w: END_W, h: END_H, rank: Number.MAX_SAFE_INTEGER },
    ];
    return layeredLayout(nodes, net.links, {
      gapX: size.gapX,
      gapY: size.gapY,
      margin: MARGIN,
      dummyH: 12,
    });
  }, [net, size]);

  const customColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of deps) if (d.rowJSON?.dependencyColor) m[depKey(d)] = d.rowJSON.dependencyColor;
    return m;
  }, [deps]);

  const zoomCtl = useNetworkZoom(layout.width, layout.height, `${projectGUID}:${variant}`);
  const z = zoomCtl.zoom;

  const selected = ix.selectedGUID ? net.byGUID[ix.selectedGUID] : undefined;
  const selBox = selected ? layout.nodes[selected.guid] : undefined;

  return (
    <View style={styles.root} testID="pm-net-diagram">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMSegmentedIconButtons
          testID="pm-net-diagram-variant"
          options={PM_NETWORK_DIAGRAM_VARIANTS}
          value={variant}
          onChange={setters.setNetworkDiagramVariant}
          color={palette.text}
          activeColor={palette.primary}
          border={palette.border}
        />
        <PMToolbarDivider color={palette.border} />
        <PMGanttZoomButtons palette={palette} onZoomOut={zoomCtl.zoomOut} onZoomIn={zoomCtl.zoomIn} onFit={zoomCtl.fit} />
        <PMToolbarDivider color={palette.border} />
        <DependencyArrowLineFormSelector color={palette.text} activeColor={palette.primary} border={palette.border} onChange={setters.setLinkLineForm} />
        <PMToolbarSpacer />
        {variant === 'cpmNodes' && <Text style={[styles.key, { color: palette.textMuted }]}>{pmT('ES · D · EF / LS · TF · LF (working days)')}</Text>}
        <PMNetworkLegend
          palette={palette}
          items={legendItems(palette, {
            critical: showCritical,
            viaStage: net.links.some((l) => l.viaStage),
          })}
        />
      </PMToolbar>

      <View style={styles.body}>
        {net.activities.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: palette.textMuted }}>{pmT('No tasks to show yet.')}</Text>
          </View>
        ) : (
          <PMNetworkCanvas
            testID="pm-net-diagram-canvas"
            contentW={layout.width}
            contentH={layout.height}
            zoom={z}
            onZoom={zoomCtl.setZoom}
            onViewport={zoomCtl.onViewport}
            background={palette.background}
            onBackgroundPress={ix.clearSelection}
          >
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <Svg width={layout.width * z} height={layout.height * z}>
                {net.links.map((l) => {
                  const pts = layout.edges[l.id];
                  if (!pts) return null;
                  const sp = pts.map(([x, y]) => [x * z, y * z] as PMPt);
                  const dim = !!ix.highlight && !(ix.highlight.has(l.from) && ix.highlight.has(l.to));
                  const critical = showCritical && l.critical;
                  const custom =
                    l.ref && !l.viaStage
                      ? customColor[
                          depKey({
                            rowDependsOnGUID: l.ref.dependsOnGUID,
                            rowGUID: l.ref.rowGUID,
                          })
                        ]
                      : undefined;
                  const color = l.virtual ? withAlpha(palette.textMuted, 0.6) : custom || (critical ? palette.critical : palette.link);
                  const d = edgePath(sp, form);
                  const [ex, ey] = sp[sp.length - 1];
                  const label = linkLabel(l.type, l.lag);
                  const anchor = label ? labelAnchor(sp) : null;
                  return (
                    <G key={l.id} opacity={dim ? 0.18 : 1}>
                      <Path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeWidth={(critical ? 2.2 : 1.4) * Math.max(0.7, z)}
                        strokeDasharray={l.virtual ? `${3 * z} ${4 * z}` : l.viaStage ? `${6 * z} ${3 * z}` : undefined}
                      />
                      <Path d={arrowHead(ex, ey, endAngle(sp, form), 8 * Math.max(0.7, z))} fill={color} />
                      {anchor && (
                        <SvgText x={anchor.x} y={anchor.y - 4 * z} fontSize={10 * z} fontWeight="700" fill={color} textAnchor="middle">
                          {label}
                        </SvgText>
                      )}
                      {ix.editable && l.ref && !l.virtual && (
                        <Path d={d} fill="none" stroke="transparent" strokeWidth={12} {...svgPressProps((e: any) => ix.pressDependency(l.ref, e))} />
                      )}
                    </G>
                  );
                })}
              </Svg>
            </View>

            {[NET_START, NET_FINISH].map((id) => {
              const b = layout.nodes[id];
              if (!b) return null;
              return (
                <View
                  key={id}
                  style={[
                    styles.end,
                    {
                      left: b.x * z,
                      top: b.y * z,
                      width: b.w * z,
                      height: b.h * z,
                      borderRadius: (b.h * z) / 2,
                      backgroundColor: palette.header,
                      borderColor: palette.gridStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: palette.textMuted,
                      fontSize: 11 * z,
                      fontWeight: '700',
                    }}
                  >
                    {id === NET_START ? 'Start' : 'Finish'}
                  </Text>
                </View>
              );
            })}

            {net.activities.map((a) => {
              const b = layout.nodes[a.guid];
              if (!b) return null;
              return (
                <NodeBox
                  key={a.guid}
                  a={a}
                  x={b.x * z}
                  y={b.y * z}
                  w={b.w * z}
                  h={b.h * z}
                  z={z}
                  variant={variant}
                  palette={palette}
                  showCritical={showCritical}
                  selected={a.guid === ix.selectedGUID}
                  linkSource={a.guid === ix.linkSourceGUID}
                  dim={!!ix.highlight && !ix.highlight.has(a.guid)}
                  ix={ix}
                />
              );
            })}

            {ix.editable && selected && selBox && !ix.linkSourceGUID && (
              <PMNetworkNodeActionPanel
                guid={selected.guid}
                crud={crud!}
                palette={palette}
                left={(selBox.x + selBox.w / 2) * z - PM_BAR_PANEL_WIDTH / 2}
                top={selBox.y * z - 32}
              />
            )}
          </PMNetworkCanvas>
        )}
        <PMNetworkInfoCard net={net} activityGUID={selected?.guid} calendar={{ skipWeekends }} palette={palette} onClose={ix.clearSelection} />
      </View>
    </View>
  );
}

// =====================================================================================

const lastDay = (a: PMNetActivity) => (a.finishMs > a.startMs ? a.finishMs - DAY_MS : a.startMs);

interface NodeProps {
  a: PMNetActivity;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  variant: PMNetworkDiagramVariant;
  palette: PMPalette;
  showCritical: boolean;
  selected: boolean;
  linkSource: boolean;
  dim: boolean;
  ix: PMNetworkInteraction;
}

const NodeBox = memo(function NodeBox({ a, x, y, w, h, z, variant, palette, showCritical, selected, linkSource, dim, ix }: NodeProps) {
  const critical = showCritical && a.critical;
  const accent = critical ? palette.critical : palette.primary;
  const borderColor = selected || linkSource ? palette.primary : critical ? palette.critical : palette.gridStrong;
  const fs = 11 * z;
  const name = `${a.kind === 'milestone' ? '◆ ' : ''}${a.name}`;
  const a11y = `${a.name}. ES ${a.es}, duration ${a.duration}, EF ${a.ef}. LS ${a.ls}, float ${a.tf}, LF ${a.lf}${a.critical ? '. Critical' : ''}`;
  return (
    <Pressable
      testID={`pm-net-node-${a.guid}`}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={() => ix.pressActivity(a.guid)}
      onLongPress={() => ix.longPressActivity(a.guid)}
      onHoverIn={IS_WEB ? () => ix.hoverActivity(a.guid) : undefined}
      onHoverOut={IS_WEB ? () => ix.hoverActivity(null) : undefined}
      style={[
        styles.node,
        {
          left: x,
          top: y,
          width: w,
          height: h,
          opacity: dim ? 0.3 : 1,
          borderColor,
          borderWidth: selected || critical || linkSource ? 2 : 1,
          borderStyle: linkSource ? 'dashed' : 'solid',
          backgroundColor: selected ? withAlpha(palette.primary, 0.08) : palette.surface,
          borderRadius: (variant === 'cpmNodes' ? 6 : 10) * z,
        },
        IS_WEB ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      {variant === 'cpmNodes' ? (
        <>
          <CellRow
            z={z}
            palette={palette}
            tint={critical ? withAlpha(palette.critical, 0.1) : palette.header}
            values={[a.es, a.duration, a.ef]}
            tips={['ES', 'D', 'EF']}
            bold
          />
          <View style={[styles.cpmBody, { paddingHorizontal: 6 * z, borderColor: palette.grid }]}>
            {!!a.color && <View style={[styles.stripe, { backgroundColor: a.color, width: 3 * z }]} />}
            <Text
              numberOfLines={2}
              style={{
                color: palette.text,
                fontSize: fs * 1.05,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {name}
            </Text>
            <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: fs * 0.82 }}>
              #{a.seq} · {a.wbs}
            </Text>
            <View
              style={[
                styles.progress,
                {
                  height: 2 * z,
                  width: `${Math.max(0, Math.min(100, a.progress))}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
          <CellRow
            z={z}
            palette={palette}
            tint={palette.surface}
            values={[a.ls, a.tf, a.lf]}
            tips={['LS', 'TF', 'LF']}
            highlightMiddle={a.tf === 0 && critical ? palette.critical : undefined}
          />
        </>
      ) : (
        <View style={[styles.compact, { paddingLeft: 10 * z, paddingRight: 6 * z }]}>
          <View
            style={[
              styles.stripe,
              {
                backgroundColor: a.color || accent,
                width: 4 * z,
                borderTopLeftRadius: 9 * z,
                borderBottomLeftRadius: 9 * z,
              },
            ]}
          />
          <Text
            numberOfLines={2}
            style={{
              color: palette.text,
              fontSize: fs * 1.05,
              fontWeight: '700',
            }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: palette.textMuted,
              fontSize: fs * 0.85,
              marginTop: 1 * z,
            }}
          >
            {a.duration} d · {formatDateShort(a.startMs)} – {formatDateShort(lastDay(a))}
            {a.tf > 0 ? ` · float ${a.tf}` : ''}
          </Text>
          <View
            style={[
              styles.progress,
              {
                height: 2 * z,
                width: `${Math.max(0, Math.min(100, a.progress))}%`,
                backgroundColor: accent,
              },
            ]}
          />
        </View>
      )}
    </Pressable>
  );
});

function CellRow({
  z,
  palette,
  tint,
  values,
  tips,
  bold,
  highlightMiddle,
}: {
  z: number;
  palette: PMPalette;
  tint: string;
  values: number[];
  tips: string[];
  bold?: boolean;
  highlightMiddle?: string;
}) {
  return (
    <View style={[styles.cells, { height: CELL_H * z, backgroundColor: tint }]}>
      {values.map((v, i) => (
        <View
          key={tips[i]}
          accessibilityLabel={`${tips[i]} ${v}`}
          style={[
            styles.cell,
            {
              borderLeftWidth: i ? StyleSheet.hairlineWidth : 0,
              borderColor: palette.gridStrong,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 10.5 * z,
              fontWeight: bold || (i === 1 && highlightMiddle) ? '700' : '500',
              color: i === 1 && highlightMiddle ? highlightMiddle : palette.text,
              fontVariant: ['tabular-nums'],
            }}
          >
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  key: { fontSize: 11, marginRight: 4 },
  node: { position: 'absolute', overflow: 'hidden' },
  end: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cells: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cpmBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compact: { flex: 1, justifyContent: 'center' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  progress: { position: 'absolute', left: 0, bottom: 0 },
});
