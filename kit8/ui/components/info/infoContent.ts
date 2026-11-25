// The content of an InfoModal as plain data: heading, sections, blocks (paragraph, key / value, formula, bullets, a worked example). Plain data = the texts can be tested without any screen.
export type InfoBlock =
  | { type: 'p'; text: string; bold?: boolean }
  | { type: 'kv'; label: string; text: string }
  | { type: 'formula'; text: string }
  | { type: 'bullets'; items: string[] }
  /** the worked example: a caption line and label / value rows; the LAST row is the result (bold, separated) */
  | { type: 'numbers'; caption: string; rows: Array<[string, string]> };

export interface InfoSection { title: string; blocks: InfoBlock[] }

export interface InfoContent {
  heading: string;
  subheading: string;
  sections: InfoSection[];
  footnote?: string;
}
