// RouteVisitsTop - the most visited routes of the user (top 5 of app_route_visits_turnover) as a short list: the route and its number of visits, nothing else.
// Shown in the pinned part of the hamburger menu (kit8/ui/components/HamburgerMenuUnmovable). Draws nothing while signed out, while the Organization switch is off or while there is no visit.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { selectIsLoggedIn } from '../../../redux/activeUserSlice';
import { useMyOrganization } from '../../organization/useMyOrganization';
import { ROUTE_VISITS_TOP, isOpenableRoute, topRouteVisits } from './routeVisitModel';
import { useRouteVisitData } from './useRouteVisitData';

export interface RouteVisitsTopProps {
  limit?: number;
  /** a row was pressed (only a route that can be opened again) */
  onSelectRoute?: (route: string) => void;
  testID?: string;
}

export default function RouteVisitsTop({ limit = ROUTE_VISITS_TOP, onSelectRoute, testID = 'route-visits-top' }: RouteVisitsTopProps) {
  const { themeColors: c } = useDesignSystem();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { numberOfVisitsEnabled } = useMyOrganization();
  const active = isLoggedIn && numberOfVisitsEnabled;
  const { rows } = useRouteVisitData(active);
  const top = topRouteVisits(rows, limit);
  if (!active || top.length === 0) return null;

  return (
    <View testID={testID} style={styles.root}>
      {top.map((item) => {
        const openable = !!onSelectRoute && isOpenableRoute(item.route);
        return (
          <TouchableOpacity
            key={item.rowGUID}
            testID={`${testID}-${item.rowGUID}`}
            disabled={!openable}
            activeOpacity={0.7}
            onPress={() => onSelectRoute?.(item.route)}
            style={styles.row}
          >
            <Text numberOfLines={1} style={[styles.route, { color: c.text }]}>{item.route}</Text>
            <Text testID={`${testID}-${item.rowGUID}-count`} style={[styles.count, { color: c.primary }]}>{item.count}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  route: { flex: 1, fontSize: 12 },
  count: { fontSize: 12, fontWeight: '700' },
});
