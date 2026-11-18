// importAssistantModel - the pure rules of the Import New Project Assistant: the three steps, what a project file says, the notes of the name.
import { parseProjectExchangeFile } from '../../../../pm/crud/exchange/project/projectExchangeFormat';

export type ImportStepId = 'file' | 'name' | 'import';

export const IMPORT_STEPS: { id: ImportStepId; title: string; tip: string }[] = [
  {
    id: 'file',
    title: 'File',
    tip: 'Choose a project file exported by this application (project_data_….json). It carries the stages, tasks, dependencies and the planning settings; money, documents and people are not part of it.',
  },
  {
    id: 'name',
    title: 'Name',
    tip: 'The imported project is a NEW project of your organization. Give it its own name so that it is not mistaken for the project the file came from.',
  },
  {
    id: 'import',
    title: 'Import',
    tip: 'The project is created with the default settings of your organization, then the file is loaded into it. You will see it on the dashboard.',
  },
];

export interface ImportFileSummary {
  fileName: string;
  sourceProjectName: string;
  tasks: number;
  dependencies: number;
  exportedAt: string;
  /** YYYY-MM-DD of the start of the project in the file ('' = none) */
  startDate: string;
  /** start of the project in the file, ms (NaN-free: 0 = none) */
  startMs: number;
}

/** the text of a file -> what it holds, or the reason it cannot be imported */
export function summarizeProjectFile(text: string, fileName: string): { ok: true; summary: ImportFileSummary } | { ok: false; error: string } {
  try {
    const f = parseProjectExchangeFile(text);
    const startAt = f.project?.rowJSON?.projectStartAt;
    const ms = startAt ? Date.parse(startAt) : NaN;
    return {
      ok: true,
      summary: {
        fileName,
        sourceProjectName: String(f.project?.rowJSON?.name || ''),
        tasks: f.tasks.length,
        dependencies: f.dependencies.length,
        exportedAt: f.exportedAt || '',
        startDate: Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10),
        startMs: Number.isNaN(ms) ? 0 : ms,
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'The file is not a project file.' };
  }
}

export interface ImportNote {
  level: 'error' | 'warning' | 'info';
  text: string;
}

export function importNameNotes(name: string, existingNames: string[]): ImportNote[] {
  const n = name.trim();
  if (!n) return [{ level: 'error', text: 'The name is required.' }];
  const notes: ImportNote[] = [];
  if (n.length > 120) notes.push({ level: 'error', text: 'The name is too long (120 characters at most).' });
  if (existingNames.some((x) => x.trim().toLowerCase() === n.toLowerCase())) notes.push({ level: 'warning', text: 'A project with this name already exists in your organization.' });
  return notes;
}

export const importStepNotes = (id: ImportStepId, summary: ImportFileSummary | null, name: string, existingNames: string[]): ImportNote[] => {
  if (id === 'file') {
    if (!summary) return [{ level: 'error', text: 'Choose the project file first.' }];
    const notes: ImportNote[] = [];
    if (summary.tasks === 0) notes.push({ level: 'warning', text: 'The file has no tasks: only the project itself will be created.' });
    return notes;
  }
  if (id === 'name') return importNameNotes(name, existingNames);
  return [];
};

export const importHasError = (notes: ImportNote[]): boolean => notes.some((n) => n.level === 'error');
