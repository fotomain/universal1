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
import PM80BrandLogo, { pm80LogoWithBackground, PM80_LOGO_DARK_BACKGROUND } from './PM80BrandLogo';
import PM80FlowStrip from './PM80FlowStrip';
import { usePM80Layout } from './pm80Layout';
import { useHomeSettings } from './homeSettings/homeSettingsLocal';
import { gridRows, itemRadius } from './homeSettings/homeSettingsModel';
import { usePM80FlowScroll } from './pm80FlowScroll';
import { usePM80Projects, useBusinessOrderFor } from './businessOrder/useBusinessOrder';
import PM80RoiInfoModal from './roiInfo/PM80RoiInfoModal';
import { roiInfoNumbers } from './roiInfo/roiInfoModel';
import { useDoubleTouch } from './roiInfo/pm80DoubleTouch';
import PM80KpiInfoModal from './kpiInfo/PM80KpiInfoModal';
import type { KpiId } from './kpiInfo/kpiInfoModel';
import { applyBusinessOrder, BUSINESS_ORDER_ROUTE, businessOrderRouteParams } from './businessOrder/businessOrderModel';
import PM80ProjectFilter from './PM80ProjectFilter';
import PM80PeriodPicker from './PM80PeriodPicker';
import PM80Tip from './PM80Tip';
import { openPM80Route } from './pm80OpenRoute';
import {
  PM80_DEFAULT_PERIOD,
  PM80Period,
  shiftPeriod,
  PM80ProjectSelection,
  pm80SnapshotFor,
  normalizeProjectSelection,
  PM80_QUICK_LINKS,
  PM80_TIPS,
  roiKindTip,
  vatBasisTip,
  pm80FlowOf,
  PM80SatelliteNode,
  PM80AdvancedMetric,
  RoiKindKey,
  computePM80Center,
} from './pm80HomeModel';

export interface PM80HomeTamaguiProps {
  /** month and year shown first (default November 2026) */
  initialPeriod?: PM80Period;
  onSwitchStyle?: () => void;
  testID?: string;
}

const ROI_KINDS_ORDER: RoiKindKey[] = ['roi4', 'roi1', 'roi2', 'roi3'];

