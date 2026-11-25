// Visual prototypes of EstimationDashboard (react-native-paper + react-native-web). Not app code: only to be photographed (see build_prototypes.sh).
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, Button, Chip, Divider, MD3LightTheme, PaperProvider, SegmentedButtons, Surface, Text, TextInput, Badge } from 'react-native-paper';
import { POSITIONS, QUICK, TRADES, calc, fmt, fmtK, sections, totals, IDX_SMR, NR_PCT, SP_PCT, VAT_PCT, CONTINGENCY_PCT } from './sample';

export const theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: { ...MD3LightTheme.colors, elevation: { level0: 'transparent', level1: '#ffffff', level2: '#ffffff', level3: '#ffffff', level4: '#ffffff', level5: '#ffffff' }, primary: '#b45309', onPrimary: '#ffffff', primaryContainer: '#fef3c7', onPrimaryContainer: '#78350f', secondary: '#475569', secondaryContainer: '#e2e8f0', surface: '#ffffff', surfaceVariant: '#f1f5f9', background: '#f8fafc', outline: '#cbd5e1', onSurface: '#0f172a', onSurfaceVariant: '#475569' },
};
const C = { amber: '#d97706', amberSoft: '#fef3c7', blue: '#0284c7', blueSoft: '#e0f2fe', green: '#059669', greenSoft: '#d1fae5', purple: '#7c3aed', purpleSoft: '#ede9fe', rose: '#e11d48', line: '#e2e8f0', muted: '#64748b', head: '#f1f5f9' };
const GLYPH: Record<string, string> = { menu: '☰', 'dots-vertical': '⋮', 'file-excel': '▦', 'file-pdf-box': '▤', 'content-save': '▣', check: '✓', plus: '+', close: '✕', magnify: '⌕', 'chevron-down': '▾', 'chevron-right': '▸', 'arrow-left': '←', calculator: '▦', download: '⤓', 'file-document': '▤', sigma: 'Σ' };
const iconSetting = ({ name, size, color }: { name: string; size: number; color?: string }) => <Text style={{ fontSize: size * 0.85, color, lineHeight: size }}>{GLYPH[name] ?? '•'}</Text>;

const T = ({ children, w, bold, c, s = 12, align, mono }: { children: React.ReactNode; w?: number; bold?: boolean; c?: string; s?: number; align?: 'left' | 'right' | 'center'; mono?: boolean }) => (
  <Text style={{ fontSize: s, color: c ?? '#0f172a', fontWeight: bold ? '700' : '400', width: w, textAlign: align, fontVariant: mono ? ['tabular-nums'] : undefined }} numberOfLines={w ? 3 : undefined}>{children}</Text>
);
const Pill = ({ label, bg, fg }: { label: string; bg: string; fg: string }) => (
  <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}><Text style={{ fontSize: 10.5, fontWeight: '700', color: fg }}>{label}</Text></View>
);
const Bar = ({ p, color = C.amber, w = 134 }: { p: number; color?: string; w?: number }) => (
  <View style={{ width: w, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' }}><View style={{ width: Math.max(2, p * w), height: 8, backgroundColor: color }} /></View>
);
const TABS = ['Estimate', 'Takeoff (BoQ)', 'Resources', 'Cost build-up', 'Summary', 'Export'];

function Frame({ tab, children, title = 'Community Centre Block B - Estimate', sub = 'Estimation project - linked to project "Community Centre Block B"' }: { tab: string; children: React.ReactNode; title?: string; sub?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <Appbar.Header style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line, height: 56 }} elevated={false}>
        <Appbar.Action icon="menu" />
        <Appbar.Content title={title} subtitle={sub} titleStyle={{ fontSize: 17, fontWeight: '700' }} subtitleStyle={{ fontSize: 11 }} />
        <Chip compact style={{ marginRight: 8, backgroundColor: C.greenSoft }} textStyle={{ fontSize: 11, color: C.green }}>Saved 14:32</Chip>
        <Button mode="outlined" compact icon="file-excel" style={{ marginRight: 6 }}>Excel</Button>
        <Button mode="outlined" compact icon="file-pdf-box" style={{ marginRight: 6 }}>PDF</Button>
        <Button mode="contained" compact icon="content-save" style={{ marginRight: 10 }}>Save</Button>
      </Appbar.Header>
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line, paddingHorizontal: 12 }}>
        {TABS.map((t) => (
          <View key={t} style={{ paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 3, borderColor: t === tab ? C.amber : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: t === tab ? '800' : '500', color: t === tab ? '#78350f' : C.muted }}>{t}</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={{ justifyContent: 'center' }}><Text style={{ fontSize: 11, color: C.muted }}>Method: base-index · Price level: Q4 2026 · Region zone: 1</Text></View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ---- the task tree (the existing PMProjectTasksTree is reused: stage = object / LSR / section, task = position)
type TreeRow = { d: number; label: string; kind: 'obj' | 'lsr' | 'sec' | 'pos'; sum?: string; sel?: boolean; posted?: boolean };
function Tree({ rows }: { rows: TreeRow[] }) {
  return (
    <View style={{ width: 330, backgroundColor: '#fff', borderRightWidth: 1, borderColor: C.line }}>
      <View style={{ padding: 10, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <TextInput mode="outlined" dense placeholder="Search tasks" left={<TextInput.Icon icon="magnify" />} style={{ flex: 1, height: 36, fontSize: 12 }} />
        <Button compact mode="contained-tonal">+ Stage</Button>
      </View>
      <View style={{ paddingHorizontal: 10, paddingBottom: 6, flexDirection: 'row' }}><T bold c={C.muted} s={10.5}>WBS · ESTIMATE STRUCTURE</T><View style={{ flex: 1 }} /><T bold c={C.muted} s={10.5}>k, direct</T></View>
      <Divider />
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingRight: 10, paddingLeft: 10 + r.d * 16, backgroundColor: r.sel ? C.amberSoft : '#fff', borderLeftWidth: 3, borderColor: r.sel ? C.amber : 'transparent' }}>
          <Text style={{ width: 16, fontSize: 11, color: C.muted }}>{r.kind === 'pos' ? '' : '▾'}</Text>
          <View style={{ width: 22, height: 16, borderRadius: 4, backgroundColor: r.kind === 'obj' ? C.purpleSoft : r.kind === 'lsr' ? C.blueSoft : r.kind === 'sec' ? C.greenSoft : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: r.kind === 'obj' ? C.purple : r.kind === 'lsr' ? C.blue : r.kind === 'sec' ? C.green : C.muted }}>{r.kind === 'obj' ? 'OS' : r.kind === 'lsr' ? 'LS' : r.kind === 'sec' ? 'S' : '·'}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: r.kind === 'pos' ? '400' : '700' }} numberOfLines={1}>{r.label}</Text>
          {r.posted ? <Text style={{ color: '#16a34a', fontSize: 12, marginRight: 6 }}>✓</Text> : null}
          <Text style={{ fontSize: 11, color: C.muted, fontVariant: ['tabular-nums'] }}>{r.sum}</Text>
        </View>
      ))}
    </View>
  );
}
const treeRows = (selNo = 5): TreeRow[] => {
  const rows: TreeRow[] = [{ d: 0, label: 'OS-02-01 Community Centre, Block B', kind: 'obj', sum: fmtK(totals().direct * 3.1) }, { d: 1, label: 'LS-02-01-01 Earthworks and foundations', kind: 'lsr', sum: fmtK(totals().direct) }];
  sections().forEach((s) => {
    rows.push({ d: 2, label: s, kind: 'sec', sum: fmtK(totals(POSITIONS.filter((p) => p.section === s)).direct) });
    POSITIONS.filter((p) => p.section === s).forEach((p) => rows.push({ d: 3, label: `${p.no}. ${p.name.slice(0, 34)}…`, kind: 'pos', sum: fmtK(calc(p).direct), sel: p.no === selNo, posted: p.no < 5 }));
  });
  rows.push({ d: 1, label: 'LS-02-01-02 Superstructure', kind: 'lsr', sum: fmtK(totals().direct * 1.35) }, { d: 1, label: 'LS-02-01-03 Finishes', kind: 'lsr', sum: fmtK(totals().direct * 0.8) });
  return rows;
};

