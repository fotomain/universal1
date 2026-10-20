// Monitor02Table - the table of Monitor02_ROINow (documentation/ROI_DOC.html section 7.2):
//   header   Name · Cost plan · Revenue plan · Revenue fact input · Cost fact · Customer invoiced · ROI1 plan-plan · ROI2 plan-fact input · ROI3 plan-invoiced · ROI4 fact-fact (every header has a tip with its formula)
//   body     one line per PROJECT (bold), under it one line per TASK (indented) - the task lines exist only for a project with roiForTasksFunctionalityEnabled ON
//   footer   the project lines added (the five values are added, the ratios are taken of the sums) - always visible below the rows
// ROI colours: >= 0 green, < 0 red, "-" (no cost) grey. A double click / touch on a task name opens the task in the dashboard (onTaskOpen).
import React, { memo, useCallback, useRef } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pmT } from '../../i18n/pmT';
import { usePMTip } from '../../inner/tooltip/PMTooltip';
import { ROI_KINDS, ROI_KIND_SUB, ROI_KIND_TITLE, RoiKind, RoiLine, formatRoi, formatRoiMoney, roiTone } from '../roi/roiModel';
import type { RoiReportLine } from '../roi/roiReportModel';

export interface Monitor02TableColors { text: string; border: string; surface: string; primary: string; headerBackground: string; positive: string; negative: string }

export interface Monitor02TableProps {
  lines: RoiReportLine[];
  footer: RoiLine;
  colors: Monitor02TableColors;
  onTaskOpen?: (line: RoiReportLine) => void;
  testID?: string;
}

export const MONITOR02_DOUBLE_PRESS_MS = 400;
const W = { name: 340, money: 170, roi: 116 };
const ROW_H = 34;

type MoneyId = 'planCost' | 'planRevenue' | 'usedRevenue' | 'factCost' | 'billedRevenue';
export const MONITOR02_MONEY_COLUMNS: { id: MoneyId; title: string; tip: string }[] = [
  { id: 'planCost', title: 'Cost plan', tip: 'Plan of Time + Material + Expense (Project settings → ROI: which VAT is added)' },
  { id: 'planRevenue', title: 'Revenue plan', tip: 'Plan of the Revenue (Deliverable) lines' },
  { id: 'usedRevenue', title: 'Revenue fact input', tip: 'Posted fact input of the Revenue lines (the revenue of ROI2)' },
  { id: 'factCost', title: 'Cost fact', tip: 'Posted vendor invoices + the posted fact input of the cost lines that have no vendor (cost that is never invoiced)' },
  { id: 'billedRevenue', title: 'Customer invoiced', tip: 'Posted customer invoices' },
];
export const MONITOR02_ROI_TIPS: Record<RoiKind, string> = {
  roi1: 'ROI1 plan - plan = (Revenue plan - Cost plan) / Cost plan',
  roi2: 'ROI2 plan - fact = (Revenue fact input - Cost plan) / Cost plan. Part of the revenue against the whole plan cost: early in a project it is negative by construction',
  roi3: 'ROI3 plan - invoiced = (Customer invoiced - Cost plan) / Cost plan. Part of the revenue against the whole plan cost',
  roi4: 'ROI4 fact - fact = (Customer invoiced - Cost fact) / Cost fact',
};
const WIDTH = W.name + MONITOR02_MONEY_COLUMNS.length * W.money + ROI_KINDS.length * W.roi;

function HeadCell({ title, sub, width, tip, testID, textStyle, subStyle, left }: { title: string; sub?: string; width: number; tip: string; testID?: string; textStyle: any; subStyle?: any; left?: boolean }) {
  const t = usePMTip(tip);
  return (
    <Pressable {...t} testID={testID} accessibilityLabel={title} style={{ width, paddingHorizontal: 8, justifyContent: 'center', alignItems: left ? 'flex-start' : 'center' }}>
      <Text numberOfLines={1} style={textStyle}>{title}</Text>
      {!!sub && <Text numberOfLines={1} style={subStyle}>{sub}</Text>}
    </Pressable>
  );
}

