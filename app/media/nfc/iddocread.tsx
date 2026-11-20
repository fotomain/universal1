import React from 'react';
import IdCardReader from '../../../kit8/ui/components/media/nfc/iddocread/IdCardReader';

// reading an ID card / passport is open to everybody; nothing is saved
export default function IdCardScreen() {
  return <IdCardReader />;
}