// ---- 1 Estimate sheet (LSR, GOST form)
const COLS: [string, number][] = [['No', 30], ['Norm', 96], ['Description of works and costs', 190], ['Unit', 52], ['Qty', 52], ['Coef.', 40], ['Qty total', 56], ['Unit cost (base)', 76], ['Total (base)', 84], ['Index', 44], ['Total, current', 90]];
function Screen1() {
  const t = totals();
  const sel = POSITIONS[4], sc = calc(sel);
  let lastSec = '';
  return (
    <Frame tab="Estimate" title="LS-02-01-01 Earthworks and foundations" sub="Local estimate · base-index method · links to tasks and task lines of the estimation project">
      <View style={{ flexDirection: 'row', flex: 1 }}>
        <Tree rows={treeRows()} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line, flexWrap: 'wrap' }}>
            <SegmentedButtons style={{ width: 440 }} density="small" value="gost" onValueChange={() => {}} buttons={[{ value: 'gost', label: 'Estimate sheet', showSelectedCheck: true }, { value: 'quick', label: 'Quick quote' }, { value: 'trade', label: 'Trade breakdown' }]} />
            <Button compact mode="outlined">+ Position</Button><Button compact mode="outlined">+ From norm book</Button><Button compact mode="outlined" icon="calculator">Recalculate</Button>
            <View style={{ flex: 1 }} /><Pill label="2 UNPOSTED" bg={C.amberSoft} fg="#92400e" /><Pill label="6 POSTED" bg={C.greenSoft} fg={C.green} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
            <Surface elevation={1} style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
              <View style={{ flexDirection: 'row', backgroundColor: C.head, paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: C.line }}>
                {COLS.map(([n, w]) => <View key={n} style={{ width: w, paddingHorizontal: 3 }}><T bold s={10.5} c="#334155" w={w - 6}>{n}</T></View>)}
              </View>
              {POSITIONS.map((p) => {
                const c = calc(p); const head = p.section !== lastSec; lastSec = p.section;
                return (
                  <React.Fragment key={p.no}>
                    {head ? <View style={{ backgroundColor: C.greenSoft, paddingVertical: 5, paddingHorizontal: 10 }}><T bold c="#065f46">{p.section}</T></View> : null}
                    <View style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: '#eef2f6', backgroundColor: p.no === 5 ? C.amberSoft : '#fff' }}>
                      {[String(p.no), p.code, p.name, p.unit, fmt(p.qty / 1, 2), p.coef === 1 ? '-' : String(p.coef), fmt(p.qty * p.coef, 2), fmt(p.labour + p.plant + p.material), fmt(c.direct), String(IDX_SMR), fmt(c.direct * IDX_SMR)].map((v, i) => (
                        <View key={i} style={{ width: COLS[i][1], paddingHorizontal: 3 }}><T s={11.5} w={COLS[i][1] - 6} align={i >= 4 && i !== 5 || i === 0 ? 'right' : 'left'} mono>{v}</T></View>
                      ))}
                    </View>
                    {p.no === 5 ? (
                      <View style={{ backgroundColor: '#fffbeb', paddingVertical: 4, paddingLeft: 130, borderBottomWidth: 1, borderColor: '#eef2f6' }}>
                        {[['LAB', 'Labour (payroll)', sc.labour], ['PLANT', 'Plant and machinery (incl. operators ' + fmt(sc.ops) + ')', sc.plant], ['MAT', 'Materials', sc.mat]].map(([k, n, v]) => (
                          <View key={k as string} style={{ flexDirection: 'row', paddingVertical: 2 }}><View style={{ width: 56 }}><Pill label={k as string} bg={k === 'LAB' ? C.blueSoft : k === 'PLANT' ? C.purpleSoft : C.greenSoft} fg={k === 'LAB' ? C.blue : k === 'PLANT' ? C.purple : C.green} /></View><T s={11} w={344} c="#475569">{n as string}</T><View style={{ width: 76 }} /><T s={11.5} mono w={84} align="right">{fmt(v as number)}</T></View>
                        ))}
                      </View>
                    ) : null}
                  </React.Fragment>
                );
              })}
              {[['Total direct costs', t.direct], ['  of which payroll (labour + operators)', t.payroll], [`Overheads, ${NR_PCT}% of payroll`, t.oh], [`Estimated profit, ${SP_PCT}% of payroll`, t.profit], ['TOTAL, base prices', t.base], [`TOTAL, current prices (index ${IDX_SMR})`, t.current]].map(([n, v], i, a) => (
                <View key={n as string} style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: i >= 4 ? C.amberSoft : '#fff', borderTopWidth: i === 0 ? 2 : 0, borderColor: C.line }}>
                  <View style={{ flex: 1 }}><T bold={i === 0 || i >= 4} s={12}>{n as string}</T></View><T bold={i >= 4} mono s={12.5} w={130} align="right">{fmt(v as number)}</T>
                </View>
              ))}
            </Surface>
          </ScrollView>
        </View>
        <View style={{ width: 270, backgroundColor: '#fff', borderLeftWidth: 1, borderColor: C.line, padding: 12 }}>
          <T bold s={13}>Position 5 · inspector</T><T c={C.muted} s={11}>Reinforced concrete strip foundations</T>
          <View style={{ height: 8 }} />
          <TextInput mode="outlined" dense label="Justification (norm)" value="FER 06-01-001-16" style={{ marginBottom: 6, fontSize: 12 }} />
          <View style={{ flexDirection: 'row', gap: 6 }}><TextInput mode="outlined" dense label="Qty" value="1.24" style={{ flex: 1, fontSize: 12 }} /><TextInput mode="outlined" dense label="Unit" value="100 m3" style={{ flex: 1, fontSize: 12 }} /></View>
          <View style={{ height: 6 }} />
          <TextInput mode="outlined" dense label="Budget item" value="Concrete works" right={<TextInput.Icon icon="chevron-down" />} style={{ fontSize: 12 }} />
          <View style={{ height: 6 }} />
          <TextInput mode="outlined" dense label="Business unit" value="Civil / Structures" right={<TextInput.Icon icon="chevron-down" />} style={{ fontSize: 12 }} />
          <View style={{ height: 10 }} /><Divider /><View style={{ height: 8 }} />
          <T bold s={12}>Maps to task lines</T>
          {[['Time · work center', 'Concrete gang A', C.blue, fmt(sc.labour)], ['Time · equipment', 'Concrete pump, excavator', C.purple, fmt(sc.plant)], ['Material', 'Concrete B25, rebar, formwork', C.green, fmt(sc.mat)]].map(([g, n, col, v]) => (
            <View key={g as string} style={{ marginTop: 8, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line }}>
              <View style={{ flexDirection: 'row' }}><Pill label={(g as string).toUpperCase()} bg="#f1f5f9" fg={col as string} /><View style={{ flex: 1 }} /><T s={11} mono>{v as string}</T></View><T s={11.5} c="#334155">{n as string}</T>
            </View>
          ))}
          <View style={{ height: 10 }} />
          <T bold s={12}>Coefficients applied</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}><Chip compact textStyle={{ fontSize: 11 }}>none</Chip><Chip compact icon="plus" textStyle={{ fontSize: 11 }}>add</Chip></View>
          <View style={{ flex: 1 }} />
          <View style={{ padding: 8, borderRadius: 8, backgroundColor: C.blueSoft }}><T s={11} c="#075985">Norm book rows fill code, unit, unit costs and the resource split. Everything stays editable.</T></View>
        </View>
      </View>
    </Frame>
  );
}

