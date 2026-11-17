// The content of an info modal (PM80InfoModal) as plain data: heading, sections, blocks.
export type InfoBlock =
  | { type: 'p'; text: string; bold?: boolean }
  | { type: 'kv'; label: string; text: string }
  | { type: 'formula'; text: string }
  | { type: 'bullets'; items: string[] }
  /** the worked example: a caption line and label / value rows; the LAST row is the result (bold, separated) */
  | { type: 'numbers'; caption: string; rows: Array<[string, string]> };

export interface InfoSection {
  title: string;
  blocks: InfoBlock[];
}

export interface InfoContent {
  heading: string;
  subheading: string;
  sections: InfoSection[];
  footnote?: string;
}

