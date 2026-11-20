// Web: the flashlight of the camera track. `version` changes every time a new stream is opened (flip camera): the torch is applied to the
// NEW track again. `available` = the track reports a torch (Chrome on Android; a laptop camera has none, then the button is not shown).
// `lit` = the browser accepted the constraint. Works while a video is recorded (the track stays the same).
import { useEffect, useState } from 'react';
import { applyWebTorch, TorchTrack, webHasTorch } from './cameraTorch';

export function useWebTorch(getTrack: () => TorchTrack | null | undefined, wanted: boolean, version: number) {
  const [available, setAvailable] = useState(false);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const track = getTrack();
    const has = webHasTorch(track);
    setAvailable(has);
    if (!has) {
      setLit(false);
      return undefined;
    }
    let cancelled = false;
    void applyWebTorch(track, wanted).then((ok) => {
      if (!cancelled) setLit(ok && wanted);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, version]);
  return { available, lit };
}