// ---- 2 Quick quote
function Screen2() {
  const rows = QUICK.map((q) => ({ ...q, total: q.qty * q.cost, price: q.qty * q.cost * (1 + q.markup / 100) }));
  const cost = rows.reduce((a, r) => a + r.total, 0), price = rows.reduce((a, r) => a + r.price, 0);
  const cols: [string, number][] = [['ID', 40], ['Status', 90], ['Category (management genus / budget item)', 250], ['Task description', 300], ['Unit', 70], ['Qty', 60], ['Cost / unit', 90], ['Cost', 90], ['Markup %', 84], ['Price', 96]];
  return (
    <Frame tab="Estimate" title="Quick quote - Kitchen refurbishment" sub="Layout 2 · one line = one task · fast for small jobs and client quotes">
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {[['Cost', fmt(cost), C.blue, C.blueSoft], ['Profit', fmt(price - cost), C.green, C.greenSoft], ['Margin', fmt(((price - cost) / price) * 100, 1) + ' %', C.purple, C.purpleSoft], ['Total price', fmt(price), '#92400e', C.amberSoft]].map(([n, v, fg, bg]) => (
            <Surface key={n as string} elevation={1} style={{ flex: 1, borderRadius: 12, padding: 14, backgroundColor: bg as string }}><T s={11} c={fg as string} bold>{(n as string).toUpperCase()}</T><Text style={{ fontSize: 26, fontWeight: '800', color: fg as string }}>{v as string}</Text></Surface>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <SegmentedButtons style={{ width: 470 }} density="small" value="quick" onValueChange={() => {}} buttons={[{ value: 'gost', label: 'Estimate sheet' }, { value: 'quick', label: 'Quick quote', showSelectedCheck: true }, { value: 'trade', label: 'Trade breakdown' }]} />
          {['All', 'Open', 'Complete'].map((c, i) => <Chip key={c} selected={i === 0} compact>{c}</Chip>)}
          <View style={{ flex: 1 }} /><Button compact mode="outlined">+ Add line</Button><Button compact mode="outlined">Paste from Excel</Button><Button compact mode="outlined">Mark-up for all…</Button>
        </View>
        <Surface elevation={1} style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: 'row', backgroundColor: C.head, paddingVertical: 8, paddingHorizontal: 8 }}>{cols.map(([n, w]) => <View key={n} style={{ width: w, paddingHorizontal: 4 }}><T bold s={10.5} c="#334155" w={w - 8}>{n}</T></View>)}</View>
          {rows.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderColor: '#eef2f6' }}>
              <View style={{ width: 40, paddingHorizontal: 4 }}><T mono>{r.id}</T></View>
              <View style={{ width: 90, paddingHorizontal: 4 }}><Pill label={r.status.toUpperCase()} bg={r.status === 'Complete' ? C.greenSoft : C.blueSoft} fg={r.status === 'Complete' ? C.green : C.blue} /></View>
              <View style={{ width: 250, paddingHorizontal: 4 }}><T>{r.cat}</T></View>
              <View style={{ width: 300, paddingHorizontal: 4 }}><T>{r.task}</T></View>
              <View style={{ width: 70, paddingHorizontal: 4 }}><T>{r.unit}</T></View>
              <View style={{ width: 60, paddingHorizontal: 4 }}><T mono align="right">{fmt(r.qty, r.qty % 1 ? 2 : 0)}</T></View>
              <View style={{ width: 90, paddingHorizontal: 4 }}><T mono align="right">{fmt(r.cost)}</T></View>
              <View style={{ width: 90, paddingHorizontal: 4 }}><T mono align="right">{fmt(r.total)}</T></View>
              <View style={{ width: 84, paddingHorizontal: 4 }}><T mono align="right">{r.markup} %</T></View>
              <View style={{ width: 96, paddingHorizontal: 4 }}><T mono bold align="right">{fmt(r.price)}</T></View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', backgroundColor: C.amberSoft, padding: 8 }}><View style={{ flex: 1 }}><T bold>Total</T></View><T bold mono w={100} align="right">{fmt(cost)}</T><T bold mono w={190} align="right">{fmt(price)}</T></View>
        </Surface>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line }}><T bold s={12}>How it is stored</T><T s={11.5} c="#475569">Each line is ONE task of the estimation project. Cost = a Material or Time task line; Category = the budget item; mark-up and price go to a Revenue line when the quote is released.</T></View>
          <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line }}><T bold s={12}>Needs only</T><T s={11.5} c="#475569">Category, description, unit, quantity, cost per unit, mark-up. No norm book, no indices, no overheads.</T></View>
        </View>
      </View>
    </Frame>
  );
}

