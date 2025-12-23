import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableCellProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  data?: any; // Data to pass to drag handler
}

/**
 * DraggableCell - Mobile-friendly drag and drop wrapper using dnd-kit
 * Wraps schedule cells to enable touch-based drag and drop
 */
export const DraggableCell: React.FC<DraggableCellProps> = ({
  id,
  children,
  disabled = false,
  className = '',
  onDragStart,
  onDragEnd,
  data,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
    data,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  React.useEffect(() => {
    if (isDragging && onDragStart) {
      onDragStart();
    } else if (!isDragging && onDragEnd) {
      onDragEnd();
    }
  }, [isDragging, onDragStart, onDragEnd]);

  return (
    <div
      ref={setDraggableRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};

interface DroppableCellProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  data?: any; // Data to pass to drop handler
}

/**
 * DroppableCell - Drop target wrapper using dnd-kit
 * Marks schedule cells as valid drop targets
 */
export const DroppableCell: React.FC<DroppableCellProps> = ({
  id,
  children,
  disabled = false,
  className = '',
  data,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
};

export default DraggableCell;
