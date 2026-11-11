import React from 'react';
import FileViewer from '../../../kit8/files/common/FileViewer';

// route /files/view?post=<mediaPost guid> - shows an attached file in the browser (image, pdf, text, markdown, audio, video); opened by "View" of the Files tab
export default function FileViewScreen() {
  return <FileViewer />;
}
