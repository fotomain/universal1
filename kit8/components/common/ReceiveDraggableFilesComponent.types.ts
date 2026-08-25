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
}
