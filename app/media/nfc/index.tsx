import React from 'react';
import NfcScan from '../../../kit8/ui/components/media/nfc/NfcScan';

// reading an NFC tag is open to everybody; only "Create media post" with the result needs a sign in
export default function NfcScreen() {
  return <NfcScan />;
}