function Monitor02TableImpl({ lines, footer, colors, onTaskOpen, testID = 'monitor02-table' }: Monitor02TableProps) {
  const lastPress = useRef<{ key: string; at: number } | null>(null);
  const press = useCallback((line: RoiReportLine) => {
    if (line.level !== 'task') return;
    const now = Date.now();
    const last = lastPress.current;
    if (last && last.key === line.key && now - last.at <= MONITOR02_DOUBLE_PRESS_MS) { lastPress.current = null; onTaskOpen?.(line); return; }
    lastPress.current = { key: line.key, at: now };
  }, [onTaskOpen]);
  const text = (extra?: object) => [{ color: colors.text, fontSize: 13 }, extra];
  const roiColor = (v: number | null) => (roiTone(v) === 'positive' ? colors.positive : roiTone(v) === 'negative' ? colors.negative : colors.text);
  const cells = (line: RoiLine, prefix: string, bold: boolean) => (
    <>
      {MONITOR02_MONEY_COLUMNS.map((c) => (
        <Text key={c.id} testID={`${prefix}-${c.id}`} numberOfLines={1} style={[text({ fontWeight: bold ? '800' : '400' }), styles.num, { width: W.money, borderLeftColor: colors.border }]}>{formatRoiMoney(line[c.id])}</Text>
      ))}
      {ROI_KINDS.map((k) => (
        <Text key={k} testID={`${prefix}-${k}`} numberOfLines={1} style={[styles.num, { width: W.roi, borderLeftColor: colors.border, color: roiColor(line[k]), opacity: roiTone(line[k]) === 'none' ? 0.5 : 1, fontWeight: bold ? '800' : '700', fontSize: 13 }]}>{formatRoi(line[k])}</Text>
      ))}
    </>
  );
  const renderItem = useCallback(({ item }: { item: RoiReportLine }) => {
    const project = item.level === 'project';
    return (
      <View testID={`${testID}-line-${item.key}`} style={[styles.row, { width: WIDTH, height: ROW_H, borderBottomColor: colors.border, backgroundColor: project ? colors.headerBackground : undefined }]}>
        {project
          ? <Text numberOfLines={1} style={[text({ fontWeight: '800' }), { width: W.name, paddingHorizontal: 8 }]}>{item.label}</Text>
          : (
            <Pressable testID={`${testID}-task-${item.key}`} accessibilityRole="link" accessibilityLabel={`${pmT('Open task')} ${item.label}`} onPress={() => press(item)} style={{ width: W.name, paddingLeft: 28, paddingRight: 8, height: '100%', justifyContent: 'center' }}>
              <Text numberOfLines={1} style={text()}>{item.label}</Text>
            </Pressable>
          )}
        {cells(item.line, `${testID}-cell-${item.key}`, project)}
      </View>
    );
  }, [colors, press, testID]);
  const headText = text({ fontWeight: '700', textAlign: 'center' });
  const subText = [{ color: colors.text, fontSize: 10, opacity: 0.65 }];
  return (
    <ScrollView horizontal testID={testID} showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: WIDTH }}>
      <View style={{ width: WIDTH, flex: 1 }}>
        <View testID={`${testID}-head`} style={[styles.row, { height: 42, backgroundColor: colors.headerBackground, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <HeadCell left title={pmT('Project / Task')} width={W.name} tip={pmT('A line per project; under it a line per task (projects with ROI for tasks on)')} testID={`${testID}-head-name`} textStyle={text({ fontWeight: '700' })} />
          {MONITOR02_MONEY_COLUMNS.map((c) => <HeadCell key={c.id} title={pmT(c.title)} width={W.money} tip={pmT(c.tip)} testID={`${testID}-head-${c.id}`} textStyle={headText} />)}
          {ROI_KINDS.map((k) => <HeadCell key={k} title={ROI_KIND_TITLE[k]} sub={pmT(ROI_KIND_SUB[k])} width={W.roi} tip={pmT(MONITOR02_ROI_TIPS[k])} testID={`${testID}-head-${k}`} textStyle={headText} subStyle={subText} />)}
        </View>
        <FlatList
          data={lines}
          keyExtractor={(l) => l.key}
          renderItem={renderItem}
          initialNumToRender={40}
          windowSize={9}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          ListEmptyComponent={<Text testID={`${testID}-empty`} style={{ color: colors.text, opacity: 0.6, padding: 16 }}>{pmT('No project to show. Switch on "ROI for tasks" in Project settings → ROI, then post the plan of a task.')}</Text>}
        />
        <View testID={`${testID}-footer`} style={[styles.row, { height: ROW_H, width: WIDTH, backgroundColor: colors.headerBackground, borderTopColor: colors.border, borderTopWidth: 1, borderBottomWidth: 0 }]}>
          <Text style={[text({ fontWeight: '800' }), { width: W.name, paddingHorizontal: 8 }]}>{pmT('Total')}</Text>
          {cells(footer, `${testID}-footer`, true)}
        </View>
      </View>
    </ScrollView>
  );
}

export default memo(Monitor02TableImpl);
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  num: { textAlign: 'right', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
});
