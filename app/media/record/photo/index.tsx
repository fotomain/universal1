import React from 'react';
import RecordPhoto from '../../../../kit8/ui/components/media/photo/RecordPhoto';
import RecordingSignInGate from '../../../../kit8/ui/components/media/common/RecordingSignInGate';

// photos are for signed-in users only, like the recordings (a guest is offered Sign in / connect the file storage)
export default function RecordPhotoScreen() {
  return (
    <RecordingSignInGate kind="photo" returnTo="/media/record/photo">
      <RecordPhoto />
    </RecordingSignInGate>
  );
}
