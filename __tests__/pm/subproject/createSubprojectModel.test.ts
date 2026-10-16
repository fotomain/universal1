/** @jest-environment jsdom */
// createSubprojectModel: "Create based on this → Subproject" - the name, when it is offered, what the new project starts with.
// the model uses the settings helpers (budgetsValuesOf ... import the tab components): the PM UI kit mocks their native-only modules; import it FIRST
import '../ui/pmUiTestKit';
import {
  SUBPROJECT_NAME_PREFIX, createSubprojectBlock, subprojectGUIDOfTask, subprojectNameOf, subprojectStartMs, subprojectStartSettings,
} from '../../../kit8/pm/subproject/createSubprojectModel';

describe('the name', () => {
  it('"Subproject of " + the name of the origin task', () => {
    expect(SUBPROJECT_NAME_PREFIX).toBe('Subproject of ');
    expect(subprojectNameOf('Task 111')).toBe('Subproject of Task 111');
    expect(subprojectNameOf('  Build  ')).toBe('Subproject of Build');
    expect(subprojectNameOf('')).toBe('Subproject of …');
    expect(subprojectNameOf(undefined)).toBe('Subproject of …');
  });
});

describe('createSubprojectBlock', () => {
  const on = { subprojectsFunctionalityEnabled: true };
  it('the project switch is OFF by default: not offered', () => {
    expect(createSubprojectBlock({}, { rowKind: 'task' })).toBe('disabled');
    expect(createSubprojectBlock(undefined, { rowKind: 'task' })).toBe('disabled');
    expect(createSubprojectBlock({ subprojectsFunctionalityEnabled: false }, { rowKind: 'task' })).toBe('disabled');
  });
  it('only a task: a stage or a milestone cannot stand for a subproject', () => {
    expect(createSubprojectBlock(on, { rowKind: 'task' })).toBe('');
    expect(createSubprojectBlock(on, {})).toBe('');
    expect(createSubprojectBlock(on, { rowKind: 'stage' })).toBe('notTask');
    expect(createSubprojectBlock(on, { rowKind: 'milestone' })).toBe('notTask');
  });
  it('a task that already stands for a subproject is not given a second one', () => {
    expect(createSubprojectBlock(on, { rowKind: 'task', taskIsSubproject: true, taskSubprojectGUID: 'p2' })).toBe('alreadySubproject');
  });
});

describe('subprojectGUIDOfTask', () => {
  it('the project of a task that is a subproject, else empty', () => {
    expect(subprojectGUIDOfTask({ taskIsSubproject: true, taskSubprojectGUID: 'p2' })).toBe('p2');
    expect(subprojectGUIDOfTask({ taskIsSubproject: false, taskSubprojectGUID: 'p2' })).toBe('');
    expect(subprojectGUIDOfTask({ taskIsSubproject: true, taskSubprojectGUID: null })).toBe('');
    expect(subprojectGUIDOfTask(undefined)).toBe('');
  });
});

describe('subprojectStartSettings', () => {
  it('the new project starts with the settings of the origin project: budgets, units, vendor, subprojects, partners, manager', () => {
    const o = subprojectStartSettings({
      name: 'Origin', projectStartAt: '2026-01-01', skipWeekends: true, planHour: true, currencyForBudget: 'EUR', projectCostCenter: 'bu-1', projectBusinessUnitsRequired: true,
      multiProjectVendorInvoceNeeded: true, subprojectsFunctionalityEnabled: true, mainSupplierGUID: 'vp-1', projectManagerPerson: 'p-boris', projectTreeContextCommandsMode: 'onRightClickMenuMode',
    });
    expect(o).toMatchObject({
      skipWeekends: true, planHour: true, currencyForBudget: 'EUR', projectCostCenter: 'bu-1', projectBusinessUnitsRequired: true, multiProjectVendorInvoceNeeded: true,
      subprojectsFunctionalityEnabled: true, mainSupplierGUID: 'vp-1', projectManagerPerson: 'p-boris', projectTreeContextCommandsMode: 'onRightClickMenuMode',
    });
  });
  it('NOT the identity of the origin: name and dates', () => {
    const o = subprojectStartSettings({ name: 'Origin', projectStartAt: '2026-01-01', projectStartDate: '2026-01-01', projectFinishDate: '2026-02-01', durationDays: 5 });
    expect(o).not.toHaveProperty('name');
    expect(o).not.toHaveProperty('projectStartAt');
    expect(o).not.toHaveProperty('projectStartDate');
    expect(o).not.toHaveProperty('projectFinishDate');
    expect(o).not.toHaveProperty('durationDays');
  });
  it('an origin without settings gives the defaults of every setting', () => {
    expect(subprojectStartSettings(undefined)).toMatchObject({ skipWeekends: false, planDay: true, subprojectsFunctionalityEnabled: false, mainSupplierGUID: null });
  });
});

describe('subprojectStartMs', () => {
  it('the start of the origin task (manual start first), else the fallback', () => {
    expect(subprojectStartMs({ manualStartAt: '2026-11-02T00:00:00.000Z' }, 1)).toBe(Date.UTC(2026, 10, 2));
    expect(subprojectStartMs({ startAt: '2026-11-03T00:00:00.000Z' }, 1)).toBe(Date.UTC(2026, 10, 3));
    expect(subprojectStartMs({ manualStartAt: 'not a date' }, 7)).toBe(7);
    expect(subprojectStartMs({}, 7)).toBe(7);
  });
});
