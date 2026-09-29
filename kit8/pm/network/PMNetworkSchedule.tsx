// PMNetworkSchedule - network schedule ("сетевой график"), activity-on-arrow (AOA):
// events are circles, activities are arrows (name above, duration below), dummies are dashed.
// The event network is derived from the same CPM schedule as the Gantt (networkModel.ts:
// one event per distinct predecessor set, then exact dummy contraction, Fulkerson numbering).
//
// Two variants (toggle in its own bar, saved per project as uxuiSettings.networkScheduleVariant):
//   eventCircles  classic 4-sector events:        top    = event number
//                                                 left   = early time   right = late time
//                                                 bottom = number of the event the early time comes from
//                 layered layout, straight arrows, critical path in red
//   timeScaled    the same network on a working-day axis: an event sits at its early time,
//                 an arrow is as long as its duration, free float = dotted tail, dates on the axis,
//                 today line
//
// Editable mode: tap an arrow label = select the task (+ CRUD panel), double tap / long press =
// edit, tap a labelled dummy = dependency menu. Read-only: selection + info card only.

import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';
import { PM_BAR_PANEL_WIDTH } from '../constants';
import { usePMStore } from '../store';
import { addWorkDays, formatDateShort, todayUTC, workDaysBetween } from '../scheduling';
import { PMPalette, withAlpha } from '../theme';
import { PMNetworkScheduleVariant } from '../types';
import { PMCrud } from '../usePMCrud';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../inner/toolbars/PMToolbarPrimitives';
import PMGanttZoomButtons from '../gantt/buttons/PMGanttZoomButtons';
import PMSegmentedIconButtons, { PMSegmentOption } from './PMSegmentedIconButtons';
import PMNetworkCanvas, { useNetworkZoom } from './PMNetworkCanvas';
import PMNetworkInfoCard from './PMNetworkInfoCard';
import PMNetworkLegend, { legendItems } from './PMNetworkLegend';
import PMNetworkNodeActionPanel from './PMNetworkNodeActionPanel';
import { arrowHead, labelAnchor, PMPt, straightPath, towards, svgPressProps } from './networkGeometry';
import { buildEventNetwork, layeredLayout, PMActivityNetwork, PMEventNetwork, PMNetArrow, PMNetEvent, timeScaledLayout } from './networkModel';
import { PMNetworkInteraction, useNetworkInteraction, useNetworkViewSetters } from './useNetworkView';

const IS_WEB = Platform.OS === 'web';

export const PM_NETWORK_SCHEDULE_VARIANTS: PMSegmentOption<PMNetworkScheduleVariant>[] = [
  {
    value: 'eventCircles',
    icon: 'lan',
    label: 'Events',
    title: 'Events as 4-sector circles (number / early / late / predecessor)',
  },
  {
    value: 'timeScaled',
    icon: 'timeline',
    label: 'Time-scaled',
    title: 'Time-scaled network: arrow length = duration, dotted = free float',
  },
];

const R_CIRCLE = 25; // eventCircles
const R_SMALL = 13; // timeScaled
const MARGIN = 28;
const AXIS_H = 44;
const DAY_PX = 34;
const LANE_H = 66;

interface DrawnArrow {
  arrow: PMNetArrow;
  /** polyline pieces: solid / dotted (float) */
  solid: PMPt[][];
  dotted: PMPt[][];
  head: { x: number; y: number; angle: number };
  /** label box: centre, angle, available length */
  label: { x: number; y: number; angle: number; len: number };
}

