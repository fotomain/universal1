// CostCalculatorResults - the right side of the screen (section 6 of documentation/PRICE_PLAN_CALCULATOR.html): total costs, the virtual machine, the bill by lines,
// the important numbers, the Realtime / traffic bars against their included amounts, the growth of the disk and the date of the price list.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { pmT } from '../../pm/i18n/pmT';
import { formatKB, formatNumber, formatPercent, formatUsd } from './costFormat';
import type { LimitingFactor } from './costModel';
import { priceListDate } from './supabasePrices';
import type { CostCalculator } from './useCostCalculator';

function limitingText(f: LimitingFactor | null): string {
  switch (f) {
    case 'memory': return pmT('A smaller machine does not have enough memory.');
    case 'cpu': return pmT('A smaller machine is too busy in the busy hour.');
    case 'databaseSize': return pmT('The database is bigger than Supabase advises for a smaller machine.');
    case 'biggestProject': return pmT('The biggest project needs a bigger machine to open, post and recalculate in time.');
    case 'pointInTimeRecovery': return pmT('Point in time recovery needs at least a Small machine.');
    case 'aboveList': return pmT('The need is above the biggest size on the list: ask Supabase.');
    default: return pmT('The smallest paid machine is enough.');
  }
}

function Card({ title, children, testID }: { title?: string; children: React.ReactNode; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {!!title && <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>}
      {children}
    </View>
  );
}

function Tile({ value, label, testID }: { value: string; label: string; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={[styles.tile, { borderColor: c.border }]}>
      <Text style={[styles.tileValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: c.text }]}>{label}</Text>
    </View>
  );
}

function UsageBar({ label, used, included, format, testID }: { label: string; used: number; included: number; format: (n: number) => string; testID: string }) {
  const { themeColors: c } = useDesignSystem();
  const share = included > 0 ? Math.min(1, used / included) : 0;
  const over = used > included;
  return (
    <View testID={testID} style={{ marginTop: 8 }}>
      <View style={styles.barHead}>
        <Text style={[styles.barLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.barLabel, { color: over ? c.error : c.text }]}>{`${format(used)} / ${format(included)}`}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: c.border }]}>
        <View style={{ width: `${share * 100}%`, height: 8, borderRadius: 4, backgroundColor: over ? c.error : c.primary }} />
      </View>
    </View>
  );
}

