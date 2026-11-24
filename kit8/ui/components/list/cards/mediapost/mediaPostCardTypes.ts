// The props of a card of the Media Posts list (ReusableCardMediaPost, MediaPostCardDefault).
import type { MediaPostRow } from '../../../media/common/mediaPostList';
import type { ReusableTableRow } from '../../../table/reusable/reusableTableTypes';
import type { ReusableCardProps } from '../reusableCardTypes';

export interface MediaPostCardProps extends ReusableCardProps {
  /** the row read as a media post (MediaPostsNativeList makes it once per row); a card used alone may leave it out */
  post?: MediaPostRow;
  /** the project the post belongs to: its name is shown on the card */
  project?: { name: string; readonly: boolean };
  /** Play: the host opens the player */
  onPlay: (post: MediaPostRow) => void;
  /** a double click / double touch on the card of a person's ID card / passport: the host opens PersonDocumentDetailsCard (read only) */
  onOpenDetails?: (row: ReusableTableRow) => void;
}
