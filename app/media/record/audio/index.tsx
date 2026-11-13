import React from 'react';
import RecordAudio from '../../../../kit8/ui/components/media/RecordAudio';
import RecordingSignInGate from '../../../../kit8/ui/components/media/RecordingSignInGate';

// recordings are for signed-in users only (a guest is offered Sign in / connect the file storage)
export default function RecordAudioScreen() {
  return (
    <RecordingSignInGate kind="audio" returnTo="/media/record/audio">
      <RecordAudio />
    </RecordingSignInGate>
  );
}