export default function CostCalculatorResults({ calc }: { calc: CostCalculator }) {
  const { themeColors: c } = useDesignSystem();
  const { result: r, prices, priceState } = calc;
  const inc = prices.included;
  const billLines = r.bill;

  return (
    <View testID="cost-results">
      {priceState.state !== 'fresh' && (
        <View testID="cost-price-warning" style={[styles.warning, { borderColor: c.error }]}>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {priceState.state === 'builtIn'
              ? pmT('The prices are the built-in snapshot of {{date}}, not fetched from Supabase. Check supabase.com/pricing before you rely on the sum.', { date: priceListDate(prices) })
              : pmT('The price list is {{n}} days old. Refresh it before you rely on the sum.', { n: priceState.ageDays })}
          </Text>
          {!!prices.unconfirmed?.includes('addons.ipv4') && <Text style={{ color: c.text, fontSize: 12, marginTop: 4 }}>{pmT('The IPv4 price is not confirmed on the pages that were read.')}</Text>}
        </View>
      )}

      <Card testID="cost-total-card">
        <Text style={[styles.tileLabel, { color: c.text }]}>{pmT('Total costs per month')}</Text>
        <Text testID="cost-total" style={[styles.big, { color: c.text }]}>{formatUsd(r.totalPerMonth)}</Text>
        <Text testID="cost-total-year" style={[styles.tileLabel, { color: c.text }]}>{pmT('{{n}} per year', { n: formatUsd(r.totalPerYear) })}</Text>
        <View style={styles.tiles}>
          <Tile testID="cost-per-user" value={formatUsd(r.perUser)} label={pmT('per user')} />
          <Tile testID="cost-per-project" value={formatUsd(r.perProject)} label={pmT('per project')} />
        </View>
      </Card>

      <Card title={pmT('Virtual machine')} testID="cost-machine-card">
        <Text testID="cost-machine" style={[styles.machine, { color: c.text }]}>{r.machine.size}</Text>
        <Text style={[styles.line, { color: c.text }]}>
          {pmT('{{cpu}} CPU, {{ram}} GB memory, ${{month}} a month (${{hour}} an hour)', { cpu: r.machine.cpu, ram: r.machine.memoryGB, month: formatNumber(r.machine.perMonth), hour: r.machine.perHour })}
        </Text>
        <Text testID="cost-machine-why" style={[styles.line, { color: c.text }]}>{limitingText(r.limitingFactor)}</Text>
        <Text testID="cost-machine-load" style={[styles.line, { color: c.text }]}>
          {pmT('The busy hour uses {{cpu}} of its steady CPU and {{ram}} of its memory.', { cpu: formatPercent(r.cpuLoad), ram: formatPercent(r.memoryLoad) })}
        </Text>
        {calc.nextSize ? (
          <Text testID="cost-next-size" style={[styles.line, { color: c.text }]}>
            {pmT('The next size ({{size}}, ${{usd}} a month) is needed at about {{projects}} projects and {{users}} users, when their activity grows with them.', { size: calc.nextSize.size, usd: formatNumber(calc.nextSize.perMonth), projects: formatNumber(calc.nextSize.projects), users: formatNumber(calc.nextSize.users) })}
          </Text>
        ) : (
          <Text testID="cost-next-size" style={[styles.line, { color: c.text }]}>{pmT('The machine does not change for a growth of up to 1 000 times.')}</Text>
        )}
        {r.machine.size === 'Micro' && <Text style={[styles.hint, { color: c.text }]}>{pmT('The Free plan is not an answer for real work: a Free project pauses after a week without use and has no backups.')}</Text>}
      </Card>

      <Card title={pmT('The bill')} testID="cost-bill-card">
        {billLines.map((b) => (
          <View key={b.id} testID={`cost-bill-${b.id}`} style={styles.billRow}>
            <Text style={[styles.billText, { color: c.text }]}>{pmT(b.text, b.values)}</Text>
            <Text style={[styles.billAmount, { color: c.text }]}>{b.usd ? formatUsd(b.usd) : pmT('included')}</Text>
          </View>
        ))}
        <View style={[styles.billRow, styles.billTotal, { borderTopColor: c.border }]}>
          <Text style={[styles.billText, { color: c.text, fontWeight: '700' }]}>{pmT('Total')}</Text>
          <Text style={[styles.billAmount, { color: c.text, fontWeight: '700' }]}>{formatUsd(r.totalPerMonth)}</Text>
        </View>
      </Card>

      <Card title={pmT('Important parameters')} testID="cost-important-card">
        <View style={styles.tiles}>
          <Tile testID="cost-database" value={`${formatNumber(r.databaseGB, 2)} GB`} label={pmT('database')} />
          <Tile testID="cost-disk" value={`${formatNumber(r.diskGB)} GB`} label={pmT('disk to pay for ({{n}} GB included)', { n: inc.diskGBPerProject })} />
          <Tile value={`${formatNumber(r.neededMemoryGB, 1)} GB`} label={pmT('memory needed')} />
          <Tile value={formatNumber(r.neededVcpu, 2)} label={pmT('vCPU at the busy hour')} />
          <Tile value={formatNumber(r.tasksTotal)} label={pmT('tasks in all')} />
          <Tile value={formatNumber(r.linesTotal)} label={pmT('lines in all')} />
          <Tile value={formatNumber(r.planRowsTotal)} label={pmT('plan rows')} />
        </View>
        <Text style={[styles.cardSub, { color: c.text }]}>{pmT('The biggest parts of the database')}</Text>
        {r.diskParts.slice(0, 3).map((p) => (
          <View key={p.id} testID={`cost-part-${p.id}`} style={styles.billRow}>
            <Text style={[styles.billText, { color: c.text }]}>{pmT(p.text)}</Text>
            <Text style={[styles.billAmount, { color: c.text }]}>{formatKB(p.kb)}</Text>
          </View>
        ))}
        <Text style={[styles.cardSub, { color: c.text }]}>{pmT('Against the included amounts')}</Text>
        <UsageBar testID="cost-bar-connections" label={pmT('Realtime connections')} used={r.realtimeConnections} included={inc.realtimeConnections} format={(n) => formatNumber(n)} />
        <UsageBar testID="cost-bar-messages" label={pmT('Realtime messages a month')} used={r.realtimeMessages} included={inc.realtimeMessages} format={(n) => (n >= 1e6 ? `${formatNumber(n / 1e6, 2)} M` : formatNumber(n))} />
        <UsageBar testID="cost-bar-egress" label={pmT('Egress a month')} used={r.egressGB} included={inc.egressGB} format={(n) => `${formatNumber(n, 1)} GB`} />
        <Text testID="cost-growth" style={[styles.line, { color: c.text, marginTop: 10 }]}>
          {pmT('Disk with the same activity: {{a}} GB after 12 months, {{b}} GB after 24 months.', { a: formatNumber(calc.diskIn12Months), b: formatNumber(calc.diskIn24Months) })}
        </Text>
      </Card>

      <Text testID="cost-price-date" style={[styles.hint, { color: c.text }]}>{pmT('Prices of {{date}} ({{currency}}) - {{source}}', { date: priceListDate(prices), currency: prices.currency, source: prices.source })}</Text>
      <Text style={[styles.hint, { color: c.text }]}>{pmT('An estimate, not the invoice: the load model has assumptions (see Model coefficients). It gives the cost, not the sales price.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardSub: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.75, marginTop: 14 },
  big: { fontSize: 40, fontWeight: '700', lineHeight: 46 },
  machine: { fontSize: 28, fontWeight: '700' },
  line: { fontSize: 14, marginTop: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginTop: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 130 },
  tileValue: { fontSize: 18, fontWeight: '700' },
  tileLabel: { fontSize: 12, opacity: 0.65 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  billTotal: { borderTopWidth: 1, marginTop: 6, paddingTop: 8 },
  billText: { fontSize: 14, flex: 1 },
  billAmount: { fontSize: 14, fontVariant: ['tabular-nums'] },
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, marginTop: 4, overflow: 'hidden' },
  warning: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
});
