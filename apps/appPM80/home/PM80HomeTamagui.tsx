import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../kit8/providers/WithDesignSystem';
import PM80CircularProgress from './PM80CircularProgress';
import PM80BrandLogo from './PM80BrandLogo';
import PM80FlowStrip from './PM80FlowStrip';
import { openPM80Route } from './pm80OpenRoute';
import {
  PM80_MONTH_SNAPSHOTS,
  PM80_QUICK_LINKS,
  pm80FlowOf,
  PM80SatelliteNode,
  PM80AdvancedMetric,
  RoiKindKey,
  computePM80Center,
} from './pm80HomeModel';

export interface PM80HomeTamaguiProps {
  initialMonthIndex?: number;
  onSwitchStyle?: () => void;
  testID?: string;
}

const ROI_KINDS_ORDER: RoiKindKey[] = ['roi4', 'roi1', 'roi2', 'roi3'];

export default function PM80HomeTamagui({
  initialMonthIndex = 0,
  onSwitchStyle,
  testID = 'pm80-home-tamagui',
}: PM80HomeTamaguiProps) {
  const router = useRouter();
  let isDark = false;
  let primaryToken = '#2563EB';
  try {
    const ds = useDesignSystem();
    if (ds) {
      if (typeof ds.isDark === 'boolean') isDark = ds.isDark;
      if (ds.themeColors?.primary) primaryToken = ds.themeColors.primary;
    }
  } catch {
    // outside provider fallback
  }

  const [monthIdx, setMonthIdx] = useState<number>(initialMonthIndex);
  const [activeRoiKind, setActiveRoiKind] = useState<RoiKindKey>('roi4');
  const [includeAllTaxes, setIncludeAllTaxes] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<PM80SatelliteNode | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<PM80AdvancedMetric | null>(null);

  const snapshot = PM80_MONTH_SNAPSHOTS[monthIdx] || PM80_MONTH_SNAPSHOTS[0];

  const centerData = useMemo(
    () =>
      computePM80Center(snapshot, activeRoiKind, {
        includeSaleVat: includeAllTaxes,
        includePurchaseVat: includeAllTaxes,
      }),
    [snapshot, activeRoiKind, includeAllTaxes]
  );

  const handlePrevMonth = useCallback(() => {
    setMonthIdx((prev) => (prev + 1) % PM80_MONTH_SNAPSHOTS.length);
  }, []);

  const handleNextMonth = useCallback(() => {
    setMonthIdx((prev) => (prev - 1 + PM80_MONTH_SNAPSHOTS.length) % PM80_MONTH_SNAPSHOTS.length);
  }, []);

  const handleCycleRoiKind = useCallback(() => {
    setActiveRoiKind((prev) => {
      const idx = ROI_KINDS_ORDER.indexOf(prev);
      return ROI_KINDS_ORDER[(idx + 1) % ROI_KINDS_ORDER.length];
    });
  }, []);

  const navigateTo = useCallback(
    (route: string) => openPM80Route(route, router),
    [router]
  );

  const flowNodes = useMemo(() => pm80FlowOf(snapshot), [snapshot]);

  const topNodes = useMemo(
    () =>
      snapshot.satellites.filter(
        (s) => s.position === 'top-left' || s.position === 'top-right'
      ),
    [snapshot.satellites]
  );
  const midLeftNode = useMemo(
    () => snapshot.satellites.find((s) => s.position === 'mid-left'),
    [snapshot.satellites]
  );
  const midRightNode = useMemo(
    () => snapshot.satellites.find((s) => s.position === 'mid-right'),
    [snapshot.satellites]
  );
  const lowerLeftNode = useMemo(
    () => snapshot.satellites.find((s) => s.position === 'lower-left'),
    [snapshot.satellites]
  );
  const lowerRightNode = useMemo(
    () => snapshot.satellites.find((s) => s.position === 'lower-right'),
    [snapshot.satellites]
  );
  const bottomNodes = useMemo(
    () =>
      snapshot.satellites.filter(
        (s) => s.position === 'bottom-left' || s.position === 'bottom-right'
      ),
    [snapshot.satellites]
  );

  // Tamagui Token Palette
  const bgCanvas = isDark ? '#090D16' : '#F1F5F9';
  const cardSurface = isDark ? '#111827' : '#FFFFFF';
  const cardBorder = isDark ? '#1E293B' : '#E2E8F0';
  const textStrong = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const pillSurface = isDark ? '#1E293B' : '#FFFFFF';
  const trackColor = isDark ? '#1E293B' : '#E2E8F0';

  const kpiStrokeColors = ['#6366F1', '#8B5CF6', '#10B981', '#D946EF'];

  const renderSatellite = (node?: PM80SatelliteNode) => {
    if (!node) return null;
    const isSelected = selectedNode?.id === node.id;

    return (
      <TouchableOpacity
        key={node.id}
        testID={`${testID}-satellite-${node.id}`}
        activeOpacity={0.85}
        onPress={() => {
          setSelectedMetric(null);
          setSelectedNode(isSelected ? null : node);
        }}
        style={styles.satWrapper}
      >
        <Text style={[styles.satLabel, { color: textStrong }]}>{node.label}</Text>
        <Text style={[styles.satPlan, { color: textMuted }]}>{node.planLabel}</Text>

        <View
          style={[
            styles.satTokenOrb,
            {
              backgroundColor: isDark ? node.pastelBgDark : node.pastelBgLight,
              borderColor: isSelected ? node.accentColor : cardBorder,
              borderWidth: isSelected ? 2.5 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={node.icon as any}
            size={25}
            color={isDark ? '#FFFFFF' : '#0F172A'}
          />
          <View
            testID={`${testID}-satellite-${node.id}-step`}
            style={[styles.stepBadge, { backgroundColor: node.accentColor }]}
          >
            <Text style={styles.stepBadgeText}>{node.step}</Text>
          </View>
        </View>

        <Text style={[styles.satFact, { color: textStrong }]}>{node.factLabel}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: bgCanvas }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* TAMAGUI HEADER CARD */}
          <View
            style={[
              styles.headerTokenBox,
              {
                backgroundColor: isDark ? '#0F172A' : '#EEF2F8',
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.topRow}>
              <TouchableOpacity
                testID={`${testID}-profile-btn`}
                onPress={() => navigateTo('/pm/project/dashboard')}
                style={[
                  styles.squareIconBtn,
                  { backgroundColor: pillSurface, borderColor: cardBorder },
                ]}
              >
                <PM80BrandLogo size={32} withBackground={true} />
              </TouchableOpacity>

              <View style={styles.titleStack}>
                <Text style={[styles.subtitleToken, { color: textMuted }]}>
                  {snapshot.projectTitle} • {snapshot.projectCount} Active
                </Text>
                <Text
                  testID={`${testID}-hero-header-roi`}
                  style={[styles.headlineToken, { color: textStrong }]}
                >
                  {centerData.formattedProfit} ROI
                </Text>
              </View>

              <TouchableOpacity
                testID={`${testID}-layers-btn`}
                onPress={() => setIncludeAllTaxes((v) => !v)}
                style={[
                  styles.squareIconBtn,
                  {
                    backgroundColor: includeAllTaxes ? primaryToken : pillSurface,
                    borderColor: includeAllTaxes ? primaryToken : cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={22}
                  color={includeAllTaxes ? '#FFFFFF' : textStrong}
                />
              </TouchableOpacity>
            </View>

            {/* Month Switcher Bar */}
            <View style={styles.monthBar}>
              <TouchableOpacity
                testID={`${testID}-prev-month`}
                onPress={handlePrevMonth}
                style={styles.chevronBtn}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={22}
                  color={textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                testID={`${testID}-month-pill`}
                onPress={handleNextMonth}
                activeOpacity={0.85}
                style={[
                  styles.tamaguiMonthPill,
                  { backgroundColor: pillSurface, borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.monthText, { color: textStrong }]}>
                  {snapshot.monthLabel}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={16}
                  color={textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                testID={`${testID}-next-month`}
                onPress={handleNextMonth}
                style={styles.chevronBtn}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* TAMAGUI ELEVATED DASHBOARD SHEET */}
          <View
            style={[
              styles.mainSheet,
              { backgroundColor: cardSurface, borderColor: cardBorder },
            ]}
          >
            {/* ADVANCED CIRCLE ROW ABOVE (Tamagui Bordered Card Style) */}
            <View
              style={[
                styles.advancedCardBox,
                {
                  backgroundColor: isDark ? '#0B1120' : '#F8FAFC',
                  borderColor: cardBorder,
                },
              ]}
            >
              {snapshot.advancedMetrics.map((metric, idx) => {
                const isSelected = selectedMetric?.id === metric.id;
                const ringColor = kpiStrokeColors[idx % kpiStrokeColors.length];
                return (
                  <TouchableOpacity
                    key={metric.id}
                    testID={`${testID}-metric-${metric.id}`}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedNode(null);
                      setSelectedMetric(isSelected ? null : metric);
                    }}
                    style={styles.advancedCol}
                  >
                    <Text
                      style={[styles.advTitle, { color: textStrong }]}
                      numberOfLines={1}
                    >
                      {metric.label}
                    </Text>
                    <View style={styles.advGaugeWrap}>
                      <PM80CircularProgress
                        size={74}
                        strokeWidth={6}
                        progress={metric.progress}
                        trackColor={trackColor}
                        strokeColor={ringColor}
                        startAngle={-90}
                      />
                      <View style={styles.advCenter}>
                        <MaterialCommunityIcons
                          name={metric.icon as any}
                          size={20}
                          color={ringColor}
                        />
                        <Text style={[styles.advVal, { color: textStrong }]}>
                          {metric.valueText}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* TAMAGUI SEGMENTED PILL BAR FOR ROI1..ROI4 & VAT */}
            <View
              style={[
                styles.segmentedBar,
                {
                  backgroundColor: isDark ? '#0B1120' : '#F1F5F9',
                  borderColor: cardBorder,
                },
              ]}
            >
              {ROI_KINDS_ORDER.map((k) => {
                const active = activeRoiKind === k;
                return (
                  <TouchableOpacity
                    key={k}
                    testID={`${testID}-chip-${k}`}
                    onPress={() => setActiveRoiKind(k)}
                    style={[
                      styles.segmentItem,
                      active && {
                        backgroundColor: cardSurface,
                        borderColor: cardBorder,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: active ? '800' : '600',
                        color: active ? primaryToken : textMuted,
                      }}
                    >
                      {k.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                testID={`${testID}-chip-vat`}
                onPress={() => setIncludeAllTaxes((v) => !v)}
                style={[
                  styles.segmentItem,
                  includeAllTaxes && {
                    backgroundColor: primaryToken,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: includeAllTaxes ? '#FFFFFF' : textMuted,
                  }}
                >
                  {includeAllTaxes ? '+VAT ON' : 'NET COST'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ANALOGIC ORBITAL CONSTELLATION */}
            <View style={styles.orbitalArea}>
              {/* Top Pair: 1 Project plan & 2 Purchase orders */}
              <View style={styles.topPairRow}>
                {topNodes.map((n) => renderSatellite(n))}
              </View>

              {/* Middle Band: Left Pair + Central Net ROI Ring + Right Pair */}
              <View style={styles.middleRow}>
                <View style={styles.sideCol}>
                  {renderSatellite(midLeftNode)}
                  {renderSatellite(lowerLeftNode)}
                </View>

                {/* Central Net ROI Ring */}
                <TouchableOpacity
                  testID={`${testID}-center-hub`}
                  activeOpacity={0.9}
                  onPress={handleCycleRoiKind}
                  style={[
                    styles.centerDialOrb,
                    {
                      backgroundColor: cardSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <PM80CircularProgress
                    size={196}
                    strokeWidth={14}
                    progress={Math.round(centerData.goalProgress * 100)}
                    trackColor={trackColor}
                    gradientColors={['#EC4899', '#8B5CF6', '#06B6D4']}
                    gradientId="tamaguiCenterRoiGrad"
                    startAngle={150}
                  />
                  <View style={styles.centerDialInner}>
                    <Text style={[styles.centerTitle, { color: textStrong }]}>
                      {centerData.kindTitle}
                    </Text>
                    <Text
                      testID={`${testID}-center-profit`}
                      style={[
                        styles.centerAmount,
                        { color: isDark ? '#F472B6' : '#6D28D9' },
                      ]}
                    >
                      {centerData.formattedProfit}
                    </Text>
                    <Text style={[styles.centerGoal, { color: textMuted }]}>
                      {centerData.formattedGoal}
                    </Text>
                    <View
                      style={[
                        styles.tamaguiRoiTag,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                          borderColor: cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: primaryToken,
                        }}
                      >
                        {centerData.kind.toUpperCase()} {centerData.formattedRoiPct}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.sideCol}>
                  {renderSatellite(midRightNode)}
                  {renderSatellite(lowerRightNode)}
                </View>
              </View>

              {/* Bottom Pair: 7 Customer invoices & 8 Cash payments */}
              <View style={styles.bottomPairRow}>
                {bottomNodes.map((n) => renderSatellite(n))}
              </View>
            </View>

            {/* BUSINESS ORDER: the 8 real parts of the app as links, in the order a project is run */}
            <PM80FlowStrip
              testID={`${testID}-flow`}
              nodes={flowNodes}
              onOpen={navigateTo}
              isDark={isDark}
              textStrong={textStrong}
              textMuted={textMuted}
              borderColor={cardBorder}
              surface={isDark ? '#0B1120' : '#F8FAFC'}
            />

            {/* INTERACTIVE INSPECTOR TOKEN BANNER */}
            {(selectedNode || selectedMetric) && (
              <View
                testID={`${testID}-inspector-card`}
                style={[
                  styles.inspectorBox,
                  {
                    backgroundColor: isDark ? '#0B1120' : '#F8FAFC',
                    borderColor: cardBorder,
                  },
                ]}
              >
                {selectedNode ? (
                  <View>
                    <View style={styles.inspectorTop}>
                      <View
                        style={[
                          styles.badgeDot,
                          { backgroundColor: selectedNode.accentColor },
                        ]}
                      />
                      <Text style={[styles.inspectorTitle, { color: textStrong }]}>
                        {selectedNode.step}. {selectedNode.label.replace('\n', ' ')} ({selectedNode.genusOrDomain})
                      </Text>
                      <TouchableOpacity
                        onPress={() => navigateTo(selectedNode.route)}
                        style={[
                          styles.openBtn,
                          { backgroundColor: primaryToken },
                        ]}
                      >
                        <Text style={styles.openBtnText}>Open</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.inspectorDesc, { color: textMuted }]}>
                      {selectedNode.description}
                    </Text>
                    <View style={[styles.inspectorMetrics, { borderTopColor: cardBorder }]}>
                      <Text style={{ fontSize: 12, color: textMuted }}>
                        {selectedNode.planCaption}: <Text style={{ fontWeight: '800', color: textStrong }}>{selectedNode.planLabel}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: textMuted }}>
                        {selectedNode.factCaption}: <Text style={{ fontWeight: '800', color: textStrong }}>{selectedNode.factLabel}</Text>
                      </Text>
                    </View>
                  </View>
                ) : selectedMetric ? (
                  <View>
                    <View style={styles.inspectorTop}>
                      <MaterialCommunityIcons
                        name={selectedMetric.icon as any}
                        size={18}
                        color={primaryToken}
                      />
                      <Text style={[styles.inspectorTitle, { color: textStrong }]}>
                        {selectedMetric.label}: {selectedMetric.valueText} ({selectedMetric.sublabel})
                      </Text>
                      <TouchableOpacity
                        onPress={() => navigateTo(selectedMetric.route)}
                        style={[
                          styles.openBtn,
                          { backgroundColor: primaryToken },
                        ]}
                      >
                        <Text style={styles.openBtnText}>Report</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.inspectorDesc, { color: textMuted }]}>
                      {selectedMetric.formulaTip}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* TAMAGUI FLOATING DOCK BAR: reports and team (all real routes) */}
            <View
              style={[
                styles.floatingDock,
                {
                  backgroundColor: isDark ? '#0B1120' : '#F8FAFC',
                  borderColor: cardBorder,
                },
              ]}
            >
              {(['reports', 'team'] as const).map((group) => (
                <View key={group} style={styles.dockGroup}>
                  <Text style={[styles.dockGroupTitle, { color: textMuted }]}>
                    {group === 'reports' ? 'REPORTS' : 'TEAM & MONEY'}
                  </Text>
                  <View style={styles.dockRow}>
                    {PM80_QUICK_LINKS.filter((l) => l.group === group).map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        testID={`${testID}-nav-${l.id}`}
                        onPress={() => navigateTo(l.route)}
                        style={styles.dockItem}
                        accessibilityLabel={l.label}
                      >
                        <MaterialCommunityIcons
                          name={l.icon as any}
                          size={20}
                          color={primaryToken}
                        />
                        <Text
                          numberOfLines={1}
                          style={[styles.dockLabel, { color: textStrong }]}
                        >
                          {l.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {group === 'team' && onSwitchStyle && (
                      <TouchableOpacity
                        testID={`${testID}-switch-paper`}
                        onPress={onSwitchStyle}
                        style={styles.dockItem}
                      >
                        <MaterialCommunityIcons
                          name="layers-outline"
                          size={20}
                          color="#8B5CF6"
                        />
                        <Text style={[styles.dockLabel, { color: '#8B5CF6', fontWeight: '800' }]}>
                          Paper MD3
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 36,
  },
  maxContainer: {
    width: '100%',
    maxWidth: 480,
  },
  headerTokenBox: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  squareIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    alignItems: 'center',
    flex: 1,
  },
  subtitleToken: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  headlineToken: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  chevronBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tamaguiMonthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  monthText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  mainSheet: {
    marginTop: 10,
    marginHorizontal: 10,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  advancedCardBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  advancedCol: {
    alignItems: 'center',
    flex: 1,
  },
  advTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 7,
  },
  advGaugeWrap: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  advCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  advVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  segmentedBar: {
    flexDirection: 'row',
    width: '100%',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitalArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  topPairRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    marginBottom: 6,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 4,
  },
  sideCol: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 18,
    width: 84,
  },
  centerDialOrb: {
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  centerDialInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  centerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  centerAmount: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginVertical: 2,
  },
  centerGoal: {
    fontSize: 12,
    fontWeight: '600',
  },
  tamaguiRoiTag: {
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  bottomPairRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    marginTop: 6,
  },
  satWrapper: {
    alignItems: 'center',
    width: 82,
  },
  satLabel: {
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 14,
  },
  satPlan: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
    marginBottom: 5,
  },
  satTokenOrb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  satFact: {
    fontSize: 13,
    fontWeight: '800',
  },
  inspectorBox: {
    width: '100%',
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  inspectorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  inspectorTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  openBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  inspectorDesc: {
    fontSize: 11.5,
    marginTop: 4,
    lineHeight: 16,
  },
  inspectorMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  floatingDock: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  dockGroup: {
    width: '100%',
  },
  dockGroupTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginLeft: 6,
    marginBottom: 4,
  },
  dockRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  dockItem: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    flex: 1,
  },
  stepBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  dockLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});