// ---- 3 Trade breakdown
function Screen3() {
  const area = 4500, rows = TRADES.map((t) => ({ ...t, total: t.labour + t.material, m2: (t.labour + t.material) / area }));
  const sub = rows.reduce((a, r) => a + r.total, 0), max = Math.max(...rows.map((r) => r.total));
  const add = [['General conditions', 2.5], ['Insurance', 3], ['Fees', 2], ['Contingency', CONTINGENCY_PCT]] as [string, number][];
  const addSum = add.reduce((a, [, p]) => a + (sub * p) / 100, 0);
  return (
    <Frame tab="Estimate" title="Trade breakdown - Commercial building" sub="Layout 3 · cost by trade, labour vs materials, cost per m² · for early (concept) estimates">
      <View style={{ flexDirection: 'row', flex: 1, padding: 14, gap: 14 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <SegmentedButtons style={{ width: 470 }} density="small" value="trade" onValueChange={() => {}} buttons={[{ value: 'gost', label: 'Estimate sheet' }, { value: 'quick', label: 'Quick quote' }, { value: 'trade', label: 'Trade breakdown', showSelectedCheck: true }]} />
            <TextInput mode="outlined" dense label="Building area, m²" value="4 500" style={{ width: 150, fontSize: 12 }} /><TextInput mode="outlined" dense label="Site area, m²" value="6 250" style={{ width: 140, fontSize: 12 }} />
          </View>
          <Surface elevation={1} style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head, padding: 8 }}>{[['Trade', 190], ['Notes', 110], ['Labour', 90], ['Materials', 90], ['Total cost', 96], ['Cost / m²', 80], ['Share', 150]].map(([n, w]) => <View key={n as string} style={{ width: w as number, paddingHorizontal: 4 }}><T bold s={10.5} c="#334155">{n as string}</T></View>)}</View>
            {rows.map((r) => (
              <View key={r.trade} style={{ flexDirection: 'row', alignItems: 'center', padding: 7, borderTopWidth: 1, borderColor: '#eef2f6' }}>
                <View style={{ width: 190, paddingHorizontal: 4 }}><T>{r.trade}</T></View><View style={{ width: 110, paddingHorizontal: 4 }}><T c={C.muted} s={11}>-</T></View>
                <View style={{ width: 90, paddingHorizontal: 4 }}><T mono align="right">{fmt(r.labour, 0)}</T></View><View style={{ width: 90, paddingHorizontal: 4 }}><T mono align="right">{fmt(r.material, 0)}</T></View>
                <View style={{ width: 96, paddingHorizontal: 4 }}><T mono bold align="right">{fmt(r.total, 0)}</T></View><View style={{ width: 80, paddingHorizontal: 4 }}><T mono align="right">{fmt(r.m2)}</T></View>
                <View style={{ width: 150, paddingHorizontal: 8 }}><Bar p={r.total / max} /></View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', backgroundColor: C.amberSoft, padding: 8 }}><View style={{ width: 300 }}><T bold>Sitework and building subtotal</T></View><T mono bold w={90} align="right">{fmt(rows.reduce((a, r) => a + r.labour, 0), 0)}</T><T mono bold w={90} align="right">{fmt(rows.reduce((a, r) => a + r.material, 0), 0)}</T><T mono bold w={96} align="right">{fmt(sub, 0)}</T><T mono bold w={80} align="right">{fmt(sub / area)}</T></View>
          </Surface>
        </View>
        <View style={{ width: 320 }}>
          <Surface elevation={1} style={{ borderRadius: 12, padding: 14, backgroundColor: '#fff' }}>
            <T bold s={13}>Allowances (percent of subtotal)</T>
            {add.map(([n, p]) => (<View key={n} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}><View style={{ flex: 1 }}><T>{n}</T></View><TextInput mode="outlined" dense value={p + ' %'} style={{ width: 84, height: 32, fontSize: 12 }} /><T mono w={80} align="right">{fmt((sub * p) / 100, 0)}</T></View>))}
            <Divider style={{ marginVertical: 10 }} />
            <View style={{ flexDirection: 'row' }}><View style={{ flex: 1 }}><T bold s={13}>Estimate total</T></View><Text style={{ fontWeight: '800', fontSize: 20, color: '#92400e', fontVariant: ['tabular-nums'] }}>{fmt(sub + addSum, 0)}</Text></View>
            <T s={11} c={C.muted}>{fmt((sub + addSum) / area)} per m² of building</T>
          </Surface>
          <Surface elevation={1} style={{ borderRadius: 12, padding: 14, backgroundColor: '#fff', marginTop: 12 }}>
            <T bold s={13}>Labour / materials split</T>
            <View style={{ flexDirection: 'row', height: 22, borderRadius: 6, overflow: 'hidden', marginTop: 10 }}><View style={{ flex: rows.reduce((a, r) => a + r.labour, 0), backgroundColor: C.blue }} /><View style={{ flex: rows.reduce((a, r) => a + r.material, 0), backgroundColor: C.amber }} /></View>
            <View style={{ flexDirection: 'row', marginTop: 6, gap: 14 }}><T s={11} c={C.blue} bold>■ Labour {fmt((rows.reduce((a, r) => a + r.labour, 0) / sub) * 100, 0)}%</T><T s={11} c="#92400e" bold>■ Materials {fmt((rows.reduce((a, r) => a + r.material, 0) / sub) * 100, 0)}%</T></View>
          </Surface>
          <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: C.blueSoft }}><T s={11} c="#075985">Each trade is a stage of the estimation project; its labour and materials are two task lines. Converting a concept estimate to the full estimate sheet keeps the stage and replaces the lump sums by positions.</T></View>
        </View>
      </View>
    </Frame>
  );
}

