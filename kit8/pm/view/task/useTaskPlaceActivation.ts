// The task page (PMProjectTaskInfo) activates rowJSON.lastEditPlace ONCE when a task is opened:
//   - openPlace   the place the task had at that moment (later writes of the place, realtime, an edit on the page do not move the page)
//   - the page scrolls to the remembered section and KEEPS it in view while the content above it is still loading (the lists of
//     dependencies, the lines of Finances ...), until the user touches / scrolls the page or ~1.5 s have passed
//   - `ready`/`financesPlace`: Finances is rendered when the place is known, so it opens its tab and marks its line from the start
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import { usePMStore } from '../../store/store_pm';
import { lastEditPlaceOf, pageSectionOf, PMLastEditPlace, PMTaskPageSection } from '../../model/lastEditPlace';

export const KEEP_IN_VIEW_MS = 1500;

export function useTaskPlaceActivation(taskGUID: string, hasTask: boolean) {
  const [openPlace, setOpenPlace] = useState<{ guid: string; place: PMLastEditPlace | null } | null>(null);
  useEffect(() => {
    if (!hasTask || openPlace?.guid === taskGUID) return;
    setOpenPlace({ guid: taskGUID, place: lastEditPlaceOf(usePMStore.getState().tasksById[taskGUID]?.rowJSON) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTask, taskGUID]);

  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<PMTaskPageSection, number>>>({});
  const [layoutTick, setLayoutTick] = useState(0);
  /** the task whose remembered section is being kept in view */
  const armedFor = useRef<string | null>(null);

  const ready = openPlace?.guid === taskGUID;
  const pageSection = ready ? pageSectionOf(openPlace!.place) : null;

  /** onLayout of a section: its top in the scrolled content */
  const sectionLayout = useCallback((key: PMTaskPageSection) => (e: Pick<LayoutChangeEvent, 'nativeEvent'>) => {
    if (sectionY.current[key] === e.nativeEvent.layout.y) return;
    sectionY.current[key] = e.nativeEvent.layout.y;
    setLayoutTick((n) => n + 1);
  }, []);
  /** the user touched / scrolled the page: stop keeping the section in view */
  const disarm = useCallback(() => { armedFor.current = null; }, []);

  useEffect(() => {
    if (!pageSection) return;
    armedFor.current = taskGUID;
    const timer = setTimeout(() => { if (armedFor.current === taskGUID) armedFor.current = null; }, KEEP_IN_VIEW_MS);
    return () => clearTimeout(timer);
  }, [pageSection, taskGUID]);
  useEffect(() => {
    if (!pageSection || armedFor.current !== taskGUID) return;
    const y = sectionY.current[pageSection];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
  }, [pageSection, taskGUID, layoutTick]);

  return { ready, financesPlace: ready ? openPlace!.place : null, pageSection, scrollRef, sectionLayout, disarm };
}
