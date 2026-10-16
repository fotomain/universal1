// PMFactInputDocumentForm - the FORM of a fact input document of a task (documentation/FACT_INPUT.html; was PMFactInputDocument).
//
//   open it from anywhere that knows a task GUID or a task line GUID (useOpenFactInput.ts): the right-click menu of a task line of the Finances table ("Facts input"), the row menu of the task tree,
//   the list of documents (PMFactInputDocumentList: hamburger menu → Budgets → Actuals).
//   header form  TextInputApp: number · author · mode (read only) · DateInputApp: created (read only), the date of NEW lines (free input) · the totals of the document
//   DocumentTabs Time · Material · Expenses · Revenues (the tab of the clicked line is open)
//   the table    a ReusableTable on the redux entity FACT_USAGE_TIMELINE_ENTITY (realtime, optimistic): the date of EVERY line is editable (a calendar date cell), qtyForContract is the only quantity
//                a user states; the three sums are computed by the database. STRONG input (project setting factStrongInputByTaskLine): no new lines (addEnabled = false), only update and delete.
//                A posted document is read only. Columns: factColumns.tsx.
//   the bar      document list · New document · Delete · Unpost · Close - and the POST button is the LAST.
// Post checks the whole document (the problems are listed); the posted documents are summed by pg_cron for Monitor01 (task_line_fact_for_monitor01).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import { useTaskLineCatalogs } from '../../../pm/view/task/finances/useTaskLineCatalogs';
import { pmT } from '../../../pm/i18n/pmT';
import { buildFactColumns } from './factColumns';
import {
  FACT_NEW_ROW_KEYS, FACT_TABS, FACT_USAGE_TIMELINE_ENTITY, FactPostProblem, canAddLines, canDeleteDocument, canEditLines, canPost, canUnpost, dayOfPeriod, factGenusOf, factPostState, factProblemText,
  factRowsOf, factTotalsOf, parseDayInput,
} from './factInputModel';
import { useFactInputDocument } from './useFactInputDocument';

