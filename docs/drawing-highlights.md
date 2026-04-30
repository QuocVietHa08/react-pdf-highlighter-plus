# Drawing Highlights (Freehand Annotations)

Draw freehand annotations directly on PDF documents using mouse or touch input.

---

## Overview

Drawing highlights (`type: "drawing"`) enable users to:
- Draw freehand lines and shapes on PDF pages
- Customize stroke color and width
- Drag drawings to reposition them
- Resize while maintaining aspect ratio

Drawings are stored as PNG images, making them compatible with PDF export.

Drawing geometry renders in `.PdfHighlighter__highlight-layer`. The floating toolbar and style controls render in `.PdfHighlighter__config-layer`, so controls stay above PDF content without changing drawing placement.

---

## Quick Start

### 1. Enable Drawing Mode

```tsx
<PdfHighlighter
  enableDrawingMode={drawingMode}
  onDrawingComplete={handleDrawingComplete}
  drawingStrokeColor="#ff0000"
  drawingStrokeWidth={2}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

### 2. Handle Drawing Completion

```tsx
const [drawingMode, setDrawingMode] = useState(false);

const handleDrawingComplete = (
  dataUrl: string,
  position: ScaledPosition,
  strokes: DrawingStroke[],
) => {
  const newHighlight: Highlight = {
    id: generateId(),
    type: "drawing",
    position,
    content: { image: dataUrl, strokes },
  };
  setHighlights([newHighlight, ...highlights]);
  setDrawingMode(false);
};
```

### 3. Render DrawingHighlight in Your Container

```tsx
import { DrawingHighlight, useHighlightContainerContext } from "react-pdf-highlighter-plus";

const HighlightContainer = ({ editHighlight }) => {
  const { highlight, viewportToScaled, isScrolledTo, highlightBindings } = useHighlightContainerContext();
  const { toggleEditInProgress } = usePdfHighlighterContext();

  if (highlight.type === "drawing") {
    return (
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
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
      />
    );
  }

  // ... handle other highlight types
};
```

---

## Component API

### PdfHighlighter Props (Drawing-related)

| Prop | Type | Description |
|------|------|-------------|
| `enableDrawingMode` | `boolean` | Whether drawing mode is active |
| `onDrawingComplete` | `(dataUrl: string, position: ScaledPosition, strokes: DrawingStroke[]) => void` | Called when user finishes drawing |
| `drawingStrokeColor` | `string` | Stroke color |
| `drawingStrokeWidth` | `number` | Stroke width |

### DrawingHighlight Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `highlight` | `ViewportHighlight` | Yes | The highlight data (must have `content.image`) |
| `onChange` | `(rect: LTWHP) => void` | No | Called when position/size changes |
| `isScrolledTo` | `boolean` | No | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | No | Bounds for dragging (react-rnd) |
| `onContextMenu` | `(event: MouseEvent) => void` | No | Right-click handler |
| `onEditStart` | `() => void` | No | Called when drag/resize begins |
| `onEditEnd` | `() => void` | No | Called when drag/resize ends |
| `style` | `CSSProperties` | No | Custom container styling |
| `dragIcon` | `ReactNode` | No | Custom drag handle icon |

---

## Styling

### CSS Classes

```css
.DrawingHighlight { }                    /* Container */
.DrawingHighlight__container { }         /* Inner wrapper */
.DrawingHighlight__toolbar { }           /* Toolbar (hidden by default, shows on hover) */
.DrawingHighlight__drag-handle { }       /* Drag handle icon */
.DrawingHighlight__content { }           /* Drawing container */
.DrawingHighlight__image { }             /* The drawing image */
.DrawingHighlight--scrolledTo { }        /* When auto-scrolled to */
```

### Default Behavior

- **Toolbar appears on hover**: The drag handle is hidden until you hover over the drawing
- **Aspect ratio locked**: Resizing maintains the original proportions
- **Minimum size**: 50x50 pixels
- **Transparent background**: Drawings have transparent backgrounds for clean overlay

---

## Complete Example

```tsx
import React, { useState, useRef } from "react";
import {
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  DrawingHighlight,
  TextHighlight,
  AreaHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
  ScaledPosition,
  Highlight,
} from "react-pdf-highlighter-plus";

