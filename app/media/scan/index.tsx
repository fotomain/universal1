import React from 'react';
import ScanCodes from '../../../kit8/ui/components/media/scan/ScanCodes';

// scanning a QR code / barcode is open to everybody; only "Create media post" with the result needs a sign in
export default function ScanScreen() {
  return <ScanCodes />;
}