export default function PMNetworkSchedule({ net, palette, crud, readOnly }: { net: PMActivityNetwork; palette: PMPalette; crud?: PMCrud; readOnly?: boolean }) {
  const variant = usePMStore((s) => s.networkScheduleVariant);
  const showCritical = usePMStore((s) => s.showCriticalPath);
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const skipWeekends = usePMStore((s) => !!(s.selectedProjectGUID && s.projectsById[s.selectedProjectGUID]?.rowJSON.skipWeekends));
  const calendar = useMemo(() => ({ skipWeekends }), [skipWeekends]);
  const setters = useNetworkViewSetters(crud, readOnly);
  const ix = useNetworkInteraction(net, crud, readOnly);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const ev = useMemo(() => buildEventNetwork(net), [net]);
  const timeScaled = variant === 'timeScaled';
  const r = timeScaled ? R_SMALL : R_CIRCLE;

  // ---- geometry at zoom 1 ----
  const geo = useMemo(() => (timeScaled ? timeScaledGeometry(ev, net) : layeredGeometry(ev)), [ev, net, timeScaled]);

  const zoomCtl = useNetworkZoom(geo.width, geo.height, `${projectGUID}:${variant}`);
  const z = zoomCtl.zoom;

  const selectEvent = (id: string) => {
    ix.clearSelection();
    setSelectedEvent(id);
  };
  const clearAll = () => {
    ix.clearSelection();
    setSelectedEvent(null);
  };
  const pressArrow = (a: PMNetArrow, e?: any) => {
    setSelectedEvent(null);
    if (a.activityGUID) ix.pressActivity(a.activityGUID);
    else if (a.ref) ix.pressDependency(a.ref, e);
  };

  const selectedArrow = ix.selectedGUID ? geo.arrows.find((d) => d.arrow.activityGUID === ix.selectedGUID) : undefined;
  const event = selectedEvent && !ix.selectedGUID ? ev.eventsById[selectedEvent] : null;
  const dimArrow = (a: PMNetArrow) => {
    if (!ix.highlight) return false;
    if (a.activityGUID) return !ix.highlight.has(a.activityGUID);
    return true;
  };

  return (
    <View style={styles.root} testID="pm-net-schedule">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMSegmentedIconButtons
          testID="pm-net-schedule-variant"
          options={PM_NETWORK_SCHEDULE_VARIANTS}
          value={variant}
          onChange={setters.setNetworkScheduleVariant}
          color={palette.text}
          activeColor={palette.primary}
          border={palette.border}
        />
        <PMToolbarDivider color={palette.border} />
        <PMGanttZoomButtons palette={palette} onZoomOut={zoomCtl.zoomOut} onZoomIn={zoomCtl.zoomIn} onFit={zoomCtl.fit} />
        <PMToolbarSpacer />
        {!timeScaled && <Text style={[styles.key, { color: palette.textMuted }]}>event: № / early · late / from №</Text>}
        <PMNetworkLegend
          palette={palette}
          items={legendItems(palette, {
            critical: showCritical,
            dummy: ev.arrows.some((a) => a.kind === 'dummy'),
            freeFloat: timeScaled,
          })}
        />
      </PMToolbar>

      <View style={styles.body}>
        {ev.events.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: palette.textMuted }}>No tasks to show yet.</Text>
          </View>
        ) : (
          <PMNetworkCanvas
            testID="pm-net-schedule-canvas"
            contentW={geo.width}
            contentH={geo.height}
            zoom={z}
            onZoom={zoomCtl.setZoom}
            onViewport={zoomCtl.onViewport}
            background={palette.background}
            onBackgroundPress={clearAll}
          >
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <Svg width={geo.width * z} height={geo.height * z}>
                {timeScaled && <TimeAxis z={z} width={geo.width} height={geo.height} net={net} palette={palette} calendar={calendar} />}
                {geo.arrows.map((d) => {
                  const a = d.arrow;
                  const critical = showCritical && a.critical;
                  const selected = !!a.activityGUID && a.activityGUID === ix.selectedGUID;
                  const color = selected ? palette.primary : critical ? palette.critical : a.kind === 'dummy' ? palette.textMuted : palette.link;
                  const sw = (critical || selected ? 2.4 : 1.5) * Math.max(0.7, z);
                  const S = (pts: PMPt[]) => pts.map(([x, y]) => [x * z, y * z] as PMPt);
                  const dash = a.kind === 'dummy' ? `${5 * z} ${4 * z}` : undefined;
                  return (
                    <G key={a.id} opacity={dimArrow(a) ? 0.18 : 1}>
                      {d.solid.map((p, i) => (
                        <Path key={`s${i}`} d={straightPath(S(p))} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={dash} />
                      ))}
                      {d.dotted.map((p, i) => (
                        <Path
                          key={`d${i}`}
                          d={straightPath(S(p))}
                          fill="none"
                          stroke={withAlpha(palette.textMuted, 0.9)}
                          strokeWidth={1.3 * Math.max(0.7, z)}
                          strokeDasharray={`${1.5 * z} ${3.5 * z}`}
                          strokeLinecap="round"
                        />
                      ))}
                      <Path d={arrowHead(d.head.x * z, d.head.y * z, d.head.angle, 8 * Math.max(0.7, z))} fill={color} />
                      {a.kind === 'dummy' && !!a.label && (
                        <SvgText x={d.label.x * z} y={d.label.y * z - 4 * z} fontSize={10 * z} fontWeight="700" fill={color} textAnchor="middle">
                          {a.label}
                        </SvgText>
                      )}
                      {ix.editable && a.kind === 'dummy' && a.ref && (
                        <Path
                          d={d.solid.map((p) => straightPath(S(p))).join(' ')}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={12}
                          {...svgPressProps((e: any) => pressArrow(a, e))}
                        />
                      )}
                    </G>
                  );
                })}
              </Svg>
            </View>

            {geo.arrows.map((d) =>
              d.arrow.activityGUID ? (
                <ArrowLabel
                  key={`l-${d.arrow.id}`}
                  d={d}
                  z={z}
                  net={net}
                  palette={palette}
                  critical={showCritical && d.arrow.critical}
                  selected={d.arrow.activityGUID === ix.selectedGUID}
                  linkSource={d.arrow.activityGUID === ix.linkSourceGUID}
                  dim={dimArrow(d.arrow)}
                  ix={ix}
                  onPress={() => pressArrow(d.arrow)}
                />
              ) : null,
            )}

            {ev.events.map((e) => (
              <EventCircle
                key={e.id}
                e={e}
                cx={geo.eventX[e.id] * z}
                cy={geo.eventY[e.id] * z}
                r={r * z}
                z={z}
                sectors={!timeScaled}
                palette={palette}
                critical={showCritical && e.critical}
                selected={e.id === selectedEvent && !ix.selectedGUID}
                dim={!!ix.highlight}
                onPress={() => selectEvent(e.id)}
              />
            ))}

            {ix.editable && selectedArrow && !ix.linkSourceGUID && (
              <PMNetworkNodeActionPanel
                guid={selectedArrow.arrow.activityGUID!}
                crud={crud!}
                palette={palette}
                left={selectedArrow.label.x * z - PM_BAR_PANEL_WIDTH / 2}
                top={selectedArrow.label.y * z - 62 * Math.max(0.6, z)}
              />
            )}
          </PMNetworkCanvas>
        )}
        <PMNetworkInfoCard
          net={net}
          activityGUID={ix.selectedGUID && net.byGUID[ix.selectedGUID] ? ix.selectedGUID : null}
          event={event}
          calendar={calendar}
          palette={palette}
          onClose={clearAll}
        />
      </View>
    </View>
  );
}

