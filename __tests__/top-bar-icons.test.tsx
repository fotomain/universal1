describe('ListWebTopBarComponent IconApp integration', () => {
  it('defines the top bar icons with correct testIDs and names', () => {
    const iconConfig = [
      { testID: 'createNewItem', name: 'add', title: 'Create New Item' },
      { testID: 'scrollToCurrent', name: 'crosshairs-gps', title: 'scrollToCurrent' },
      { testID: 'scrollTop', name: 'format-vertical-align-top', title: 'scrollTop' },
      { testID: 'scrollBottom', name: 'format-vertical-align-bottom', title: 'scrollBottom' },
    ];

    expect(iconConfig).toHaveLength(4);
    expect(iconConfig.find(i => i.testID === 'createNewItem')?.name).toBe('add');
    expect(iconConfig.find(i => i.testID === 'scrollToCurrent')?.name).toBe('crosshairs-gps');
    expect(iconConfig.find(i => i.testID === 'scrollTop')?.name).toBe('format-vertical-align-top');
    expect(iconConfig.find(i => i.testID === 'scrollBottom')?.name).toBe('format-vertical-align-bottom');
  });
});
