import {
  NUMBER_OF_VISITS_KEY, ROUTE_VISIT_TABLE, formatLastVisit, isOpenableRoute, normalizeRoute, numberOfVisitsEnabledOf, topRouteVisits, visitCountOf,
} from '../../../../kit8/catalog/user/visit/routeVisitModel';
import { routeVisitSystemMetaData } from '../../../../kit8/catalog/user/visit/routeVisitMetaData';
import { normalizeOrganization } from '../../../../kit8/catalog/organization/organizationModel';

const row = (route: string, n: any, guid = route) => ({ rowGUID: guid, rowOwnerGUID: 'u1', rowParentGUID: route, orderInList: 0, rowJSON: { number_of_route_visits: n } }) as any;

describe('route visits model', () => {
  it('the table is app_route_visits_turnover', () => {
    expect(ROUTE_VISIT_TABLE.table).toBe('app_route_visits_turnover');
    const meta = routeVisitSystemMetaData()[ROUTE_VISIT_TABLE.entity];
    expect(meta.tableName).toBe('app_route_visits_turnover');
  });

  it('the Organization switch is TRUE unless it is stored false', () => {
    expect(numberOfVisitsEnabledOf(undefined)).toBe(true);
    expect(numberOfVisitsEnabledOf({})).toBe(true);
    expect(numberOfVisitsEnabledOf({ [NUMBER_OF_VISITS_KEY]: true })).toBe(true);
    expect(numberOfVisitsEnabledOf({ [NUMBER_OF_VISITS_KEY]: false })).toBe(false);
  });

  it('normalizeOrganization keeps only a stored boolean of the switch', () => {
    const base = { organizationTitle: 'Acme', createdByUser: 'a@b.com' } as any;
    expect(normalizeOrganization({ ...base, numberOfVisitsFunctionalityEnabled: false }).numberOfVisitsFunctionalityEnabled).toBe(false);
    expect(normalizeOrganization({ ...base, numberOfVisitsFunctionalityEnabled: true }).numberOfVisitsFunctionalityEnabled).toBe(true);
    expect('numberOfVisitsFunctionalityEnabled' in normalizeOrganization({ ...base, numberOfVisitsFunctionalityEnabled: 'no' as any })).toBe(false);
    expect('numberOfVisitsFunctionalityEnabled' in normalizeOrganization(base)).toBe(false);
  });

  it('normalizeRoute: no query / hash / trailing slash, a GUID is :id, the root is not counted', () => {
    expect(normalizeRoute('/home')).toBe('/home');
    expect(normalizeRoute('/catalog/money/account/')).toBe('/catalog/money/account');
    expect(normalizeRoute('/pm/project/dashboard?projectGUID=1#x')).toBe('/pm/project/dashboard');
    expect(normalizeRoute('/catalog/person/edit/0b1c2d3e-1111-4222-8333-444455556666')).toBe('/catalog/person/edit/:id');
    expect(normalizeRoute('/')).toBe('');
    expect(normalizeRoute('')).toBe('');
    expect(normalizeRoute(null)).toBe('');
  });

  it('visitCountOf: a positive number, else 0', () => {
    expect(visitCountOf(row('/a', 3))).toBe(3);
    expect(visitCountOf(row('/a', '4'))).toBe(4);
    expect(visitCountOf(row('/a', -1))).toBe(0);
    expect(visitCountOf(row('/a', 'x'))).toBe(0);
    expect(visitCountOf(undefined)).toBe(0);
  });

  it('topRouteVisits: the 5 most visited, the bigger first, ties by route, no empty route, no zero', () => {
    const rows = [row('/e', 5), row('/a', 5), row('/b', 9), row('/c', 1), row('/d', 2), row('/f', 7), row('/zero', 0), row('', 50)];
    const top = topRouteVisits(rows);
    expect(top.map((t) => t.route)).toEqual(['/b', '/f', '/a', '/e', '/d']);
    expect(top.map((t) => t.count)).toEqual([9, 7, 5, 5, 2]);
    expect(topRouteVisits(rows, 2)).toHaveLength(2);
    expect(topRouteVisits(null)).toEqual([]);
  });

  it('isOpenableRoute / formatLastVisit', () => {
    expect(isOpenableRoute('/home')).toBe(true);
    expect(isOpenableRoute('/catalog/person/edit/:id')).toBe(false);
    expect(isOpenableRoute('')).toBe(false);
    expect(formatLastVisit('')).toBe('');
    expect(formatLastVisit('not a date')).toBe('not a date');
    expect(formatLastVisit('2026-10-26T14:05:00')).toBe('2026-10-26 14:05');
  });
});
