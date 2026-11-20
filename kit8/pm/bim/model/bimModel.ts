// BIM: the shared names, types and small pure helpers (documentation/BIM_WBS.html, README.md of this folder). No React, no Supabase, no three.
import type { PMProjectRow } from '../../model/types';

/** the private Storage bucket of the chunk files (SQL PART 55: bim_storage_setup) */
export const BIM_BUCKET = 'bim';
/** the read only mark of a project made by an import: project_table.rowJSON.projectIsBIMBased (SQL: trigger ab_project_bim; only the bim_ RPCs set it) */
export const PROJECT_IS_BIM_BASED_KEY = 'projectIsBIMBased';
/** the BIM example 1 of the plan: project GUID + the IFC of the viktor-platform sample models (Structure Walls) */
export const BIM_EXAMPLE1_PROJECT_GUID = 'aabd1dde-97e6-4359-97e4-0efcb847589b';
export const BIM_EXAMPLE1_URL = 'https://raw.githubusercontent.com/viktor-platform/ifc-sample-models/main/sample-models/Structure%20Walls.ifc';
export const BIM_EXAMPLE1_NAME = 'BIM example 1 - Structure Walls';
/** BIM example 3: the design model of the Schependomlaan residential building (ArchiCAD, ROOT bv; IFC2X3, 49 MB, about 3 500 elements: more than 1 500, so the tasks are grouped per storey + class + type).
 *  Source: the openBIMstandards archive (the dataset moved to buildingSMART Sample-Test-Files, whose repository was renamed and no longer lists it). */
export const BIM_EXAMPLE3_PROJECT_GUID = '3a427f72-98f9-4f46-8449-164e3a22e1de';
export const BIM_EXAMPLE3_URL = 'https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/master/Design%20model%20IFC/IFC%20Schependomlaan.ifc';
export const BIM_EXAMPLE3_NAME = 'BIM example 3 - Schependomlaan';
/** BIM example 4: Sixty5, an ArchiCAD architecture model (buildingSMART Community-Sample-Test-Files "SDK - S1", CC BY 4.0, holder unspecified; IFC2X3, 343 MB, a LARGE model: the test of the converter).
 *  The buildingSMART repository no longer lists it: the file is the mirror of the IFC-Bench dataset on Hugging Face, pinned to a revision (sha256 below). The converter needs BIM_MAX_IFC_MB >= 400 and the host huggingface.co
 *  (both are its defaults since converter 2) and about 10 GB of memory (see py/bim/server/README.md). */
export const BIM_EXAMPLE4_PROJECT_GUID = '7c1d5a30-4b8e-4f6a-9d21-5e0b6a3f8c14';
export const BIM_EXAMPLE4_URL = 'https://huggingface.co/datasets/sylvainHellin/ifc-bench/resolve/df630deb761efcb184f1a30ab374da7dbae38225/projects/sixty5/arc.ifc';
export const BIM_EXAMPLE4_NAME = 'BIM example 4 - Sixty5';
export const BIM_EXAMPLE4_SHA256 = 'e91ddbbd672bbde946af14631de4c732f0cf8a7cfae5dbbf06fbeab03b5c46df';

/** the BIM example 2: the buildingSMART Duplex Apartment (IFC2X3, Revit, CC BY 4.0). The file is a Git LFS file: raw.githubusercontent.com would give the 132 byte pointer, so the address is on media.githubusercontent.com (allowed by the converter, py/bim/server). */
export const BIM_EXAMPLE2_PROJECT_GUID = 'a1800750-c76d-401b-b866-e4aaf1998a7c';
export const BIM_EXAMPLE2_URL = 'https://media.githubusercontent.com/media/buildingsmart-community/Community-Sample-Test-Files/main/IFC%202.3.0.1%20(IFC%202x3)/Duplex%20Apartment/Duplex_A_20110907.ifc';
export const BIM_EXAMPLE2_NAME = 'BIM example 2 - Duplex Apartment';

