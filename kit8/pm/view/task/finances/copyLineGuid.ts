// "Copy line GUID" of the Finances table (right button on a line): the rowGUID of the task_line_table line on the clipboard.
// The user pastes it anywhere, e.g. into the line of a multi project vendor invoice / purchase order (vendorInvoiceTaskLineGUID).
import * as Clipboard from 'expo-clipboard';
import { showSnackbar } from '../../../../redux/uxuiSlice';

/** puts the GUID on the clipboard and says so in a snackbar; false when the clipboard refused */
export async function copyLineGUID(guid: string, dispatch: (action: any) => any): Promise<boolean> {
  if (!guid) return false;
  try {
    await Clipboard.setStringAsync(guid);
    dispatch(showSnackbar({ message: `Line GUID copied: ${guid}`, duration: 2500 }));
    return true;
  } catch {
    return false;
  }
}