export interface PMFactInputDocumentFormProps {
  taskGUID: string;
  /** the line the user clicked: its tab opens (a strong document knows the line; the genus below covers the free one) */
  taskLineGUID?: string | null;
  genus?: string | null;
  /** a given document is shown instead of the latest draft */
  documentGUID?: string | null;
  onClose?: () => void;
  testID?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PMFactInputDocumentForm({ taskGUID, taskLineGUID, genus, documentGUID, onClose, testID = 'fact-input' }: PMFactInputDocumentFormProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const doc = useFactInputDocument(taskGUID, documentGUID);
  const { header } = doc;
  const [tab, setTab] = useState<string>(() => factGenusOf(genus));
  const [problems, setProblems] = useState<FactPostProblem[]>([]);
  const [newDay, setNewDay] = useState(todayISO());

  // the lines the table holds (redux): the counts of the tabs, the totals of the document, Post needs lines
  const allRows: any[] = useSelector((s: any) => s?.[FACT_USAGE_TIMELINE_ENTITY]?.entityDataFromServer) ?? [];
  const docRows = useMemo(() => factRowsOf(allRows, header?.guid), [allRows, header?.guid]);
  const totals = useMemo(() => factTotalsOf(docRows), [docRows]);
  const counts = useMemo(() => Object.fromEntries(FACT_TABS.map((t) => [t.genus, factRowsOf(docRows, header?.guid, t.genus).length])), [docRows, header?.guid]);

  // the tab of the clicked line opens once the lines are here (a strong line knows its task line)
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !docRows.length) return;
    opened.current = true;
    const hit = taskLineGUID ? docRows.find((r) => r.taskLineGUID === taskLineGUID) : undefined;
    if (hit) setTab(factGenusOf(hit.genusGUID));
  }, [docRows, taskLineGUID]);
  // another document: the problems of the earlier one are history
  useEffect(() => setProblems([]), [header?.guid]);

  const edit = !!header && canEditLines(header);
  const columns = useMemo(() => (header ? buildFactColumns({ data, genus: tab, header }) : []), [data, tab, header]);
  const rowFilter = useMemo(() => {
    const guid = header?.guid;
    return (r: ReusableTableRow) => !!guid && (r.rowHeaderGUID ?? r.rowJSON?.[FACT_NEW_ROW_KEYS.header]) === guid && (r.genusGUID ?? r.rowJSON?.[FACT_NEW_ROW_KEYS.genus]) === tab;
  }, [header?.guid, tab]);
  // a NEW row (free input): the table puts the header, the genus (the tab) and the day into its rowJSON; the saga makes them columns (factLineInsert)
  const newRowDefaults = useMemo(() => ({
    rowOwnerGUID: taskGUID,
    rowJSON: { [FACT_NEW_ROW_KEYS.header]: header?.guid, [FACT_NEW_ROW_KEYS.genus]: tab, [FACT_NEW_ROW_KEYS.day]: parseDayInput(newDay) ?? todayISO() },
  }), [taskGUID, header?.guid, tab, newDay]);

  const documentItems = useMemo(
    () => doc.documents.map((d) => ({ value: d.documentGUID, label: `${d.documentNumber || d.documentGUID.slice(0, 8)} · ${dayOfPeriod(d.createdAt)} · ${pmT(d.documentStatus === 'posted' ? 'Posted' : 'Draft')}` })),
    [doc.documents],
  );

  const doPost = async () => {
    const answer = await doc.post();
    setProblems(answer && answer.status !== 'posted' ? answer.problems : []);
  };
  const doUnpost = async () => {
    const answer = await doc.unpost();
    setProblems(answer && answer.status !== 'draft' ? answer.problems : []);
  };

  const postTitle = header && factPostState(header) === 'postNeeded' ? pmT('Post needed') : pmT('Post');

  return (
    <View testID={testID} style={styles.root}>
      {/* the bar: the POST button is the last */}
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
        {header && canDeleteDocument(header) && (
          <ButtonApp testID={`${testID}-delete`} title={pmT('Delete document')} icon="delete" variant="text" danger size="small" disabled={doc.busy} onPress={() => { void doc.removeDocument(); }} />
        )}
        {header && canUnpost(header) && (
          <ButtonApp testID={`${testID}-unpost`} title={pmT('Unpost')} icon="undo" variant="outlined" size="small" disabled={doc.busy} onPress={doUnpost} />
        )}
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        {header && header.status === 'posted' && (
          // a status, not a command: the same BIG button as Post (nothing to press)
          <ButtonApp testID={`${testID}-posted`} title={pmT('Posted')} icon="check" size="large" onPress={() => {}} accessibilityLabel={pmT('Posted')} />
        )}
        {header && canPost(header, docRows.length) && (
          <ButtonApp testID={`${testID}-post`} title={postTitle} icon="send" size="large" disabled={doc.busy} onPress={doPost} />
        )}
      </View>

      {/* the form of the document */}
      {header && (
        <View testID={`${testID}-form`} style={styles.form}>
          <View style={{ width: 150 }}>
            <TextInputApp testID={`${testID}-field-number`} label={pmT('Document')} value={header.number} compact disabled hideClearIcon />
          </View>
          <View style={{ width: 200 }}>
            <TextInputApp testID={`${testID}-field-author`} label={pmT('Author')} value={header.userName || header.user} compact disabled hideClearIcon />
          </View>
          <View style={{ width: 160 }}>
            <DateInputApp testID={`${testID}-field-created`} label={pmT('Created')} value={dayOfPeriod(header.createdAt)} compact disabled hideClearIcon />
          </View>
          <View style={{ width: 150 }}>
            <TextInputApp testID={`${testID}-field-mode`} label={pmT('Input')} value={header.strong ? pmT('Strong') : pmT('Free')} compact disabled hideClearIcon />
          </View>
          {canAddLines(header) && (
            <View style={{ width: 170 }}>
              <DateInputApp testID={`${testID}-field-newday`} label={pmT('Date of new lines')} value={newDay} onChangeText={setNewDay} compact hideClearIcon error={parseDayInput(newDay) === null} />
            </View>
          )}
          <View testID={`${testID}-totals`} style={styles.totals}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{pmT('Document total')} · {totals.lineCount} {pmT('lines')}</Text>
            <Text testID={`${testID}-total-budget`} style={{ color: c.text, fontSize: 12 }}>{pmT('Sum for budget')} {money(totals.sumForBudget)}</Text>
            <Text testID={`${testID}-total-contract`} style={{ color: c.text, fontSize: 12 }}>{pmT('Sum for contract')} {money(totals.sumForContract)}</Text>
            <Text testID={`${testID}-total-accounting`} style={{ color: c.text, fontSize: 12 }}>{pmT('Sum for accounting')} {money(totals.sumForAccounting)}</Text>
          </View>
        </View>
      )}

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
          <ReusableTable
            key={`${header.guid}:${tab}:${header.status}`}
            testID={`${testID}-lines`}
            entityName={FACT_USAGE_TIMELINE_ENTITY}
            crudListTitle={pmT('Fact lines')}
            itemLabel="Line"
            listOwnerGUID={taskGUID}
            // all-rows mode on the parent: the read is by task, the table filters ONE document and ONE tab
            listParentGUID={REUSABLE_TABLE_ALL}
            rowFilter={rowFilter}
            newRowDefaults={newRowDefaults}
            visualColumns={columns}
            addEnabled={canAddLines(header)}
            crudPanelEnabled={edit}
            contextMenuEnabled={edit}
            selectionEnabled={edit}
            reorderEnabled={false}
            dragAndDropColumns
            resizeColumnWidth
            emptyText={canAddLines(header) ? pmT('No lines on this tab. Press "+ Add".') : pmT('No lines on this tab.')}
            realtime
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
  form: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  totals: { flex: 1, minWidth: 220, gap: 1, paddingBottom: 2, alignItems: 'flex-end' },
  problems: { margin: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8, paddingLeft: 14, paddingRight: 20, borderBottomWidth: 2 },
  badge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  body: { padding: 12, paddingBottom: 40 },
});