// =====================================================================================
// geometry
// =====================================================================================

interface ScheduleGeometry {
  eventX: Record<string, number>;
  eventY: Record<string, number>;
  arrows: DrawnArrow[];
  width: number;
  height: number;
}

function layeredGeometry(ev: PMEventNetwork): ScheduleGeometry {
  const L = layeredLayout(
    ev.events.map((e) => ({
      id: e.id,
      w: R_CIRCLE * 2,
      h: R_CIRCLE * 2,
      rank: e.number,
    })),
    ev.arrows,
    { gapX: 150, gapY: 46, margin: MARGIN, dummyH: 34 },
  );
  const eventX: Record<string, number> = {};
  const eventY: Record<string, number> = {};
  for (const e of ev.events) {
    const b = L.nodes[e.id];
    eventX[e.id] = b.x + b.w / 2;
    eventY[e.id] = b.y + b.h / 2;
  }
  const arrows: DrawnArrow[] = ev.arrows.map((a) => {
    const raw = L.edges[a.id] || [];
    const c1: PMPt = [eventX[a.from], eventY[a.from]];
    const c2: PMPt = [eventX[a.to], eventY[a.to]];
    const inner = raw.slice(1, -1);
    const p0 = towards(c1[0], c1[1], (inner[0] ?? c2)[0], (inner[0] ?? c2)[1], R_CIRCLE);
    const last = inner[inner.length - 1] ?? c1;
    const p1 = towards(c2[0], c2[1], last[0], last[1], R_CIRCLE + 1);
    const pts: PMPt[] = [p0, ...inner, p1];
    const [px, py] = pts[pts.length - 2];
    return {
      arrow: a,
      solid: [pts],
      dotted: [],
      head: { x: p1[0], y: p1[1], angle: Math.atan2(p1[1] - py, p1[0] - px) },
      label: labelAnchor(pts),
    };
  });
  return { eventX, eventY, arrows, width: L.width, height: L.height };
}

