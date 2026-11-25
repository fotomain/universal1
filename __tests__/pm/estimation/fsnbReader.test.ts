import { classifyNormFile, readNormFile, resourceClassOf } from '../../../kit8/pm/estimation/import/fsnbReader';
import { decodeEntities, xmlEvents } from '../../../kit8/pm/estimation/import/xmlTokenizer';

const enc = (s: string) => new TextEncoder().encode(s);
const NORMS = `﻿<?xml version="1.0" encoding="utf-8"?>
<base xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" BaseName="Test base (sup 20)">
  <Decrees><Decree><ApprovingActNumber>727/пр</ApprovingActNumber></Decree></Decrees>
  <ResourcesDirectory>
    <ResourceCategory Type="СТРОИТЕЛЬНЫЕ РАБОТЫ" CodePrefix="ГЭСН">
      <Section Name="Земляные работы" Type="Сборник" Code="01">
        <Section Name="Разработка грунта &quot;драглайн&quot; &amp; прочее" Type="Таблица" Code="01-01-001">
          <NameGroup BeginName="Разработка грунта в отвал экскаваторами с ковшом:">
            <Work Code="01-01-001-01" EndName="15 м3, группа грунтов 1" MeasureUnit="1000 м3">
              <Content><Item Text="Разработка грунта навымет." /><Item Text="Содержание канав." /></Content>
              <Resources>
                <Resource Code="1-100-38" EndName="Средний разряд работы 3,8" Quantity="1.54" />
                <Resource Code="2" Quantity="6.4" />
                <Resource Code="91.01.01-035" EndName="Бульдозеры" Quantity="1,6" />
              </Resources>
              <NrSp><ReasonItem Nr="Пр/812-001.1" Sp="Пр/774-001.1" /></NrSp>
            </Work>
          </NameGroup>
        </Section>
      </Section>
    </ResourceCategory>
  </ResourcesDirectory>
</base>`;
const RES = `<?xml version="1.0"?>
<ResourceCatalog><Decrees><ApprovingActNumber>727/пр</ApprovingActNumber></Decrees>
  <ResourcesDirectory>
    <ResourceCategory Type="Материал">
      <Section Name="Материалы" Code="01" Type="Книга">
        <Section Name="Доски" Code="01.1.01.02" Type="Группа">
          <Resource Code="01.1.01.02-0011" Name="Доска электротехническая" MeasureUnit="100 м2"><Prices><Price Cost="35537.67" OptCost="34458.33" /></Prices></Resource>
        </Section>
      </Section>
    </ResourceCategory>
    <ResourceCategory Type="МашиныМеханизмы">
      <Section Name="Бульдозеры" Code="91.01.01" Type="Группа">
        <Resource Code="91.01.01-014" Name="Бульдозеры-рыхлители" MeasureUnit="маш.-ч"><Prices><Price SalaryMach="386.65" LabourMach="1.00" PriceCostWithoutSalary="961.73" /></Prices></Resource>
      </Section>
    </ResourceCategory>
  </ResourcesDirectory>
</ResourceCatalog>`;
const OPTS = { bookGUID: 'book1', convert: (a: number) => a / 100, sourceCurrency: 'RUB', currency: 'EUR', language: 'ru' };

describe('xml tokenizer', () => {
  it('reads elements, attributes, entities, self-closing tags, text and skips comments / declarations', () => {
    const ev = [...xmlEvents(enc('<?xml version="1.0"?><a x="1" y=\'2&amp;3\'><!-- c --><b/>hi &lt;there&gt;</a>'))];
    expect(ev.map((e) => (e.type === 'text' ? `t:${e.text}` : `${e.type}:${e.name}`))).toEqual(['open:a', 'open:b', 'close:b', 't:hi <there>', 'close:a']);
    expect((ev[0] as any).attrs).toEqual({ x: '1', y: '2&3' });
    expect(decodeEntities('&#1040;&#x41;&quot;')).toBe('АA"');
  });
  it('gives the same events with a tiny window as with a big one (a tag cut by a window is carried over, multi-byte letters too)', () => {
    const bytes = enc(NORMS);
    const big = [...xmlEvents(bytes, 1 << 20)];
    const small = [...xmlEvents(bytes, 7)];
    expect(small).toEqual(big);
    expect(big.length).toBeGreaterThan(30);
  });
});

