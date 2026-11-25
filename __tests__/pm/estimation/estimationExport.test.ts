import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx, columnLetter, cellRef, safeSheetName } from '../../../kit8/pm/estimation/export/xlsxWriter';
import { buildLocalEstimateForm, buildQuotationForm, buildResourceSheet, buildSummaryForm, docKindTitle, formsToXlsx, formToTextRows, identity, summaryRowsOf } from '../../../kit8/pm/estimation/export/estimationForms';
import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';
import { exampleDocument, recalcLines } from '../../../kit8/pm/estimation/model/estimationDocumentModel';

const P = '11111111-1111-1111-1111-111111111111';
const O = { gost: false, t: identity, basis: 'budget' as const, currency: 'EUR' };

describe('xlsx writer', () => {
  it('names columns and cells like Excel and keeps sheet names legal and unique', () => {
    expect([0, 25, 26, 51, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA']);
    expect(cellRef(2, 4)).toBe('C5');
    const used = new Set<string>();
    expect(safeSheetName('LS/01:[x]?', used)).toBe('LS 01  x');
    expect(safeSheetName('LS 01  x', used)).toBe('LS 01  x 2');
    expect(safeSheetName('a'.repeat(50), new Set())).toHaveLength(31);
  });
  it('writes a zip with the parts of a workbook; text is escaped, numbers stay numbers, a formula carries its cached value', () => {
    const files = unzipSync(buildXlsx([{ name: 'S', widths: [10, 20], rows: [[{ v: 'a<b & "c"', s: 'bold' }, 5], [{ v: 12.5, f: 'SUM(B1:B1)', s: 'moneyBold' }, null]], merges: ['A1:B1'], freezeRow: 1 }]));
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(sheet).toContain('<c r="B1" s="3"><v>5</v></c>');
    expect(sheet).toContain('<f>SUM(B1:B1)</f><v>12.5</v>');
    expect(sheet).toContain('<mergeCell ref="A1:B1"/>');
    expect(sheet).toContain('<col min="2" max="2" width="20" customWidth="1"/>');
    expect(strFromU8(files['xl/workbook.xml'])).toContain('<sheet name="S" sheetId="1" r:id="rId1"/>');
  });
});

describe('the forms', () => {
  const { doc, lines } = exampleDocument(P, 'estimateSheet');
  const calc = recalcLines(lines, doc.rowJSON).lines;
  it('the local estimate: sections, numbered positions, the totals of the sample, neutral wording when the regulation switch is off', () => {
    const f = buildLocalEstimateForm(doc, calc, O);
    expect(f.subtitle).toBe('Local estimate');
    expect(JSON.stringify(f)).not.toMatch(/Methodology|Order|Russia|Minstroy/i);
    expect(f.rows.filter((r) => r.section)).toHaveLength(3);
    const positions = f.rows.filter((r) => typeof r.cells[0] === 'number');
    expect(positions.map((r) => r.cells[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const total = f.rows.find((r) => r.cells[2] === 'TOTAL')!;
    expect(total.cells[7]).toBe(1060642.56);
    expect(total.cells[9]).toBe(9270015.98);
    expect(f.rows.find((r) => r.cells[2] === 'Total direct costs')!.cells[7]).toBe(932243.71);
  });
  it('with the regulation switch ON the names of the forms of the Methodology are added', () => {
    expect(docKindTitle('local', { gost: true, t: identity })).toContain('Methodology');
    expect(docKindTitle('local', { gost: false, t: identity })).toBe('Local estimate');
    expect(docKindTitle('summary', { gost: true, t: identity })).toContain('appendix 6');
  });
  it('the Excel file has the totals as SUMIF formulas over the numbered positions with the number as cached value', () => {
    const files = unzipSync(formsToXlsx([buildLocalEstimateForm(doc, calc, O), buildResourceSheet(doc, calc, O)]));
    const s1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(s1).toMatch(/<f>SUMIF\(A\d+:A\d+,&quot;&gt;0&quot;,H\d+:H\d+\)<\/f><v>1060642.56<\/v>/);
    expect(s1).toMatch(/<f>SUMIF\(A\d+:A\d+,&quot;&gt;0&quot;,J\d+:J\d+\)<\/f><v>9270015.98<\/v>/);
    expect(strFromU8(files['xl/workbook.xml'])).toContain('LS-01-01-01');
    expect(strFromU8(files['xl/worksheets/sheet2.xml'])).toContain('<f>SUMIF(');
  });
  it('the PDF text rows have one string per column and money with two decimals', () => {
    const { headers, rows } = formToTextRows(buildLocalEstimateForm(doc, calc, O));
    expect(headers).toHaveLength(10);
    expect(rows.every((r) => r.length === 10)).toBe(true);
    expect(rows.find((r) => r[2] === 'TOTAL')![9]).toBe('9,270,015.98');
  });
  it('the quotation and the summary estimate', () => {
    const q = exampleDocument(P, 'quickQuote');
    const qf = buildQuotationForm(q.doc, recalcLines(q.lines, q.doc.rowJSON).lines, O);
    expect(qf.rows.at(-2)!.cells[8]).toBeGreaterThan(0);
    const total = calcDocument(calc, doc.rowJSON).total;
    const rows = summaryRowsOf([{ doc, total }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ chapter: 2, construction: 9270015.98, equipment: 0 });
    const sf = buildSummaryForm(rows, { ...O, contingencyPct: 2, vatPct: 20 });
    expect(sf.rows.map((r) => r.cells[1])).toEqual(expect.arrayContaining(['Total, chapters 1 - 7', 'Total, chapters 1 - 12', 'Contingency, 2 %', 'VAT, 20 %', 'TOTAL WITH VAT']));
    expect(sf.rows.at(-1)!.cells[6]).toBe(Math.round(9270.02 * 1.02 * 1.2 * 100) / 100);
    expect(sf.rows.filter((r) => /^\d+$/.test(String(r.cells[0])))).toHaveLength(12);
  });
});
