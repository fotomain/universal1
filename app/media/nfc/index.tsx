import React from 'react';
import RecordingSignInGate from '../../../kit8/ui/components/media/common/RecordingSignInGate';
import NfcScan from '../../../kit8/ui/components/media/nfc/NfcScan';

// scanning and reading are for signed-in users only (a guest is offered Sign in)
export default function NfcScreen() {
  return (
    <RecordingSignInGate kind="nfc" returnTo="/media/nfc">
      <NfcScan />
    </RecordingSignInGate>
  );
}