export default function PM80HomeTamagui({
  initialPeriod = PM80_DEFAULT_PERIOD,
  onSwitchStyle,
  testID = 'pm80-home-tamagui',
}: PM80HomeTamaguiProps) {
  const router = useRouter();
  // the look of the home (items in the first row of the grid, form of the items): kept on this device
  const homeSettings = useHomeSettings();
  const L = usePM80Layout(50, homeSettings.itemsPerRow);
  const flow = usePM80FlowScroll(L.isMobile);
  const [flowActiveId, setFlowActiveId] = useState<string | null>(null);
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

  const [period, setPeriod] = useState<PM80Period>(initialPeriod);
  const [activeRoiKind, setActiveRoiKind] = useState<RoiKindKey>('roi4');
  const [includeAllTaxes, setIncludeAllTaxes] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<PM80SatelliteNode | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<PM80AdvancedMetric | null>(null);

  const [projectSelection, setProjectSelection] = useState<PM80ProjectSelection>(null);

  // the user's REAL projects (the demo list while there are none) and the Business order set up for the selection
  const projectsSource = usePM80Projects();
  const baseSnapshot = useMemo(
    () => pm80SnapshotFor(period, projectSelection, projectsSource.projects),
    [period, projectSelection, projectsSource.projects]
  );
  const businessOrder = useBusinessOrderFor(
    normalizeProjectSelection(projectSelection, projectsSource.projects),
    projectsSource.rows
  );
  const snapshot = useMemo(() => applyBusinessOrder(baseSnapshot, businessOrder), [baseSnapshot, businessOrder]);

  // a double touch on a ROI button: the description of that ROI for a CFO (roiInfo/)
  const doubleTouch = useDoubleTouch();
  const [roiInfoKind, setRoiInfoKind] = useState<RoiKindKey | null>(null);
  // a double touch / double click on the NAME of a KPI ring: its description for a CFO (kpiInfo/)
  const [kpiInfoId, setKpiInfoId] = useState<KpiId | null>(null);
  const onRoiButton = (k: RoiKindKey) => {
    setActiveRoiKind(k);
    if (doubleTouch.touch(`roi-${k}`)) setRoiInfoKind(k);
  };

  /** the layers button: the setup of the Business order (a route of its own; its Back button goes Home) */
  const openBusinessOrderSettings = useCallback(() => {
    try {
      router.push({
        pathname: BUSINESS_ORDER_ROUTE,
        params: businessOrderRouteParams(normalizeProjectSelection(projectSelection, projectsSource.projects)),
      } as any);
    } catch {
      // route unavailable (standalone test)
    }
  }, [router, projectSelection, projectsSource.projects]);

  const centerData = useMemo(
    () =>
      computePM80Center(snapshot, activeRoiKind, {
        includeSaleVat: includeAllTaxes,
        includePurchaseVat: includeAllTaxes,
      }),
    [snapshot, activeRoiKind, includeAllTaxes]
  );

  const handlePrevMonth = useCallback(() => {
    setPeriod((prev) => shiftPeriod(prev, -1) ?? prev);
  }, []);

  const handleNextMonth = useCallback(() => {
    setPeriod((prev) => shiftPeriod(prev, 1) ?? prev);
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

  // Tamagui Token Palette
  const bgCanvas = isDark ? '#090D16' : '#F1F5F9';
  const cardSurface = isDark ? '#111827' : '#FFFFFF';
  const cardBorder = isDark ? '#1E293B' : '#E2E8F0';
  const textStrong = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const pillSurface = isDark ? '#1E293B' : '#FFFFFF';
  const trackColor = isDark ? '#1E293B' : '#E2E8F0';

  const kpiStrokeColors = ['#6366F1', '#8B5CF6', '#10B981', '#D946EF'];

  /** one row of the grid: the items side by side, centered (the last row may be shorter) */
  const renderGridRow = (row: PM80SatelliteNode[], index: number) => (
    <View key={`row-${index}`} testID={`${testID}-grid-row-${index}`} style={[styles.gridRow, { columnGap: L.itemGap }]}>
      {row.map((n) => renderSatellite(n))}
    </View>
  );

  const renderSatellite = (node?: PM80SatelliteNode) => {
    if (!node) return null;
    const isSelected = selectedNode?.id === node.id;

    return (
      <PM80Tip key={node.id} tip={node.tip}><TouchableOpacity
        testID={`${testID}-satellite-${node.id}`}
        activeOpacity={0.85}
        onPress={() => {
          setSelectedMetric(null);
          setSelectedNode(isSelected ? null : node);
          // phone: the Business order panel goes to the top and shows this step and the next one
          setFlowActiveId(node.id);
          flow.scrollToFlow();
        }}
        style={[styles.satWrapper, { width: L.sat }]}
      >
        <Text style={[styles.satLabel, { color: textStrong }]}>{node.label}</Text>
        <Text style={[styles.satPlan, { color: textMuted }]}>{node.planLabel}</Text>

        <View
          style={[
            styles.satTokenOrb,
            {
              width: L.satCircle,
              height: L.satCircle,
              borderRadius: itemRadius(homeSettings.itemShape, L.satCircle),
              backgroundColor: isDark ? node.pastelBgDark : node.pastelBgLight,
              borderColor: isSelected ? node.accentColor : cardBorder,
              borderWidth: isSelected ? 2.5 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={node.icon as any}
            size={Math.round(L.satCircle * 0.43)}
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
      </TouchableOpacity></PM80Tip>
    );
  };

  const kpiEl = (
    <>
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
                  <PM80Tip key={metric.id} tip={`${metric.label}: ${metric.formulaTip} Double tap for the full description.`} style={{ flex: 1 }}><TouchableOpacity
                    testID={`${testID}-metric-${metric.id}`}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedNode(null);
                      setSelectedMetric(isSelected ? null : metric);
                      if (doubleTouch.touch(`kpi-${metric.id}`)) setKpiInfoId(metric.id as KpiId);
                    }}
                    style={styles.advancedCol}
                  >
                    <Text
                      style={[styles.advTitle, { color: textStrong, fontSize: L.kpi < 70 ? 10.5 : 11.5, minHeight: 28, textAlign: 'center' }]}
                      numberOfLines={2}
                    >
                      {metric.label}
                    </Text>
                    <View style={[styles.advGaugeWrap, { width: L.kpi, height: L.kpi }]}>
                      <PM80CircularProgress
                        size={L.kpi}
                        strokeWidth={Math.max(4, Math.round(L.kpi / 12))}
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
                  </TouchableOpacity></PM80Tip>
                );
              })}
            </View>
    </>
  );

  const chipsEl = (
    <>
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
                  <PM80Tip key={k} tip={roiKindTip(k)} style={{ flex: 1 }}><TouchableOpacity
                    testID={`${testID}-chip-${k}`}
                    onPress={() => onRoiButton(k)}
                    style={[
                      styles.segmentItem,
                      active && {
                        backgroundColor: cardSurface,
                        borderColor: cardBorder,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    {active && (
                      <MaterialCommunityIcons
                        testID={`${testID}-chip-${k}-check`}
                        name="check"
                        size={13}
                        color={primaryToken}
                        style={{ position: 'absolute', left: 6, top: 9 }}
                      />
                    )}
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: active ? '800' : '600',
                        textAlign: 'center',
                        color: active ? primaryToken : textMuted,
                      }}
                    >
                      {k.toUpperCase()}
                    </Text>
                  </TouchableOpacity></PM80Tip>
                );
              })}

            </View>
    </>
  );

  /** the VAT basis button: under the Net ROI ring */
  const vatEl = (
    <PM80Tip tip={vatBasisTip(includeAllTaxes)}>
      <TouchableOpacity
        testID={`${testID}-chip-vat`}
        onPress={() => setIncludeAllTaxes((v) => !v)}
        style={[
          styles.vatPill,
          { backgroundColor: includeAllTaxes ? primaryToken : pillSurface, borderColor: includeAllTaxes ? primaryToken : cardBorder },
        ]}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: includeAllTaxes ? '#FFFFFF' : textMuted }}>
          {includeAllTaxes ? '+VAT ON' : 'NET COST'}
        </Text>
      </TouchableOpacity>
    </PM80Tip>
  );

  const hubEl = (
    <View style={styles.hubColumn}>
                {/* Central Net ROI Ring */}
                <PM80Tip tip={PM80_TIPS.hub}><TouchableOpacity
                  testID={`${testID}-center-hub`}
                  activeOpacity={0.9}
                  onPress={handleCycleRoiKind}
                  style={[
                    styles.centerDialOrb,
                    {
                      width: L.hub,
                      height: L.hub,
                      borderRadius: L.hub / 2,
                      backgroundColor: cardSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <PM80CircularProgress
                    size={L.hub}
                    strokeWidth={Math.round(14 * L.scale)}
                    progress={Math.round(centerData.goalProgress * 100)}
                    trackColor={trackColor}
                    gradientColors={['#EC4899', '#8B5CF6', '#06B6D4']}
                    gradientId="tamaguiCenterRoiGrad"
                    startAngle={150}
                  />
                  <View style={styles.centerDialInner}>
                    <Text style={[styles.centerTitle, { color: textStrong, fontSize: Math.round(15 * L.scale) }]}>
                      {centerData.kindTitle}
                    </Text>
                    <Text
                      testID={`${testID}-center-profit`}
                      style={[
                        styles.centerAmount,
                        { color: isDark ? '#F472B6' : '#6D28D9', fontSize: Math.round(25 * L.scale) },
                      ]}
                    >
                      {centerData.formattedProfit}
                    </Text>
                    <Text style={[styles.centerGoal, { color: textMuted, fontSize: Math.max(10, Math.round(12 * L.scale)) }]}>
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
                </TouchableOpacity></PM80Tip>
      {vatEl}
    </View>
  );

  return (
    <View testID={testID} onLayout={L.onLayout} style={[styles.root, { backgroundColor: bgCanvas }]}>
      <ScrollView
        ref={flow.scrollRef}
        {...flow.scrollViewProps}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.maxContainer, { maxWidth: L.bodyMax }]}>
          {/* TAMAGUI HEADER CARD */}
          <View
            style={[
              styles.headerTokenBox,
              L.isLandscape && { paddingTop: 8, paddingBottom: 8 },
              {
                backgroundColor: isDark ? '#0F172A' : '#EEF2F8',
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={[styles.topRow, L.isLandscape && { marginBottom: 4 }]}>
              <PM80Tip tip={PM80_TIPS.profile}><TouchableOpacity
                testID={`${testID}-profile-btn`}
                onPress={() => navigateTo('/pm/project/dashboard')}
                style={[
                  styles.squareIconBtn,
                  { backgroundColor: pillSurface, borderColor: cardBorder },
                ]}
              >
                <PM80BrandLogo size={32} withBackground={pm80LogoWithBackground(isDark)} backgroundColor={PM80_LOGO_DARK_BACKGROUND} />
              </TouchableOpacity></PM80Tip>

              <View style={styles.titleStack}>
                <PM80ProjectFilter
                projects={projectsSource.projects}
                  testID={`${testID}-project-filter`}
                  selection={projectSelection}
                  onChange={setProjectSelection}
                  isDark={isDark}
                  textStrong={textStrong}
                  textMuted={textMuted}
                  accent={primaryToken}
                  surface={cardSurface}
                  borderColor={cardBorder}
                />
                <Text
                  testID={`${testID}-hero-header-roi`}
                  style={[styles.headlineToken, { color: textStrong }]}
                >
                  {centerData.formattedProfit} ROI
                </Text>
              </View>

              <PM80Tip tip={PM80_TIPS.businessOrder}><TouchableOpacity
                testID={`${testID}-layers-btn`}
                onPress={openBusinessOrderSettings}
                accessibilityLabel="Business order settings"
                style={[
                  styles.squareIconBtn,
                  { backgroundColor: pillSurface, borderColor: cardBorder },
                ]}
              >
                <MaterialCommunityIcons
                  name="layers-triple-outline"
                  size={22}
                  color={textStrong}
                />
              </TouchableOpacity></PM80Tip>
            </View>

            {/* Month Switcher Bar */}
            <View style={styles.monthBar}>
              <View style={{ width: 34 }} />
            <PM80Tip tip={PM80_TIPS.prevMonth}><TouchableOpacity
                testID={`${testID}-prev-month`}
                onPress={handlePrevMonth}
                style={styles.chevronBtn}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={22}
                  color={textMuted}
                />
              </TouchableOpacity></PM80Tip>

              <PM80PeriodPicker
                testID={testID}
                period={period}
                onChange={setPeriod}
                isDark={isDark}
                textStrong={textStrong}
                textMuted={textMuted}
                accent={primaryToken}
                borderColor={cardBorder}
                pillBackground={pillSurface}
                pillBorderColor={cardBorder}
              />

              <PM80Tip tip={PM80_TIPS.nextMonth}><TouchableOpacity
                testID={`${testID}-next-month`}
                onPress={handleNextMonth}
                style={styles.chevronBtn}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={textMuted}
                />
              </TouchableOpacity></PM80Tip>
            </View>
          </View>

          {/* TAMAGUI ELEVATED DASHBOARD SHEET */}
          <View
            onLayout={flow.onBodyLayout}
            style={[
              styles.mainSheet,
              { backgroundColor: cardSurface, borderColor: cardBorder },
            ]}
          >
            {L.isLandscape ? (
              /* LANDSCAPE: hub + chips on the left, KPI rings + the 8 circles (4 x 2, business order) on the right */
              <View style={styles.landRow}>
                <View style={[styles.landLeft, { width: L.leftW }]}>
                  {chipsEl}
                <View style={styles.landHubSlot}>{hubEl}</View>
              
                </View>
                <View style={styles.landRight}>
                  {kpiEl}
                  <View style={styles.landGrid}>
                    {gridRows(flowNodes, L.itemsPerRow).map((row, i) => renderGridRow(row, i))}
                  </View>
                </View>
              </View>
            ) : (
              <>
                {kpiEl}
                {chipsEl}
            {/* PORTRAIT: the Net ROI ring on top, under it the 8 items in a grid of `itemsPerRow` (home settings; 3 by default) */}
              <View testID={`${testID}-hub-slot`} style={{ alignItems: 'center', marginVertical: 8 }}>{hubEl}</View>
              <View testID={`${testID}-grid`} style={styles.landGrid}>
                {gridRows(flowNodes, L.itemsPerRow).map((row, i) => renderGridRow(row, i))}
              </View>
            </>
            )}

            {/* BUSINESS ORDER: the 8 real parts of the app as links, in the order a project is run */}
            <PM80FlowStrip
              testID={`${testID}-flow`}
              activeId={flowActiveId}
              onLayout={flow.onPanelLayout}
            viewRef={flow.panelRef}
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
                      <PM80Tip key={l.id} tip={l.tip} style={{ flex: 1 }}><TouchableOpacity
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
                          numberOfLines={2}
                          style={[styles.dockLabel, { color: textStrong, textAlign: 'center' }]}
                        >
                          {l.label}
                        </Text>
                      </TouchableOpacity></PM80Tip>
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
          {/* phone: room under the page so that the Business order panel can reach the top of the screen */}
          {flow.spacerH > 0 && <View testID={`${testID}-flow-spacer`} style={{ height: flow.spacerH }} />}
        </View>
      </ScrollView>
      <PM80KpiInfoModal
        testID={`${testID}-kpi-info`}
        id={kpiInfoId}
        snapshot={baseSnapshot}
        onClose={() => setKpiInfoId(null)}
        isDark={isDark}
        textStrong={textStrong}
        textMuted={textMuted}
        accent={primaryToken}
        borderColor={cardBorder}
      />
      <PM80RoiInfoModal
        testID={`${testID}-roi-info`}
        kind={roiInfoKind}
        numbers={roiInfoKind ? roiInfoNumbers(snapshot, roiInfoKind, { includeSaleVat: includeAllTaxes, includePurchaseVat: includeAllTaxes }) : null}
        onClose={() => setRoiInfoKind(null)}
        isDark={isDark}
        textStrong={textStrong}
        textMuted={textMuted}
        accent={primaryToken}
        borderColor={cardBorder}
      />
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
    paddingHorizontal: 0,
  },
  chevronBtn: {
    width: 30,
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
  landRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: 16,
  },
  // the left column is as tall as the right one: the buttons on top, the big ring CENTERED (both ways) in the rest
  landLeft: {
    alignItems: 'stretch',
  },
  landHubSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  landRight: {
    flex: 1,
  },
  landGrid: {
    rowGap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  hubColumn: {
    alignItems: 'center',
    gap: 10,
  },
  vatPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  badgeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  inspectorTitle: {
    minWidth: 150,
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

