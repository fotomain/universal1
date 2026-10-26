// RouteVisitsTop - the most visited routes of the user (top 5 of app_route_visits_turnover) as a short list: the route name and its number of visits, nothing else.
// The route is shown by the name of the hamburger menu ("Project Dashboard", "Routes visits" ...): `routeLabels` (buildRouteLabels); a route the menu does not know shows its path.
// Shown in the pinned part of the hamburger menu (kit8/ui/components/HamburgerMenuUnmovable). Draws nothing while signed out, while the Organization switch is off or while there is no visit.
// The number has the tip "Total visits"; while the pointer is over a row (web) - or after a long press on touch - a Close icon button deletes the visits of that route (route_visits_clear(route)).
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMTip } from '../../../pm/inner/tooltip/PMTooltip';
import { pmT } from '../../../pm/i18n/pmT';
import { useSupabase } from '../../../providers/WithSupabase';
import { useMyOrganization } from '../../organization/useMyOrganization';
import { ROUTE_VISITS_TOP, isOpenableRoute, routeKeyOf, routeLabelOf, topRouteVisits } from './routeVisitModel';
import { useRouteVisitData } from './useRouteVisitData';

const IS_WEB = Platform.OS === 'web';
const CLOSE_SIZE = 20;

function VisitRow({ item, label, color, countColor, openable, onOpen, onDelete, testID }: {
  item: { rowGUID: string; route: string; count: number };
  label: string; color: string; countColor: string; openable: boolean; onOpen: () => void; onDelete: () => void; testID: string;
}) {
  const [hover, setHover] = useState(false);
  const countTip = usePMTip(pmT('Total visits'), 'app');
  return (
    <Pressable
      testID={testID}
      disabled={!openable}
      onPress={onOpen}
      onHoverIn={IS_WEB ? () => setHover(true) : undefined}
      onHoverOut={IS_WEB ? () => setHover(false) : undefined}
      onLongPress={IS_WEB ? undefined : () => setHover((h) => !h)}
      style={styles.row}
    >
      <Text numberOfLines={1} style={[styles.route, { color }]}>{label}</Text>
      <Pressable
        ref={countTip.ref as any}
        testID={`${testID}-count-tip`}
        accessibilityHint={countTip.accessibilityHint}
        onHoverIn={countTip.onHoverIn}
        onHoverOut={countTip.onHoverOut}
        onPressIn={countTip.onPressIn}
        onLongPress={countTip.onLongPress}
        delayLongPress={countTip.delayLongPress}
        onPress={openable ? onOpen : undefined}
      >
        <Text testID={`${testID}-count`} style={[styles.count, { color: countColor }]}>{item.count}</Text>
      </Pressable>
      {/* always mounted: a button that appears under the pointer made the row lose its hover (the button vanished at once) */}
      <View testID={`${testID}-close-slot`} aria-hidden={!hover} pointerEvents={hover ? 'auto' : 'none'} style={[styles.closeSlot, { opacity: hover ? 1 : 0 }]}>
        <PMIconButton compact tipScope="app" testID={`${testID}-delete`} icon="close" title="Delete the visits of this route" color={color} disabled={!hover} onPress={onDelete} />
      </View>
    </Pressable>
  );
}

/** the end of a Top 5 row drawn as a menu row: the number of visits (tip "Total visits") and the Close button */
function VisitRight({ count, color, countColor, onOpen, onDelete, testID }: { count: number; color: string; countColor: string; onOpen?: () => void; onDelete: () => void; testID: string }) {
  const countTip = usePMTip(pmT('Total visits'), 'app');
  return (
    <View style={styles.right}>
      <Pressable
        ref={countTip.ref as any}
        testID={`${testID}-count-tip`}
        accessibilityHint={countTip.accessibilityHint}
        onHoverIn={countTip.onHoverIn}
        onHoverOut={countTip.onHoverOut}
        onPressIn={countTip.onPressIn}
        onLongPress={countTip.onLongPress}
        delayLongPress={countTip.delayLongPress}
        onPress={onOpen}
      >
        <Text testID={`${testID}-count`} style={[styles.count, { color: countColor }]}>{count}</Text>
      </Pressable>
      <View style={styles.closeSlot}>
        <PMIconButton compact tipScope="app" testID={`${testID}-delete`} icon="close" title="Delete the visits of this route" color={color} onPress={onDelete} />
      </View>
    </View>
  );
}

export interface RouteVisitsTopProps {
  limit?: number;
  /** a row was pressed (only a route that can be opened again) */
  onSelectRoute?: (route: string) => void;
  /** route key -> the name the hamburger menu shows (buildRouteLabels) */
  routeLabels?: Record<string, string>;
  /** route key -> icon name of its menu row */
  routeIcons?: Record<string, string>;
  /** draws a row as a row of the hamburger menu (icon and text in the columns of the other rows); without it the compact own row is used */
  renderItem?: (item: { id: string; label: string; icon: string; route: string; right?: React.ReactNode; onPress?: () => void; compact?: boolean }) => React.ReactNode;
  testID?: string;
}

export default function RouteVisitsTop({ limit = ROUTE_VISITS_TOP, onSelectRoute, routeLabels, routeIcons, renderItem, testID = 'route-visits-top' }: RouteVisitsTopProps) {
  const { themeColors: c } = useDesignSystem();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { numberOfVisitsEnabled } = useMyOrganization();
  const active = isLoggedIn && numberOfVisitsEnabled;
  const { rows, reload } = useRouteVisitData(active);
  const { supabase } = useSupabase();
  const top = topRouteVisits(rows, limit);
  const deleteRoute = async (route: string) => {
    try {
      const { error } = await (supabase as any).rpc('route_visits_clear', { p_route: route });
      if (error) throw error;
      reload();
    } catch (e) {
      console.warn('route_visits_clear failed', e);
    }
  };
  if (!active || top.length === 0) return null;

  if (renderItem) {
    return (
      <View testID={testID}>
        {top.map((item) => {
          const rowID = `${testID}-${item.rowGUID}`;
          const openable = !!onSelectRoute && isOpenableRoute(item.route);
          return (
            <React.Fragment key={item.rowGUID}>
              {renderItem({
                id: `visit-${item.rowGUID}`,
                label: routeLabelOf(item.route, routeLabels),
                icon: routeIcons?.[routeKeyOf(item.route)] || 'history',
                route: item.route,
                compact: true,
                onPress: () => { if (openable) onSelectRoute?.(item.route); },
                right: <VisitRight testID={rowID} count={item.count} color={c.text} countColor={c.primary} onOpen={openable ? () => onSelectRoute?.(item.route) : undefined} onDelete={() => deleteRoute(item.route)} />,
              })}
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.root}>
      {top.map((item) => (
        <VisitRow
          key={item.rowGUID}
          testID={`${testID}-${item.rowGUID}`}
          item={item}
          label={routeLabelOf(item.route, routeLabels)}
          color={c.text}
          countColor={c.primary}
          openable={!!onSelectRoute && isOpenableRoute(item.route)}
          onOpen={() => onSelectRoute?.(item.route)}
          onDelete={() => deleteRoute(item.route)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  route: { flex: 1, fontSize: 13 },
  count: { fontSize: 12, fontWeight: '400' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeSlot: { width: CLOSE_SIZE, height: CLOSE_SIZE, alignItems: 'center', justifyContent: 'center' },
});
