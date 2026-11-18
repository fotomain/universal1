// A NEW organization (created at the first sign in of its owner) starts with the currencies of its projects: budget USD, accounting EUR, default
// currency for contracts GBP (SQL organization_for_email); the project settings show them read only, the organization screen changes them.
import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.resolve(__dirname, '../../../kit8/sql/start/start2_sql_code.sql'), 'utf8');
/** the body of organization_for_email */
const body = (() => {
  const a = sql.indexOf('CREATE OR REPLACE FUNCTION public.organization_for_email');
  return sql.slice(a, sql.indexOf('$$;', sql.indexOf('AS $$', a)));
})();

describe('the currencies of a new organization', () => {
  it('organization_for_email puts USD / EUR / GBP into rowJSON.defaultProjectSettings of the organization it makes', () => {
    expect(body).toMatch(/'defaultProjectSettings',\s*jsonb_build_object\(\s*'currencyForBudget',\s*'USD',\s*'currencyForAccounting',\s*'EUR',\s*'currencyForContract',\s*'GBP'\s*\)/);
    // it is the INSERT of a NEW organization only: an existing one is returned (or adopted) before, untouched
    const insertAt = body.indexOf('INSERT INTO public."organizationTable"');
    expect(insertAt).toBeGreaterThan(body.indexOf('RETURN v_guid'));
    expect(body.indexOf("'defaultProjectSettings'")).toBeGreaterThan(insertAt);
  });

  it('the Docker test checks it (and that a changed currency stays changed)', () => {
    const t = fs.readFileSync(path.resolve(__dirname, '../../../kit8/docker/tests/10_organization.sql'), 'utf8');
    expect(t).toContain('new organization: budget currency USD');
    expect(t).toContain('new organization: accounting currency EUR');
    expect(t).toContain('new organization: default currency GBP');
    expect(t).toContain('a changed currency stays changed');
  });
});
