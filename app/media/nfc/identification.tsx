import React from 'react';
import IdentificationFlow from '../../../kit8/ui/components/media/nfc/identification/IdentificationFlow';

// Identification: ID card or passport -> photo of the zone -> text recognised on the phone -> NFC scan (open to everybody; nothing is saved)
export default function IdentificationScreen() {
  return <IdentificationFlow />;
}
