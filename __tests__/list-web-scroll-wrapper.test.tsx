import { getBusinessMotto } from '../kit8/components/list/web/ListWebScrollWrapper';

describe('ListWebScrollWrapper', () => {
  it('calculates correct business mottos based on scroll percentage', () => {
    expect(getBusinessMotto(0)).toContain('Initializing Q4 Synergy Protocols');
    expect(getBusinessMotto(10)).toContain('Leveraging Core Competencies');
    expect(getBusinessMotto(40)).toContain('Circle Back & Touch Base');
    expect(getBusinessMotto(60)).toContain('Paradigms Shifted');
    expect(getBusinessMotto(80)).toContain('Closing the Loop');
    expect(getBusinessMotto(100)).toContain('100% PROFITABILITY REACHED');
  });
});
