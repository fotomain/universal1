import { type StyleProp, type ViewStyle } from 'react-native';

export interface DroppedFileItem {
    name: string;
    mimeType?: string;
    uri?: string;
    blob?: Blob | File;
    size?: number;
    base64?: string;
}

export interface ReceiveDraggableFilesProps {
    folderName: string;
    isHovered?: boolean;
    onFilesDropped: (files: DroppedFileItem[]) => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    style?: StyleProp<ViewStyle>;
    allowedMimeTypes?: (string | RegExp)[];
    /** main text (default: "Drop files to upload to {folderName}") */
    title?: string;
    /** second line (default: the MD3 drop hint) */
    subtitle?: string;
    /** small layout for dialogs: no big icon circle, no platform badge */
    compact?: boolean;
    /** show a "Choose file…" button (web: file input, iOS / Android: document picker) */
    pickable?: boolean;
    /** label of that button (default "Choose file…") */
    pickLabel?: string;
    /** web <input accept> for the picker, e.g. ".json,application/json" */
    accept?: string;
    /** native picker types, e.g. ["application/json"] */
    pickMimeTypes?: string[];
    disabled?: boolean;
    testID?: string;
}
