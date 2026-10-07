// ReusableTable - Export (automatic download) and Share of the table: JSON · CSV · PDF full data · PDF visible.
//   JSON / CSV / "PDF - full data": what the table shows + the GUIDs behind it
//   "PDF - visible":                only what the table shows
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { downloadTextFile } from '../../../../pm/crud/exchange/project/export/downloadTextFile';
import { downloadBinaryFile } from '../../../../pm/crud/exchange/pdf/downloadBinaryFile';
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';
import type { CatalogTitleFn } from './tableFilter';
import { buildTableExport, exportFileName, exportToCSV, exportToJSON } from './tableExport';
import { buildTablePdf } from './tablePdf';

export type TableExportFormat = 'json' | 'csv' | 'pdfFull' | 'pdfVisible';
export const TABLE_EXPORT_FORMATS: { format: TableExportFormat; label: string; icon: string }[] = [
  { format: 'json', label: 'to JSON', icon: 'data_object' },
  { format: 'csv', label: 'to CSV', icon: 'description' },
  { format: 'pdfFull', label: 'PDF - full data', icon: 'picture_as_pdf' },
  { format: 'pdfVisible', label: 'PDF - visible', icon: 'picture_as_pdf' },
];

export interface TableFile { fileName: string; mimeType: string; text?: string; bytes?: Uint8Array }
export interface TableExportSource { title: string; rows: ReusableTableRow[]; columns: VisualColumn[]; catalogTitle: CatalogTitleFn }

export function buildTableFile(format: TableExportFormat, src: TableExportSource, now = new Date()): TableFile {
  const data = buildTableExport({ ...src, withGuids: format !== 'pdfVisible' });
  if (format === 'json') return { fileName: exportFileName(src.title, 'json', now), mimeType: 'application/json', text: exportToJSON(data, now) };
  if (format === 'csv') return { fileName: exportFileName(src.title, 'csv', now), mimeType: 'text/csv', text: exportToCSV(data) };
  const subtitle = `${data.rows.length} rows · ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC${format === 'pdfFull' ? ' · full data (with GUIDs)' : ''}`;
  return { fileName: exportFileName(`${src.title}${format === 'pdfFull' ? ' full' : ''}`, 'pdf', now), mimeType: 'application/pdf', bytes: buildTablePdf(src.title, subtitle, data.headers, data.rows) };
}

export type TableFileResult = 'downloaded' | 'shared' | 'saved' | 'copied' | 'dismissed';

/** web: the file is downloaded at once; iOS: share sheet ("Save to Files" ...); Android: PDF = pick a folder, text = share sheet */
export async function exportTableFile(file: TableFile): Promise<TableFileResult> {
  return file.bytes ? downloadBinaryFile(file.fileName, file.bytes, file.mimeType) : downloadTextFile(file.fileName, file.text ?? '', file.mimeType);
}

/**
 * web: the browser's share dialog with the file; where the browser cannot share files, JSON / CSV are copied to the
 * clipboard and a PDF is downloaded. iOS / Android: the system share sheet (Android PDF: saved to a folder the user picks).
 */
export async function shareTableFile(file: TableFile, title: string): Promise<TableFileResult> {
  if (Platform.OS !== 'web') return exportTableFile(file);
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  try {
    if (nav?.share && nav?.canShare && typeof File !== 'undefined') {
      const f = new File([file.bytes ? (file.bytes as any) : file.text ?? ''], file.fileName, { type: file.mimeType });
      if (nav.canShare({ files: [f] })) {
        await nav.share({ files: [f], title });
        return 'shared';
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'dismissed';
    // sharing files is not allowed here -> the fallback below
  }
  if (file.text !== undefined) {
    await Clipboard.setStringAsync(file.text);
    return 'copied';
  }
  return exportTableFile(file);
}

export const tableFileResultMessage = (r: TableFileResult, fileName: string): string | null =>
  r === 'downloaded' ? `${fileName} downloaded` : r === 'saved' ? `${fileName} saved` : r === 'copied' ? 'This browser cannot share files: the data was copied to the clipboard' : null;
