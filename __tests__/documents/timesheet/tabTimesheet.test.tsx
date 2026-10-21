/** @jest-environment jsdom */
// TabTimesheet: the two switches PER PERSON with the default of the user in the ORGANIZATION (Person -> Organization -> built-in default); the Person and Organization models keep the keys.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../pm/ui/pmUiTestKit';

const mockSwitches: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SwitchApp', () => ({ __esModule: true, default: (p: any) => { mockSwitches[p.testID] = p; return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const TabTimesheet = require('../../../kit8/documents/timesheet/TabTimesheet').default;
const { storedTimesheetSettings } = require('../../../kit8/documents/timesheet/TabTimesheet');
import { normalizeOrganization } from '../../../kit8/catalog/organization/organizationModel';
import { normalizePerson } from '../../../kit8/catalog/person/personModel';

const A = 'timesheet-settings-timesheetAllWorkCenterInputAvailable';
const M = 'timesheet-settings-timesheetOnlyCurrentMonthInputEnabled';
afterEach(() => { cleanupUI(); jest.clearAllMocks(); Object.keys(mockSwitches).forEach((k) => delete mockSwitches[k]); });

describe('Organization level: the default of every user', () => {
  it('nothing stored: the built-in defaults (false / true)', () => {
    renderUI(<TabTimesheet values={{}} onChange={jest.fn()} />);
    expect(mockSwitches[A].value).toBe(false);
    expect(mockSwitches[M].value).toBe(true);
    expect(q(`${A}-source`)).toBeNull();                                 // no source line / reset button on this level
  });
  it('a stored value is shown; a change gives the whole new stored object', () => {
    const onChange = jest.fn();
    renderUI(<TabTimesheet values={{ timesheetOnlyCurrentMonthInputEnabled: false }} onChange={onChange} />);
    expect(mockSwitches[M].value).toBe(false);
    act(() => mockSwitches[A].onValueChange(true));
    expect(onChange).toHaveBeenCalledWith({ timesheetOnlyCurrentMonthInputEnabled: false, timesheetAllWorkCenterInputAvailable: true });
  });
});

describe('Person level: Person -> Organization -> built-in default', () => {
  it('a Person with no value follows the organization and says so', () => {
    renderUI(<TabTimesheet values={{}} inherited={{ timesheetAllWorkCenterInputAvailable: true }} onChange={jest.fn()} />);
    expect(mockSwitches[A].value).toBe(true);
    expect(textOf(`${A}-source`)).toBe('From the organization');
    expect(mockSwitches[M].value).toBe(true);
    expect(textOf(`${M}-source`)).toBe('Built-in default');
    expect(q(`${A}-reset`)).toBeNull();
  });
  it('the Person\'s own value wins; a button gives it back to the organization (the key is removed)', () => {
    const onChange = jest.fn();
    renderUI(<TabTimesheet values={{ timesheetAllWorkCenterInputAvailable: false }} inherited={{ timesheetAllWorkCenterInputAvailable: true }} onChange={onChange} />);
    expect(mockSwitches[A].value).toBe(false);
    expect(textOf(`${A}-source`)).toBe('Set for you');
    press(`${A}-reset`);
    expect(onChange).toHaveBeenCalledWith({});
  });
  it('a change stores the Person\'s own value next to the others', () => {
    const onChange = jest.fn();
    renderUI(<TabTimesheet values={{ timesheetOnlyCurrentMonthInputEnabled: false }} inherited={{}} onChange={onChange} />);
    act(() => mockSwitches[A].onValueChange(true));
    expect(onChange).toHaveBeenCalledWith({ timesheetOnlyCurrentMonthInputEnabled: false, timesheetAllWorkCenterInputAvailable: true });
  });
  it('disabled: no reset button', () => {
    renderUI(<TabTimesheet values={{ timesheetAllWorkCenterInputAvailable: false }} inherited={{}} onChange={jest.fn()} disabled />);
    expect(q(`${A}-reset`)).toBeNull();
    expect(mockSwitches[A].disabled).toBe(true);
  });
});

describe('the models keep the keys (the edit forms save through them)', () => {
  it('storedTimesheetSettings: only booleans', () => {
    expect(storedTimesheetSettings({ timesheetAllWorkCenterInputAvailable: true, timesheetOnlyCurrentMonthInputEnabled: 'x', other: 1 })).toEqual({ timesheetAllWorkCenterInputAvailable: true });
    expect(storedTimesheetSettings(null)).toEqual({});
  });
  it('normalizePerson keeps a stored boolean and drops anything else', () => {
    const j = normalizePerson({ personFirstName: 'Anna', isActive: true, personIsEmployee: false, personTitle: '', timesheetAllWorkCenterInputAvailable: false, timesheetOnlyCurrentMonthInputEnabled: undefined } as any);
    expect(j.timesheetAllWorkCenterInputAvailable).toBe(false);
    expect('timesheetOnlyCurrentMonthInputEnabled' in j).toBe(false);
    expect('timesheetAllWorkCenterInputAvailable' in normalizePerson({ personFirstName: 'B' } as any)).toBe(false);
  });
  it('normalizeOrganization keeps the base currency (3 letters, upper case) and drops anything else', () => {
    const base = { organizationTitle: 'Acme', createdByUser: 'a@b.c', isActive: true } as any;
    expect(normalizeOrganization({ ...base, baseCurrency: ' usd ' }).baseCurrency).toBe('USD');
    expect('baseCurrency' in normalizeOrganization({ ...base, baseCurrency: 'US' })).toBe(false);
    expect('baseCurrency' in normalizeOrganization({ ...base, baseCurrency: '' })).toBe(false);
    expect('baseCurrency' in normalizeOrganization({ ...base })).toBe(false);
  });
  it('normalizeOrganization keeps a stored boolean and drops anything else', () => {
    const j = normalizeOrganization({ organizationTitle: 'Acme', createdByUser: 'a@b.c', isActive: true, timesheetOnlyCurrentMonthInputEnabled: false, timesheetAllWorkCenterInputAvailable: 'yes' } as any);
    expect(j.timesheetOnlyCurrentMonthInputEnabled).toBe(false);
    expect('timesheetAllWorkCenterInputAvailable' in j).toBe(false);
  });
});
