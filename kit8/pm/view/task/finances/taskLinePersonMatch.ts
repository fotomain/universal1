// Task lines - does a PERSON match what the ROLE asks for? (pure). The person has his own Properties and Variants (kit8/catalog/person/
// personTypeModel.ts), separate from the ones of the role, on the same descriptor tables ("W1 V3 ER DESCRIPTORS PLAN"). The two sides meet on the
// DESCRIPTOR (descriptorGenus + descriptorValue are shared), never on the plan line: Seniority = Senior is one pair on both sides although the plan lines
// (dp18 of the Data analyst set, dp_emp_v1 of the Employee set) belong to different sets.
//
//   Variant   the role asks for a variant (resourceRoleAttributeSetKey "Senior, English"); the person has variants (Senior·English, Middle·Latvian).
//             He covers the role when ONE of his variants has every pair the role asks for (it may have more).
//   Property  every property value of the ROLE is a requirement (Min. experience 5, Certification PMP). The person answers it with the descriptor
//             of the same genus, or the one that "satisfies" it (Experience, years satisfies Min. experience): numbers "at least", lists "includes".
//
// The line stores the variant the person is booked as in taskResourceAttributesKey (the descriptorKey of his variant); EMPTY = automatic = the first
// variant that covers the role. The result is a list of problems shown as a mark on the line - the data is never refused.
import type { DefRow } from '../../../../catalog/product/productModel';
import { isSet, rowTitle } from '../../../../catalog/product/crud/productCatalogTools';
import type { TaskLineCatalogData } from './taskLineCatalogs';
import type { TaskLineGenusDef, TaskLineRowJSON } from './taskLineModel';

/** one descriptor = one value: Seniority = Senior (genus and value GUIDs) */
export interface GenusPair { genus: string; value: string }

const planGenus = (d: TaskLineCatalogData, planGUID: string): string | null => {
  const g = d.descriptorPlan.find((p) => p.rowGUID === planGUID)?.rowParentGUID;
  return isSet(g) ? g : null;
};

/** 'dp10=dv13|dp11=dv15' -> [{ genus: 'seniority', value: 'dv13' }, ...] (the plan line of ANY set is turned into its descriptor) */
export function keyGenusPairs(d: TaskLineCatalogData, key: string | null | undefined): GenusPair[] {
  if (!isSet(key)) return [];
  const out: GenusPair[] = [];
  for (const pair of String(key).split('|')) {
    const i = pair.indexOf('=');
    if (i <= 0 || i >= pair.length - 1) continue;
    const genus = planGenus(d, pair.slice(0, i));
    if (genus) out.push({ genus, value: pair.slice(i + 1) });
  }
  return out;
}

const valueLabel = (d: TaskLineCatalogData, value: string) => rowTitle(d.descriptorValue.find((v) => v.rowGUID === value)) || value;
const genusLabel = (d: TaskLineCatalogData, genus: string) => rowTitle(d.descriptorGenus.find((g) => g.rowGUID === genus)) || genus;

export interface PersonVariantInfo {
  variant: DefRow<any>;
  /** the descriptorKey stored on the line */
  key: string;
  title: string;
  pairs: GenusPair[];
}

/** the active variants of a person (variantTable, owner = person) */
export function personVariants(d: TaskLineCatalogData, personGUID: string | null | undefined): PersonVariantInfo[] {
  if (!isSet(personGUID)) return [];
  return d.variant
    .filter((v) => v.rowOwnerGUID === personGUID && v.rowJSON?.isActive !== false && isSet(v.rowJSON?.descriptorKey))
    .sort((a, b) => Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0))
    .map((variant) => ({ variant, key: String(variant.rowJSON.descriptorKey), title: rowTitle(variant) || String(variant.rowJSON.descriptorKey), pairs: keyGenusPairs(d, variant.rowJSON.descriptorKey) }));
}

/** the person has every descriptor value the role asks for */
export const variantCovers = (have: GenusPair[], need: GenusPair[]): boolean => need.every((n) => have.some((h) => h.genus === n.genus && h.value === n.value));

const missingPairs = (have: GenusPair[], need: GenusPair[]) => need.filter((n) => !have.some((h) => h.genus === n.genus && h.value === n.value));

/** what the role asks for as a variant (resourceRoleAttributeSetKey) */
export function requiredPairs(d: TaskLineCatalogData, json: Partial<TaskLineRowJSON>): GenusPair[] {
  return keyGenusPairs(d, json.resourceRoleAttributeSetKey);
}

/** the variant the line books: the chosen one, else the first that covers the role (automatic), else null */
export function effectivePersonVariant(d: TaskLineCatalogData, json: Partial<TaskLineRowJSON>): PersonVariantInfo | null {
  const variants = personVariants(d, json.taskResourceItem);
  if (isSet(json.taskResourceAttributesKey)) return variants.find((v) => v.key === json.taskResourceAttributesKey) ?? null;
  const need = requiredPairs(d, json);
  return variants.find((v) => variantCovers(v.pairs, need)) ?? null;
}

/** pick list of the "Person variant" cell: the person's variants, each marked when it covers the role */
export function personVariantOptions(d: TaskLineCatalogData, json: Partial<TaskLineRowJSON>): { value: string; label: string; hint?: string }[] {
  const need = requiredPairs(d, json);
  return personVariants(d, json.taskResourceItem).map((v) => ({
    value: v.key, label: v.title,
    ...(need.length ? { hint: variantCovers(v.pairs, need) ? 'covers the role' : 'does not cover the role' } : {}),
  }));
}

export interface PropertyRequirement { genus: string; descriptor: string; wanted: string; numeric: number | null; valueGUID: string | null }