function timeScaledGeometry(ev: PMEventNetwork, net: PMActivityNetwork): ScheduleGeometry {
  const T = timeScaledLayout(ev, net, {
    dayPx: DAY_PX,
    laneH: LANE_H,
    top: AXIS_H,
    margin: MARGIN,
  });
  const r = R_SMALL;
  const X = (t: number) => T.x0 + t * T.dayPx;
  const arrows: DrawnArrow[] = ev.arrows.map((a) => {
    const xt = T.eventX[a.from];
    const yt = T.eventY[a.from];
    const xh = T.eventX[a.to];
    const yh = T.eventY[a.to];
    const solid: PMPt[][] = [];
    const dotted: PMPt[][] = [];
    if (a.kind === 'dummy') {
      // horizontal at the tail's lane, then vertical into the head
      if (Math.abs(yh - yt) < 0.5) {
        solid.push([
          [xt + r, yt],
          [xh - r - 1, yh],
        ]);
        return {
          arrow: a,
          solid,
          dotted,
          head: { x: xh - r - 1, y: yh, angle: 0 },
          label: { x: (xt + xh) / 2, y: yt, angle: 0, len: xh - xt },
        };
      }
      const down = yh > yt;
      const pts: PMPt[] =
        xh - xt > r
          ? [
              [xt + r, yt],
              [xh, yt],
              [xh, yh + (down ? -r - 1 : r + 1)],
            ]
          : [
              [xt, yt + (down ? r : -r)],
              [xh, yh + (down ? -r - 1 : r + 1)],
            ];
      solid.push(pts);
      const end = pts[pts.length - 1];
      return {
        arrow: a,
        solid,
        dotted,
        head: {
          x: end[0],
          y: end[1],
          angle: down ? Math.PI / 2 : -Math.PI / 2,
        },
        label: {
          x: (xt + xh) / 2,
          y: yt,
          angle: 0,
          len: Math.max(40, xh - xt),
        },
      };
    }
    const act = net.byGUID[a.activityGUID!];
    const ya = T.arrowY[a.id];
    const xs = Math.max(xt, X(act.es));
    const xe = Math.max(xs, X(act.ef));
    let cx = xt + r;
    if (Math.abs(ya - yt) >= 0.5) {
      solid.push([
        [xt, yt + (ya > yt ? r : -r)],
        [xt, ya],
      ]);
      cx = xt;
    }
    if (xs > cx + 0.5)
      dotted.push([
        [cx, ya],
        [xs, ya],
      ]);
    const sameLane = Math.abs(ya - yh) < 0.5;
    const endX = sameLane ? xh - r - 1 : xh;
    solid.push([
      [Math.max(cx, xs), ya],
      [Math.min(xe, endX), ya],
    ]);
    let head = { x: Math.min(xe, endX), y: ya, angle: 0 };
    if (endX > xe + 0.5)
      dotted.push([
        [xe, ya],
        [endX, ya],
      ]);
    if (!sameLane) {
      const down = yh > ya;
      const tipY = yh + (down ? -r - 1 : r + 1);
      solid.push([
        [xh, ya],
        [xh, tipY],
      ]);
      head = { x: xh, y: tipY, angle: down ? Math.PI / 2 : -Math.PI / 2 };
    } else if (endX > xe + 0.5) {
      head = { x: endX, y: ya, angle: 0 };
    }
    const x0 = Math.max(cx, xs);
    return {
      arrow: a,
      solid,
      dotted,
      head,
      label: { x: (x0 + xe) / 2, y: ya, angle: 0, len: Math.max(48, xe - x0) },
    };
  });
  return {
    eventX: T.eventX,
    eventY: T.eventY,
    arrows,
    width: T.width,
    height: T.height,
  };
}

