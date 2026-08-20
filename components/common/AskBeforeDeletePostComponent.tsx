import React from 'react';
import { ModalAskComponent } from './ModalAskComponent';

export interface AskBeforeDeletePostComponentProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  modatTopBar?: string;
  modalTopBar?: string;
  modalBody?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  testID?: string;
}

export const AskBeforeDeletePostComponent: React.FC<AskBeforeDeletePostComponentProps> = ({
  visible,
  onCancel,
  onConfirm,
  modatTopBar = 'Delete forever?',
  modalTopBar,
  modalBody = 'information will be completely deleted from the database',
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete',
  testID = 'askBeforeDeletePostComponent',
}) => {
  return (
    <ModalAskComponent
      visible={visible}
      modatTopBar={modatTopBar || modalTopBar}
      modalBody={modalBody}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmColor="#d32f2f"
      testID={testID}
    />
  );
};

export default AskBeforeDeletePostComponent;
