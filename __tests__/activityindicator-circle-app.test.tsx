import React from 'react';
import { ActivityIndicator } from 'react-native';
import renderer from 'react-test-renderer';
import {
  ActivityIndicatorCircleApp,
  ACTIVITY_INDICATOR_CIRCLE_APP_SIZE,
  PM_ACTIVITY_INDICATOR_SIZE,
} from '../kit8/ui/components/activityindicator/ActivityIndicatorCircleApp';
import PMActivityIndicator from '../kit8/pm/inner/PMActivityIndicator';

const mockThemeColors = { primary: '#123456' };

jest.mock('../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: jest.fn(() => ({
    themeColors: mockThemeColors,
  })),
}));

describe('ActivityIndicatorCircleApp', () => {
  it('exports valid component and constants', () => {
    expect(typeof ActivityIndicatorCircleApp).toBe('function');
    expect(ACTIVITY_INDICATOR_CIRCLE_APP_SIZE).toBe('large');
    expect(PM_ACTIVITY_INDICATOR_SIZE).toBe('large');
  });

  it('renders with default size "large" and theme primary color', () => {
    let testRenderer: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      testRenderer = renderer.create(<ActivityIndicatorCircleApp testID="my-loader" />);
    });
    const indicator = testRenderer!.root.findByType(ActivityIndicator);
    expect(indicator.props.testID).toBe('my-loader');
    expect(indicator.props.size).toBe('large');
    expect(indicator.props.color).toBe('#123456');
  });

  it('respects custom size and custom color', () => {
    let testRenderer: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      testRenderer = renderer.create(
        <ActivityIndicatorCircleApp testID="custom-loader" size="small" color="#ff0000" />
      );
    });
    const indicator = testRenderer!.root.findByType(ActivityIndicator);
    expect(indicator.props.testID).toBe('custom-loader');
    expect(indicator.props.size).toBe('small');
    expect(indicator.props.color).toBe('#ff0000');
  });

  it('falls back safely when useDesignSystem throws', () => {
    const { useDesignSystem } = require('../kit8/providers/WithDesignSystem');
    useDesignSystem.mockImplementationOnce(() => {
      throw new Error('outside provider');
    });

    let testRenderer: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      testRenderer = renderer.create(<ActivityIndicatorCircleApp testID="fallback-loader" />);
    });
    const indicator = testRenderer!.root.findByType(ActivityIndicator);
    expect(indicator.props.color).toBe('#6366f1');
  });

  it('PMActivityIndicator re-exports ActivityIndicatorCircleApp seamlessly', () => {
    expect(PMActivityIndicator).toBe(ActivityIndicatorCircleApp);
  });
});
