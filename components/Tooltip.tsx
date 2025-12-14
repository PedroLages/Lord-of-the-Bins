import React, { useState, useRef, useEffect, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

/**
 * Get the appropriate portal container.
 * In fullscreen mode, we need to portal to the fullscreen element
 * because document.body is not visible inside the fullscreen context.
 */
function getPortalContainer(): HTMLElement {
  const fullscreenElement =
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement;

  return (fullscreenElement as HTMLElement) || document.body;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 0,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    } else {
      setIsVisible(true);
    }
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.top - tooltipRect.height - 8;
          break;
        case 'bottom':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.bottom + 8;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - 8;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
        case 'right':
          x = triggerRect.right + 8;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
      }

      // Keep tooltip within viewport
      const padding = 10;
      x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
      y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

      setCoords({ x, y });
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) return <>{children}</>;

  // Clone the child element and add event handlers directly
  // This avoids wrapping in a div which would break absolute positioning
  const child = isValidElement(children) ? children : <span>{children}</span>;

  const clonedChild = cloneElement(child as React.ReactElement, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      // Forward ref if the original child had one
      const originalRef = (child as any).ref;
      if (typeof originalRef === 'function') {
        originalRef(node);
      } else if (originalRef && typeof originalRef === 'object') {
        (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip();
      // Call original handler if it exists
      const originalHandler = (child as React.ReactElement).props?.onMouseEnter;
      if (originalHandler) originalHandler(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      const originalHandler = (child as React.ReactElement).props?.onMouseLeave;
      if (originalHandler) originalHandler(e);
    },
  });

  const tooltipElement = isVisible ? (
    <div
      ref={tooltipRef}
      className={`fixed z-[9999] px-3 py-2 text-sm rounded-lg shadow-lg max-w-xs whitespace-pre-wrap pointer-events-none
        bg-gray-900 text-white ${className}`}
      style={{
        left: coords.x,
        top: coords.y,
      }}
    >
      {content}
      {/* Arrow */}
      <div
        className={`absolute w-2 h-2 bg-gray-900 transform rotate-45
          ${position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : ''}
          ${position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : ''}
          ${position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : ''}
          ${position === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2' : ''}
        `}
      />
    </div>
  ) : null;

  return (
    <>
      {clonedChild}
      {tooltipElement && createPortal(tooltipElement, getPortalContainer())}
    </>
  );
}
