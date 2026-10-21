// One tap = a callback after a short wait; a second tap on the same thing inside the wait = the double callback instead.
// Used for the project tasks of the calendar: a tap shows the quick view, a double click / double touch opens the task in the dashboard.

// a bit under the macOS / Windows default double click time (500 ms): a slower double click is still one
export const DOUBLE_TAP_MS = 380;

export function createDoubleTap<T>(onSingle: (value: T) => void, onDouble: (value: T) => void, sameThing: (a: T, b: T) => boolean, delay = DOUBLE_TAP_MS) {
  let pending: { value: T; timer: ReturnType<typeof setTimeout> } | null = null;
  const flush = () => {
    if (!pending) return;
    const { value, timer } = pending;
    clearTimeout(timer);
    pending = null;
    onSingle(value);
  };
  return {
    tap(value: T) {
      if (pending && sameThing(pending.value, value)) {
        clearTimeout(pending.timer);
        pending = null;
        onDouble(value);
        return;
      }
      flush(); // a tap on something else: the earlier one is a single tap now
      pending = {
        value,
        timer: setTimeout(() => {
          pending = null;
          onSingle(value);
        }, delay),
      };
    },
    cancel() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
    },
  };
}