/** every property value of the role is a requirement */
export function roleRequirements(d: TaskLineCatalogData, roleGUID: string | null | undefined): PropertyRequirement[] {
  if (!isSet(roleGUID)) return [];
  const out: PropertyRequirement[] = [];
  for (const pv of d.propertyValue.filter((x) => x.rowOwnerGUID === roleGUID)) {
    const genus = planGenus(d, pv.rowParentGUID);
    if (!genus) continue;
    const valueGUID = isSet(pv.rowJSON?.descriptorValueGUID) ? pv.rowJSON.descriptorValueGUID : null;
    const raw = pv.rowJSON?.value;
    const numeric = raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
    if (!valueGUID && numeric === null) continue; // an empty requirement asks for nothing
    const unit = d.descriptorGenus.find((g) => g.rowGUID === genus)?.rowJSON?.unit;
    out.push({ genus, descriptor: genusLabel(d, genus), wanted: valueGUID ? valueLabel(d, valueGUID) : `${numeric}${unit ? ` ${unit}` : ''}`, numeric, valueGUID });
  }
  return out;
}

/** the descriptors of the person that answer a requirement of this genus: the same genus, or one that "satisfies" it */
function answeringGenus(d: TaskLineCatalogData, requirementGenus: string): DefRow<any>[] {
  return d.descriptorGenus.filter((g) => g.rowGUID === requirementGenus || g.rowJSON?.satisfies === requirementGenus);
}

/** the property rows of a person (what he IS) */
const personProperties = (d: TaskLineCatalogData, personGUID: string) =>
  d.propertyValue.filter((x) => x.rowOwnerGUID === personGUID).map((pv) => ({ pv, genus: planGenus(d, pv.rowParentGUID) })).filter((x) => !!x.genus) as { pv: DefRow<any>; genus: string }[];

/** the person's type has a property plan line for one of these descriptors (a set without it cannot answer the requirement) */
function personCanAnswer(d: TaskLineCatalogData, personGUID: string, genusGUIDs: string[]): boolean {
  const type = d.person.find((p) => p.rowGUID === personGUID)?.rowJSON?.personType;
  if (!isSet(type)) return false;
  const sets = new Set(d.descriptorDestination.filter((s) => s.rowOwnerGUID === type && s.rowParentGUID === 'property').map((s) => s.rowGUID));
  return d.descriptorPlan.some((p) => sets.has(p.rowOwnerGUID) && genusGUIDs.includes(p.rowParentGUID));
}

/**
 * The requirements of the role that the person does not meet, e.g. ['Experience, years: needs at least 5 years, has 3', 'Certification: PMP is missing'].
 * A requirement the person's type has no descriptor for is not comparable and not a problem.
 */
export function unmetRequirements(d: TaskLineCatalogData, roleGUID: string | null | undefined, personGUID: string | null | undefined): string[] {
  if (!isSet(roleGUID) || !isSet(personGUID)) return [];
  const mine = personProperties(d, personGUID);
  const out: string[] = [];
  for (const req of roleRequirements(d, roleGUID)) {
    const answering = answeringGenus(d, req.genus);
    const ids = answering.map((g) => g.rowGUID);
    if (!personCanAnswer(d, personGUID, ids)) continue;
    const rows = mine.filter((m) => ids.includes(m.genus));
    if (req.valueGUID) {
      if (!rows.some((r) => r.pv.rowJSON?.descriptorValueGUID === req.valueGUID)) out.push(`${req.descriptor}: ${req.wanted} is missing`);
    } else if (req.numeric !== null) {
      const have = rows.map((r) => Number(r.pv.rowJSON?.value)).filter((n) => Number.isFinite(n));
      const best = have.length ? Math.max(...have) : null;
      if (best === null || best < req.numeric) {
        const mineGenus = answering.find((g) => g.rowGUID !== req.genus) ?? answering[0];
        const unit = mineGenus?.rowJSON?.unit;
        out.push(`${mineGenus ? genusLabel(d, mineGenus.rowGUID) : req.descriptor}: needs at least ${req.wanted}, ${best === null ? 'has none' : `has ${best}${unit ? ` ${unit}` : ''}`}`);
      }
    }
  }
  return out;
}

/** Time line: what does not match between the person and the role (shown as a mark; the data is never refused) */
export function personMatchProblems(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): string[] {
  if (genus.resource !== 'person' || !isSet(json.resourceRoleItem) || !isSet(json.taskResourceItem)) return [];
  const out: string[] = [];
  const variants = personVariants(d, json.taskResourceItem);
  const need = requiredPairs(d, json);
  if (isSet(json.taskResourceAttributesKey) && !variants.some((v) => v.key === json.taskResourceAttributesKey)) out.push('The variant is not a variant of this person');
  else if (need.length) {
    const chosen = effectivePersonVariant(d, json);
    const label = need.map((n) => `${genusLabel(d, n.genus)} = ${valueLabel(d, n.value)}`).join(', ');
    if (isSet(json.taskResourceAttributesKey)) {
      if (chosen && !variantCovers(chosen.pairs, need)) out.push(`The variant "${chosen.title}" does not cover the role: needs ${missingPairs(chosen.pairs, need).map((n) => `${genusLabel(d, n.genus)} = ${valueLabel(d, n.value)}`).join(', ')}`);
    } else if (!chosen) {
      out.push(variants.length ? `The person has no variant that covers the role: needs ${label}` : `The person has no variants: the role needs ${label}`);
    }
  }
  for (const m of unmetRequirements(d, json.resourceRoleItem, json.taskResourceItem)) out.push(m);
  return out;
}

