// FillProjectFromEstimationWindow - the window of "Fill project from estimation": what will be copied, the question APPEND or REPLACE (asked, never preselected, only while the project has rows of
// its own), the run with a progress bar, and - when the budget / accounting currency of the two projects differ - the question "Recalculate now? Yes / No" after the copy.
//   The work is fillProjectFromEstimation.ts (new rows first, rolled back on a failure, the old rows of a Replace deleted last). Same look as the export window.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import { showErrorModal } from '../../../../ui/components/common/ErrorModalWindow';
import { appDispatch } from '../../../../redux/storeRef';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { organizationCurrenciesOf, recalcSummary } from '../../../../catalog/organization/currencies/organizationCurrenciesModel';
import { useProjectCurrencyRecalc } from '../../../../catalog/organization/currencies/useOrganizationCurrencyRecalc';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { askPMApprove } from '../../../inner/PMApproveYesNoCancelModalWindow';
import { pmT } from '../../../i18n/pmT';
import type { PMProjectRow } from '../../../model/types';
import { EstimationFillCancelledError, type EstimationFillResult } from './fillProjectFromEstimation';
import { fillNeedsModeQuestion, fillNeedsRecalculation, replaceBlockedReason, type EstimationSummary, type FillMode } from './estimationModel';
import { useFillProjectFromEstimation } from './useProjectEstimation';

/** the steps already done + the one running */
export function addStep(steps: string[], text: string): string[] {
  return steps[steps.length - 1] === text ? steps : [...steps, text];
}

export interface FillProjectFromEstimationWindowProps {
  visible: boolean;
  onClose: () => void;
  source: PMProjectRow;
  target: PMProjectRow;
  summary: EstimationSummary;
  ownerGUID: string;
  testID?: string;
}

