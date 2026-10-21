// Time genus control - the pure side: parsing the answer of Post, the rule, the sentences and the Share text.
import {
  DEFAULT_CAPACITY_MODE, busyLineGUIDs, busySentence, capacityModeOf, hoursText, isBusy, parseBusy, shareMailto, shareRecipients, shareState, shareText,
} from '../../../../../kit8/pm/view/task/plan/busyControl';

const raw = {
  resourceKind: 'person', resourceGUID: 'p-boris', resourceTitle: 'Boris M', day: '2026-10-14', capacityHours: '8.00', bookedHere: '4.00', bookedOthers: '8.00', overHours: '4.00',
  notFilled: false, lines: ['l-5'], postingManagerEmail: 'Rok@Acme.test',
  others: [{ projectGUID: 'prj-1', taskGUID: 't-3', hours: '8.00', managerEmail: 'petra@acme.test' }],
};

describe('capacity mode', () => {
  it('a missing or unknown value is off', () => {
    expect(DEFAULT_CAPACITY_MODE).toBe('capacityModeOff');
    expect(capacityModeOf(null)).toBe('capacityModeOff');
    expect(capacityModeOf({})).toBe('capacityModeOff');
    expect(capacityModeOf({ resourceCapacityStrongMode: 'block' })).toBe('capacityModeOff');
    expect(capacityModeOf({ resourceCapacityStrongMode: 'capacityModeBlock' })).toBe('capacityModeBlock');
    expect(capacityModeOf({ resourceCapacityStrongMode: 'capacityModeWarn' })).toBe('capacityModeWarn');
  });
});

describe('parseBusy', () => {
  it('turns the answer of the database into typed conflicts (numbers come as text)', () => {
    const [c] = parseBusy([raw]);
    expect(c).toMatchObject({ resourceKind: 'person', resourceTitle: 'Boris M', day: '2026-10-14', capacityHours: 8, bookedHere: 4, bookedOthers: 8, overHours: 4, notFilled: false, lines: ['l-5'] });
    expect(c.others).toEqual([{ projectGUID: 'prj-1', taskGUID: 't-3', hours: 8, managerEmail: 'petra@acme.test' }]);
  });
  it('keeps the kind: person | equipment | workCenter (an unknown or missing kind is a person)', () => {
    expect(parseBusy([{ ...raw, resourceKind: 'workCenter' }])[0].resourceKind).toBe('workCenter');
    expect(parseBusy([{ ...raw, resourceKind: 'equipment' }])[0].resourceKind).toBe('equipment');
    expect(parseBusy([{ ...raw, resourceKind: 'room' }])[0].resourceKind).toBe('person');
  });
  it('anything that is not a list is no conflict; a null capacity is "not filled"', () => {
    expect(parseBusy(undefined)).toEqual([]);
    expect(parseBusy('x')).toEqual([]);
    expect(parseBusy([null, 3])).toEqual([]);
    const [c] = parseBusy([{ ...raw, capacityHours: null }]);
    expect(c.capacityHours).toBeNull();
    expect(c.notFilled).toBe(true);
  });
});

describe('isBusy = the twin of the SQL rule', () => {
  it('equal is not busy, more is', () => {
    expect(isBusy(8, 6, 2)).toBe(false);
    expect(isBusy(8, 6, 2.01)).toBe(true);
    expect(isBusy(4, 4, 0)).toBe(false);
    expect(isBusy(4, 5, 0)).toBe(true);
  });
  it('capacity 0 (weekend, vacation) and anything booked is busy; nothing booked is never busy', () => {
    expect(isBusy(0, 1, 0)).toBe(true);
    expect(isBusy(0, 0, 5)).toBe(false);
  });
  it('a day the calendar does not have is a conflict, never a guess', () => {
    expect(isBusy(null, 2, 0)).toBe(true);
    expect(isBusy(null, 0, 0)).toBe(false);
  });
});

describe('sentences', () => {
  it('names the resource, the day and the hours', () => {
    const [c] = parseBusy([raw]);
    expect(busySentence(c)).toBe('Boris M is busy on 2026-10-14: 12 h of 8 h (8 h are booked by other tasks of your organization)');
  });
  it('without other bookings the calendar is the reason (Saturday, vacation)', () => {
    const [c] = parseBusy([{ ...raw, capacityHours: 0, bookedOthers: 0, others: [] }]);
    expect(busySentence(c)).toBe('Boris M is busy on 2026-10-14: 4 h of 0 h (the calendar allows 0 h)');
  });
  it('a calendar that is not filled says so', () => {
    const [c] = parseBusy([{ ...raw, capacityHours: null, others: [] }]);
    expect(busySentence(c)).toContain('not filled');
  });
  it('hours without .00', () => {
    expect(hoursText(8)).toBe('8');
    expect(hoursText(2.5)).toBe('2.5');
    expect(hoursText(1.005 * 100)).toBe('100.5');
  });
  it('lists each left-out line once', () => {
    const cs = parseBusy([raw, { ...raw, day: '2026-10-15' }]);
    expect(busyLineGUIDs(cs)).toEqual(['l-5']);
  });
});

describe('Share', () => {
  it('goes to the managers of the projects that hold the booking and copies the manager of the project being posted', () => {
    const [c] = parseBusy([raw]);
    expect(shareRecipients(c)).toEqual({ to: ['petra@acme.test'], cc: ['rok@acme.test'] });
  });
  it('the same manager twice is one address; a manager who is also To is not copied again', () => {
    const [c] = parseBusy([{ ...raw, postingManagerEmail: 'PETRA@acme.test', others: [raw.others[0], { ...raw.others[0], taskGUID: 't-9' }] }]);
    expect(shareRecipients(c)).toEqual({ to: ['petra@acme.test'], cc: [] });
  });
  it('the text names the resource, the day, the hours and both GUIDs', () => {
    const [c] = parseBusy([raw]);
    const text = shareText(c);
    expect(text).toContain('Boris M');
    expect(text).toContain('2026-10-14');
    expect(text).toContain('project prj-1, task t-3 (8 h)');
    expect(text).toContain('already booked 8 h of 8 h');
  });
  it('mailto: To + Cc, subject and body are encoded; the application never sends the mail', () => {
    const [c] = parseBusy([raw]);
    const url = shareMailto(c)!;
    expect(url.startsWith('mailto:petra@acme.test?')).toBe(true);
    expect(url).toContain('cc=rok%40acme.test');
    expect(url).toContain('subject=');
    expect(decodeURIComponent(url)).toContain('project prj-1, task t-3');
  });
  it('without any manager e-mail there is no link and the button says what to set', () => {
    const [c] = parseBusy([{ ...raw, postingManagerEmail: '', others: [{ ...raw.others[0], managerEmail: '' }] }]);
    expect(shareMailto(c)).toBeNull();
    expect(shareState(c)).toEqual({ enabled: false, hint: 'Set the project manager in the project settings (a person with an e-mail)' });
    expect(shareState(parseBusy([raw])[0]).enabled).toBe(true);
  });
  it('only the copy exists: it becomes the To', () => {
    const [c] = parseBusy([{ ...raw, others: [{ ...raw.others[0], managerEmail: '' }] }]);
    expect(shareMailto(c)!.startsWith('mailto:rok@acme.test?')).toBe(true);
  });
});
