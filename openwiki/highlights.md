# Highlights & Annotations

This guide covers each annotation type, styling options, and configuration patterns.

## Overview

The library supports 8 annotation types:
1. **Text Highlights** — Colored overlays on selected text
2. **Area Highlights** — Rectangular regions
3. **Freetext Notes** — Draggable sticky notes
4. **Drawing Highlights** — Freehand pen strokes
5. **Shape Highlights** — Rectangles, circles, arrows
6. **Signature Pads** — Handwritten signatures
7. **Image Highlights** — Uploaded or base64 images
8. **Left Panel** — Document outline and thumbnails

---

## Text Highlights

Select and highlight passages of text. Supports multiple line wrapping, custom colors, and underline/strikethrough styles.

### Basic Usage

```tsx
import { TextHighlight } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight, isScrolledTo } = useHighlightContainerContext();

  if (highlight.type === "text") {
    return <TextHighlight isScrolledTo={isScrolledTo} />;
  }
}
```

### Props

```typescript
interface TextHighlightProps {
  isScrolledTo?: boolean;           // Highlight scroll target
  onClick?: (e: React.MouseEvent) => void;
  style?: TextHighlightStyle;
}

interface TextHighlightStyle {
  backgroundColor?: string;         // Overlay color, e.g. "rgba(255, 226, 143, 0.5)"
  textColor?: string;               // Text color override
  borderRadius?: string;            // Rounded corners
  cursor?: string;                  // Mouse cursor style
}
```

### Styling

CSS custom properties (use in `:root` or component style):

```css
--highlight-text-bg: rgba(255, 226, 143, 0.5);
--highlight-text-hover-bg: rgba(255, 226, 143, 0.8);
--highlight-text-scrolledto-bg: rgba(255, 226, 143, 0.8);
--highlight-text-border-radius: 3px;
--highlight-text-cursor: pointer;
```

### Creating Text Highlights

In your `HighlightContainer`, use the `onSelectionFinished` callback:

```tsx
<PdfHighlighter
  onSelectionFinished={(position, content, hideTipAndSelection) => {
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      position,
      type: "text",
      content: { text: content.text },
    };
    setHighlights([...highlights, highlight]);
    hideTipAndSelection();
  }}
>
  <HighlightContainer />
</PdfHighlighter>
```

### Highlight Styles

Render with custom text styles (highlight, underline, strikethrough):

```tsx
<TextHighlight
  style={{
    backgroundColor: "rgba(255, 0, 0, 0.3)",
  }}
/>
```