type Status = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export default function FillProjectFromEstimationWindow({ visible, onClose, source, target, summary, ownerGUID, testID = 'pm-estimation-fill' }: FillProjectFromEstimationWindowProps) {
  const { themeColors: c } = useDesignSystem();
  const paperTheme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const primary = paperTheme.colors?.primary || c.primary;
  const { run, cancel } = useFillProjectFromEstimation();
  const recalc = useProjectCurrencyRecalc(visible);
  const [mode, setMode] = useState<'append' | 'replace' | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [steps, setSteps] = useState<string[]>([]);
  const [fraction, setFraction] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<EstimationFillResult | null>(null);
  const [stopping, setStopping] = useState(false);
  const stepsRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (!visible) return;
    setMode(null); setStatus('idle'); setSteps([]); setFraction(0); setMessage(''); setResult(null); setStopping(false);
  }, [visible]);
  useEffect(() => {
    const t = setTimeout(() => stepsRef.current?.scrollToEnd?.({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [steps.length]);

  const t = summary.target;
  const s = summary.source;
  const question = fillNeedsModeQuestion(t);
  const replaceBlocked = replaceBlockedReason(t);
  const needsRecalc = fillNeedsRecalculation(s, t);
  const running = status === 'running';
  const canFill = !running && status !== 'done' && (!question || mode !== null);
  const lastFill = target.rowJSON?.projectEstimationLastFill;

  if (!visible) return null;

  /** after the copy: the lines have no sums in the currencies of THIS project - the user decides (Yes / No) */
  const askRecalculation = async () => {
    const answer = await askPMApprove({
      title: pmT('Recalculate the task lines now?'),
      message: pmT('The currencies of the estimation ({{from}}) differ from the currencies of this project ({{to}}): the copied lines have no sums in {{to}} yet. Recalculate them now with the exchange rates?', { from: s.currencyForBudget || '-', to: t?.currencyForBudget || '-' }),
      yesLabel: pmT('Yes'),
      noLabel: pmT('No'),
      icon: 'currency_exchange',
    });
    if (answer !== 'yes') return;
    try {
      const r = await recalc(target.rowGUID, organizationCurrenciesOf(target.rowJSON as any));
      const summaryText = recalcSummary([r]);
      appDispatch(showSnackbar({ message: summaryText.message, isError: summaryText.isError }));
      const problems = [...(r.status === 'done' ? [] : [`${r.name}: ${r.reason}`]), ...r.postProblems.map((m) => `${r.name} · ${m}`)];
      if (problems.length) showErrorModal(problems.slice(0, 20).join('\n'), pmT('Recalculation of the project'));
    } catch (e: any) {
      showErrorModal(e?.message || String(e), pmT('Recalculation of the project'));
    }
  };

  const start = async () => {
    if (!canFill) return;
    setStatus('running'); setSteps([]); setFraction(0); setMessage(''); setStopping(false);
    try {
      const r = await run({
        source, target, ownerGUID,
        mode: question ? mode : null,
        existingRoots: t?.roots ?? [],
        dropCurrencySums: needsRecalc,
        onStep: (text, f, values) => { setSteps((list) => addStep(list, pmT(text, values))); setFraction(f); },
      });
      setResult(r); setStatus('done'); setFraction(1);
      appDispatch(showSnackbar({ message: pmT('{{tasks}} tasks and {{lines}} task lines copied. Press Post unposted tasks to post them.', { tasks: r.tasks, lines: r.lines }), isError: false }));
      if (needsRecalc) await askRecalculation();
    } catch (e: any) {
      if (e instanceof EstimationFillCancelledError) { setStatus('cancelled'); setMessage(pmT('Cancelled. Nothing was changed.')); return; }
      setStatus('error'); setMessage(e?.message || String(e));
    }
  };
  const close = () => { if (!running) onClose(); };
  const stop = () => { setStopping(true); cancel(); };

  const modeLabel = (m: FillMode): string => (m === 'replace' ? pmT('Replace') : m === 'append' ? pmT('Append') : pmT('Empty project'));
  const bodyMaxHeight = Math.max(160, windowHeight - 32 - 36 - 40 - 86);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={pmT('Cancel')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID={`${testID}-window`}
          {...(Platform.OS === 'web' ? ({ onKeyDown: (e: any) => { if (e.key === 'Escape') close(); } } as any) : {})}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{pmT('Fill project from estimation')}</Text>
            <PMIconButton testID={`${testID}-close`} icon="close" title={pmT('Close')} color={c.text} disabled={running} onPress={close} />
          </View>
          <ScrollView style={[styles.body, { maxHeight: bodyMaxHeight }]} contentContainerStyle={styles.bodyContent} testID={`${testID}-body`}>
            <Text style={[styles.text, { color: c.text }]} testID={`${testID}-what`}>
              {pmT('{{tasks}} tasks and stages, {{links}} links and {{lines}} task lines of "{{from}}" will be copied into "{{to}}". The lines are not posted.', { tasks: s.tasks, links: s.links, lines: s.lines, from: s.name || source.rowJSON?.name || '', to: target.rowJSON?.name || '' })}
            </Text>
            {!!lastFill && (
              <Text style={[styles.note, { color: c.text }]} testID={`${testID}-last`}>
                {pmT('Already filled on {{date}} ({{mode}}, {{n}} tasks). Filling again adds the rows again unless you choose Replace.', { date: String(lastFill.at || '').replace('T', ' ').slice(0, 16), mode: modeLabel(lastFill.mode), n: lastFill.tasks })}
              </Text>
            )}
            {question && (
              <View style={styles.modeBox} testID={`${testID}-mode`}>
                <Text style={[styles.section, { color: c.text }]}>{pmT('The project already has {{n}} top-level rows of its own. What should happen to them?', { n: t?.roots.length ?? 0 })}</Text>
                <ModeOption testID={`${testID}-mode-append`} selected={mode === 'append'} disabled={running || status === 'done'} color={c.text} primary={primary}
                  title={pmT('Add after the existing rows')} detail={pmT('Nothing of the project is touched.')} onPress={() => setMode('append')} />
                <ModeOption testID={`${testID}-mode-replace`} selected={mode === 'replace'} disabled={running || status === 'done' || !!replaceBlocked} color={c.text} primary={primary}
                  title={pmT('Replace the existing rows')} onPress={() => setMode('replace')}
                  detail={replaceBlocked === 'posted' ? pmT('Not possible: {{n}} tasks of the project are posted.', { n: t?.postedTasks ?? 0 })
                    : replaceBlocked === 'documents' ? pmT('Not possible: the project has documents (invoices, orders, facts ...).')
                    : pmT('The {{n}} existing top-level rows with everything below them are deleted after the copy succeeded.', { n: t?.roots.length ?? 0 })} />
                {mode === null && status === 'idle' && <Text testID={`${testID}-mode-ask`} style={[styles.note, { color: c.text }]}>{pmT('Choose one to continue.')}</Text>}
              </View>
            )}
            {needsRecalc && (
              <Text style={[styles.note, { color: c.text }]} testID={`${testID}-currency`}>
                {pmT('The currencies differ ({{from}} -> {{to}}): the sums of the copied lines are removed, and you will be asked whether to recalculate them now.', { from: s.currencyForBudget || '-', to: t?.currencyForBudget || '-' })}
              </Text>
            )}
            {status !== 'idle' && (
              <View style={styles.progressBox} testID={`${testID}-progress`} accessibilityLiveRegion="polite">
                <View style={[styles.bar, { backgroundColor: c.border }]} accessibilityRole="progressbar">
                  <View style={{ height: 8, borderRadius: 4, width: `${Math.round((status === 'error' || status === 'cancelled' ? 0 : fraction) * 100)}%`, backgroundColor: status === 'error' ? c.error : primary }} />
                </View>
                <Text style={[styles.percent, { color: c.text }]} testID={`${testID}-percent`}>{`${Math.round((status === 'error' || status === 'cancelled' ? 0 : fraction) * 100)} %`}</Text>
                <ScrollView ref={stepsRef} style={styles.steps} nestedScrollEnabled testID={`${testID}-steps`}>
                  {steps.map((text, i) => {
                    const current = running && i === steps.length - 1;
                    return (
                      <View key={`${i}-${text}`} style={styles.stepRow} testID={`${testID}-step-${i}`}>
                        {current ? <ActivityIndicator size="small" color={primary} style={styles.spinner} /> : <IconApp name={status === 'error' && i === steps.length - 1 ? 'error' : 'check_circle'} size={16} color={status === 'error' && i === steps.length - 1 ? c.error : primary} />}
                        <Text style={[styles.stepText, { color: c.text }]}>{text}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {status === 'done' && result && (
              <Text style={[styles.success, { color: c.text }]} testID={`${testID}-done`}>
                {pmT('Done: {{tasks}} tasks, {{links}} links and {{lines}} task lines copied.', { tasks: result.tasks, links: result.links, lines: result.lines })}
              </Text>
            )}
            {(status === 'error' || status === 'cancelled') && !!message && <Text style={[styles.error, { color: status === 'error' ? c.error : c.text }]} testID={`${testID}-message`}>{message}</Text>}
          </ScrollView>
          <View style={styles.actions}>
            {status === 'done' ? (
              <View style={styles.cell}><PMDialogButton testID={`${testID}-done-button`} kind="primary" color={primary} title="Close" style={styles.fill} onPress={onClose} /></View>
            ) : (
              <>
                <View style={styles.cell}>
                  <PMDialogButton testID={`${testID}-cancel`} kind={running ? 'dangerOutlined' : 'secondary'} icon={running ? 'cancel' : undefined} title={running ? 'Cancel fill' : 'Cancel'} disabled={running && stopping} style={styles.fill} onPress={running ? stop : onClose} />
                </View>
                <View style={styles.cell}>
                  <PMDialogButton testID={`${testID}-fill`} kind="primary" color={primary} icon="download" title={status === 'error' || status === 'cancelled' ? 'Try again' : 'Fill'} disabled={!canFill} loading={running} style={styles.fill} onPress={start} />
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModeOption({ selected, disabled, title, detail, onPress, testID, color, primary }: { selected: boolean; disabled: boolean; title: string; detail: string; onPress: () => void; testID: string; color: string; primary: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.option, { borderColor: selected ? primary : 'rgba(128,128,128,0.35)', opacity: disabled ? 0.55 : 1 }]}>
      <IconApp name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} size={18} color={selected ? primary : color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color, fontSize: 12, opacity: 0.75 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 520, maxHeight: '100%', borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 4 },
  text: { fontSize: 14, marginTop: 8 },
  note: { fontSize: 12, opacity: 0.8, marginTop: 8 },
  section: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  modeBox: { marginTop: 4, gap: 8 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  progressBox: { marginTop: 14, gap: 2 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch' },
  percent: { fontSize: 12, alignSelf: 'flex-end', opacity: 0.8 },
  steps: { height: 5 * 24 + 4, flexGrow: 0, marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  spinner: { transform: [{ scale: 0.75 }] },
  stepText: { fontSize: 13 },
  success: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  error: { fontSize: 13, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.35)' },
  cell: { flex: 1 },
  fill: { marginLeft: 0, marginVertical: 0, width: '100%', minWidth: 0, maxWidth: '100%', flexGrow: 1, flexShrink: 1 },
});
