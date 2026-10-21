// The equipment part of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql (PART 17) and delete_sql_structure.sql (PART 6) against the model:
// the same tables, the same descriptors, the same seed ids. (The SQL itself is run on a real Postgres 15 by kit8/docker/test_sql.sh.)
// start2_sql_code.sql (the DDL) and start5_sql_upsert_all.sql (the seed rows, as upserts) are the same part cut in two: they must hold it too.
import fs from 'fs';
import path from 'path';
import { equipmentTable, EQUIPMENT_OWNERSHIPS } from '../../../kit8/catalog/equipment/equipmentModel';
import { EQUIPMENT_TYPE, EQUIPMENT_TYPE_TABLE } from '../../../kit8/catalog/equipment/equipmentTypeModel';
import { tablesSql } from '../../sql/sqlFilesTestKit';

const dir = path.join(__dirname, '../../../kit8/sql/start');
const start = fs.readFileSync(path.join(dir, 'start1_sql_tables.sql'), 'utf8') + '\n' + fs.readFileSync(path.join(dir, 'start2_sql_code.sql'), 'utf8');
const del = fs.readFileSync(path.join(dir, 'delete_sql_structure.sql'), 'utf8');
const insert = fs.readFileSync(path.join(dir, 'start4_sql_insert_missing.sql'), 'utf8');
// the DDL of the part (start1_sql_tables.sql + start2_sql_code.sql) and its seed rows (start4_sql_insert_missing.sql)
const from17 = (src: string) => src.slice(src.indexOf('-- PART 17: create_equipment_tables.sql'));
const part = from17(tablesSql) + '\n' + from17(start.slice(tablesSql.length)) + '\n' + insert.slice(insert.indexOf('-- PART 17: create_equipment_tables.sql'));
const delPart = del.slice(del.indexOf('-- PART 6: delete_equipment_tables.sql'), del.indexOf('-- PART 7:'));

const code = fs.readFileSync(path.join(dir, 'start2_sql_code.sql'), 'utf8');
const data = fs.readFileSync(path.join(dir, 'start5_sql_upsert_all.sql'), 'utf8');

