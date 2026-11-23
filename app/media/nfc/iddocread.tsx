import React from 'react';
import RecordingSignInGate from '../../../kit8/ui/components/media/common/RecordingSignInGate';
import IdCardReader from '../../../kit8/ui/components/media/nfc/iddocread/IdCardReader';

// scanning and reading are for signed-in users only (a guest is offered Sign in)
export default function IdCardScreen() {
  return (
    <RecordingSignInGate kind="idcard" returnTo="/media/nfc/iddocread">
      <IdCardReader />
    </RecordingSignInGate>
  );
}
