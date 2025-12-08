import React, { CSSProperties, MouseEvent, ReactNode } from "react";
import { Rnd } from "react-rnd";
import { getPageFromElement } from "../lib/pdfjs-dom";
import "../style/ImageHighlight.css";
import type { LTWHP, ViewportHighlight } from "../types";

/**
 * The props type for {@link ImageHighlight}.
 *
 * @category Component Properties
 */
export interface ImageHighlightProps {
  /**
   * The highlight to be rendered as an {@link ImageHighlight}.
   * The highlight.content.image should contain the image data URL.
   */
  highlight: ViewportHighlight;

  /**
   * A callback triggered whenever the highlight position or size changes.
   *
   * @param rect - The updated highlight area.
   */
  onChange?(rect: LTWHP): void;

  /**
   * Has the highlight been auto-scrolled into view?
   */
  isScrolledTo?: boolean;

  /**
   * react-rnd bounds on the highlight area.
   */
  bounds?: string | Element;

  /**
   * A callback triggered on context menu.
   */
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void;

  /**
   * Event called when editing begins (drag or resize).
   */
  onEditStart?(): void;

  /**
   * Event called when editing ends.
   */
  onEditEnd?(): void;

  /**
   * Custom styling for the container.
   */
  style?: CSSProperties;

  /**
   * Custom drag icon. Replaces the default 6-dot grid icon.
   */
  dragIcon?: ReactNode;
}

/**
 * Default drag icon - 6 dot grid pattern.
 */
const DefaultDragIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="8" cy="6" r="2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="12" r="2" />
    <circle cx="8" cy="18" r="2" />
    <circle cx="16" cy="18" r="2" />
  </svg>
);

/**
 * Renders a draggable, resizable image/signature annotation.
 *
 * @category Component
 */
export const ImageHighlight = ({
  highlight,
  onChange,
  isScrolledTo,
  bounds,
  onContextMenu,
  onEditStart,
  onEditEnd,
  style,
  dragIcon,
}: ImageHighlightProps) => {
  const highlightClass = isScrolledTo ? "ImageHighlight--scrolledTo" : "";

  // Generate key based on position for Rnd remount on position changes
  const key = `${highlight.position.boundingRect.width}${highlight.position.boundingRect.height}${highlight.position.boundingRect.left}${highlight.position.boundingRect.top}`;

  const imageUrl = highlight.content?.image;

  return (
    <div
      className={`ImageHighlight ${highlightClass}`}
      onContextMenu={onContextMenu}
    >
      <Rnd
        className="ImageHighlight__rnd"
        onDragStop={(_, data) => {
          const boundingRect: LTWHP = {
            ...highlight.position.boundingRect,
            top: data.y,
            left: data.x,
          };
          onChange?.(boundingRect);
          onEditEnd?.();
        }}
        onDragStart={onEditStart}
        onResizeStop={(_e, _direction, ref, _delta, position) => {
          const boundingRect: LTWHP = {
            top: position.y,
            left: position.x,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            pageNumber:
              getPageFromElement(ref)?.number ||
              highlight.position.boundingRect.pageNumber,
          };
          onChange?.(boundingRect);
          onEditEnd?.();
        }}
        onResizeStart={onEditStart}
        default={{
          x: highlight.position.boundingRect.left,
          y: highlight.position.boundingRect.top,
          width: highlight.position.boundingRect.width || 150,
          height: highlight.position.boundingRect.height || 100,
        }}
        minWidth={50}
        minHeight={50}
        key={key}
        bounds={bounds}
        lockAspectRatio={true}
        dragHandleClassName="ImageHighlight__drag-handle"
        onClick={(event: Event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        style={style}
      >
        <div className="ImageHighlight__container">
          <div className="ImageHighlight__toolbar">
            <div className="ImageHighlight__drag-handle" title="Drag to move">
              {dragIcon || <DefaultDragIcon />}
            </div>
          </div>
          <div className="ImageHighlight__content">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Highlight"
                className="ImageHighlight__image"
                draggable={false}
              />
            ) : (
              <div className="ImageHighlight__placeholder">No image</div>
            )}
          </div>
        </div>
      </Rnd>
    </div>
  );
};