// ---- 4 Takeoff
function Screen4() {
  const rows = [
    ['TO-001', 'Excavation, trench and pit', 'A-101, C-3', '=A*D', 'A 560.0 m2 · D 1.50', 840.0, 'm3', 'Position 1'], ['TO-002', 'Hand trimming of trench bottom', 'A-101', '=L*W*0.25', 'L 60.0 · W 2.4', 36.0, 'm3', 'Position 2'],
    ['TO-003', 'Blinding under strip footings', 'S-201', '=L*W*0.1', 'L 60.0 · W 3.0', 18.0, 'm3', 'Position 4'], ['TO-004', 'Strip foundations, concrete', 'S-202, S-210', '=L*W*H', 'L 62.0 · W 2.0 · H 1.0', 124.0, 'm3', 'Position 5'],
    ['TO-005', 'Waterproofing, horizontal', 'S-202', '=L*W', 'L 65.0 · W 8.0', 520.0, 'm2', 'Position 6'], ['TO-006', 'External walls, blocks 300', 'A-210..A-214', '=(P*H-OP)*T', 'P 139.6 · H 3.6 · T 0.3 · openings 9.1', 148.04, 'm3', 'Position 7'],
  ];
  return (
    <Frame tab="Takeoff (BoQ)" title="Bill of quantities - volumes of work" sub="Quantities with the calculation formula and the drawing reference · feeds the positions of the estimate">
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <Chip icon="check" selected compact>All</Chip><Chip compact>Not linked (0)</Chip><Chip compact>Changed after drawing revision (1)</Chip>
          <View style={{ flex: 1 }} /><Button compact mode="outlined">+ Quantity line</Button><Button compact mode="outlined">Import BoQ (Excel / BIM)</Button><Button compact mode="contained-tonal">Update positions</Button>
        </View>
        <Surface elevation={1} style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: 'row', backgroundColor: C.head, padding: 8 }}>{[['Ref', 70], ['Description', 230], ['Drawing', 110], ['Formula', 120], ['Variables', 250], ['Quantity', 90], ['Unit', 50], ['Linked to', 110], ['Status', 100]].map(([n, w]) => <View key={n as string} style={{ width: w as number, paddingHorizontal: 4 }}><T bold s={10.5} c="#334155">{n as string}</T></View>)}</View>
          {rows.map((r, i) => (
            <View key={r[0] as string} style={{ flexDirection: 'row', alignItems: 'center', padding: 7, borderTopWidth: 1, borderColor: '#eef2f6', backgroundColor: i === 3 ? '#fffbeb' : '#fff' }}>
              <View style={{ width: 70, paddingHorizontal: 4 }}><T mono>{r[0] as string}</T></View><View style={{ width: 230, paddingHorizontal: 4 }}><T>{r[1] as string}</T></View><View style={{ width: 110, paddingHorizontal: 4 }}><T s={11} c={C.blue}>{r[2] as string}</T></View>
              <View style={{ width: 120, paddingHorizontal: 4 }}><T mono s={11}>{r[3] as string}</T></View><View style={{ width: 250, paddingHorizontal: 4 }}><T s={11} c="#475569">{r[4] as string}</T></View>
              <View style={{ width: 90, paddingHorizontal: 4 }}><T mono bold align="right">{fmt(r[5] as number)}</T></View><View style={{ width: 50, paddingHorizontal: 4 }}><T>{r[6] as string}</T></View>
              <View style={{ width: 110, paddingHorizontal: 4 }}><Pill label={(r[7] as string).toUpperCase()} bg={C.greenSoft} fg={C.green} /></View><View style={{ width: 100, paddingHorizontal: 4 }}>{i === 3 ? <Pill label="REV. B CHANGED" bg={C.amberSoft} fg="#92400e" /> : <Pill label="IN SYNC" bg="#f1f5f9" fg={C.muted} />}</View>
            </View>
          ))}
        </Surface>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line }}><T bold s={12}>Formula editor · TO-004</T><View style={{ height: 6 }} /><TextInput mode="outlined" dense value="=L*W*H" style={{ fontSize: 13 }} /><T s={11} c={C.muted}>L 62.0 · W 2.0 · H 1.0 = 124.00 m3 = 1.24 of the norm unit (100 m3). Variables are named; a formula is checked, never executed as code.</T></View>
          <View style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line }}><T bold s={12}>Sources</T><T s={11.5} c="#475569">Typed by hand · pasted from Excel · imported from the BIM model of the project (IFC quantities per element) · linked to a drawing sheet. A drawing revision flags the lines that must be re-checked.</T></View>
        </View>
      </View>
    </Frame>
  );
}