const App = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [drawingMode, setDrawingMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#ff0000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const highlighterUtilsRef = useRef<PdfHighlighterUtils>();

  const handleDrawingComplete = (
    dataUrl: string,
    position: ScaledPosition,
    strokes: DrawingStroke[],
  ) => {
    const newHighlight: Highlight = {
      id: String(Math.random()).slice(2),
      type: "drawing",
      position,
      content: { image: dataUrl, strokes },
    };
    setHighlights([newHighlight, ...highlights]);
    setDrawingMode(false);
  };

  const editHighlight = (id: string, edit: Partial<Highlight>) => {
    setHighlights(
      highlights.map((h) => (h.id === id ? { ...h, ...edit } : h))
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <button
          onClick={() => setDrawingMode(!drawingMode)}
          className={drawingMode ? "active" : ""}
        >
          {drawingMode ? "Exit Drawing" : "Draw"}
        </button>

        {drawingMode && (
          <>
            <label>
              Color:
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
              />
            </label>
            <label>
              Width:
              <select
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
              >
                <option value={1}>Thin (1px)</option>
                <option value={2}>Normal (2px)</option>
                <option value={4}>Thick (4px)</option>
                <option value={8}>Extra Thick (8px)</option>
              </select>
            </label>
          </>
        )}
      </div>

      <PdfLoader document="https://example.com/document.pdf">
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            highlights={highlights}
            utilsRef={(utils) => (highlighterUtilsRef.current = utils)}
            enableDrawingMode={drawingMode}
            onDrawingComplete={handleDrawingComplete}
            drawingStrokeColor={strokeColor}
            drawingStrokeWidth={strokeWidth}
          >
            <HighlightContainer editHighlight={editHighlight} />
          </PdfHighlighter>
        )}
      </PdfLoader>
    </div>
  );
};

// Highlight Container Component
const HighlightContainer = ({
  editHighlight,
}: {
  editHighlight: (id: string, edit: Partial<Highlight>) => void;
}) => {
  const {
    highlight,
    viewportToScaled,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext();

  const { toggleEditInProgress } = usePdfHighlighterContext();

  if (highlight.type === "drawing") {
    return (
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
        onEditStart={() => toggleEditInProgress(true)}
        onEditEnd={() => toggleEditInProgress(false)}
      />
    );
  }

  if (highlight.type === "text") {
    return <TextHighlight highlight={highlight} isScrolledTo={isScrolledTo} />;
  }

  // Area highlight (default)
  return (
    <AreaHighlight
      highlight={highlight}
      isScrolledTo={isScrolledTo}
      bounds={highlightBindings.textLayer}
    />
  );
};

export default App;
```

---

## User Interaction

### Creating a Drawing

1. Click the "Draw" button to enter drawing mode
2. Optionally adjust stroke color and width
3. Click and drag on the PDF to draw
4. Release to complete the drawing
5. Drawing is saved and exits drawing mode

### Moving a Drawing

1. Hover over the drawing to reveal the drag handle
2. Click and drag the handle icon (6-dot grid)
3. Release to save new position

### Resizing a Drawing

1. Hover over the drawing corners/edges
2. Drag to resize (aspect ratio is maintained)
3. Release to save new size

---

## Data Structure

Drawing highlights use the standard `Highlight` interface with `type: "drawing"`:

```typescript
interface Highlight {
  id: string;
  type: "drawing";
  position: ScaledPosition;
  content?: {
    image?: string;  // Base64 PNG data URL
  };
}
```

The `content.image` field contains a base64-encoded PNG data URL of the drawing with transparent background.

---

## PDF Export

Drawings are fully supported in PDF export. They are embedded as PNG images at their exact position and size on the page.

```tsx
import { exportPdf } from "react-pdf-highlighter-plus";

const pdfBytes = await exportPdf(pdfUrl, highlights);
// Drawings are automatically included
```

---

## Tips

### Stroke Settings

- **Thin strokes (1-2px)**: Good for writing and fine details
- **Medium strokes (3-4px)**: Good for underlining and circling
- **Thick strokes (6-8px)**: Good for emphasis and highlighting

### Best Practices

1. Use distinct colors for different annotation purposes
2. Keep drawings simple for better readability
3. Use smaller stroke widths for detailed annotations
4. Drawings with transparent backgrounds overlay cleanly on PDF content
