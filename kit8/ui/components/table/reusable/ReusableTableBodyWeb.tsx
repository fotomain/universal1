// ReusableTable - web body: rows are dragged by the ⠿ handle (@hello-pangea/dnd, as in ListWebCardsComponent),
// right-click opens the row menu. WEB ONLY (DOM elements): loaded by ReusableTable with Platform.OS === 'web'.
import React, { useEffect, useRef } from 'react';
import { DragDropContext, Draggable, Droppable, DragStart, DropResult } from '@hello-pangea/dnd';
import { beginFolderDrag, cancelFolderDrag, endFolderDrag, FolderDragPayload, moveFolderDrag } from '../../tree/folderTreeDnd';
import type { ReusableTableRow } from './reusableTableTypes';

export interface ReusableTableBodyProps {
  rows: ReusableTableRow[];
  /** drag & drop allowed (reorderEnabled and no search filter) */
  canDrag: boolean;
  onMove: (from: number, to: number) => void;
  onRowMenu?: (guid: string, x: number, y: number) => void;
  /** dragHandle = props of the ⠿ element (null: no handle); ghost = the row is the drag clone */
  renderRow: (row: ReusableTableRow, index: number, opts: { dragHandle: React.ReactNode; isDragging: boolean; ghost: boolean }) => React.ReactNode;
  handleColor: string;
  testID: string;
  /**
   * folders tree beside the table: the same ⠿ drag also feeds the folder-tree drag session (folderTreeDnd), so a row can
   * be dropped ON a folder. getPayload = what is dragged (the row, or all selected rows). When the tree takes the drop,
   * the row is not reordered.
   */
  folderDrag?: { getPayload: (row: ReusableTableRow) => FolderDragPayload | null };
}

export default function ReusableTableBodyWeb({ rows, canDrag, onMove, onRowMenu, renderRow, handleColor, testID, folderDrag }: ReusableTableBodyProps) {
  const folderDragOn = !!folderDrag;
  const dragEnabled = canDrag || folderDragOn;
  // the pointer position (@hello-pangea/dnd does not report it): tracked all the time while a tree is beside the table
  const pointer = useRef({ x: 0, y: 0 });
  const folderActive = useRef(false);
  useEffect(() => {
    if (!folderDragOn) return;
    const mv = (e: MouseEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; if (folderActive.current) moveFolderDrag(e.clientX, e.clientY); };
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (!t) return; pointer.current = { x: t.clientX, y: t.clientY }; if (folderActive.current) moveFolderDrag(t.clientX, t.clientY); };
    window.addEventListener('mousemove', mv, true);
    window.addEventListener('touchmove', tm, { capture: true, passive: true });
    return () => { window.removeEventListener('mousemove', mv, true); window.removeEventListener('touchmove', tm, true); };
  }, [folderDragOn]);

  const onDragStart = (start: DragStart) => {
    if (!folderDrag) return;
    const payload = folderDrag.getPayload(rows[start.source.index]);
    if (!payload) return;
    folderActive.current = true;
    // the web table draws the dragged row itself (renderClone)
    beginFolderDrag({ ...payload, ownGhost: true }, pointer.current.x, pointer.current.y);
  };
  const onDragEnd = (result: DropResult) => {
    let taken = false;
    if (folderActive.current) {
      folderActive.current = false;
      if (result.reason === 'CANCEL') cancelFolderDrag(); else taken = endFolderDrag();
    }
    // dropped on a folder: the row is moved there, not reordered
    if (taken || !canDrag || !result.destination) return;
    onMove(result.source.index, result.destination.index);
  };
  const handle = (dragHandleProps: any, guid: string) => (
    <div
      {...(dragHandleProps || {})}
      data-testid={`${testID}-drag-${guid}`}
      title={canDrag ? (folderDragOn ? 'Drag to reorder, or onto a folder' : 'Drag to reorder') : folderDragOn ? 'Drag onto a folder' : 'Clear the search to reorder'}
      style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: dragEnabled ? 'grab' : 'not-allowed', color: handleColor, opacity: dragEnabled ? 0.7 : 0.25, fontSize: 16, userSelect: 'none', flexShrink: 0 }}
    >
      ⠿
    </div>
  );
  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Droppable
        droppableId={`${testID}-rows`}
        // reordering is off (a search / folder filter is active) but the rows may still be dragged onto a folder
        isDropDisabled={!canDrag}
        renderClone={(provided, _snapshot, rubric) => (
          <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, zIndex: 99999, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
            {renderRow(rows[rubric.source.index], rubric.source.index, { dragHandle: handle(provided.dragHandleProps, rows[rubric.source.index].rowGUID), isDragging: true, ghost: true })}
          </div>
        )}
      >
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} data-testid={`${testID}-body`}>
            {rows.map((row, index) => (
              <Draggable key={row.rowGUID} draggableId={row.rowGUID} index={index} isDragDisabled={!dragEnabled}>
                {(p, snapshot) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    id={`${testID}-row-${row.rowGUID}`}
                    onContextMenu={onRowMenu ? (e) => { e.preventDefault(); onRowMenu(row.rowGUID, e.clientX, e.clientY); } : undefined}
                    style={p.draggableProps.style}
                  >
                    {renderRow(row, index, { dragHandle: handle(p.dragHandleProps, row.rowGUID), isDragging: snapshot.isDragging, ghost: false })}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
