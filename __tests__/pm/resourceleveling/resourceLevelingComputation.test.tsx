/** @jest-environment jsdom */
// Where a run is calculated: the setting resourceLevelingComputationSide, the radio set with the pluses and minuses of both variants, the texts of the outcome, and the effect on Fast mode.
// documentation/RESOURCE_LEVELING_WBS.html section 19.
import { cleanupUI, press, q, renderUI, textOf } from '../ui/pmUiTestKit';
import PMResourceLevelingComputationRadio from '../../../kit8/pm/resourceleveling/PMResourceLevelingComputationRadio';
import PMResourceLevelingSettingsTab from '../../../kit8/pm/resourceleveling/PMResourceLevelingSettingsTab';
import { computationInfos, fallbackText, outcomeText, reasonText } from '../../../kit8/pm/resourceleveling/resourceLevelingComputation';
import { RESOURCE_LEVELING_COMPUTATIONS, resourceLevelingOf, resourceLevelingValuesOf } from '../../../kit8/pm/resourceleveling/resourceLevelingSettings';
import { defaultProjectSettingsOf } from '../../../kit8/catalog/organization/defaultProjectSettings';

afterEach(cleanupUI);
const CLIENT = 'resourceLevelingClientSideComputations';
const SERVER = 'resourceLevelingServerSideComputations';

describe('the setting resourceLevelingComputationSide', () => {
  it('the client side is the default; the two names are the ones of the radio set', () => {
    expect(RESOURCE_LEVELING_COMPUTATIONS).toEqual([CLIENT, SERVER]);
    expect(resourceLevelingValuesOf(null).resourceLevelingComputationSide).toBe(CLIENT);
    expect(resourceLevelingValuesOf({ resourceLevelingComputationSide: 'resourceLevelingServerSideC9mputations' as any }).resourceLevelingComputationSide).toBe(CLIENT); // the typo of the request is no value
    expect(resourceLevelingValuesOf({ resourceLevelingComputationSide: SERVER }).resourceLevelingComputationSide).toBe(SERVER);
    expect(defaultProjectSettingsOf({ resourceLevelingComputationSide: SERVER }).resourceLevelingComputationSide).toBe(SERVER);
  });

  it('works only while the master is on', () => {
    expect(resourceLevelingOf({ resourceLevelingComputationSide: SERVER })).toMatchObject({ computation: CLIENT, serverSide: false });
    expect(resourceLevelingOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingComputationSide: SERVER })).toMatchObject({ computation: SERVER, serverSide: true });
    expect(resourceLevelingOf({ resourceLevelingFunctionalityEnabled: true })).toMatchObject({ computation: CLIENT, serverSide: false });
  });

  it('Fast mode works only with the client side computations', () => {
    const on = { resourceLevelingFunctionalityEnabled: true, resourceLevelingFunctionalityFastModeEnabled: true };
    expect(resourceLevelingOf({ ...on, resourceLevelingComputationSide: CLIENT })).toMatchObject({ fastMode: true, fastModeNeedsClientSide: false });
    expect(resourceLevelingOf({ ...on, resourceLevelingComputationSide: SERVER })).toMatchObject({ fastMode: false, fastModeNeedsClientSide: true });
    expect(resourceLevelingOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingComputationSide: SERVER })).toMatchObject({ fastMode: false, fastModeNeedsClientSide: false });
  });
});

