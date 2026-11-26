// ReusableList - the ghost pointer (web only, see GhostPointer.web.tsx). Shared types of the two twins.
export interface GhostPointerHandle {
  /** an arrow of the select column moved its row `dy` px up (< 0) / down (> 0): the ghost pointer jumps with it */
  jump: (dy: number) => void;
}
export interface GhostPointerProps {
  /** testID of the list: its arrows are `<testID>-up-<guid>` / `<testID>-down-<guid>` */
  testID: string;
}
