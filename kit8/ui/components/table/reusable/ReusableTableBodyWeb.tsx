// ReusableTable - web body: rows are dragged by the ⠿ handle (@hello-pangea/dnd, as in ListWebCardsComponent),
// right-click opens the row menu. WEB ONLY (DOM elements): loaded by ReusableTable with Platform.OS === 'web'.
import React from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
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
}

export default function ReusableTableBodyWeb({ rows, canDrag, onMove, onRowMenu, renderRow, handleColor, testID }: ReusableTableBodyProps) {
  const onDragEnd = (result: DropResult) => {
    if (!canDrag || !result.destination) return;
    onMove(result.source.index, result.destination.index);
  };
  const handle = (dragHandleProps: any, guid: string) => (
    <div
      {...(dragHandleProps || {})}
      data-testid={`${testID}-drag-${guid}`}
      title={canDrag ? 'Drag to reorder' : 'Clear the search to reorder'}
      style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canDrag ? 'grab' : 'not-allowed', color: handleColor, opacity: canDrag ? 0.7 : 0.25, fontSize: 16, userSelect: 'none', flexShrink: 0 }}
    >
      ⠿
    </div>
  );
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable
        droppableId={`${testID}-rows`}
        renderClone={(provided, _snapshot, rubric) => (
          <div ref={provided.innerRef} {...provided.draggableProps} style={{ ...provided.draggableProps.style, zIndex: 99999, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
            {renderRow(rows[rubric.source.index], rubric.source.index, { dragHandle: handle(provided.dragHandleProps, rows[rubric.source.index].rowGUID), isDragging: true, ghost: true })}
          </div>
        )}
      >
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} data-testid={`${testID}-body`}>
            {rows.map((row, index) => (
              <Draggable key={row.rowGUID} draggableId={row.rowGUID} index={index} isDragDisabled={!canDrag}>
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
