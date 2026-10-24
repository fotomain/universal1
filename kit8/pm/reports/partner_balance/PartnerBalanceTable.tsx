// PartnerBalanceTable - the table of Monitor07 (documentation/PARTNER_BALANCE.html section 7.3):
//   head    Partner / Contract / Task · Contract finish · Currency, then for every SHOWN sum kind a group (Contract | Accounting | Budget) with the columns Begin · Plus · Minus · End (every header has a tip)
//   body    Partner lines (bold) -> Contract lines -> Task lines (loaded when a contract is opened); the chevron opens / closes. A press on a number of a Contract / Task line opens the rows behind it
//   footer  one line per currency (the sums of different currencies are never added); a group whose children have two currencies shows "mixed" instead of numbers
// Colours: an End below 0 is red (the balance went the unusual way: we overpaid a vendor, a customer paid too much); a 0 is dimmed.
import React, { memo, useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../../ui/components/common/IconApp';
import { pmT } from '../../i18n/pmT';
import { usePMTip } from '../../inner/tooltip/PMTooltip';
import { formatReportMoney } from '../common/reportFormat';
import { BalanceCell, BalanceNode, FlatBalanceLine, FooterLine, KindCell, PART_TIPS, SUM_PARTS, SumKind, SumKindId, SumPart } from './partnerBalanceModel';

export interface PartnerBalanceTableColors { text: string; border: string; surface: string; primary: string; headerBackground: string; negative: string }

export interface PartnerBalanceTableProps {
  lines: FlatBalanceLine[];
  footer: FooterLine[];
  kinds: readonly SumKind[];
  expanded: ReadonlySet<string>;
  /** contract keys whose tasks are being loaded */
  loadingKeys?: ReadonlySet<string>;
  colors: PartnerBalanceTableColors;
  onToggle: (node: BalanceNode) => void;
  /** a press on a number of a contract / task line: the rows behind it */
  onCellPress?: (node: BalanceNode, kind: SumKindId, part: SumPart) => void;
  /** a currency suffix per kind for the group header ('' = none, e.g. when the rows have two currencies) */
  kindCurrency?: Partial<Record<SumKindId, string>>;
  emptyText?: string;
  testID?: string;
}

const W = { name: 340, finish: 112, cur: 78, num: 112 };
const ROW_H = 34;
const widthOf = (kinds: readonly SumKind[]) => W.name + W.finish + W.cur + kinds.length * SUM_PARTS.length * W.num;
export const PARTNER_BALANCE_PART_KEY = (kind: SumKindId, part: SumPart) => `${kind}${part}`;

function HeadCell({ title, width, tip, testID, textStyle, left }: { title: string; width: number; tip: string; testID?: string; textStyle: any; left?: boolean }) {
  const t = usePMTip(tip);
  return (
    <Pressable {...t} testID={testID} accessibilityLabel={title} style={{ width, paddingHorizontal: 8, justifyContent: 'center', alignItems: left ? 'flex-start' : 'center' }}>
      <Text numberOfLines={1} style={textStyle}>{title}</Text>
    </Pressable>
  );
}

function PartnerBalanceTableImpl({ lines, footer, kinds, expanded, loadingKeys, colors, onToggle, onCellPress, kindCurrency = {}, emptyText, testID = 'partner-balance-table' }: PartnerBalanceTableProps) {
  const width = widthOf(kinds);
  const text = (extra?: object) => [{ color: colors.text, fontSize: 13 }, extra];
  const partValue = (cell: BalanceCell, part: SumPart): number => cell[part.toLowerCase() as 'begin' | 'plus' | 'minus' | 'end'];
  const numCell = (cell: KindCell | BalanceCell | undefined, kind: SumKindId, part: SumPart, prefix: string, bold: boolean, press?: () => void) => {
    const mixed = !!cell && 'currency' in cell && cell.currency === null;
    const v = cell ? partValue(cell, part) : 0;
    const child = (
      <Text testID={`${prefix}-${PARTNER_BALANCE_PART_KEY(kind, part)}`} numberOfLines={1}
        style={[text({ fontWeight: bold ? '800' : '400', color: part === 'End' && v < 0 ? colors.negative : colors.text, opacity: mixed ? 0.5 : v === 0 ? 0.55 : 1 }), styles.num, { width: W.num, borderLeftColor: colors.border }]}>
        {!cell ? '' : mixed ? pmT('mixed') : formatReportMoney(v)}
      </Text>
    );
    return press && !mixed
      ? <Pressable key={`${kind}${part}`} onPress={press} accessibilityRole="link" accessibilityLabel={`${pmT('Show the rows')} ${pmT(kind)} ${part}`}>{child}</Pressable>
      : <React.Fragment key={`${kind}${part}`}>{child}</React.Fragment>;
  };
  const renderItem = useCallback(({ item }: { item: FlatBalanceLine }) => {
    const n = item.node;
    const open = expanded.has(n.key);
    const canOpen = n.level !== 'task';
    const bold = n.level === 'partner';
    const press = n.level === 'partner' ? undefined : (kind: SumKindId, part: SumPart) => () => onCellPress?.(n, kind, part);
    return (
      <View testID={`${testID}-line-${n.key}`} style={[styles.row, { width, height: ROW_H, borderBottomColor: colors.border, backgroundColor: bold ? colors.headerBackground : undefined }]}>
        <Pressable testID={`${testID}-toggle-${n.key}`} disabled={!canOpen} onPress={() => onToggle(n)} accessibilityRole="button" accessibilityLabel={`${open ? pmT('Close') : pmT('Open')} ${n.label}`}
          style={{ width: W.name, paddingLeft: 8 + item.depth * 20, paddingRight: 8, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {canOpen ? <IconApp name={open ? 'expand_more' : 'chevron_right'} size={18} color={colors.text} /> : <View style={{ width: 18 }} />}
          <Text numberOfLines={1} style={text({ fontWeight: bold ? '800' : '400', flexShrink: 1 })}>{n.label}</Text>
          {!!loadingKeys?.has(n.key) && <ActivityIndicator size="small" />}
        </Pressable>
        <Text testID={`${testID}-finish-${n.key}`} numberOfLines={1} style={[text({ opacity: 0.8 }), styles.num, { width: W.finish, borderLeftColor: colors.border, textAlign: 'center' }]}>{n.level === 'task' ? '' : n.finishDate ?? ''}</Text>
        <Text testID={`${testID}-currency-${n.key}`} numberOfLines={1} style={[text({ opacity: 0.8 }), styles.num, { width: W.cur, borderLeftColor: colors.border, textAlign: 'center' }]}>{n.currency === null ? pmT('mixed') : n.currency}</Text>
        {kinds.map((k) => SUM_PARTS.map((part) => numCell(n.cells[k.id], k.id, part, `${testID}-cell-${n.key}`, bold, press ? press(k.id, part) : undefined)))}
      </View>
    );
  }, [colors, expanded, loadingKeys, onCellPress, onToggle, testID, width]);

  const headText = text({ fontWeight: '700', textAlign: 'center' });
  return (
    <ScrollView horizontal testID={testID} showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: width }}>
      <View style={{ width, flex: 1 }}>
        <View testID={`${testID}-head`} style={{ backgroundColor: colors.headerBackground, borderBottomColor: colors.border, borderBottomWidth: 1 }}>
          <View style={[styles.row, { height: 28 }]}>
            <View style={{ width: W.name + W.finish + W.cur }} />
            {kinds.map((k) => (
              <HeadCell key={k.id} title={`${pmT(k.title)}${kindCurrency[k.id] ? ` (${kindCurrency[k.id]})` : ''}`} width={SUM_PARTS.length * W.num} tip={pmT(k.tip)} testID={`${testID}-group-${k.id}`} textStyle={headText} />
            ))}
          </View>
          <View style={[styles.row, { height: 34 }]}>
            <HeadCell left title={pmT('Partner / Contract / Task')} width={W.name} tip={pmT('A line per partner; under it a line per contract; open a contract to see its projects and tasks')} testID={`${testID}-head-name`} textStyle={text({ fontWeight: '700' })} />
            <HeadCell title={pmT('Contract finish')} width={W.finish} tip={pmT('The finish date of the contract (a partner shows the earliest)')} testID={`${testID}-head-finish`} textStyle={headText} />
            <HeadCell title={pmT('Currency')} width={W.cur} tip={pmT('The currency of the contract sums')} testID={`${testID}-head-currency`} textStyle={headText} />
            {kinds.map((k) => SUM_PARTS.map((part) => (
              <HeadCell key={`${k.id}${part}`} title={pmT(part)} width={W.num} tip={pmT(PART_TIPS[part])} testID={`${testID}-head-${PARTNER_BALANCE_PART_KEY(k.id, part)}`} textStyle={headText} />
            )))}
          </View>
        </View>
        <FlatList
          data={lines}
          keyExtractor={(l) => l.node.key}
          renderItem={renderItem}
          extraData={expanded}
          initialNumToRender={40}
          windowSize={9}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          ListEmptyComponent={<Text testID={`${testID}-empty`} style={{ color: colors.text, opacity: 0.6, padding: 16 }}>{emptyText ?? pmT('Nothing to show for this period and these filters.')}</Text>}
        />
        {footer.map((f) => (
          <View key={f.label} testID={`${testID}-footer-${f.label}`} style={[styles.row, { height: ROW_H, width, backgroundColor: colors.headerBackground, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0 }]}>
            <Text style={[text({ fontWeight: '800' }), { width: W.name, paddingHorizontal: 8 }]}>{pmT('Total')}</Text>
            <View style={{ width: W.finish }} />
            <Text style={[text({ fontWeight: '800' }), styles.num, { width: W.cur, borderLeftColor: colors.border, textAlign: 'center' }]}>{f.label}</Text>
            {kinds.map((k) => SUM_PARTS.map((part) => numCell(f.cells[k.id], k.id, part, `${testID}-footer-${f.label}`, true)))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default memo(PartnerBalanceTableImpl);
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  num: { textAlign: 'right', paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
});
