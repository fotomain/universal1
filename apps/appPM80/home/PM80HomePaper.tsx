import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Surface,
  Text,
  Chip,
  useTheme,
  Divider,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../kit8/providers/WithDesignSystem';
import PM80CircularProgress from './PM80CircularProgress';
import PM80BrandLogo, { pm80LogoWithBackground, PM80_LOGO_DARK_BACKGROUND } from './PM80BrandLogo';
import PM80FlowStrip from './PM80FlowStrip';
import { usePM80Layout } from './pm80Layout';
import { useHomeSettings, saveHomeSettingsLocal } from './homeSettings/homeSettingsLocal';
import { gridRows, itemRadius } from './homeSettings/homeSettingsModel';
import PM80HomeSettingsModal from './homeSettings/PM80HomeSettingsModal';
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
  ROI_KIND_META,
  computePM80Center,
} from './pm80HomeModel';

export interface PM80HomePaperProps {
  /** month and year shown first (default November 2026) */
  initialPeriod?: PM80Period;
  onSwitchStyle?: () => void;
  testID?: string;
}

const ROI_KINDS_ORDER: RoiKindKey[] = ['roi4', 'roi1', 'roi2', 'roi3'];

export default function PM80HomePaper({
  initialPeriod = PM80_DEFAULT_PERIOD,
  onSwitchStyle,
  testID = 'pm80-home-paper',
}: PM80HomePaperProps) {
  const theme = useTheme();
  // the look of the home (items in the first row of the grid, form of the items): kept on this device
  const homeSettings = useHomeSettings();
  const [homeSettingsOpen, setHomeSettingsOpen] = useState(false);
  const L = usePM80Layout(28, homeSettings.itemsPerRow);
  const flow = usePM80FlowScroll(L.isMobile);
  const [flowActiveId, setFlowActiveId] = useState<string | null>(null);
  const router = useRouter();
  let isDark = false;
  try {
    const ds = useDesignSystem();
    if (ds && typeof ds.isDark === 'boolean') {
      isDark = ds.isDark;
    }
  } catch {
    // fallback if outside provider
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

  // MD3 Surface Palette
  const bgHeader = isDark ? '#141218' : '#F3EDF7';
  const bgMain = isDark ? '#0F0D13' : '#FAF8FC';
  const pillBg = isDark ? '#2B2930' : '#E3DDF3';
  const textPrimary = isDark ? '#F5EFF7' : '#1D1B20';
  const textSecondary = isDark ? '#CAC4D0' : '#625B71';
  const ringTrack = isDark ? '#2B2930' : '#E6E0E9';
  const kpiRingColor = isDark ? '#D0BCFF' : '#7C749B';

  /** one row of the grid: the items side by side, centered (the last row may be shorter) */
  const renderGridRow = (row: PM80SatelliteNode[], index: number) => (
    <View key={`row-${index}`} testID={`${testID}-grid-row-${index}`} style={[styles.gridRow, { columnGap: L.itemGap }]}>
      {row.map((n) => renderSatellite(n))}
    </View>
  );

  const renderSatellite = (node?: PM80SatelliteNode) => {
    if (!node) return null;
    const isSelected = selectedNode?.id === node.id;
    const circleBg = isDark ? node.pastelBgDark : node.pastelBgLight;
    const iconColor = isDark ? '#F8FAFC' : '#1E293B';

    return (
      <PM80Tip key={node.id} tip={node.tip}><TouchableOpacity
        testID={`${testID}-satellite-${node.id}`}
        activeOpacity={0.82}
        onPress={() => {
          setSelectedMetric(null);
          setSelectedNode(isSelected ? null : node);
          // phone: the Business order panel goes to the top and shows this step and the next one
          setFlowActiveId(node.id);
          flow.scrollToFlow();
        }}
        style={[styles.satelliteContainer, { width: L.sat }]}
      >
        <Text
          variant="labelMedium"
          style={[styles.satLabel, { color: textPrimary }]}
        >
          {node.label}
        </Text>
        <Text
          variant="labelSmall"
          style={[styles.satPlanText, { color: textSecondary }]}
        >
          {node.planLabel}
        </Text>

        <Surface
          elevation={isSelected ? 4 : 2}
          style={[
            styles.satCircle,
            {
              width: L.satCircle,
              height: L.satCircle,
              borderRadius: itemRadius(homeSettings.itemShape, L.satCircle),
              backgroundColor: circleBg,
              borderColor: isSelected ? node.accentColor : 'transparent',
              borderWidth: isSelected ? 2.5 : 0,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={node.icon as any}
            size={Math.round(L.satCircle * 0.45)}
            color={iconColor}
          />
          <View
            testID={`${testID}-satellite-${node.id}-step`}
            style={[styles.stepBadge, { backgroundColor: node.accentColor }]}
          >
            <Text style={styles.stepBadgeText}>{node.step}</Text>
          </View>
        </Surface>

        <Text
          variant="labelLarge"
          style={[styles.satFactText, { color: textPrimary }]}
        >
          {node.factLabel}
        </Text>
      </TouchableOpacity></PM80Tip>
    );
  };

  const kpiEl = (
    <>
          {/* ADVANCED CIRCLE ROW ABOVE (Efficiency, Utilization, Risk Rate, Quality) */}
          <View style={styles.advancedRow}>
            {snapshot.advancedMetrics.map((metric) => {
              const isMetricSelected = selectedMetric?.id === metric.id;
              return (
                <PM80Tip key={metric.id} tip={`${metric.label}: ${metric.formulaTip} Double tap for the full description.`} style={{ flex: 1 }}><TouchableOpacity
                  testID={`${testID}-metric-${metric.id}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedNode(null);
                    setSelectedMetric(isMetricSelected ? null : metric);
                    if (doubleTouch.touch(`kpi-${metric.id}`)) setKpiInfoId(metric.id as KpiId);
                  }}
                  style={styles.advancedItem}
                >
                  <Text
                    variant="labelMedium"
                    style={[styles.advancedLabel, { color: textPrimary, fontSize: L.kpi < 70 ? 11 : 12, minHeight: 30, textAlign: 'center' }]}
                    numberOfLines={2}
                  >
                    {metric.label}
                  </Text>
                  <View style={[styles.gaugeBox, { width: L.kpi, height: L.kpi }]}>
                    <PM80CircularProgress
                      size={L.kpi}
                      strokeWidth={Math.max(4, Math.round(L.kpi / 12))}
                      progress={metric.progress}
                      trackColor={ringTrack}
                      strokeColor={
                        isMetricSelected ? theme.colors.primary : kpiRingColor
                      }
                      startAngle={-90}
                    />
                    <View style={styles.gaugeInnerOverlay}>
                      <MaterialCommunityIcons
                        name={metric.icon as any}
                        size={Math.round(L.kpi * 0.29)}
                        color={textPrimary}
                      />
                      <Text
                        variant="labelLarge"
                        style={[styles.gaugePctText, { color: textPrimary }]}
                      >
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
          {/* ROI KIND SELECTOR PILLS (ROI1..ROI4 + VAT Basis from ROI_DOC.html) */}
          <View style={styles.roiKindChipsRow}>
            {ROI_KINDS_ORDER.map((k) => {
              const active = activeRoiKind === k;
              return (
                <PM80Tip key={k} tip={roiKindTip(k)} style={styles.kindChipCell}>
                  {/* the name is always CENTERED; the selected button has a check mark at its left, inside */}
                  <TouchableOpacity
                    testID={`${testID}-chip-${k}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.8}
                    onPress={() => onRoiButton(k)}
                    style={[
                      styles.roiBtn,
                      {
                        borderColor: active ? 'transparent' : isDark ? '#938F99' : '#79747E',
                        backgroundColor: active ? (isDark ? '#4F378B' : '#EADDFF') : 'transparent',
                      },
                    ]}
                  >
                    {active && (
                      <MaterialCommunityIcons
                        testID={`${testID}-chip-${k}-check`}
                        name="check"
                        size={12}
                        color={isDark ? '#E8DEF8' : '#1D192B'}
                        style={styles.roiBtnCheck}
                      />
                    )}
                    <Text
                      style={[
                        styles.roiBtnText,
                        { color: active ? (isDark ? '#E8DEF8' : '#1D192B') : textPrimary, fontWeight: active ? '700' : '500' },
                      ]}
                    >
                      {k.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                </PM80Tip>
              );
            })}

          </View>
    </>
  );

  /** the VAT basis button: under the Net ROI ring */
  const vatEl = (
            <PM80Tip tip={vatBasisTip(includeAllTaxes)}><Chip
              testID={`${testID}-chip-vat`}
              selected={includeAllTaxes}
              compact
              mode={includeAllTaxes ? 'flat' : 'outlined'}
              icon="percent-outline"
              onPress={() => setIncludeAllTaxes((v) => !v)}
              style={styles.kindChip}
              textStyle={{ fontSize: 11 }}
            >
              {includeAllTaxes ? 'Gross (+VAT)' : 'IFRS Cost'}
            </Chip></PM80Tip>
  );

  const hubEl = (
    <View style={styles.hubColumn}>
              {/* CENTER HUB: Net ROI Ring */}
              <PM80Tip tip={PM80_TIPS.hub}><TouchableOpacity
                testID={`${testID}-center-hub`}
                activeOpacity={0.9}
                onPress={handleCycleRoiKind}
                style={styles.centerHubTouchable}
              >
                <Surface
                  elevation={3}
                  style={[
                    styles.centerHubSurface,
                    {
                      width: L.hub,
                      height: L.hub,
                      borderRadius: L.hub / 2,
                      backgroundColor: isDark ? '#1D1B20' : '#FFFFFF',
                    },
                  ]}
                >
                  <PM80CircularProgress
                    size={L.hub}
                    strokeWidth={Math.round(13 * L.scale)}
                    progress={Math.round(centerData.goalProgress * 100)}
                    trackColor={ringTrack}
                    gradientColors={['#D946EF', '#7C3AED', '#2563EB']}
                    gradientId="paperCenterRoiGrad"
                    startAngle={150}
                  />
                  <View style={styles.centerHubTextOverlay}>
                    <Text
                      variant="titleMedium"
                      style={[styles.centerNetRoiLabel, { color: textPrimary, fontSize: Math.round(15 * L.scale) }]}
                    >
                      {centerData.kindTitle}
                    </Text>
                    <Text
                      testID={`${testID}-center-profit`}
                      style={[
                        styles.centerHeroAmount,
                        { color: isDark ? '#E9D5FF' : '#7E22CE', fontSize: Math.round(25 * L.scale) },
                      ]}
                    >
                      {centerData.formattedProfit}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[styles.centerGoalLabel, { color: textSecondary, fontSize: Math.max(10, Math.round(12 * L.scale)) }]}
                    >
                      {centerData.formattedGoal}
                    </Text>
                    <View
                      style={[
                        styles.centerRoiBadge,
                        {
                          backgroundColor: isDark ? '#332D41' : '#F3EDF7',
                        },
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={{
                          color: isDark ? '#D0BCFF' : '#6750A4',
                          fontWeight: '700',
                        }}
                      >
                        {centerData.kind.toUpperCase()}: {centerData.formattedRoiPct}
                      </Text>
                    </View>
                  </View>
                </Surface>
              </TouchableOpacity></PM80Tip>
      {vatEl}
    </View>
  );

  return (
    <Surface
      testID={testID}
      onLayout={L.onLayout}
      style={[styles.root, { backgroundColor: bgMain }]}
      elevation={0}
    >
      <ScrollView
        ref={flow.scrollRef}
        {...flow.scrollViewProps}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP HEADER SECTION (Matches reference upper header + MD3 styling) */}
        <Surface
          style={[styles.topHeaderArea, { backgroundColor: bgHeader, maxWidth: L.bodyMax }, L.isLandscape && { paddingTop: 8, paddingBottom: 8 }]}
          elevation={0}
        >
          <View style={[styles.headerTopRow, L.isLandscape && { marginBottom: 4 }]}>
            <PM80Tip tip={PM80_TIPS.profile}><TouchableOpacity
              testID={`${testID}-profile-btn`}
              onPress={() => navigateTo('/pm/project/dashboard')}
              style={styles.iconCircleBtn}
              accessibilityLabel="Open Project Dashboard"
            >
              <PM80BrandLogo size={36} withBackground={pm80LogoWithBackground(isDark)} backgroundColor={PM80_LOGO_DARK_BACKGROUND} />
            </TouchableOpacity></PM80Tip>

            <View style={styles.headerCenterTitle}>
              <PM80ProjectFilter
                projects={projectsSource.projects}
                testID={`${testID}-project-filter`}
                selection={projectSelection}
                onChange={setProjectSelection}
                isDark={isDark}
                textStrong={textPrimary}
                textMuted={textSecondary}
                accent={theme.colors.primary}
                surface={bgHeader}
                borderColor={ringTrack}
              />
              <Text
                testID={`${testID}-hero-header-roi`}
                variant="headlineSmall"
                style={[styles.headerRoiHeadline, { color: textPrimary }]}
              >
                {centerData.formattedProfit} ROI
              </Text>
            </View>

            <PM80Tip tip={PM80_TIPS.businessOrder}><TouchableOpacity
              testID={`${testID}-layers-btn`}
              onPress={openBusinessOrderSettings}
              style={styles.iconCircleBtn}
              accessibilityLabel="Business order settings"
            >
              <MaterialCommunityIcons
                name="layers-triple-outline"
                size={26}
                color={textPrimary}
              />
            </TouchableOpacity></PM80Tip>
          </View>

          {/* Month Navigation Row */}
          <View style={styles.monthNavRow}>
            <View style={{ width: 34 }} />
            <PM80Tip tip={PM80_TIPS.prevMonth}><TouchableOpacity
              testID={`${testID}-prev-month`}
              onPress={handlePrevMonth}
              style={styles.monthArrowBtn}
              accessibilityLabel="Previous month"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color={textSecondary}
              />
            </TouchableOpacity></PM80Tip>

            <PM80PeriodPicker
              testID={testID}
              period={period}
              onChange={setPeriod}
              isDark={isDark}
              textStrong={textPrimary}
              textMuted={textSecondary}
              accent={theme.colors.primary}
              borderColor={ringTrack}
              pillBackground={pillBg}
            />

            <PM80Tip tip={PM80_TIPS.nextMonth}><TouchableOpacity
              testID={`${testID}-next-month`}
              onPress={handleNextMonth}
              style={styles.monthArrowBtn}
              accessibilityLabel="Next month"
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={textSecondary}
              />
            </TouchableOpacity></PM80Tip>
            <PM80Tip tip="Home settings: items in the first row, form of the items"><TouchableOpacity
              testID={`${testID}-settings-btn`}
              onPress={() => setHomeSettingsOpen(true)}
              style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel="Home settings"
            >
              <MaterialCommunityIcons name="tune-variant" size={22} color={textSecondary} />
            </TouchableOpacity></PM80Tip>
          </View>
        </Surface>

        {/* MAIN WHITE/SURFACE CARD BODY */}
        <View style={[styles.bodyWrapper, { maxWidth: L.bodyMax }]} onLayout={flow.onBodyLayout}>
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
            textStrong={textPrimary}
            textMuted={textSecondary}
            borderColor={ringTrack}
            surface={isDark ? '#1D1B20' : '#F7F2FA'}
          />

          {/* INTERACTIVE INSPECTOR DRAWER CARD (When user taps any circle) */}
          {(selectedNode || selectedMetric) && (
            <Surface
              testID={`${testID}-inspector-card`}
              elevation={2}
              style={[
                styles.inspectorCard,
                {
                  backgroundColor: isDark ? '#1E1A24' : '#F3EDF7',
                  borderColor: isDark ? '#49454F' : '#CAC4D0',
                },
              ]}
            >
              {selectedNode ? (
                <View style={styles.inspectorContent}>
                  <View style={styles.inspectorHeaderRow}>
                    <View
                      style={[
                        styles.inspectorDot,
                        { backgroundColor: selectedNode.accentColor },
                      ]}
                    />
                    <Text
                      variant="titleSmall"
                      style={{ color: textPrimary, fontWeight: '700', flex: 1, minWidth: 150 }}
                    >
                      {selectedNode.step}. {selectedNode.label.replace('\n', ' ')} •{' '}
                      {selectedNode.genusOrDomain}
                    </Text>
                    <Chip
                      compact
                      onPress={() => navigateTo(selectedNode.route)}
                      icon="arrow-top-right"
                    >
                      Open {selectedNode.label.replace('\n', ' ')}
                    </Chip>
                  </View>
                  <Text
                    variant="bodySmall"
                    style={{ color: textSecondary, marginTop: 4 }}
                  >
                    {selectedNode.description}
                  </Text>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.inspectorNumbersRow}>
                    <Text variant="labelMedium" style={{ color: textSecondary }}>
                      {selectedNode.planCaption}: <Text style={{ fontWeight: '700', color: textPrimary }}>{selectedNode.planLabel}</Text>
                    </Text>
                    <Text variant="labelMedium" style={{ color: textSecondary }}>
                      {selectedNode.factCaption}: <Text style={{ fontWeight: '700', color: textPrimary }}>{selectedNode.factLabel}</Text>
                    </Text>
                  </View>
                </View>
              ) : selectedMetric ? (
                <View style={styles.inspectorContent}>
                  <View style={styles.inspectorHeaderRow}>
                    <MaterialCommunityIcons
                      name={selectedMetric.icon as any}
                      size={20}
                      color={theme.colors.primary}
                    />
                    <Text
                      variant="titleSmall"
                      style={{ color: textPrimary, fontWeight: '700', flex: 1, minWidth: 150 }}
                    >
                      {selectedMetric.label} ({selectedMetric.valueText}) •{' '}
                      {selectedMetric.sublabel}
                    </Text>
                    <Chip
                      compact
                      onPress={() => navigateTo(selectedMetric.route)}
                      icon="arrow-top-right"
                    >
                      Open Report
                    </Chip>
                  </View>
                  <Text
                    variant="bodySmall"
                    style={{ color: textSecondary, marginTop: 4 }}
                  >
                    {selectedMetric.formulaTip}
                  </Text>
                </View>
              ) : null}
            </Surface>
          )}

          {/* QUICK LINKS: reports and team (all real routes) */}
          <Surface
            elevation={1}
            style={[
              styles.bottomQuickNav,
              {
                backgroundColor: isDark ? '#1D1B20' : '#F7F2FA',
                borderColor: ringTrack,
              },
            ]}
          >
            {(['reports', 'team'] as const).map((group) => (
              <View key={group} style={styles.quickNavGroup}>
                <Text variant="labelSmall" style={[styles.quickNavGroupTitle, { color: textSecondary }]}>
                  {group === 'reports' ? 'REPORTS' : 'TEAM & MONEY'}
                </Text>
                <View style={styles.quickNavRow}>
                  {PM80_QUICK_LINKS.filter((l) => l.group === group).map((l) => (
                    <PM80Tip key={l.id} tip={l.tip} style={{ flex: 1 }}><TouchableOpacity
                      testID={`${testID}-nav-${l.id}`}
                      onPress={() => navigateTo(l.route)}
                      style={styles.quickNavBtn}
                      accessibilityLabel={l.label}
                    >
                      <MaterialCommunityIcons
                        name={l.icon as any}
                        size={20}
                        color={theme.colors.primary}
                      />
                      <Text
                        variant="labelSmall"
                        numberOfLines={2}
                        style={{ color: textPrimary, fontWeight: '600', textAlign: 'center' }}
                      >
                        {l.label}
                      </Text>
                    </TouchableOpacity></PM80Tip>
                  ))}
                  {group === 'team' && onSwitchStyle && (
                    <TouchableOpacity
                      testID={`${testID}-switch-tamagui`}
                      onPress={onSwitchStyle}
                      style={styles.quickNavBtn}
                    >
                      <MaterialCommunityIcons
                        name="palette-swatch-outline"
                        size={20}
                        color="#D946EF"
                      />
                      <Text variant="labelSmall" style={{ color: '#D946EF', fontWeight: '700' }}>
                        Tamagui UI
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </Surface>
        </View>
        {/* phone: room under the page so that the Business order panel can reach the top of the screen */}
        {flow.spacerH > 0 && <View testID={`${testID}-flow-spacer`} style={{ height: flow.spacerH }} />}
      </ScrollView>
      <PM80KpiInfoModal
        testID={`${testID}-kpi-info`}
        id={kpiInfoId}
        snapshot={baseSnapshot}
        onClose={() => setKpiInfoId(null)}
        isDark={isDark}
        textStrong={textPrimary}
        textMuted={textSecondary}
        accent={theme.colors.primary}
        borderColor={ringTrack}
      />
      <PM80HomeSettingsModal
        testID={`${testID}-settings`}
        visible={homeSettingsOpen}
        settings={homeSettings}
        onChange={saveHomeSettingsLocal}
        onClose={() => setHomeSettingsOpen(false)}
        isDark={isDark}
        textStrong={textPrimary}
        textMuted={textSecondary}
        accent={theme.colors.primary}
        borderColor={ringTrack}
      />
      <PM80RoiInfoModal
        testID={`${testID}-roi-info`}
        kind={roiInfoKind}
        numbers={roiInfoKind ? roiInfoNumbers(snapshot, roiInfoKind, { includeSaleVat: includeAllTaxes, includePurchaseVat: includeAllTaxes }) : null}
        onClose={() => setRoiInfoKind(null)}
        isDark={isDark}
        textStrong={textPrimary}
        textMuted={textSecondary}
        accent={theme.colors.primary}
        borderColor={ringTrack}
      />
    </Surface>
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
  topHeaderArea: {
    width: '100%',
    maxWidth: 480,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterTitle: {
    alignItems: 'center',
    flex: 1,
  },
  allProjectsLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerRoiHeadline: {
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  monthArrowBtn: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 6,
  },
  monthPillText: {
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  bodyWrapper: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 14,
    paddingTop: 16,
    alignItems: 'center',
  },
  advancedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  advancedItem: {
    alignItems: 'center',
    flex: 1,
  },
  advancedLabel: {
    fontWeight: '500',
    marginBottom: 4,
    fontSize: 12,
  },
  gaugeBox: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeInnerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  gaugePctText: {
    fontWeight: '700',
    fontSize: 13,
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
  // the buttons panel is as wide as the circles panel above it (advancedRow): 4 equal buttons from edge to edge
  roiKindChipsRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 2,
    gap: 6,
    marginBottom: 14,
  },
  kindChipCell: {
    flex: 1,
  },
  kindChip: {
    borderRadius: 16,
  },
  roiBtn: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiBtnCheck: {
    position: 'absolute',
    left: 5,
    top: 9,
  },
  roiBtnText: {
    fontSize: 11,
    textAlign: 'center',
  },
  centerHubTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerHubSurface: {
    width: 194,
    height: 194,
    borderRadius: 97,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerHubTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  centerNetRoiLabel: {
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 2,
  },
  centerHeroAmount: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginVertical: 2,
  },
  centerGoalLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  centerRoiBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  satelliteContainer: {
    alignItems: 'center',
    width: 84,
  },
  satLabel: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 14,
  },
  satPlanText: {
    fontSize: 11,
    marginTop: 1,
    marginBottom: 5,
  },
  satCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  satFactText: {
    fontWeight: '700',
    fontSize: 13,
  },
  inspectorCard: {
    width: '100%',
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  inspectorContent: {
    width: '100%',
  },
  inspectorHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  inspectorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inspectorNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomQuickNav: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  quickNavGroup: {
    width: '100%',
  },
  quickNavGroupTitle: {
    fontWeight: '700',
    letterSpacing: 0.6,
    marginLeft: 6,
    marginBottom: 4,
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  quickNavBtn: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    flex: 1,
  },
  stepBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
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
});

