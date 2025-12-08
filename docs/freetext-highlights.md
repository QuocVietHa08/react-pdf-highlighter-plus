# Freetext Highlights (Text Notes)

This document describes the freetext highlight feature, which allows users to create draggable, editable text annotations anywhere on a PDF document.

## Overview

Freetext highlights are a new highlight type (`"freetext"`) that enables users to:
- Click anywhere on a PDF to create a text note
- Edit the text content inline
- Drag notes to reposition them
- Customize styling (color, background, font family, font size)

Unlike text highlights (which annotate selected text) or area highlights (which capture a region), freetext highlights are standalone annotations that can be placed anywhere.

## Quick Start

### 1. Enable Freetext Mode in PdfHighlighter

```tsx
<PdfHighlighter
  // ... other props
  enableFreetextCreation={() => freetextMode}  // Return true when freetext mode is active
  onFreetextClick={handleFreetextClick}        // Handle click to create annotation
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

### 2. Handle Freetext Creation

```tsx
const handleFreetextClick = (position: ScaledPosition) => {
  const newHighlight: Highlight = {
    id: generateId(),
    type: "freetext",
    position,
    content: { text: "New note" },
  };
  setHighlights([newHighlight, ...highlights]);
};
```

### 3. Render FreetextHighlight in Your Container

```tsx
import { FreetextHighlight, useHighlightContainerContext } from "react-pdf-highlighter-extended";

const HighlightContainer = ({ editHighlight }) => {
  const { highlight, viewportToScaled, isScrolledTo } = useHighlightContainerContext();

  if (highlight.type === "freetext") {
    return (
      <FreetextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        onChange={(boundingRect) => {
          editHighlight(highlight.id, {
            position: {
              boundingRect: viewportToScaled(boundingRect),
              rects: [],
            },
          });
        }}
        onTextChange={(newText) => {
          editHighlight(highlight.id, {
            content: { text: newText },
          });
        }}
      />
    );
  }

  // ... handle other highlight types
};
```

## Component API

### FreetextHighlight Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `highlight` | `ViewportHighlight` | Yes | The highlight data to render |
| `onChange` | `(rect: LTWHP) => void` | No | Called when position changes (drag) |
| `onTextChange` | `(text: string) => void` | No | Called when text content changes |
| `isScrolledTo` | `boolean` | No | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | No | Bounds for dragging (react-rnd) |
| `onContextMenu` | `(event: MouseEvent) => void` | No | Right-click handler |
| `onEditStart` | `() => void` | No | Called when editing begins |
| `onEditEnd` | `() => void` | No | Called when editing ends |
| `style` | `CSSProperties` | No | Custom container styling |
| `color` | `string` | No | Text color |
| `backgroundColor` | `string` | No | Background color |
| `fontFamily` | `string` | No | Font family |
| `fontSize` | `string` | No | Font size (e.g., "14px") |

### PdfHighlighter Props (Freetext-related)

| Prop | Type | Description |
|------|------|-------------|
| `enableFreetextCreation` | `(event: MouseEvent) => boolean` | Returns true when freetext mode is active |
| `onFreetextClick` | `(position: ScaledPosition) => void` | Called when user clicks to create annotation |

## Styling

### Default Styling

The component comes with default sticky-note styling. Override via CSS classes:

```css
.FreetextHighlight { }                    /* Container */
.FreetextHighlight__container { }         /* Inner wrapper */
.FreetextHighlight__drag-handle { }       /* Drag handle */
.FreetextHighlight__text { }              /* Text display */
.FreetextHighlight__input { }             /* Text input (edit mode) */
.FreetextHighlight--scrolledTo { }        /* When auto-scrolled to */
.FreetextHighlight--editing { }           /* When in edit mode */
```

### Custom Styling via Props

Pass styling props directly to the component:

```tsx
<FreetextHighlight
  highlight={highlight}
  color="#333333"
  backgroundColor="#ffffc8"
  fontFamily="Arial, sans-serif"
  fontSize="16px"
/>
```

### Per-Highlight Styling

Store style preferences with each highlight:

```tsx
interface MyHighlight extends Highlight {
  freetextStyle?: {
    color?: string;
    backgroundColor?: string;
    fontFamily?: string;
    fontSize?: string;
  };
}

// In your container:
<FreetextHighlight
  highlight={highlight}
  color={highlight.freetextStyle?.color}
  backgroundColor={highlight.freetextStyle?.backgroundColor}
  fontFamily={highlight.freetextStyle?.fontFamily}
  fontSize={highlight.freetextStyle?.fontSize}
