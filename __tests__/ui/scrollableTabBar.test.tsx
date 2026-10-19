/** @jest-environment jsdom */
// ScrollableTabBar: a tab row that scrolls left / right. Pure side: which edges have more tabs; the render keeps the testID, the children and the tablist role,
// and shows no chevron while the tabs fit (jsdom has no layout: width 0 = nothing overflows).
import React from 'react';
import { Pressable, Text } from 'react-native';
import { cleanupUI, q, renderUI } from '../pm/ui/pmUiTestKit';
import ScrollableTabBar, { tabBarEdges } from '../../kit8/ui/components/tabs/ScrollableTabBar';

afterEach(cleanupUI);

it('tabBarEdges: nothing to scroll while the tabs fit; the edge that has more tabs behind it', () => {
  expect(tabBarEdges(0, 0, 0)).toEqual({ left: false, right: false });
  expect(tabBarEdges(0, 400, 400)).toEqual({ left: false, right: false });
  expect(tabBarEdges(0, 400, 900)).toEqual({ left: false, right: true });
  expect(tabBarEdges(250, 400, 900)).toEqual({ left: true, right: true });
  expect(tabBarEdges(500, 400, 900)).toEqual({ left: true, right: false });
});

it('renders its tabs inside a tablist with the given testID and no chevron while they fit', () => {
  renderUI(
    <ScrollableTabBar testID="bar" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderBottomWidth: 1 }}>
      <Pressable testID="t1" accessibilityRole="tab"><Text>One</Text></Pressable>
      <Pressable testID="t2" accessibilityRole="tab"><Text>Two</Text></Pressable>
    </ScrollableTabBar>,
  );
  const bar = q('bar')!;
  expect(bar.getAttribute('role')).toBe('tablist');
  expect(bar.querySelectorAll('[role="tab"]').length).toBe(2);
  expect(q('bar-left')).toBeNull();
  expect(q('bar-right')).toBeNull();
});
