import React from 'react';
import RecordingSignInGate from '../../../kit8/ui/components/media/common/RecordingSignInGate';
import ScanCodes from '../../../kit8/ui/components/media/scan/ScanCodes';

// scanning and reading are for signed-in users only (a guest is offered Sign in)
export default function ScanScreen() {
  return (
    <RecordingSignInGate kind="scan" returnTo="/media/scan">
      <ScanCodes />
    </RecordingSignInGate>
  );
}
