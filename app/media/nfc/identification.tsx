import React from 'react';
import RecordingSignInGate from '../../../kit8/ui/components/media/common/RecordingSignInGate';
import CameraPermissionGate from '../../../kit8/ui/components/media/common/CameraPermissionGate';
import IdentificationFlow from '../../../kit8/ui/components/media/nfc/identification/IdentificationFlow';

// scanning and reading are for signed-in users only (a guest is offered Sign in); the flow starts with the photo of the document, so the camera access is
// asked for AT THE START and the screen does not open without it
export default function IdentificationScreen() {
  return (
    <RecordingSignInGate kind="identification" returnTo="/media/nfc/identification">
      <CameraPermissionGate reason="to photograph the zone of the document">
        <IdentificationFlow />
      </CameraPermissionGate>
    </RecordingSignInGate>
  );
}