// =====================================================================================
// pieces
// =====================================================================================

function TimeAxis({
  z,
  width,
  height,
  net,
  palette,
  calendar,
}: {
  z: number;
  width: number;
  height: number;
  net: PMActivityNetwork;
  palette: PMPalette;
  calendar: { skipWeekends: boolean };
}) {
  const dayPx = DAY_PX * z;
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => s * dayPx >= 24) ?? 100;
  const dateEvery = Math.max(1, Math.ceil(52 / (step * dayPx)));
  const maxT = Math.ceil((width - MARGIN * 3) / DAY_PX);
  const ticks: number[] = [];
  for (let t = 0; t <= maxT; t += step) ticks.push(t);
  const ps = net.projectStartMs;
  const today = todayUTC();
  const todayT = today >= ps ? workDaysBetween(ps, today, calendar) : -1;
  const X = (t: number) => (MARGIN + t * DAY_PX) * z;
  return (
    <G>
      {ticks.map((t, i) => (
        <G key={t}>
          <Line x1={X(t)} y1={AXIS_H * z - 6 * z} x2={X(t)} y2={height * z} stroke={palette.grid} strokeWidth={1} />
          <SvgText x={X(t)} y={14 * z} fontSize={10 * z} fontWeight="700" fill={palette.textMuted} textAnchor="middle">
            {t}
          </SvgText>
          {i % dateEvery === 0 && (
            <SvgText x={X(t)} y={28 * z} fontSize={9 * z} fill={palette.textMuted} textAnchor="middle">
              {formatDateShort(addWorkDays(ps, t, calendar))}
            </SvgText>
          )}
        </G>
      ))}
      <Line x1={0} y1={AXIS_H * z - 6 * z} x2={width * z} y2={AXIS_H * z - 6 * z} stroke={palette.gridStrong} strokeWidth={1} />
      {todayT >= 0 && todayT <= maxT && (
        <Line x1={X(todayT)} y1={AXIS_H * z - 6 * z} x2={X(todayT)} y2={height * z} stroke={palette.today} strokeWidth={1.6} opacity={0.8} />
      )}
    </G>
  );
}

function ArrowLabel({
  d,
  z,
  net,
  palette,
  critical,
  selected,
  linkSource,
  dim,
  ix,
  onPress,
}: {
  d: DrawnArrow;
  z: number;
  net: PMActivityNetwork;
  palette: PMPalette;
  critical: boolean;
  selected: boolean;
  linkSource: boolean;
  dim: boolean;
  ix: PMNetworkInteraction;
  onPress: () => void;
}) {
  const act = net.byGUID[d.arrow.activityGUID!];
  let angle = d.label.angle;
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  const w = Math.max(56, d.label.len - R_CIRCLE * 0.6) * z;
  const lineH = 14 * z;
  const h = lineH * 2 + 6 * z;
  const color = selected || linkSource ? palette.primary : critical ? palette.critical : palette.text;
  return (
    <Pressable
      testID={`pm-net-arrow-${act.guid}`}
      accessibilityRole="button"
      accessibilityLabel={`${act.name}, ${act.duration} days${act.critical ? ', critical' : ''}`}
      onPress={onPress}
      onLongPress={() => ix.longPressActivity(act.guid)}
      onHoverIn={IS_WEB ? () => ix.hoverActivity(act.guid) : undefined}
      onHoverOut={IS_WEB ? () => ix.hoverActivity(null) : undefined}
      style={[
        styles.label,
        {
          left: d.label.x * z - w / 2,
          top: d.label.y * z - h / 2,
          width: w,
          height: h,
          opacity: dim ? 0.25 : 1,
          transform: [{ rotate: `${angle}rad` }],
        },
        IS_WEB ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.labelText,
          {
            fontSize: 11 * z,
            lineHeight: lineH,
            color,
            fontWeight: selected || critical ? '700' : '600',
            backgroundColor: selected ? withAlpha(palette.primary, 0.1) : 'transparent',
            borderStyle: linkSource ? 'dashed' : 'solid',
            borderWidth: linkSource ? 1 : 0,
            borderColor: palette.primary,
          },
        ]}
      >
        {act.kind === 'milestone' ? '◆ ' : ''}
        {act.name}
      </Text>
      <Text numberOfLines={1} style={[styles.labelText, { fontSize: 10 * z, lineHeight: lineH, color: palette.textMuted }]}>
        {act.duration} d{act.progress > 0 ? ` · ${Math.round(act.progress)}%` : ''}
        {d.arrow.freeFloat > 0 ? ` · ff ${d.arrow.freeFloat}` : ''}
      </Text>
    </Pressable>
  );
}

