// PMFactInputDocument - the FACT INPUT document of a task (documentation/FACT_INPUT.html).
//
//   open it from anywhere that knows a task GUID or a task line GUID (useOpenFactInput.ts): the right-click menu of a task line of the Finances table ("Facts input"), the row menu of the task tree.
//   header    document number · user · created · mode (strong: the lines of the task, delete / update only · free: add lines) · status · Post / Unpost
//   tabs      DocumentTabs: Time · Material · Expenses · Revenues (the tab of the clicked line is open)
//   body      FactLinesTable of the tab: the date of EVERY line is editable, the quantity (qtyForContract) is the only quantity the user states
// A draft is edited line by line; Post checks the whole document (the problems are listed per line) and makes it read only; Unpost takes it back to a draft.
// The posted documents are summed by pg_cron for Monitor01 (task_line_fact_for_monitor01).
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import IconApp from '../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import { useTaskLineCatalogs } from '../view/task/finances/useTaskLineCatalogs';
import { pmT } from '../i18n/pmT';
import FactLinesTable from './FactLinesTable';
import {
  FACT_TABS, FactPostProblem, canDeleteDocument, canPost, canUnpost, dayOfPeriod, factGenusOf, factHeaderOf, factPostState, factProblemText, genusOfTaskLine, linesOfGenus,
} from './factInputModel';
import { useFactInputDocument } from './useFactInputDocument';

export interface PMFactInputDocumentProps {
  taskGUID: string;
  /** the line the user clicked: its tab opens (a strong document knows the line; the genus below covers the free one) */
  taskLineGUID?: string | null;
  genus?: string | null;
  /** a given document is shown instead of the latest draft */
  documentGUID?: string | null;
  onClose?: () => void;
  testID?: string;
}

export default function PMFactInputDocument({ taskGUID, taskLineGUID, genus, documentGUID, onClose, testID = 'fact-input' }: PMFactInputDocumentProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const doc = useFactInputDocument(taskGUID, documentGUID);
  const { header, lines } = doc;
  const [tab, setTab] = useState<string>(() => factGenusOf(genus));
  const [problems, setProblems] = useState<FactPostProblem[]>([]);

  // the tab of the clicked line opens once the lines are here (a strong line knows its task line)
  const opened = React.useRef(false);
  useEffect(() => {
    if (opened.current || !lines.length) return;
    opened.current = true;
    if (taskLineGUID) setTab(genusOfTaskLine(lines, taskLineGUID, genus));
  }, [lines, taskLineGUID, genus]);
  // another document: the problems of the earlier one are history
  useEffect(() => setProblems([]), [header?.guid]);

  const counts = useMemo(() => Object.fromEntries(FACT_TABS.map((t) => [t.genus, linesOfGenus(lines, t.genus).length])), [lines]);
  const tabLines = useMemo(() => linesOfGenus(lines, tab), [lines, tab]);
  const documentItems = useMemo(
    () => doc.documents.map((d) => {
      const h = factHeaderOf(d);
      return { value: h.guid, label: `${h.number || h.guid.slice(0, 8)} · ${dayOfPeriod(h.createdAt)} · ${pmT(h.status === 'posted' ? 'Posted' : 'Draft')}` };
    }),
    [doc.documents],
  );
  const lineProblems = useMemo(() => new Set(problems.map((p) => p.lineGUID).filter(Boolean) as string[]), [problems]);

  const doPost = async () => {
    const answer = await doc.post();
    setProblems(answer && answer.status !== 'posted' ? answer.problems : []);
  };
  const doUnpost = async () => {
    const answer = await doc.unpost();
    setProblems(answer && answer.status !== 'draft' ? answer.problems : []);
  };

  const postState = header ? factPostState(header) : 'post';
  const postTitle = postState === 'postNeeded' ? pmT('Post needed') : pmT('Post');

  return (
    <View testID={testID} style={styles.root}>
      {/* header bar */}
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="fact_check" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Facts input')}{doc.taskName ? ` · ${doc.taskName}` : ''}</Text>
          {header && (
            <Text testID={`${testID}-subtitle`} numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
              {header.number} · {dayOfPeriod(header.createdAt)} · {header.strong ? pmT('Strong input: the lines of the task, delete and update only') : pmT('Free input: add lines freely')}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }} />
        {documentItems.length > 1 && header && (
          <SelectItemFromListApp testID={`${testID}-documents`} items={documentItems} value={header.guid} onSelect={doc.select} trigger="link" lowerCaseTrigger={false} />
        )}
        <ButtonApp testID={`${testID}-new`} title={pmT('New document')} icon="note_add" variant="outlined" size="small" disabled={doc.busy} onPress={() => { void doc.newDocument(); }} />
        {header && canPost(header, lines.length) && (
          <ButtonApp testID={`${testID}-post`} title={postTitle} icon="send" size="small" disabled={doc.busy} onPress={doPost} />
        )}
        {header && header.status === 'posted' && (
          <View testID={`${testID}-posted`} style={[styles.chip, { backgroundColor: c.primary }]}>
            <IconApp name="check" size={14} color="#fff" />
            <Text style={styles.chipText}>{pmT('Posted')}</Text>
          </View>
        )}
        {header && canUnpost(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {header && canDeleteDocument(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doc.removeDocument(); }} />
        )}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
      </View>

      {!!doc.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{doc.error}</Text>}

      {problems.length > 0 && (
        <View testID={`${testID}-problems`} style={[styles.problems, { borderColor: c.error }]}>
          <Text style={{ color: c.error, fontWeight: '700', marginBottom: 4 }}>{pmT('The document was not posted:')}</Text>
          {problems.map((p, i) => (
            <Text key={`${p.lineGUID}-${i}`} testID={`${testID}-problem-${i}`} style={{ color: c.text, fontSize: 13 }}>• {pmT(factProblemText(p.problem))}</Text>
          ))}
        </View>
      )}

      {/* DocumentTabs: the same look as the genus tabs of the Finances table */}
      <View accessibilityRole="tablist" testID={`${testID}-tabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {FACT_TABS.map((t) => {
          const active = t.genus === tab;
          return (
            <Pressable key={t.genus} accessibilityRole="tab" aria-selected={active} testID={`${testID}-tab-${t.genus}`} onPress={() => setTab(t.genus)}
              style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
              <IconApp name={t.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(t.title)}</Text>
              {!!counts[t.genus] && (
                <View testID={`${testID}-tab-${t.genus}-count`} style={[styles.badge, { backgroundColor: c.primary }]}>
                  <Text style={styles.badgeText}>{counts[t.genus] > 99 ? '99+' : String(counts[t.genus])}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {doc.isLoading && <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('Loading…')}</Text>}
        {header && (
          <FactLinesTable
            testID={`${testID}-lines`}
            header={header}
            genus={tab}
            lines={tabLines}
            problemLines={lineProblems}
            data={data}
            busy={doc.busy}
            onSave={(guid, patch) => { void doc.saveLine(guid, patch); }}
            onDelete={(guid) => { void doc.removeLine(guid); }}
            onAdd={(line) => { void doc.addLine(line); }}
          />
        )}
        {!header && !doc.isLoading && <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('No document yet.')}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  problems: { margin: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8, paddingLeft: 14, paddingRight: 20, borderBottomWidth: 2 },
  badge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  body: { padding: 12, paddingBottom: 40 },
});
