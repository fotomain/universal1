import { projectCommands } from '../../../kit8/catalog/project/projectCommandsModel';
import { buildRowFabActions } from '../../../kit8/ui/components/list/reusable/rowFabModel';
import { archiveOffered } from '../../../kit8/ui/components/list/reusable/swipeModel';
import { copyProject, planProjectCopy } from '../../../kit8/catalog/project/copy/projectCopy';

const row = (rowJSON: any = {}) => ({ rowGUID: 'p1', rowJSON } as any);
const all = () => ({ onDashboard: jest.fn(), onSettings: jest.fn(), onCopy: jest.fn(), onCopyWithTasks: jest.fn(), onCopyWithBim: jest.fn() });

describe('projectCommands (the project items of the three dots menu and the card FAB)', () => {
  it('lists Dashboard, Settings, Copy, Copy with Tasks in this order; Copy with BIM only for a BIM project', () => {
    expect(projectCommands(row(), all()).map((c) => c.key)).toEqual(['dashboard', 'settings', 'copy', 'copy-tasks']);
    expect(projectCommands(row({ projectIsBIMBased: true }), all()).map((c) => c.key)).toEqual(['dashboard', 'settings', 'copy', 'copy-tasks', 'copy-bim']);
  });

  it('a command runs its handler with the project guid (open / settings) or the row (the copies)', () => {
    const h = all();
    const r = row({ projectIsBIMBased: true });
    projectCommands(r, h).forEach((c) => c.run());
    expect(h.onDashboard).toHaveBeenCalledWith('p1');
    expect(h.onSettings).toHaveBeenCalledWith('p1');
    expect(h.onCopy).toHaveBeenCalledWith(r);
    expect(h.onCopyWithTasks).toHaveBeenCalledWith(r);
    expect(h.onCopyWithBim).toHaveBeenCalledWith(r);
  });

  it('a handler that is not given gives no command; every command has a menu icon and a FAB icon', () => {
    expect(projectCommands(row(), { onCopy: jest.fn() }).map((c) => c.key)).toEqual(['copy']);
    projectCommands(row({ projectIsBIMBased: true }), all()).forEach((c) => { expect(c.menuIcon).toBeTruthy(); expect(c.fabIcon).toBeTruthy(); expect(c.label).toBeTruthy(); });
  });
});

describe('buildRowFabActions (the standard commands of the default card FAB)', () => {
  const actions = () => ({ edit: jest.fn(), remove: jest.fn(), duplicate: jest.fn(), createBefore: jest.fn(), createAfter: jest.fn(), moveUp: jest.fn(), moveDown: jest.fn(), makeFirst: jest.fn(), makeLast: jest.fn(), archive: jest.fn(), openMenu: jest.fn(), markUsed: jest.fn() });
  const input = (over: any = {}) => ({ guid: 'g', itemLabel: 'Project', actions: actions(), canOpen: true, canEdit: true, canAdd: true, canDelete: true, canMove: true, archiveOffered: true, archived: false, testPrefix: 'fab-g', ...over });

  it('all rights: Edit, Add below / above, Duplicate, Move up / down, Archive, Delete; the host commands come first', () => {
    const extra = [{ icon: 'x', label: 'Mine', onPress: jest.fn() }];
    expect(buildRowFabActions(input({ extra })).map((a) => a.label)).toEqual(['Mine', 'Edit project', 'Add project below', 'Add project above', 'Duplicate', 'Move up', 'Move down', 'Archive', 'Delete']);
  });

  it('an archived row offers Restore; Delete is red; a command calls the list action of its row', () => {
    const i = input({ archived: true });
    const list = buildRowFabActions(i);
    expect(list.find((a) => a.label === 'Restore')).toBeTruthy();
    list.find((a) => a.label === 'Restore')!.onPress();
    list.find((a) => a.label === 'Delete')!.onPress();
    expect(i.actions.archive).toHaveBeenCalledWith('g');
    expect(i.actions.remove).toHaveBeenCalledWith('g');
    expect(list.find((a) => a.label === 'Delete')!.color).toBeTruthy();
  });

  it('what the user may not do is not offered', () => {
    expect(buildRowFabActions(input({ canOpen: false, canAdd: false, canMove: false, archiveOffered: false, canDelete: false }))).toEqual([]);
    expect(buildRowFabActions(input({ canEdit: false })).map((a) => a.label)).not.toContain('Edit project');
  });
});

describe('archiveOffered (the swipeActions prop)', () => {
  it('on by default and with true; off with false or { archive: false }; a { delete: false } leaves it', () => {
    expect(archiveOffered(undefined)).toBe(true);
    expect(archiveOffered(true)).toBe(true);
    expect(archiveOffered({ delete: false })).toBe(true);
    expect(archiveOffered(false)).toBe(false);
    expect(archiveOffered({ archive: false })).toBe(false);
  });
});

describe('a copy of an archived project', () => {
  it('is not archived (rowIsArchived is not copied); the other settings are', () => {
    const source: any = { rowGUID: 's', rowOwnerGUID: 'u', orderInList: 1, rowJSON: { name: 'A', rowKind: 'project', rowIsArchived: true, skipWeekends: true } };
    const copy = planProjectCopy(source, 'u', 'A (copy)', 2, () => 'new-guid');
    expect(copy.rowJSON.rowIsArchived).toBeUndefined();
    expect(copy.rowJSON.skipWeekends).toBe(true);
    expect(copy.rowJSON.name).toBe('A (copy)');
    expect(typeof copyProject).toBe('function');
  });
});
