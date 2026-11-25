// Reader of the XML norm books of the Russian federal base FSNB-2022 (files of the Ministry of Construction, open XML): works (norms with their resources), the priced materials / equipment
// and the priced machines. Pure: bytes in, rows of estimation_norm_catalog / estimation_resource_catalog out (a generator: the caller sends them in batches and can stop any time).
//   norm file        <base> ... <ResourceCategory Type CodePrefix> <Section Name Type Code> ... <NameGroup BeginName> <Work Code EndName MeasureUnit> <Content><Item Text/> <Resources><Resource Code Quantity EndName/> <NrSp><ReasonItem Nr Sp/>
//   resource file    <ResourceCatalog> <ResourcesDirectory> <ResourceCategory Type = Материал | Оборудование | МашиныМеханизмы> <Section ...> <Resource Code Name MeasureUnit> <Prices><Price Cost OptCost | SalaryMach PriceCostWithoutSalary .../>
// Prices are converted by `convert` (RUB -> the currency of the book); the original price stays in rowJSON.sourcePrice. The texts stay in the source language (rowJSON.title): the importer
// decides which text is the main one and writes the translations (catalogTranslationTable).
import type { DefRow } from '../../../catalog/product/productModel';
import { normRowGUID } from '../model/estimationModel';
import { xmlEvents } from './xmlTokenizer';

export type NormFileKind = 'norms' | 'resources' | 'skipped';

export interface NormFileInfo { kind: NormFileKind; root: string; baseName?: string; decree?: string; decreeDate?: string }

/** what a file is: the root element and the first elements decide (the other FSNB files - technology groups, transition keys, correction coefficients - are skipped in version 1) */
export function classifyNormFile(bytes: Uint8Array): NormFileInfo {
  let root = '';
  let baseName: string | undefined;
  let decree: string | undefined;
  let decreeDate: string | undefined;
  let kind: NormFileKind = 'skipped';
  let opens = 0;
  let last = '';
  for (const e of xmlEvents(bytes, 256 * 1024)) {
    if (e.type === 'text') {
      if (last === 'ApprovingActNumber') decree = e.text.trim();
      if (last === 'ApprovingActDate') decreeDate = e.text.trim();
      continue;
    }
    if (e.type !== 'open') continue;
    last = e.name;
    if (++opens === 1) root = e.name;
    if (e.name === 'base' && e.attrs.BaseName) baseName = e.attrs.BaseName;
    if (e.name === 'ResourceCatalog') kind = 'resources';
    if (e.name === 'ResourceCategory' && root === 'base' && e.attrs.CodePrefix !== undefined) { kind = 'norms'; break; }
    if (e.name === 'TechnologyGroup' || e.name === 'Coefficient') break;
    if (opens > 20000) break;   // the list of decrees at the top of a norm file can be long
  }
  return { kind, root, baseName, decree, decreeDate };
}

export interface NormReadOptions {
  bookGUID: string;
  /** an amount in the source currency -> the currency of the book (rounded here to 4 decimals) */
  convert: (amount: number) => number;
  sourceCurrency: string;
  currency: string;
  /** the language of the texts in the file */
  language: string;
}

export interface CatalogImportRow {
  table: 'norm' | 'resource';
  row: DefRow<Record<string, any>>;
  /** the text in the language of the file (the title of the row is the same text until the importer replaces it) */
  originalTitle: string;
}

const RESOURCE_KIND: Record<string, string> = { Материал: 'material', Оборудование: 'equipment', МашиныМеханизмы: 'machine' };
const num = (v: string | undefined): number | null => { if (v === undefined || v === '') return null; const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : null; };
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** the code class of a resource inside a norm: 1-... labour of workers, 2 labour of machine operators, 91.... machines, 3 other labour, anything else = materials / products */
export function resourceClassOf(code: string): 'labour' | 'operators' | 'machine' | 'material' {
  if (code === '2') return 'operators';
  if (/^1-/.test(code) || code === '1' || code === '3') return 'labour';
  if (/^91\./.test(code)) return 'machine';
  return 'material';
}