/>
```

## Complete Example

Here's a complete implementation with a style panel:

```tsx
import React, { useState, useRef } from "react";
import {
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  FreetextHighlight,
  TextHighlight,
  AreaHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
  ScaledPosition,
  Highlight,
} from "react-pdf-highlighter-extended";

// Style configuration
interface FreetextStyle {
  color: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: string;
}

interface MyHighlight extends Highlight {
  comment?: string;
  freetextStyle?: FreetextStyle;
}

const App = () => {
  const [highlights, setHighlights] = useState<MyHighlight[]>([]);
  const [freetextMode, setFreetextMode] = useState(false);
  const [freetextStyle, setFreetextStyle] = useState<FreetextStyle>({
    color: "#333333",
    backgroundColor: "#ffffc8",
    fontFamily: "inherit",
    fontSize: "14px",
  });
  const highlighterUtilsRef = useRef<PdfHighlighterUtils>();

  const handleFreetextClick = (position: ScaledPosition) => {
    const newHighlight: MyHighlight = {
      id: String(Math.random()).slice(2),
      type: "freetext",
      position,
      content: { text: "New note" },
      freetextStyle: { ...freetextStyle },
    };
    setHighlights([newHighlight, ...highlights]);
  };

  const editHighlight = (id: string, edit: Partial<MyHighlight>) => {
    setHighlights(
      highlights.map((h) => (h.id === id ? { ...h, ...edit } : h))
    );
  };

  return (
    <div>
      <button onClick={() => setFreetextMode(!freetextMode)}>
        {freetextMode ? "Exit Note Mode" : "Add Text Note"}
      </button>

      <PdfLoader document="https://example.com/document.pdf">
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            highlights={highlights}
            utilsRef={(utils) => (highlighterUtilsRef.current = utils)}
            enableFreetextCreation={() => freetextMode}
            onFreetextClick={handleFreetextClick}
          >
            <HighlightContainer
              editHighlight={editHighlight}
              freetextStyle={freetextStyle}
            />
          </PdfHighlighter>
        )}
      </PdfLoader>
    </div>
  );
};

// Highlight Container Component
const HighlightContainer = ({
  editHighlight,
  freetextStyle,
}: {
  editHighlight: (id: string, edit: Partial<MyHighlight>) => void;
  freetextStyle: FreetextStyle;
}) => {
  const {
    highlight,
    viewportToScaled,
    screenshot,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext<MyHighlight>();

  const { toggleEditInProgress } = usePdfHighlighterContext();

  if (highlight.type === "freetext") {
    return (
      <FreetextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
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
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
        color={highlight.freetextStyle?.color ?? freetextStyle.color}
        backgroundColor={highlight.freetextStyle?.backgroundColor ?? freetextStyle.backgroundColor}
        fontFamily={highlight.freetextStyle?.fontFamily ?? freetextStyle.fontFamily}
        fontSize={highlight.freetextStyle?.fontSize ?? freetextStyle.fontSize}
      />
    );
  }

  if (highlight.type === "text") {
    return <TextHighlight highlight={highlight} isScrolledTo={isScrolledTo} />;
  }

  // Area highlight
  return (
    <AreaHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      onChange={(boundingRect) => {
        editHighlight(highlight.id, {
          position: {
            boundingRect: viewportToScaled(boundingRect),
            rects: [],
          },
          content: { image: screenshot(boundingRect) },
        });
        toggleEditInProgress(false);
      }}
      bounds={highlightBindings.textLayer}
      onEditStart={() => toggleEditInProgress(true)}
    />
  );
};

export default App;
```

## User Interaction

### Creating a Note
1. Enable freetext mode (via button/toggle)
2. Click anywhere on the PDF
3. A new note appears at the click position

### Editing Text
1. Click on the note text
2. Edit in the textarea
3. Press Enter to save, Escape to cancel
4. Click outside to save

### Moving a Note
1. Grab the drag handle (left side with dots)
2. Drag to new position
3. Release to save new position

## Data Structure

Freetext highlights use the standard `Highlight` interface with `type: "freetext"`:

```typescript
interface Highlight {
  id: string;
  type: "freetext";
  position: ScaledPosition;
  content?: {
    text?: string;  // The note text
  };
}
```

The position stores normalized coordinates, making highlights portable across different viewport sizes.