/** the examples of the importer: the radio kind -> the project, the name and the address of the IFC */
export const BIM_EXAMPLES: Record<'example1' | 'example2' | 'example3' | 'example4', { projectGUID: string; name: string; url: string }> = {
  example1: { projectGUID: BIM_EXAMPLE1_PROJECT_GUID, name: BIM_EXAMPLE1_NAME, url: BIM_EXAMPLE1_URL },
  example2: { projectGUID: BIM_EXAMPLE2_PROJECT_GUID, name: BIM_EXAMPLE2_NAME, url: BIM_EXAMPLE2_URL },
  example3: { projectGUID: BIM_EXAMPLE3_PROJECT_GUID, name: BIM_EXAMPLE3_NAME, url: BIM_EXAMPLE3_URL },
  example4: { projectGUID: BIM_EXAMPLE4_PROJECT_GUID, name: BIM_EXAMPLE4_NAME, url: BIM_EXAMPLE4_URL },
};

export const projectIsBimBased = (rowJSON: Record<string, any> | undefined | null): boolean => rowJSON?.[PROJECT_IS_BIM_BASED_KEY] === true;
export const projectRowIsBimBased = (project: Pick<PMProjectRow, 'rowJSON'> | undefined | null): boolean => projectIsBimBased(project?.rowJSON);

/** the local database of the device / browser: one file per ORGANIZATION (section 7 of the plan); a switch of the organization opens another file */
export const bimLocalDbName = (organizationGUID: string | null | undefined): string => `kit8bimdb_${String(organizationGUID || 'none').replace(/[^A-Za-z0-9_-]/g, '_')}`;

/** the state of an element in the scene: normal | highlighted (the pressed task) | dimmed (the rest while something is highlighted) */
export const BIM_STATE_NORMAL = 0;
export const BIM_STATE_HIGHLIGHT = 1;
export const BIM_STATE_DIM = 2;

export interface BimModelInfo {
  modelGUID: string;
  revision: number;
  sourceName: string;
  sourceSha256?: string | null;
  ifcSchema?: string | null;
  converterVersion?: string | null;
  unitScale?: number | null;
  /** the IFC coordinates of the scene origin (x, y, z) */
  originShift: number[];
  /** scene space: minx, miny, minz, maxx, maxy, maxz (metres, Y up) */
  bbox: number[];
  counts: { storeys?: number; chunks?: number; elements?: number; tasks?: number; properties?: number };
  created_at?: string;
}

export interface BimStoreyInfo {
  storeyGUID: string;
  ifcGuid: string | null;
  name: string;
  elevation: number | null;
  orderInList: number;
  stageGUID: string | null;
}

export interface BimChunkInfo {
  storeyGUID: string | null;
  contentHash: string;
  part: number;
  byteSize: number;
  formatVersion: number;
  vertexCount: number;
  elementCount: number;
  bboxMin: number[] | null;
  bboxSize: number[] | null;
  storagePath: string;
}

/** bim_model_manifest(project) */
export interface BimManifest {
  model: BimModelInfo;
  storeys: BimStoreyInfo[];
  chunks: BimChunkInfo[];
}

export interface BimElementRow {
  ifcGuid: string;
  ifcClass: string;
  name: string;
  typeName: string;
  storeyGUID: string | null;
  taskGUID: string | null;
  chunkHash: string;
  elementNumber: number;
  /** scene space: minx, miny, minz, maxx, maxy, maxz */
  bbox: number[];
}

/** what an element looks like to the viewer: the key of an element is its IFC GlobalId */
export const BIM_SITE_STAGE_NAME = 'Building / Site';

/** a short text for the facts of a model (the BIM tab of the project settings) */
export function bimModelFacts(m: BimModelInfo): { label: string; value: string }[] {
  const c = m.counts || {};
  const kb = (n?: number) => (n == null ? '-' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  void kb;
  return [
    { label: 'Source file', value: m.sourceName || '-' },
    { label: 'IFC schema', value: m.ifcSchema || '-' },
    { label: 'Unit scale', value: m.unitScale != null ? String(m.unitScale) : '-' },
    { label: 'Converter', value: m.converterVersion || '-' },
    { label: 'Revision', value: String(m.revision) },
    { label: 'Imported', value: m.created_at ? String(m.created_at).slice(0, 16).replace('T', ' ') : '-' },
    { label: 'Storeys', value: String(c.storeys ?? '-') },
    { label: 'Elements', value: String(c.elements ?? '-') },
    { label: 'Tasks', value: String(c.tasks ?? '-') },
    { label: 'Chunks', value: String(c.chunks ?? '-') },
    { label: 'Model hash', value: m.sourceSha256 ? String(m.sourceSha256).slice(0, 12) : '-' },
  ];
}