export function* readNormFile(bytes: Uint8Array, opts: NormReadOptions): Generator<CatalogImportRow> {
  const { bookGUID } = opts;
  const sections: { guid: string; path: string }[] = [];
  let order = 0;
  let resourceKind = 'material';
  let prefix = '';
  let beginName = '';
  let work: { code: string; end: string; unit: string; content: string[]; resources: { code: string; qty: number; name?: string }[]; nr?: string; sp?: string } | null = null;
  let res: { code: string; name: string; unit: string; price: Record<string, string> } | null = null;
  let inResourcesOfWork = false;
  let isResourceFile = false;
  const categoryStack: boolean[] = [];
  const top = () => (sections.length ? sections[sections.length - 1] : null);

  for (const e of xmlEvents(bytes)) {
    if (e.type === 'text') continue;
    if (e.type === 'open') {
      const a = e.attrs;
      switch (e.name) {
        case 'ResourceCatalog': isResourceFile = true; break;
        case 'ResourceCategory':
          if (a.CodePrefix === undefined) { resourceKind = RESOURCE_KIND[a.Type] ?? 'material'; categoryStack.push(false); break; }
          {
            // a norm file: the category (ГЭСН, ГЭСНм ...) is the top section of its norms
            prefix = a.CodePrefix;
            const path = `cat:${prefix || a.Type}`;
            const guid = normRowGUID(bookGUID, 'sec', path);
            sections.push({ guid, path });
            categoryStack.push(true);
            yield { table: 'norm', originalTitle: a.Type ?? prefix, row: { rowGUID: guid, rowOwnerGUID: bookGUID, rowParentGUID: 'empty', orderInList: (order += 10), rowJSON: { nodeKind: 'section', code: prefix || a.Type || '', title: a.Type ?? prefix, sectionType: 'category' } } };
          }
          break;
        case 'Section': {
          const parent = top();
          const path = `${parent?.path ?? ''}/${a.Code ?? ''}|${a.Name ?? ''}`;
          const guid = normRowGUID(bookGUID, isResourceFile ? 'grp' : 'sec', path);
          sections.push({ guid, path });
          if (isResourceFile) {
            yield { table: 'resource', originalTitle: a.Name ?? '', row: { rowGUID: guid, rowOwnerGUID: bookGUID, rowParentGUID: parent?.guid ?? 'empty', orderInList: (order += 10), rowJSON: { nodeKind: 'group', code: a.Code ?? '', title: a.Name ?? '', groupType: a.Type ?? null, resourceKind } } };
          } else {
            yield { table: 'norm', originalTitle: a.Name ?? '', row: { rowGUID: guid, rowOwnerGUID: bookGUID, rowParentGUID: parent?.guid ?? 'empty', orderInList: (order += 10), rowJSON: { nodeKind: 'section', code: a.Code ?? '', title: a.Name ?? '', sectionType: a.Type ?? null } } };
          }
          break;
        }
        case 'NameGroup': beginName = a.BeginName ?? ''; break;
        case 'Work': work = { code: a.Code ?? '', end: a.EndName ?? '', unit: a.MeasureUnit ?? '', content: [], resources: [] }; inResourcesOfWork = false; break;
        case 'Item': if (work && a.Text) work.content.push(a.Text); break;
        case 'Resources': if (work) inResourcesOfWork = true; break;
        case 'Resource':
          if (work && inResourcesOfWork) { const q = num(a.Quantity); if (q !== null) work.resources.push({ code: a.Code ?? '', qty: q, ...(a.EndName ? { name: a.EndName } : {}) }); }
          else if (isResourceFile && !work) res = { code: a.Code ?? '', name: a.Name ?? '', unit: a.MeasureUnit ?? '', price: {} };
          break;
        case 'ReasonItem': if (work) { work.nr = a.Nr; work.sp = a.Sp; } break;
        case 'Price': if (res) res.price = { ...res.price, ...a }; break;
        default: break;
      }
    } else if (e.type === 'close') {
      if (e.name === 'Section') sections.pop();
      else if (e.name === 'ResourceCategory') { if (categoryStack.pop()) sections.pop(); }
      else if (e.name === 'Resources') inResourcesOfWork = false;
      else if (e.name === 'Work' && work) {
        const title = `${beginName} ${work.end}`.replace(/\s+/g, ' ').trim();
        const code = `${prefix}${work.code}`;
        const guid = normRowGUID(bookGUID, 'norm', `${prefix}|${work.code}`);
        yield {
          table: 'norm', originalTitle: title,
          row: { rowGUID: guid, rowOwnerGUID: bookGUID, rowParentGUID: top()?.guid ?? 'empty', orderInList: (order += 10),
            rowJSON: { nodeKind: 'norm', code, title, unit: work.unit, baseType: prefix, content: work.content, resources: work.resources, nrCode: work.nr ?? null, spCode: work.sp ?? null, language: opts.language } },
        };
        work = null;
      } else if (e.name === 'Resource' && res) {
        const guid = normRowGUID(bookGUID, 'res', res.code);
        const p = res.price;
        const rowJSON: Record<string, any> = { nodeKind: 'resource', code: res.code, title: res.name, unit: res.unit, resourceKind, currency: opts.currency, sourceCurrency: opts.sourceCurrency, language: opts.language };
        if (resourceKind === 'machine') {
          const noSalary = num(p.PriceCostWithoutSalary);
          const salary = num(p.SalaryMach);
          if (noSalary !== null || salary !== null) {
            rowJSON.price = r4(opts.convert((noSalary ?? 0) + (salary ?? 0)));
            rowJSON.priceWithoutOperator = noSalary === null ? null : r4(opts.convert(noSalary));
            rowJSON.operatorPay = salary === null ? null : r4(opts.convert(salary));
            rowJSON.sourcePrice = (noSalary ?? 0) + (salary ?? 0);
          }
          rowJSON.operatorHours = num(p.LabourMach);
        } else {
          const cost = num(p.Cost);
          const opt = num(p.OptCost);
          if (cost !== null) { rowJSON.price = r4(opts.convert(cost)); rowJSON.sourcePrice = cost; }
          if (opt !== null) { rowJSON.priceOpt = r4(opts.convert(opt)); rowJSON.sourcePriceOpt = opt; }
        }
        yield { table: 'resource', originalTitle: res.name, row: { rowGUID: guid, rowOwnerGUID: bookGUID, rowParentGUID: top()?.guid ?? 'empty', orderInList: (order += 10), rowJSON } };
        res = null;
      }
    }
  }
}
