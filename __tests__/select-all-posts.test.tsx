describe('Select all posts selection state', () => {
  it('correctly calculates isAllSelected, isSomeSelected (indeterminate), and ensures intermediate minus icon color is not equal to background color', () => {
    const cards = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const primaryColor = '#6750A4';

    const getCheckboxColors = (selectedIds: string[], themeOnPrimary?: string) => {
      const isAllSelected = cards.length > 0 && selectedIds.length === cards.length;
      const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

      const headerCheckboxBg = (isAllSelected || isSomeSelected) ? primaryColor : "transparent";
      let headerCheckboxIconColor = "transparent";
      if (isAllSelected) {
        headerCheckboxIconColor = (themeOnPrimary && themeOnPrimary !== headerCheckboxBg)
          ? themeOnPrimary
          : "#ffffff";
      } else if (isSomeSelected) {
        headerCheckboxIconColor = (themeOnPrimary && themeOnPrimary !== headerCheckboxBg)
          ? themeOnPrimary
          : "#ffffff";
        if (headerCheckboxIconColor === headerCheckboxBg) {
          headerCheckboxIconColor = "#ffffff";
        }
      }

      return {
        isAllSelected,
        isSomeSelected,
        iconName: isAllSelected ? 'check' : isSomeSelected ? 'minus' : 'check',
        headerCheckboxBg,
        headerCheckboxIconColor,
      };
    };

    // State 1: No cards selected
    let res = getCheckboxColors([]);
    expect(res.isAllSelected).toBe(false);
    expect(res.isSomeSelected).toBe(false);
    expect(res.iconName).toBe('check');
    expect(res.headerCheckboxBg).toBe('transparent');
    expect(res.headerCheckboxIconColor).toBe('transparent');

    // State 2: Some cards selected (Indeterminate state)
    res = getCheckboxColors(['1']);
    expect(res.isAllSelected).toBe(false);
    expect(res.isSomeSelected).toBe(true);
    expect(res.iconName).toBe('minus');
    expect(res.headerCheckboxBg).toBe(primaryColor);
    expect(res.headerCheckboxIconColor).not.toBe(res.headerCheckboxBg);
    expect(res.headerCheckboxIconColor).toBe('#ffffff');

    // State 2b: Edge case where themeOnPrimary was incorrectly set equal to primaryColor
    res = getCheckboxColors(['1'], '#6750A4');
    expect(res.isSomeSelected).toBe(true);
    expect(res.headerCheckboxIconColor).not.toBe(res.headerCheckboxBg);
    expect(res.headerCheckboxIconColor).toBe('#ffffff');

    // State 3: All cards selected
    res = getCheckboxColors(['1', '2', '3']);
    expect(res.isAllSelected).toBe(true);
    expect(res.isSomeSelected).toBe(false);
    expect(res.iconName).toBe('check');
    expect(res.headerCheckboxBg).toBe(primaryColor);
    expect(res.headerCheckboxIconColor).not.toBe(res.headerCheckboxBg);
  });
});
