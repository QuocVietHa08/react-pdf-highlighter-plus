import React, { MouseEvent } from "react";
import HighlightPopup from "./HighlightPopup";
import {
  AreaHighlight,
  DrawingHighlight,
  FreetextHighlight,
  ImageHighlight,
  MonitoredHighlightContainer,
  ShapeHighlight,
  TextHighlight,
  Tip,
  ViewportHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
} from "./react-pdf-highlighter-extended";
import { CommentedHighlight } from "./types";

interface HighlightContainerProps {
  editHighlight: (
    idToUpdate: string,
    edit: Partial<CommentedHighlight>,
  ) => void;
  deleteHighlight: (highlightId: string) => void;
  onContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>,
  ) => void;
}

const HighlightContainer = ({
  editHighlight,
  deleteHighlight,
  onContextMenu,
}: HighlightContainerProps) => {
  const {
    highlight,
    viewportToScaled,
    screenshot,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext<CommentedHighlight>();

  const { toggleEditInProgress } = usePdfHighlighterContext();

  let component;

  if (highlight.type === "text") {
    component = (
      <TextHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}
        highlightColor={highlight.highlightColor}
        highlightStyle={highlight.highlightStyle}
        onStyleChange={(style) => {
          editHighlight(highlight.id, style);
        }}
        onDelete={() => deleteHighlight(highlight.id)}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
      />
    );
  } else if (highlight.type === "freetext") {
    component = (
      <FreetextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        color={highlight.color}
        backgroundColor={highlight.backgroundColor}
        fontSize={highlight.fontSize}
        fontFamily={highlight.fontFamily}
        onChange={(boundingRect) => {
          editHighlight(highlight.id, {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
          });
          toggleEditInProgress(false);
        }}
        onTextChange={(newText) => {
          editHighlight(highlight.id, {
            content: { text: newText },
          });
        }}
        onStyleChange={(style) => {
          editHighlight(highlight.id, style);
        }}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
        onDelete={() => deleteHighlight(highlight.id)}
      />
    );
  } else if (highlight.type === "image") {
    component = (
      <ImageHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        onChange={(boundingRect) => {
          editHighlight(highlight.id, {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
          });
        }}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
        onDelete={() => deleteHighlight(highlight.id)}
      />
    );
  } else if (highlight.type === "drawing") {
    component = (
      <DrawingHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        onChange={(boundingRect) => {
          editHighlight(highlight.id, {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
          });
        }}
        onStyleChange={(newImage, newStrokes) => {
          console.log("Drawing style changed, updating highlight");
          editHighlight(highlight.id, {
            content: {
              image: newImage,
              strokes: newStrokes,
            },
          });
        }}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
        onDelete={() => deleteHighlight(highlight.id)}
      />
    );
  } else if (highlight.type === "shape") {
    component = (
      <ShapeHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        bounds={highlightBindings.textLayer}
        shapeType={highlight.shapeType || highlight.content?.shape?.shapeType || "rectangle"}
        strokeColor={highlight.strokeColor || highlight.content?.shape?.strokeColor || "#000000"}
        strokeWidth={highlight.strokeWidth || highlight.content?.shape?.strokeWidth || 2}
        startPoint={highlight.content?.shape?.startPoint}
        endPoint={highlight.content?.shape?.endPoint}
        onChange={(boundingRect) => {
          editHighlight(highlight.id, {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
          });
        }}
        onStyleChange={(style) => {
          console.log("Shape style changed:", style);
          editHighlight(highlight.id, {
            strokeColor: style.strokeColor,
            strokeWidth: style.strokeWidth,
            content: {
              ...highlight.content,
              shape: {
                ...highlight.content?.shape,
                shapeType: highlight.shapeType || highlight.content?.shape?.shapeType || "rectangle",
                strokeColor: style.strokeColor || highlight.strokeColor || "#000000",
                strokeWidth: style.strokeWidth || highlight.strokeWidth || 2,
              },
            },
          });
        }}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
        onDelete={() => deleteHighlight(highlight.id)}
      />
    );
  } else {
    // Area highlight (default)
    component = (
      <AreaHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}
        highlightColor={highlight.highlightColor}
        onStyleChange={(style) => {
          editHighlight(highlight.id, style);
        }}
        onDelete={() => deleteHighlight(highlight.id)}
        onChange={(boundingRect) => {
          const edit = {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
            content: {
              image: screenshot(boundingRect),
            },
          };

          editHighlight(highlight.id, edit);
          toggleEditInProgress(false);
        }}
        bounds={highlightBindings.textLayer}
        onContextMenu={(event) =>
          onContextMenu && onContextMenu(event, highlight)
        }
        onEditStart={() => toggleEditInProgress(true)}
      />
    );
  }

  const highlightTip: Tip = {
    position: highlight.position,
    content: <HighlightPopup highlight={highlight} />,
  };

  // Don't show popup tip for freetext, image, drawing, and shape highlights
  const showTip = highlight.type !== "freetext" && highlight.type !== "image" && highlight.type !== "drawing" && highlight.type !== "shape";

  return (
    <MonitoredHighlightContainer
      highlightTip={showTip ? highlightTip : undefined}
      key={highlight.id}
      children={component}
    />
  );
};

export default HighlightContainer;
