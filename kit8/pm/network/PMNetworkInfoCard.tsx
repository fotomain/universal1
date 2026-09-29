// Read-only details of the selected activity / event, docked at the bottom-left of the
// network canvas. Shown in both modes (read-only too): it never changes data.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DAY_MS } from '../constants';
import { PMIconButton } from '../inner/buttons/PMIconButton';
import { addWorkDays, formatDateShort, PMCalendar } from '../scheduling';
import { PMPalette, withAlpha } from '../theme';
import { PMActivityNetwork, PMNetActivity, PMNetEvent } from './networkModel';

const lastDay = (a: PMNetActivity) => (a.finishMs > a.startMs ? a.finishMs - DAY_MS : a.startMs);

function Row({ k, v, palette, strong }: { k: string; v: string; palette: PMPalette; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.k, { color: palette.textMuted }]}>{k}</Text>
      <Text style={[styles.v, { color: strong ? palette.critical : palette.text }]}>{v}</Text>
    </View>
  );
}

export default function PMNetworkInfoCard({
  net,
  activityGUID,
  event,
  calendar,
  palette,
  onClose,
}: {
  net: PMActivityNetwork;
  activityGUID?: string | null;
  event?: PMNetEvent | null;
  calendar: PMCalendar;
  palette: PMPalette;
  onClose: () => void;
}) {
  const a = activityGUID ? net.byGUID[activityGUID] : undefined;
  if (!a && !event) return null;
  const dayDate = (t: number) => formatDateShort(addWorkDays(net.projectStartMs, Math.max(0, t), calendar));
  return (
    <View
      testID="pm-net-info"
      pointerEvents="box-none"
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: a?.critical || event?.critical ? palette.critical : palette.border,
        },
      ]}
    >
      <View style={styles.head}>
        <Text numberOfLines={2} style={[styles.title, { color: palette.text }]}>
          {a ? `${a.kind === 'milestone' ? '◆ ' : ''}${a.name}` : `Event ${event!.number}`}
        </Text>
        <PMIconButton compact size={16} testID="pm-net-info-close" icon="close" title="Close" color={palette.text} onPress={onClose} />
      </View>
      {a ? (
        <>
          <Text numberOfLines={1} style={[styles.sub, { color: palette.textMuted }]}>
            #{a.seq} · WBS {a.wbs}
            {a.stageName ? ` · ${a.stageName}` : ''}
          </Text>
          {a.critical && (
            <Text
              style={[
                styles.badge,
                {
                  color: palette.critical,
                  backgroundColor: withAlpha(palette.critical, 0.12),
                },
              ]}
            >
              Critical path
            </Text>
          )}
          <Row palette={palette} k="Dates" v={`${formatDateShort(a.startMs)} – ${formatDateShort(lastDay(a))}`} />
          <Row palette={palette} k="Duration" v={`${a.duration} d`} />
          <Row palette={palette} k="ES · EF" v={`${a.es} · ${a.ef}`} />
          <Row palette={palette} k="LS · LF" v={`${a.ls} · ${a.lf}  (${formatDateShort(a.lateStartMs)})`} />
          <Row palette={palette} k="Total float" v={`${a.tf} d`} strong={a.tf === 0} />
          <Row palette={palette} k="Progress" v={`${Math.round(a.progress)} %`} />
        </>
      ) : (
        <>
          <Row palette={palette} k="Early time" v={`${event!.early}  (${dayDate(event!.early)})`} />
          <Row palette={palette} k="Late time" v={`${event!.late}  (${dayDate(event!.late)})`} />
          <Row palette={palette} k="Reserve" v={`${event!.reserve} d`} strong={event!.reserve === 0} />
          {event!.predNumber !== null && <Row palette={palette} k="Comes from" v={`event ${event!.predNumber}`} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 250,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 14, fontWeight: '700', marginTop: 4 },
  sub: { fontSize: 11, marginBottom: 4 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  k: { fontSize: 12 },
  v: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
