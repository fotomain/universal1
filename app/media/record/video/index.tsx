import React from 'react';
import RecordVideo from '../../../../kit8/ui/components/media/video/RecordVideo';
import RecordingSignInGate from '../../../../kit8/ui/components/media/common/RecordingSignInGate';

// recordings are for signed-in users only (a guest is offered Sign in / connect the file storage)
export default function RecordVideoScreen() {
  return (
    <RecordingSignInGate kind="video" returnTo="/media/record/video">
      <RecordVideo />
    </RecordingSignInGate>
  );
}
