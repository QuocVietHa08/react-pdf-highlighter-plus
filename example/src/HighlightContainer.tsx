import React, { MouseEvent } from "react";
import HighlightPopup from "./HighlightPopup";
import {
  AreaHighlight,
  DrawingHighlight,
  FreetextHighlight,
  ImageHighlight,
  MonitoredHighlightContainer,
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
  onContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>,
  ) => void;
}

const HighlightContainer = ({
  editHighlight,
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
      />
    );
  } else {
    // Area highlight (default)
    component = (
      <AreaHighlight
        isScrolledTo={isScrolledTo}
        highlight={highlight}
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

  // Don't show popup tip for freetext, image, and drawing highlights
  const showTip = highlight.type !== "freetext" && highlight.type !== "image" && highlight.type !== "drawing";

  return (
    <MonitoredHighlightContainer
      highlightTip={showTip ? highlightTip : undefined}
      key={highlight.id}
      children={component}
    />
  );
};

export default HighlightContainer;