The component supports a `highlightStyle` property in the highlight object (see [Highlights & Annotations](./highlights.md#highlight-types)):

```typescript
{
  id: "h1",
  position: { ... },
  type: "text",
  content: { text: "..." },
  highlightStyle?: "highlight" | "underline" | "strikethrough";
}
```

---

## Area Highlights

Rectangular regions for marking regions of the PDF that don't fit text selection (diagrams, scanned documents, etc.).

### Basic Usage

```tsx
import { AreaHighlight } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight } = useHighlightContainerContext();

  if (highlight.type === "area") {
    return <AreaHighlight />;
  }
}
```

### Props

```typescript
interface AreaHighlightProps {
  isScrolledTo?: boolean;
  onSelectionFinished?: (newPosition: ScaledPosition) => void;  // Drag/resize callback
  style?: AreaHighlightStyle;
}

interface AreaHighlightStyle {
  backgroundColor?: string;   // Fill color, e.g. "rgba(0, 0, 255, 0.1)"
  borderColor?: string;       // Outline color
  borderWidth?: string;       // Outline width
  borderRadius?: string;      // Rounded corners
}
```

### Styling

```css
--highlight-area-bg: rgba(0, 0, 255, 0.1);
--highlight-area-border: 2px solid #0066cc;
--highlight-area-border-radius: 3px;
```

### Creating Area Highlights

Enable area selection with Alt+drag or a custom condition:

```tsx
<PdfHighlighter
  enableAreaSelection={(event) => event.altKey}  // Alt key enables area selection
  onSelectionFinished={(position, content, hideTipAndSelection) => {
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      position,
      type: "area",
      content: { text: content.text },  // Text intersected by area
    };
    setHighlights([...highlights, highlight]);
    hideTipAndSelection();
  }}
>
  <HighlightContainer />
</PdfHighlighter>
```

### Editing (Drag/Resize)

Area highlights are draggable and resizable via `react-rnd`. To handle position updates:

```tsx
<AreaHighlight
  onSelectionFinished={(newPosition) => {
    // Update highlight position in state
    setHighlights(
      highlights.map((h) =>
        h.id === highlight.id ? { ...h, position: newPosition } : h
      )
    );
  }}
/>
```

Remember to call `toggleEditInProgress()` while dragging to prevent conflicting selections.

---

## Freetext Notes

Sticky notes with custom text, colors, and styling.

### Basic Usage

```tsx
import { FreetextHighlight } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight } = useHighlightContainerContext();

  if (highlight.type === "freetext") {
    return <FreetextHighlight />;
  }
}
```

### Props

```typescript
interface FreetextHighlightProps {
  isScrolledTo?: boolean;
  onUpdate?: (content: FreetextContent) => void;  // Edit callback
  style?: FreetextStyle;
  compact?: boolean;                              // Compact display
}

interface FreetextStyle {
  color?: string;              // Text color
  backgroundColor?: string;    // Note background
  fontSize?: string;           // Font size
  fontFamily?: string;         // Font family
  borderColor?: string;        // Border color
  borderRadius?: string;       // Rounded corners
}
```

### Styling

```css
--highlight-freetext-bg: #ffffc8;
--highlight-freetext-color: #333;
--highlight-freetext-font-size: 14px;
--highlight-freetext-border-color: #ddd;
--highlight-freetext-hover-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
```

### Creating Freetext Notes

Typically created via a button or context menu, not direct selection:

```tsx
function addFreetextNote() {
  const highlight: Highlight = {
    id: crypto.randomUUID(),
    position: {
      boundingRect: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.2, width: 0.2, height: 0.1, pageNumber: 1 },
      rects: [],
    },
    type: "freetext",
    content: {
      text: "New note",
      color: "#333",
      backgroundColor: "#ffffc8",
      fontSize: "14px",
    },
  };
  setHighlights([...highlights, highlight]);
}
```

### Editing

FreetextHighlight supports inline editing. Use `onUpdate` to sync changes:

```tsx
<FreetextHighlight
  onUpdate={(content) => {
    setHighlights(
      highlights.map((h) =>
        h.id === highlight.id ? { ...h, content } : h
      )
    );
  }}
/>
```

---

## Drawing Highlights

Freehand pen strokes with customizable color and width.

### Basic Usage

```tsx
import { DrawingHighlight } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight } = useHighlightContainerContext();

  if (highlight.type === "drawing") {
    return <DrawingHighlight />;
  }
}
```

### Props

```typescript
interface DrawingHighlightProps {
  isScrolledTo?: boolean;
  strokeColor?: string;   // Pen color, default from context or light/dark mode
  strokeWidth?: number;   // Pen width, default 2
  readOnly?: boolean;     // Disable editing
}
```

### Data Model

```typescript
interface DrawingStroke {
  points: DrawingPoint[];  // Array of { x, y } (viewport coords)
  color: string;
  width: number;
}

interface DrawingHighlight extends Highlight {
  type: "drawing";
  content: {
    strokes: DrawingStroke[];
  };
}
```

### Creating Drawing Highlights

Use the `DrawingCanvas` component for interactive drawing:

```tsx
import { DrawingCanvas } from "react-pdf-highlighter-plus";

<DrawingCanvas
  onDrawingFinished={(strokes, position) => {
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      position,
      type: "drawing",
      content: { strokes },
    };
    setHighlights([...highlights, highlight]);
  }}
  strokeColor="#000"
  strokeWidth={2}
/>
```

### Styling

```css
--highlight-drawing-stroke-color: #000;
--highlight-drawing-stroke-width: 2px;
--highlight-drawing-canvas-cursor: crosshair;
```

---

## Shape Highlights

Vector shapes: rectangles, circles, or arrows with customizable stroke.

### Basic Usage

```tsx
import { ShapeHighlight } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight } = useHighlightContainerContext();

  if (highlight.type === "shape") {
    return <ShapeHighlight />;
  }
}
```

### Props

```typescript
interface ShapeHighlightProps {
  isScrolledTo?: boolean;
  readOnly?: boolean;
  style?: ShapeStyle;
}

interface ShapeStyle {
  strokeColor?: string;    // Outline color
  strokeWidth?: number;    // Outline width
  fillColor?: string;      // Fill color (optional)
  opacity?: number;        // Fill opacity
}
```

### Data Model

```typescript
interface ShapeData {
  type: "rectangle" | "circle" | "arrow";
  x: number;        // Viewport x
  y: number;        // Viewport y
  width: number;    // Viewport width
  height: number;   // Viewport height
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
}

interface ShapeHighlight extends Highlight {
  type: "shape";
  content: {
    shape: ShapeData;
  };
}
```

### Creating Shape Highlights

Use the `ShapeCanvas` component:

```tsx
import { ShapeCanvas } from "react-pdf-highlighter-plus";

<ShapeCanvas
  onShapeFinished={(shape, position) => {
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      position,
      type: "shape",
      content: { shape },
    };
    setHighlights([...highlights, highlight]);
  }}
  shapeType="rectangle"
  strokeColor="#000"
  strokeWidth={2}
/>
```

### Styling

```css
--highlight-shape-stroke-color: #000;
--highlight-shape-stroke-width: 2px;
--highlight-shape-fill-color: transparent;
```

---

## Image Highlights

Upload or embed images on pages.

### Basic Usage

```tsx
import { ImageHighlight } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight } = useHighlightContainerContext();

  if (highlight.type === "image") {
    return <ImageHighlight />;
  }
}
```

### Props

```typescript
interface ImageHighlightProps {
  isScrolledTo?: boolean;
  onImageUpload?: (dataUrl: string) => void;  // New image callback
  onSelectionFinished?: (newPosition: ScaledPosition) => void;  // Resize callback
}
```

### Data Model

```typescript
interface ImageHighlight extends Highlight {
  type: "image";
  content: {
    image: string;  // Base64 data URL or URL
  };
}
```

### Creating Image Highlights

Typically via file input:

```tsx
function addImageHighlight(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      position: {
        boundingRect: { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.3, width: 0.3, height: 0.2, pageNumber: 1 },
        rects: [],
      },
      type: "image",
      content: { image: dataUrl },
    };
    setHighlights([...highlights, highlight]);
  };
  reader.readAsDataURL(file);
}
```

---

## Signature Pads

Handwritten signatures or drawings.

### Basic Usage

```tsx
import { SignaturePad } from "react-pdf-highlighter-plus";

function MyHighlightContainer() {
  const { highlight } = useHighlightContainerContext();

  if (highlight.type === "signature") {
    return <SignaturePad readOnly />;
  }
}
```

### Props

```typescript
interface SignaturePadProps {
  onSignatureFinished?: (strokes: DrawingStroke[], position: ScaledPosition) => void;
  strokeColor?: string;
  strokeWidth?: number;
  readOnly?: boolean;
}
```

### Data Model

```typescript
interface SignatureHighlight extends Highlight {
  type: "signature";
  content: {
    strokes: DrawingStroke[];
  };
}
```

### Creating Signatures

```tsx
<SignaturePad
  onSignatureFinished={(strokes, position) => {
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      position,
      type: "signature",
      content: { strokes },
    };
    setHighlights([...highlights, highlight]);
  }}
/>
```

---

## Common Patterns

### Conditional Rendering by Type

```tsx
function HighlightContainer({ highlights }) {
  return (
    <>
      {highlights.map((highlight) => (
        <MonitoredHighlightContainer key={highlight.id} highlight={highlight}>
          {highlight.type === "text" && <TextHighlight />}
          {highlight.type === "area" && <AreaHighlight />}
          {highlight.type === "freetext" && <FreetextHighlight />}
          {highlight.type === "drawing" && <DrawingHighlight />}
          {highlight.type === "shape" && <ShapeHighlight />}
          {highlight.type === "image" && <ImageHighlight />}
          {highlight.type === "signature" && <SignaturePad readOnly />}
        </MonitoredHighlightContainer>
      ))}
    </>
  );
}
```

### Hover Tips

Wrap highlights in `MonitoredHighlightContainer` to show tooltips on hover:

```tsx
<MonitoredHighlightContainer highlight={highlight} tip={<HighlightTip highlight={highlight} />}>
  <TextHighlight />
</MonitoredHighlightContainer>
```

Use `usePdfHighlighterContext().setTip()` to show custom popups.

### Custom Styling by Type

```tsx
const highlightStyles = {
  text: { backgroundColor: "rgba(255, 226, 143, 0.5)" },
  important: { backgroundColor: "rgba(255, 0, 0, 0.3)" },
  question: { backgroundColor: "rgba(0, 0, 255, 0.3)" },
};

<TextHighlight style={highlightStyles[highlight.category]} />
```

### Edit Callbacks

Handle position/content updates for draggable/editable highlights:

```tsx
<AreaHighlight
  onSelectionFinished={(newPosition) => {
    setHighlights(
      highlights.map((h) =>
        h.id === highlight.id ? { ...h, position: newPosition } : h
      )
    );
  }}
/>

<FreetextHighlight
  onUpdate={(content) => {
    setHighlights(
      highlights.map((h) =>
        h.id === highlight.id ? { ...h, content } : h
      )
    );
  }}
/>
```

---

## Left Panel

The optional left panel provides document outline (table of contents) and page thumbnails for navigation.

### Basic Usage

```tsx
import { LeftPanel } from "react-pdf-highlighter-plus";

<div style={{ display: "flex", height: "100vh" }}>
  <LeftPanel
    pdfDocument={pdfDocument}
    onPageChange={(page) => {
      // Handle navigation
    }}
  />
  <PdfHighlighter {...props}>
    <HighlightContainer />
  </PdfHighlighter>
</div>
```

### Props

```typescript
interface LeftPanelProps {
  pdfDocument: PDFDocumentProxy;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  mode?: "light" | "dark";
  theme?: LeftPanelTheme;
}

interface LeftPanelTheme {
  containerBackgroundColor?: string;
  tabStyles?: TabStyles;
  footerStyles?: FooterStyles;
  toggleButtonStyles?: ToggleButtonStyles;
}
```

### Styling

```css
--leftpanel-bg: #f5f5f5;
--leftpanel-text-color: #333;
--leftpanel-tab-active-color: #0066cc;
--leftpanel-border-color: #ddd;
```

---

## Dark Mode

All highlight components automatically adapt to dark mode when `theme.mode === "dark"`.

### Default Dark Colors

```typescript
{
  mode: "dark",
  darkModeColors: {
    background: "#141210",
    foreground: "#eae6e0",
  }
}
```

### Custom Dark Colors

```tsx
<PdfHighlighter
  theme={{
    mode: "dark",
    darkModeColors: {
      background: "#1e1e1e",
      foreground: "#ffffff",
    },
  }}
>
  <HighlightContainer />
</PdfHighlighter>
```

Highlights automatically stay readable in dark mode with translucent fills and contrasting borders.

---

## Export to PDF

Export all highlights to an annotated PDF file:

```tsx
import { exportPdf } from "react-pdf-highlighter-plus";

async function downloadAnnotatedPdf() {
  const pdf = await exportPdf(pdfDocument, highlights, {
    textHighlightColor: "rgba(255, 226, 143, 0.5)",
    areaHighlightColor: "rgba(255, 226, 143, 0.5)",
    defaultFreetextColor: "#333",
    defaultFreetextBgColor: "#ffffc8",
    onProgress: (current, total) => {
      console.log(`Exporting ${current}/${total} pages...`);
    },
  });

  const blob = pdf.asBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "annotated.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
```

The export function supports text, area, freetext, drawing, shape, image, and signature highlights.

