import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { viewportPositionToScaled } from "../lib/coordinates";
import { ShapeType, ShapeData, ScaledPosition, ViewportPosition } from "../types";
import "../style/ShapeCanvas.css";

import type { PDFViewer as TPDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

/**
 * The props type for {@link ShapeCanvas}.
 *
 * @category Component Properties
 */
export interface ShapeCanvasProps {
  /**
   * Whether shape mode is active.
   */
  isActive: boolean;

  /**
   * The type of shape to create.
   */
  shapeType: ShapeType;

  /**
   * Stroke color for the shape.
   * @default "#000000"
   */
  strokeColor?: string;

  /**
   * Stroke width for the shape.
   * @default 2
   */
  strokeWidth?: number;

  /**
   * The PDF viewer instance.
   */
  viewer: InstanceType<typeof TPDFViewer>;

  /**
   * Callback when shape creation is complete.
   *
   * @param position - Scaled position of the shape on the page.
   * @param shape - The shape data.
   */
  onComplete: (position: ScaledPosition, shape: ShapeData) => void;

  /**
   * Callback when shape creation is cancelled.
   */
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

/**
 * A transparent overlay for creating shape annotations on PDF pages.
 * Supports mouse and touch input with click-and-drag to define shape bounds.
 *
 * @category Component
 */
export const ShapeCanvas = ({
  isActive,
  shapeType,
  strokeColor = "#000000",
  strokeWidth = 2,
  viewer,
  onComplete,
  onCancel,
}: ShapeCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [pageNumber, setPageNumber] = useState<number | null>(null);
  const [pageRect, setPageRect] = useState<DOMRect | null>(null);
  const isDrawingRef = useRef(false);

  // Find which page the user is drawing on
  const findPageFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!viewer) return null;

      for (let i = 0; i < viewer.pagesCount; i++) {
        const pageView = viewer.getPageView(i);
        if (!pageView?.div) continue;

        const rect = pageView.div.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return {
            pageNumber: i + 1,
            element: pageView.div as HTMLElement,
            rect,
          };
        }
      }
      return null;
    },
    [viewer]
  );

  // Handle mouse/touch down
  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      const pageInfo = findPageFromPoint(clientX, clientY);
      if (!pageInfo) return;

      console.log("ShapeCanvas: Started drawing on page", pageInfo.pageNumber);

      setPageNumber(pageInfo.pageNumber);
      setPageRect(pageInfo.rect);

      isDrawingRef.current = true;
      const pos = {
        x: clientX - pageInfo.rect.left,
        y: clientY - pageInfo.rect.top,
      };
      setStartPoint(pos);
      setCurrentPoint(pos);
    },
    [findPageFromPoint]
  );

  // Handle mouse/touch move
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawingRef.current || !pageRect) return;

      const pos = {
        x: clientX - pageRect.left,
        y: clientY - pageRect.top,
      };
      setCurrentPoint(pos);
    },
    [pageRect]
  );

  // Handle mouse/touch end
  const handleEnd = useCallback(() => {
    if (!isDrawingRef.current || !startPoint || !currentPoint || pageNumber === null || !viewer) {
      isDrawingRef.current = false;
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    isDrawingRef.current = false;

    // Calculate bounding box
    const minX = Math.min(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const maxX = Math.max(startPoint.x, currentPoint.x);
    const maxY = Math.max(startPoint.y, currentPoint.y);

    const width = maxX - minX;
    const height = maxY - minY;

    // Minimum size check
    if (width < 10 || height < 10) {
      console.log("ShapeCanvas: Shape too small, ignoring");
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    console.log("ShapeCanvas: Creating shape", shapeType, "at", { minX, minY, width, height });

    // Create viewport position
    const viewportPosition: ViewportPosition = {
      boundingRect: {
        left: minX,
        top: minY,
        width: width,
        height: height,
        pageNumber: pageNumber,
      },
      rects: [],
    };

    const scaledPosition = viewportPositionToScaled(viewportPosition, viewer);

    // For arrows, calculate start/end points as percentages within the bounding box
    let shapeData: ShapeData = {
      shapeType,
      strokeColor,
      strokeWidth,
    };

    if (shapeType === "arrow") {
      // Calculate start and end points relative to bounding box (0-1 range)
      shapeData.startPoint = {
        x: (startPoint.x - minX) / width,
        y: (startPoint.y - minY) / height,
      };
      shapeData.endPoint = {
        x: (currentPoint.x - minX) / width,
        y: (currentPoint.y - minY) / height,
      };
      console.log("ShapeCanvas: Arrow points", shapeData.startPoint, "->", shapeData.endPoint);
    }

    console.log("ShapeCanvas: Created shape at position", scaledPosition);
    onComplete(scaledPosition, shapeData);

    // Reset state
    setStartPoint(null);
    setCurrentPoint(null);
    setPageNumber(null);
    setPageRect(null);
  }, [startPoint, currentPoint, pageNumber, viewer, shapeType, strokeColor, strokeWidth, onComplete]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch event handlers
  const handleTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleStart]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Handle keyboard events
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        console.log("ShapeCanvas: Cancelled via Escape");
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onCancel]);

  // Render shape preview
  const renderShapePreview = () => {
    if (!startPoint || !currentPoint || !pageRect) return null;

    const minX = Math.min(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    const svgStyle: React.CSSProperties = {
      position: "fixed",
      left: pageRect.left,
      top: pageRect.top,
      width: pageRect.width,
      height: pageRect.height,
      pointerEvents: "none",
      zIndex: 1001,
    };

    return (
      <svg style={svgStyle}>
        {shapeType === "rectangle" && (
          <rect
            x={minX}
            y={minY}
            width={width}
            height={height}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
        {shapeType === "circle" && (
          <ellipse
            cx={minX + width / 2}
            cy={minY + height / 2}
            rx={width / 2}
            ry={height / 2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
        {shapeType === "arrow" && (
          <>
            <defs>
              <marker
                id="shape-canvas-arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
              </marker>
            </defs>
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={currentPoint.x}
              y2={currentPoint.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              markerEnd="url(#shape-canvas-arrowhead)"
            />
          </>
        )}
      </svg>
    );
  };

  if (!isActive) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="ShapeCanvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {renderShapePreview()}
      <div className="ShapeCanvas__controls">
        <div className="ShapeCanvas__hint">
          Click and drag to draw a {shapeType}. Press Escape to cancel.
        </div>
        <button
          type="button"
          className="ShapeCanvas__cancelButton"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </>
  );
};
