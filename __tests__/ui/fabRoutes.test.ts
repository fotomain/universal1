// The floating "+" button is hidden on the video recorder (its settings stand where the button floats)
import { fabHiddenOnRoute } from '../../kit8/ui/components/fab/fabRoutes';

it('hidden on the record video route only', () => {
  expect(fabHiddenOnRoute('/media/record/video')).toBe(true);
  expect(fabHiddenOnRoute('/media/record/video/')).toBe(true);
  expect(fabHiddenOnRoute('/media/record/video?x=1')).toBe(true);
  expect(fabHiddenOnRoute('/media/record/audio')).toBe(false);
  expect(fabHiddenOnRoute('/media/play/video')).toBe(false);
  expect(fabHiddenOnRoute('/')).toBe(false);
  expect(fabHiddenOnRoute(undefined)).toBe(false);
});
