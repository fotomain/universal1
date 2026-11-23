// scrollNodeIntoView: web = scrollIntoView of the node, phone = measure inside the ScrollView and scroll a little above the node.
import { SCROLL_TARGET_MARGIN, scrollNodeIntoView } from '../../kit8/ui/components/media/nfc/iddocread/scrollToNode';

it('web: the node scrolls itself into view', () => {
  const node = { scrollIntoView: jest.fn() };
  expect(scrollNodeIntoView(node, null)).toBe(true);
  expect(node.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
});

it('phone: scrolls to the measured y minus the margin, never above the top', () => {
  const scroll = { getInnerViewRef: () => 'inner', scrollTo: jest.fn() };
  const node = { measureLayout: jest.fn((_inner: any, ok: any) => ok(0, 900, 300, 60)) };
  expect(scrollNodeIntoView(node, scroll)).toBe(true);
  expect(node.measureLayout.mock.calls[0][0]).toBe('inner');
  expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 900 - SCROLL_TARGET_MARGIN, animated: true });
  const near = { measureLayout: jest.fn((_i: any, ok: any) => ok(0, 20, 1, 1)) };
  scrollNodeIntoView(near, scroll);
  expect(scroll.scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
});

it('nothing to scroll to, or a view that cannot measure: false, no crash', () => {
  expect(scrollNodeIntoView(null, null)).toBe(false);
  expect(scrollNodeIntoView({}, { scrollTo: jest.fn() })).toBe(false);
  expect(scrollNodeIntoView({ measureLayout: () => { throw new Error('gone'); } }, { getInnerViewRef: () => 1, scrollTo: jest.fn() })).toBe(false);
});