// ---- 5 Summary (LSR -> OS -> SSRSS)
function Screen5() {
  const t = totals(); const k = (n: number) => n / 1000;
  const lsr = [['LS-02-01-01', 'Earthworks and foundations', t.direct, t.oh + t.profit], ['LS-02-01-02', 'Superstructure', t.direct * 1.35, (t.oh + t.profit) * 1.35], ['LS-02-01-03', 'Finishes', t.direct * 0.8, (t.oh + t.profit) * 0.8]] as [string, string, number, number][];
  const obj = lsr.reduce((a, r) => a + (r[2] + r[3]) * IDX_SMR, 0);
  const chapters: [number, string, number][] = [[1, 'Site preparation', obj * 0.04], [2, 'Main construction objects', obj], [3, 'Auxiliary and service objects', obj * 0.06], [6, 'External utility networks', obj * 0.09], [7, 'Landscaping', obj * 0.05], [8, 'Temporary buildings and structures', obj * 0.031], [9, 'Other works and costs', obj * 0.052], [10, 'Client supervision, technical oversight', obj * 0.024], [12, 'Design, surveys, expert review', obj * 0.058]];
  const s12 = chapters.reduce((a, c) => a + c[2], 0), res = (s12 * CONTINGENCY_PCT) / 100, vat = ((s12 + res) * VAT_PCT) / 100, all = s12 + res + vat, maxc = Math.max(...chapters.map((c) => c[2]));
  return (
    <Frame tab="Summary" title="SSRSS-01 Summary estimate of construction cost" sub="Local estimates → object estimate → summary estimate · thousands, project currency · rounding as GOST 421/pr item 42">
      <View style={{ flexDirection: 'row', flex: 1, padding: 14, gap: 14 }}>
        <View style={{ width: 470 }}>
          <T bold s={13}>Estimate hierarchy</T>
          <Surface elevation={1} style={{ borderRadius: 10, marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head, padding: 8 }}><View style={{ flex: 1 }}><T bold s={10.5}>CODE · NAME</T></View><T bold s={10.5} w={80} align="right">DIRECT</T><T bold s={10.5} w={90} align="right">CURRENT, k</T></View>
            {lsr.map((r) => (<View key={r[0]} style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#eef2f6' }}><View style={{ flex: 1 }}><T bold s={11} c={C.blue}>{r[0]}</T><T s={11.5}>{r[1]}</T></View><T mono w={80} align="right">{fmtK(r[2])}</T><T mono w={90} align="right" bold>{fmt(k((r[2] + r[3]) * IDX_SMR))}</T></View>))}
            <View style={{ flexDirection: 'row', padding: 8, backgroundColor: C.purpleSoft }}><View style={{ flex: 1 }}><T bold s={11} c={C.purple}>OS-02-01</T><T s={11.5}>Community Centre, Block B</T></View><T mono bold w={170} align="right">{fmt(k(obj))}</T></View>
          </Surface>
          <View style={{ height: 12 }} />
          <T bold s={13}>Documents checked before export</T>
          {[['Every position has a norm or a source', true], ['Quantities linked to BoQ', true], ['Indices set for the price level date', true], ['Overheads / profit norms chosen for every LS', true], ['2 positions without a budget item', false]].map(([n, ok]) => (<View key={n as string} style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}><Text style={{ color: ok ? C.green : C.rose, width: 18 }}>{ok ? '✓' : '!'}</Text><T s={12} c={ok ? '#334155' : C.rose}>{n as string}</T></View>))}
        </View>
        <View style={{ flex: 1 }}>
          <T bold s={13}>Summary estimate by chapters (thousands)</T>
          <Surface elevation={1} style={{ borderRadius: 10, marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head, padding: 8 }}><T bold s={10.5} w={46}>CH.</T><View style={{ flex: 1 }}><T bold s={10.5}>NAME</T></View><T bold s={10.5} w={110} align="right">TOTAL, k</T><View style={{ width: 170, paddingLeft: 12 }}><T bold s={10.5}>SHARE</T></View></View>
            {chapters.map((c) => (<View key={c[0]} style={{ flexDirection: 'row', alignItems: 'center', padding: 7, borderTopWidth: 1, borderColor: '#eef2f6' }}><T s={11.5} w={46} mono>{c[0]}</T><View style={{ flex: 1 }}><T>{c[1]}</T></View><T mono w={110} align="right">{fmt(k(c[2]))}</T><View style={{ width: 170, paddingLeft: 12 }}><Bar p={c[2] / maxc} color={c[0] === 2 ? C.amber : C.blue} w={150} /></View></View>))}
            {[['Total, chapters 1 - 12', s12, false], [`Contingency, ${CONTINGENCY_PCT}% of chapters 1 - 12`, res, false], [`VAT ${VAT_PCT}% (rate from settings)`, vat, false], ['TOTAL WITH VAT', all, true]].map(([n, v, b]) => (<View key={n as string} style={{ flexDirection: 'row', padding: 8, backgroundColor: b ? C.amberSoft : '#fff', borderTopWidth: 1, borderColor: C.line }}><View style={{ flex: 1 }}><T bold={!!b || (n as string).startsWith('Total')}>{n as string}</T></View><T mono bold={!!b} w={120} align="right" s={b ? 14 : 12}>{fmt(k(v as number))}</T><View style={{ width: 170 }} /></View>))}
          </Surface>
          <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: C.blueSoft }}><T s={11} c="#075985">Chapters, totals after chapters 1-7, 1-8, 1-9 and 1-12, the contingency and the VAT are calculated in the order of the Methodology (items 141 - 143, 179 - 181). The contingency cap depends on the kind of object and is set by the client.</T></View>
        </View>
      </View>
    </Frame>
  );
}