function EventCircle({
  e,
  cx,
  cy,
  r,
  z,
  sectors,
  palette,
  critical,
  selected,
  dim,
  onPress,
}: {
  e: PMNetEvent;
  cx: number;
  cy: number;
  r: number;
  z: number;
  sectors: boolean;
  palette: PMPalette;
  critical: boolean;
  selected: boolean;
  dim: boolean;
  onPress: () => void;
}) {
  const border = selected ? palette.primary : critical ? palette.critical : palette.handle;
  const bw = (critical || selected ? 2.2 : 1.3) * Math.max(0.7, z);
  const d = r * 2;
  const k = r / Math.SQRT2;
  const fs = (sectors ? 11 : 10) * z;
  const cellW = r * 0.9;
  const T = ({ x, y, children, bold, color }: { x: number; y: number; children: React.ReactNode; bold?: boolean; color?: string }) => (
    <Text
      numberOfLines={1}
      style={{
        position: 'absolute',
        left: x - cellW / 2,
        top: y - fs * 0.65,
        width: cellW,
        textAlign: 'center',
        fontSize: fs,
        lineHeight: fs * 1.3,
        fontWeight: bold ? '700' : '500',
        color: color || palette.text,
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
  return (
    <Pressable
      testID={`pm-net-event-${e.number}`}
      accessibilityRole="button"
      accessibilityLabel={`Event ${e.number}: early ${e.early}, late ${e.late}, reserve ${e.reserve}`}
      onPress={onPress}
      style={[
        styles.event,
        {
          left: cx - r,
          top: cy - r,
          width: d,
          height: d,
          borderRadius: r,
          borderWidth: bw,
          borderColor: border,
          backgroundColor: selected ? withAlpha(palette.primary, 0.1) : palette.surface,
          opacity: dim && !critical ? 0.55 : 1,
        },
        IS_WEB ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      {sectors ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', left: -bw, top: -bw }}>
            <Svg width={d} height={d}>
              <Line x1={r - k} y1={r - k} x2={r + k} y2={r + k} stroke={withAlpha(palette.handle, 0.55)} strokeWidth={1} />
              <Line x1={r + k} y1={r - k} x2={r - k} y2={r + k} stroke={withAlpha(palette.handle, 0.55)} strokeWidth={1} />
            </Svg>
          </View>
          <T x={r - bw} y={r * 0.42 - bw} bold>
            {e.number}
          </T>
          <T x={r * 0.42 - bw} y={r - bw}>
            {e.early}
          </T>
          <T x={r * 1.58 - bw} y={r - bw} color={e.reserve > 0 ? palette.textMuted : undefined}>
            {e.late}
          </T>
          <T x={r - bw} y={r * 1.58 - bw} color={palette.textMuted}>
            {e.predNumber ?? ''}
          </T>
        </>
      ) : (
        <Text style={{ fontSize: fs, fontWeight: '700', color: palette.text }}>{e.number}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  key: { fontSize: 11, marginRight: 4 },
  label: {
    position: 'absolute',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    textAlign: 'center',
    paddingHorizontal: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  event: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
