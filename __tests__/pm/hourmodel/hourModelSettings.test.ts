import { hourModelOf, hourModelSwitchPatch, parseWindowsText, timeZoneIsValid, windowsToText } from '../../../kit8/pm/hourmodel/hourModelSettings';

describe('hourModelSettings', () => {
  test('the day model is the default and nothing of the hour model is active', () => {
    expect(hourModelOf({}).active).toBe(false);
    expect(hourModelOf(null).active).toBe(false);
    expect(hourModelOf({ resourceOptimizationMode: 'dayByDayModel', resourceSlotMinutes: 5 }).active).toBe(false);
  });
  test('the effective values with their defaults', () => {
    expect(hourModelOf({ resourceOptimizationMode: 'hourByHourModel' })).toEqual({ active: true, windows: [{ from: 480, to: 960 }], slotMinutes: 15, timeZone: 'UTC' });
    expect(hourModelOf({ resourceOptimizationMode: 'hourByHourModel', resourceSlotMinutes: 5, projectTimeZone: 'Europe/Berlin', projectWorkWindows: [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }] }))
      .toEqual({ active: true, windows: [{ from: 540, to: 780 }, { from: 840, to: 1080 }], slotMinutes: 5, timeZone: 'Europe/Berlin' });
    expect(hourModelOf({ resourceOptimizationMode: 'hourByHourModel', resourceSlotMinutes: 7 }).slotMinutes).toBe(15);
  });
  test('the windows text', () => {
    expect(parseWindowsText('09:00-13:00, 14:00-18:00')).toEqual([{ from: 540, to: 780 }, { from: 840, to: 1080 }]);
    expect(parseWindowsText('14:00-18:00; 9:00-13:00')).toEqual([{ from: 540, to: 780 }, { from: 840, to: 1080 }]);
    expect(parseWindowsText('')).toBeNull();
    expect(parseWindowsText('09:00-08:00')).toBeNull();
    expect(parseWindowsText('09:00-13:00, 12:00-15:00')).toBeNull();
    expect(parseWindowsText('nine to five')).toBeNull();
    expect(windowsToText([{ from: 540, to: 780 }, { from: 840, to: 1080 }])).toBe('09:00-13:00, 14:00-18:00');
  });
  test('time zones', () => {
    expect(timeZoneIsValid('Europe/Berlin')).toBe(true);
    expect(timeZoneIsValid('Mars/Base')).toBe(false);
  });
  test('the switch patch keeps what the project already has', () => {
    expect(hourModelSwitchPatch('dayByDayModel', {})).toEqual({ resourceOptimizationMode: 'dayByDayModel' });
    expect(hourModelSwitchPatch('hourByHourModel', {}, 'Europe/Riga')).toMatchObject({ resourceOptimizationMode: 'hourByHourModel', projectTimeZone: 'Europe/Riga', resourceSlotMinutes: 15 });
    expect(hourModelSwitchPatch('hourByHourModel', { projectTimeZone: 'Asia/Tokyo', resourceSlotMinutes: 30 }, 'Europe/Riga')).toMatchObject({ projectTimeZone: 'Asia/Tokyo', resourceSlotMinutes: 30 });
    expect(hourModelSwitchPatch('hourByHourModel', {}, 'Not/AZone').projectTimeZone).toBe('UTC');
  });
});