// ---- 6 Export
function Screen6() {
  const t = totals();
  return (
    <Frame tab="Export" title="Export estimate documents" sub="Excel and PDF in the forms of the Methodology (Order 421/pr, appendices 2 - 7)">
      <View style={{ flexDirection: 'row', flex: 1, padding: 14, gap: 14 }}>
        <View style={{ width: 440 }}>
          <Surface elevation={1} style={{ borderRadius: 12, padding: 14, backgroundColor: '#fff' }}>
            <T bold s={13}>1 · Documents</T>
            {[['LS-02-01-01 Local estimate (App. 2)', true], ['LS-02-01-02 Local estimate', true], ['LS-02-01-03 Local estimate', true], ['OS-02-01 Object estimate (App. 5)', true], ['SSRSS-01 Summary estimate (App. 6)', true], ['Cost summary (App. 7)', false], ['Resource sheet', true], ['Bill of quantities', true], ['Explanatory note', false]].map(([n, on]) => (<View key={n as string} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}><View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: on ? C.amber : '#cbd5e1', backgroundColor: on ? C.amber : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>{on ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text> : null}</View><T s={12}>{n as string}</T></View>))}
            <Divider style={{ marginVertical: 12 }} /><T bold s={13}>2 · Format</T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Chip selected icon="file-excel">Excel (.xlsx)</Chip><Chip selected icon="file-pdf-box">PDF</Chip></View>
            <Divider style={{ marginVertical: 12 }} /><T bold s={13}>3 · Header and signatures</T>
            <TextInput mode="outlined" dense label="Client" value="Community Trust Ltd" style={{ marginTop: 6, fontSize: 12 }} /><TextInput mode="outlined" dense label="Compiled by" value="Chief estimator" style={{ marginTop: 6, fontSize: 12 }} /><TextInput mode="outlined" dense label="Approved on / document" value="Order 12, 02 Dec 2026" style={{ marginTop: 6, fontSize: 12 }} />
            <View style={{ height: 12 }} /><View style={{ flexDirection: 'row', gap: 8 }}><Button mode="contained" icon="download" style={{ flex: 1 }}>Export 5 files</Button><Button mode="outlined">Cancel</Button></View>
            <T s={10.5} c={C.muted}>Progress bar and the list of steps run while the files are made; Cancel stops between files.</T>
          </Surface>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T bold s={13}>Preview · page 1 of 6 · Local estimate form</T>
          <Surface elevation={3} style={{ marginTop: 10, width: 600, padding: 26, backgroundColor: '#fff', borderRadius: 4 }}>
            <T s={9.5} c={C.muted} align="right">Appendix 2 to the Methodology · recommended form</T>
            <View style={{ height: 8 }} /><T s={11} c="#334155">Region: Sample Region · Price zone 1</T><View style={{ height: 8 }} />
            <T align="center" bold s={12}>LOCAL ESTIMATE No. LS-02-01-01</T><T align="center" s={10.5}>Earthworks and foundations</T><T align="center" s={9.5} c={C.muted}>Community Centre, Block B</T><View style={{ height: 6 }} />
            <T s={10}>Compiled by the base-index method · Basis: drawings A-101..A-214, S-201..S-210</T><View style={{ height: 6 }} />
            <T s={10}>Estimate cost: <Text style={{ fontWeight: '700' }}>{fmt(t.base / 1000)}</Text> k (base) · <Text style={{ fontWeight: '700' }}>{fmt(t.current / 1000)}</Text> k (current)</T>
            <T s={10}>Payroll {fmt(t.payroll / 1000)} k · Labour hours 1 482.5</T><View style={{ height: 8 }} />
            <View style={{ borderWidth: 1, borderColor: '#334155' }}>
              <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9' }}>{['No', 'Norm', 'Description', 'Unit', 'Qty', 'Unit cost', 'Total', 'Index', 'Current'].map((h, i) => (<View key={h} style={{ flex: i === 2 ? 3 : 1, borderRightWidth: 1, borderColor: '#334155', padding: 3 }}><T s={8.5} bold align="center">{h}</T></View>))}</View>
              {POSITIONS.slice(0, 5).map((p) => { const c = calc(p); return (<View key={p.no} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#334155' }}>{[String(p.no), p.code.replace('FER ', ''), p.name.slice(0, 44), p.unit, fmt(p.qty), fmt(p.labour + p.plant + p.material, 0), fmt(c.direct, 0), String(IDX_SMR), fmt(c.direct * IDX_SMR, 0)].map((v, i) => (<View key={i} style={{ flex: i === 2 ? 3 : 1, borderRightWidth: 1, borderColor: '#334155', padding: 3 }}><Text style={{ fontSize: 8.5, textAlign: i === 2 ? 'left' : 'right' }}>{v}</Text></View>))}</View>); })}
            </View>
            <View style={{ height: 14 }} /><View style={{ flexDirection: 'row' }}><T s={10} w={200}>Compiled by ______________</T><T s={10}>Checked by ______________</T></View>
          </Surface>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><Badge style={{ backgroundColor: C.green }}>OK</Badge><T s={11} c={C.muted}>Rubles-to-kopeck rounding in local estimates; thousands in object and summary estimates.</T></View>
        </View>
      </View>
    </Frame>
  );
}

export const SCREENS: Record<string, { name: string; node: React.ReactElement }> = {
  '1': { name: 'proto_01_estimate_sheet_gost_form', node: <Screen1 /> },
  '2': { name: 'proto_02_quick_quote_layout', node: <Screen2 /> },
  '3': { name: 'proto_03_trade_breakdown_layout', node: <Screen3 /> },
  '4': { name: 'proto_04_takeoff_boq', node: <Screen4 /> },
  '5': { name: 'proto_05_summary_ls_os_ssrss', node: <Screen5 /> },
  '6': { name: 'proto_06_export_excel_pdf', node: <Screen6 /> },
};

export default function App({ id }: { id: string }) {
  return (
    <PaperProvider theme={theme} settings={{ icon: iconSetting as any }}>
      <View style={{ width: 1440, height: 900, overflow: 'hidden' }}>{(SCREENS[id] ?? SCREENS['1']).node}</View>
    </PaperProvider>
  );
}