describe('FSNB reader - norms', () => {
  it('classifies the files', () => {
    expect(classifyNormFile(enc(NORMS))).toMatchObject({ kind: 'norms', root: 'base', baseName: 'Test base (sup 20)', decree: '727/пр' });
    expect(classifyNormFile(enc(RES))).toMatchObject({ kind: 'resources', root: 'ResourceCatalog' });
    expect(classifyNormFile(enc('<NewDataSet><base BaseName="x"><TechnologyGroup Code="1"><Work Code="2"/></TechnologyGroup></base></NewDataSet>')).kind).toBe('skipped');
  });
  const rows = [...readNormFile(enc(NORMS), OPTS)];
  it('makes the category, the sections and the norm with its resources, content, overhead and profit codes', () => {
    expect(rows.map((r) => r.row.rowJSON.nodeKind)).toEqual(['section', 'section', 'section', 'norm']);
    const [cat, collection, table, norm] = rows.map((r) => r.row);
    expect(cat.rowParentGUID).toBe('empty');
    expect(collection.rowParentGUID).toBe(cat.rowGUID);
    expect(table.rowParentGUID).toBe(collection.rowGUID);
    expect(norm.rowParentGUID).toBe(table.rowGUID);
    expect(table.rowJSON.title).toBe('Разработка грунта "драглайн" & прочее');
    expect(norm.rowJSON).toMatchObject({ code: 'ГЭСН01-01-001-01', unit: '1000 м3', baseType: 'ГЭСН', nrCode: 'Пр/812-001.1', spCode: 'Пр/774-001.1', language: 'ru' });
    expect(norm.rowJSON.title).toBe('Разработка грунта в отвал экскаваторами с ковшом: 15 м3, группа грунтов 1');
    expect(norm.rowJSON.content).toEqual(['Разработка грунта навымет.', 'Содержание канав.']);
    expect(norm.rowJSON.resources).toEqual([{ code: '1-100-38', qty: 1.54, name: 'Средний разряд работы 3,8' }, { code: '2', qty: 6.4 }, { code: '91.01.01-035', qty: 1.6, name: 'Бульдозеры' }]);
    expect(norm.rowOwnerGUID).toBe('book1');
  });
  it('the rowGUIDs are stable: the same file twice gives the same ids', () => {
    const again = [...readNormFile(enc(NORMS), OPTS)];
    expect(again.map((r) => r.row.rowGUID)).toEqual(rows.map((r) => r.row.rowGUID));
    expect(new Set(rows.map((r) => r.row.rowGUID)).size).toBe(rows.length);
  });
  it('resource codes are classified', () => {
    expect(['1-100-38', '2', '91.01.01-035', '01.7.03.01-0001', '3'].map(resourceClassOf)).toEqual(['labour', 'operators', 'machine', 'material', 'labour']);
  });
});

describe('FSNB reader - priced resources', () => {
  const rows = [...readNormFile(enc(RES), OPTS)];
  it('converts the prices into the currency of the book and keeps the source price', () => {
    const mat = rows.find((r) => r.row.rowJSON.code === '01.1.01.02-0011')!.row.rowJSON;
    expect(mat).toMatchObject({ nodeKind: 'resource', resourceKind: 'material', price: 355.3767, priceOpt: 344.5833, sourcePrice: 35537.67, sourcePriceOpt: 34458.33, currency: 'EUR', sourceCurrency: 'RUB', unit: '100 м2' });
  });
  it('a machine costs its operation without the operator plus the operator pay; both parts are kept', () => {
    const m = rows.find((r) => r.row.rowJSON.code === '91.01.01-014')!.row.rowJSON;
    expect(m.resourceKind).toBe('machine');
    expect(m.price).toBe(Math.round(((961.73 + 386.65) / 100) * 1e4) / 1e4);
    expect(m.operatorPay).toBe(3.8665);
    expect(m.priceWithoutOperator).toBe(9.6173);
    expect(m.sourcePrice).toBeCloseTo(1348.38, 2);
  });
  it('the groups are rows of the resource catalog with their parents', () => {
    const groups = rows.filter((r) => r.row.rowJSON.nodeKind === 'group');
    expect(groups.map((g) => g.row.rowJSON.code)).toEqual(['01', '01.1.01.02', '91.01.01']);
    expect(groups[1].row.rowParentGUID).toBe(groups[0].row.rowGUID);
    expect(rows.filter((r) => r.table === 'resource').length).toBe(rows.length);
  });
});