describe('the equipment SQL lives in kit8/sql/start only', () => {
  it('the structure file has the part, the delete file has its counterpart', () => {
    expect(part.length).toBeGreaterThan(0);
    expect(delPart.length).toBeGreaterThan(0);
    expect(start).toContain('17. create_equipment_tables.sql');
    expect(del).toContain('6. delete_equipment_tables.sql');
    expect(fs.readdirSync(path.join(dir, '..'))).toEqual(['start']);
  });
  it('the delete parts are numbered one after the other', () => {
    const nums = Array.from(del.matchAll(/^-- PART (\d+):/gm)).map((m) => Number(m[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
});

describe('start2_sql_code.sql + start5_sql_upsert_all.sql hold the same part, cut in two', () => {
  it('the code file: the tables, the policies, the check, the realtime - and the kind in the posted days; no seed rows', () => {
    expect(code).toContain('17. create_equipment_tables.sql');
    expect(tablesSql).toContain('CREATE TABLE IF NOT EXISTS public."equipmentTable"');          // the tables are in start1_sql_tables.sql ...
    expect(tablesSql).toContain('CREATE TABLE IF NOT EXISTS public."equipmentTypeTable"');
    expect(tablesSql).toContain('task_line_resource_kind_chk');
    expect(code).not.toContain('CREATE TABLE IF NOT EXISTS public."equipmentTable"');          // ... and not in the code file
    expect(code).toContain("ARRAY['equipmentTypeTable', 'equipmentTable']");
    expect(code).toMatch(/'taskResourceKind', COALESCE\(l\."rowJSON"->'taskResourceKind', 'null'::jsonb\)/);
    const from = code.indexOf('-- PART 17: create_equipment_tables.sql');
    const codePart = code.slice(from, code.indexOf('-- PART 18:', from));   // up to the next part (the later parts have functions that INSERT)
    expect(codePart).not.toContain('INSERT INTO');
  });
  it('the data file: the seed rows as UPSERTs (a seed row is refreshed, a row of a user is not touched)', () => {
    const dataPart = data.slice(data.indexOf('-- Equipment (PART 17'));
    expect(dataPart.length).toBeGreaterThan(0);
    for (const table of ['descriptorGenusTable', 'descriptorValueTable', 'equipmentTypeTable', 'descriptorDestinationTable', 'descriptorPlanTable', 'equipmentTable', 'propertyValueTable', 'variantTable', 'variantValueTable', 'resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable']) expect(dataPart).toContain(`INSERT INTO public."${table}"`);
    expect(dataPart).not.toContain('DO NOTHING');
    expect(dataPart).not.toContain('CREATE TABLE');
    expect((dataPart.match(/INSERT INTO/g) || []).length).toBe((dataPart.match(/DO UPDATE SET/g) || []).length);
    expect(dataPart).toContain('"resourceKind": "equipment"');
  });
});

describe('the tables are the model\'s', () => {
  it('equipmentTable + equipmentTypeTable: defTable pattern, owners, RLS for signed-in users, realtime', () => {
    expect(part).toContain(`CREATE TABLE IF NOT EXISTS public."${equipmentTable}"`);
    expect(part).toContain(`CREATE TABLE IF NOT EXISTS public."${EQUIPMENT_TYPE_TABLE.table}"`);
    expect(part).toContain(`DEFAULT '${EQUIPMENT_TYPE_TABLE.catalogOwner}'`);
    expect(part).toContain("DEFAULT 'equipmentCatalog'");
    expect(part).toContain("kit8_setup_def_table('equipmentTable')");
    expect(part).toContain("kit8_setup_def_table('equipmentTypeTable')");
    expect(part).toContain('TO authenticated');
    expect(part).not.toMatch(/TO anon/);
    expect(part).toContain("ARRAY['equipmentTypeTable', 'equipmentTable']");
  });
  it('the ownership check lists the ownerships of the model; the inventory number is unique', () => {
    for (const o of EQUIPMENT_OWNERSHIPS) expect(part).toContain(`'${o.value}'`);
    expect(part).toContain('idx_equipmentTable_code');
  });
  it('the seed types are the model\'s', () => {
    expect(part).toContain(`'${EQUIPMENT_TYPE.heavy}'`);
    expect(part).toContain(`'${EQUIPMENT_TYPE.vehicle}'`);
  });
});

describe('descriptors and the role type', () => {
  it('the equipment descriptors are meant for equipment types; the role requirement for role types; engine power answers it', () => {
    expect(part).toMatch(/'equipmentClass'[^\n]*"targetKinds": \["equipmentType", "resourceRoleType"\]/);
    expect(part).toMatch(/'enginePowerKw'[^\n]*"targetKinds": \["equipmentType"\][^\n]*"satisfies": "minEnginePowerKw"[^\n]*"matchRule": "atLeast"/);
    expect(part).toMatch(/'minEnginePowerKw'[^\n]*"targetKinds": \["resourceRoleType"\]/);
  });
  it('the role type "Equipment Resources": Time genus, resourceKind equipment; the older human type says person', () => {
    expect(part).toMatch(/'equipmentResources'[^\n]*"managementGenus": "timeGenus", "resourceKind": "equipment"/);
    expect(part).toContain(`'{"resourceKind": "person"}'`);
  });
  it('equipment variants use the plan lines of the TYPE of the equipment and the key is sorted by plan line', () => {
    expect(part).toContain("v.pre || 'v1=' || v.cls || '|' || v.pre || 'v2=' || v.hire");
    expect(part).toContain('dp_eqr_v1=dv_eqc_heavy|dp_eqr_v2=dv_hm_op');
  });
});

describe('the Time line', () => {
  it('task_line_table.rowJSON.taskResourceKind: person | equipment | workCenter (PART 35), an equipment on the Time genus only; no kind = person', () => {
    expect(part).toContain('task_line_resource_kind_chk');
    expect(part).toContain("COALESCE(\"rowJSON\"->>'taskResourceKind', 'person') IN ('person', 'equipment', 'workCenter')");
    expect(part).toContain("\"rowParentGUID\" = 'timeGenus'");
  });
  it('the posted days copy the kind of the line (a report needs no join)', () => {
    expect(start).toMatch(/'taskResourceKind', COALESCE\(l\."rowJSON"->'taskResourceKind', 'null'::jsonb\)/);
  });
});

describe('the delete part removes what the start part made', () => {
  it('drops the check, both tables (and their realtime entries), the descriptors and the role type', () => {
    expect(delPart).toContain('DROP CONSTRAINT IF EXISTS task_line_resource_kind_chk');
    expect(delPart).toContain("ARRAY['equipmentTable', 'equipmentTypeTable']");
    expect(delPart).toContain("'equipmentResources'");
    expect(delPart).toContain("'equipmentClass', 'hireMode', 'enginePowerKw', 'minEnginePowerKw', 'yearOfManufacture'");
    expect(delPart).toContain('"rowJSON" - \'resourceKind\'');
  });
  it('every seed id prefix of the start part is removed by a pattern of the delete part', () => {
    for (const prefix of ['evv', 'rvv', 'evar', 'rv\\_eqr', 'pp\\_eq', 'pp\\_eqr', 'rp\\_eqr', 'dp\\_eqh', 'dp\\_eqv', 'dp\\_eqr']) expect(delPart).toContain(`'${prefix}\\_%'`.replace(/\\\\/g, '\\'));
    // the seed builds the ids with these prefixes
    for (const built of ["'evar_'", "'evv_'", "'rvv_'", "'pp_eq_'", "'rv_eqr_heavy_op'", "'rp_eqr_excavator_bill'", "'dp_eqh_p1'", "'dp_eqr_p1'"]) expect(part).toContain(built);
  });
});