describe('the texts of the two variants', () => {
  it('each variant has a title, a summary, and pluses and minuses for the user', () => {
    const infos = computationInfos();
    expect(infos.map((i) => i.value)).toEqual([CLIENT, SERVER]);
    for (const i of infos) {
      expect(i.title.length).toBeGreaterThan(5);
      expect(i.summary.length).toBeGreaterThan(20);
      expect(i.plus.length).toBeGreaterThanOrEqual(3);
      expect(i.minus.length).toBeGreaterThanOrEqual(3);
      expect(new Set([...i.plus, ...i.minus]).size).toBe(i.plus.length + i.minus.length);
    }
    expect(infos[0].title).toBe('Client side computations');
    expect(infos[1].title).toBe('Server side computations');
  });

  it('the server side says honestly what it takes and that it has a time limit', () => {
    const minus = computationInfos()[1].minus.join(' ');
    expect(minus).toMatch(/PART 42/);
    expect(minus).toMatch(/one calendar/);
    expect(minus).toMatch(/5 seconds/);
    expect(minus).toMatch(/Fast mode/);
  });

  it('the outcome: nothing to say on the client side, one line for the database, the reasons after a fallback', () => {
    expect(outcomeText(null)).toBe('');
    expect(outcomeText({ asked: CLIENT, used: 'client' })).toBe('');
    expect(outcomeText({ asked: SERVER, used: 'server', adjusted: 0 })).toBe('Calculated by the database and checked on this device.');
    expect(outcomeText({ asked: SERVER, used: 'server', adjusted: 2 })).toContain('2 task(s) were adjusted');
    const why = outcomeText({ asked: SERVER, used: 'client', fallback: 'planNotSupported', reasons: ['constraint', 'constraint', 'splits'] });
    expect(why).toContain(fallbackText({ asked: SERVER, used: 'client', fallback: 'planNotSupported' }));
    expect(why).toContain(reasonText('constraint'));
    expect(why).toContain(reasonText('splits'));
    expect(why.split(reasonText('constraint')).length).toBe(2); // once
    expect(outcomeText({ asked: SERVER, used: 'client', fallback: 'serverUnavailable' })).toContain('start2_sql_code.sql');
    expect(reasonText('something new')).toBe('the database does not know this request');
  });
});

describe('the radio set', () => {
  it('both variants are on the screen with their pluses and minuses; the chosen one is checked', () => {
    renderUI(<PMResourceLevelingComputationRadio value={SERVER} onChange={jest.fn()} />);
    expect(q('pm-resource-leveling-computation')!.getAttribute('role')).toBe('radiogroup');
    expect(q(`pm-resource-leveling-computation-${SERVER}`)!.getAttribute('aria-checked')).toBe('true');
    expect(q(`pm-resource-leveling-computation-${CLIENT}`)!.getAttribute('aria-checked')).toBe('false');
    for (const info of computationInfos()) {
      expect(textOf(`pm-resource-leveling-computation-${info.value}-title`)).toBe(info.title);
      info.plus.forEach((t, i) => expect(textOf(`pm-resource-leveling-computation-${info.value}-plus-${i}`)).toContain(t));
      info.minus.forEach((t, i) => expect(textOf(`pm-resource-leveling-computation-${info.value}-minus-${i}`)).toContain(t));
    }
  });

  it('a press chooses a variant; disabled does not', () => {
    const onChange = jest.fn();
    const { rerender } = renderUI(<PMResourceLevelingComputationRadio value={CLIENT} onChange={onChange} />) as any;
    press(`pm-resource-leveling-computation-${SERVER}`);
    expect(onChange).toHaveBeenLastCalledWith(SERVER);
    onChange.mockClear();
    if (rerender) rerender(<PMResourceLevelingComputationRadio value={CLIENT} onChange={onChange} disabled />);
    else { cleanupUI(); renderUI(<PMResourceLevelingComputationRadio value={CLIENT} onChange={onChange} disabled />); }
    press(`pm-resource-leveling-computation-${SERVER}`);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the section Resource optimization', () => {
  it('no radio set while the master is off', () => {
    renderUI(<PMResourceLevelingSettingsTab values={{}} onChange={jest.fn()} />);
    expect(q('pm-resource-leveling-computation')).toBeNull();
  });

  it('with the master on: the radio set; a press writes only its key', () => {
    const onChange = jest.fn();
    renderUI(<PMResourceLevelingSettingsTab values={{ resourceLevelingFunctionalityEnabled: true }} onChange={onChange} />);
    expect(q(`pm-resource-leveling-computation-${CLIENT}`)!.getAttribute('aria-checked')).toBe('true');
    press(`pm-resource-leveling-computation-${SERVER}`);
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingComputationSide: SERVER });
  });

  it('with the server side: Fast mode is disabled and says why', () => {
    renderUI(<PMResourceLevelingSettingsTab values={{ resourceLevelingFunctionalityEnabled: true, resourceLevelingComputationSide: SERVER, resourceLevelingFunctionalityFastModeEnabled: true }} onChange={jest.fn()} />);
    expect((q('pm-resource-leveling-fast')!.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    expect(q('pm-project-tab-resources-content')!.textContent).toContain('Not available with Server side computations');
  });
});
