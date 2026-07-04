# Architecture Overview

This document describes the component hierarchy, coordinate systems, context layers, and data flow in react-pdf-highlighter-plus.

## Component Hierarchy

The library uses a three-level component structure to manage PDF rendering, user interactions, and highlight rendering:

```
PdfLoader
  │
  └─ PdfHighlighter (core viewer)
      │
      └─ HighlightContainer (your custom component)
          │
          ├─ TextHighlight
          ├─ AreaHighlight
          ├─ FreetextHighlight
          ├─ DrawingHighlight
          ├─ ShapeHighlight
          ├─ SignaturePad
          └─ ImageHighlight
```

### PdfLoader

**File**: `/src/components/PdfLoader.tsx`

Handles PDF.js document loading from a URL or `DocumentInitParameters` object.

**Props**:
- `url: string | DocumentInitParameters` — PDF location
- `children: ReactNode` — Rendered with loaded `PDFDocumentProxy`
- `httpHeaders?: Record<string, string>` — Auth headers
- `withCredentials?: boolean` — Include credentials in requests
- `disableAutoFetch?: boolean` — Disable automatic page fetching
- `disableStream?: boolean` — Disable streaming range requests
- `rangeChunkSize?: number` — Size of range request chunks
- `enableCache?: boolean` — Enable URL-keyed document caching
- `onProgress?: (current: number, total: number) => void` — Loading progress callback
- `skeleton?: ReactNode` — Loading placeholder

**Behavior**:
- Imports the local PDF.js worker by default (no manual `workerSrc` setup needed)
- Supports progressive range loading for large documents
- Caches documents by URL if `enableCache` is true
- Passes loaded `PDFDocumentProxy` as context to children

### PdfHighlighter

**File**: `/src/components/PdfHighlighter.tsx` (66 KB, 590+ lines)

Core viewer component managing PDF.js rendering, event handling, selections, and coordinate transformations.

**Key Responsibilities**:
- Initializes PDF.js viewer and link service
- Manages text and area selections
- Converts between viewport and scaled coordinates
- Provides utilities via `PdfHighlighterContext`
- Does NOT render highlights itself — expects user-defined `HighlightContainer` as child
- Handles zoom, scroll, dark mode, and theme

**Props** (key subset):
- `pdfDocument: PDFDocumentProxy` — Loaded document
- `highlights: Highlight[]` — Annotations to render
- `onSelectionFinished?: (position, content, hide) => void` — Text/area selection callback
- `enableAreaSelection?: (event: MouseEvent) => boolean` — Condition for area selection (e.g., `event.altKey`)
- `enableTextSelection?: boolean` — Allow text selection (default: true)
- `theme?: PdfHighlighterTheme` — Light/dark mode and colors
- `initialPage?: number` — Start page for deep linking
- `onPageChange?: (page: number) => void` — Page navigation callback
- `onZoomChange?: (scale: number) => void` — Zoom change callback
- `children: ReactNode` — HighlightContainer component

**Context & Utilities**:

Provides `PdfHighlighterUtils` via `usePdfHighlighterContext()`:
- `scrollToHighlight(highlight)` — Scroll to and highlight a highlight (smooth, respects `prefers-reduced-motion`)
- `setTip(tip)` — Show a custom popup/tooltip
- `getCurrentSelection()` — Get active text/area selection
- `getGhostHighlight()` — Get temporary highlight from in-progress selection
- `removeGhostHighlight()` — Cancel temporary highlight
- `search(query, options)` — Search PDF text
- `toggleEditInProgress()` — Disable tips/selections during highlight editing
- `isEditingOrHighlighting()`, `isEditInProgress()`, `isSelectionInProgress()` — State checks

### HighlightContainer

**Pattern**: User-defined component that renders individual highlights.

**Example**:
```tsx
function HighlightContainer({ highlights }) {
  return (
    <>
      {highlights.map((highlight) => (
        <MonitoredHighlightContainer key={highlight.id} highlight={highlight}>
          {highlight.type === "text" ? (
            <TextHighlight isScrolledTo={false} />
          ) : (
            <AreaHighlight isScrolledTo={false} />
          )}
        </MonitoredHighlightContainer>
      ))}
    </>
  );
}
```

The `MonitoredHighlightContainer` wraps each highlight to track hover events and manage tip display.

---

## Coordinate Systems

The library maintains two coordinate systems for portability and precision:

### Viewport Coordinates (LTWHP, ViewportPosition)

Pixel coordinates relative to the current viewport and zoom level.

**LTWHP**:
```typescript
{
  left: number;      // x position in pixels
  top: number;       // y position in pixels
  width: number;     // width in pixels
  height: number;    // height in pixels
  pageNumber: number; // 1-indexed page
}
```

**ViewportPosition**:
```typescript
{
  boundingRect: LTWHP;
  rects: LTWHP[];     // per-line rects for text, single rect for area
}
```

**Used for**: Real-time rendering, mouse interaction, tip positioning

### Scaled Coordinates (Scaled, ScaledPosition)

Normalized (0–1) coordinates relative to page dimensions. Platform-agnostic and zoom-independent.

**Scaled**:
```typescript
{
  x1: number;        // left edge (0–1)
  y1: number;        // top edge (0–1)
  x2: number;        // right edge (0–1)
  y2: number;        // bottom edge (0–1)
  width: number;     // normalized width (0–1)
  height: number;    // normalized height (0–1)
  pageNumber: number; // 1-indexed page
}
```

**ScaledPosition**:
```typescript
{
  boundingRect: Scaled;
  rects: Scaled[];
  usePdfCoordinates?: boolean;
}
```

**Used for**: Persistence, export, portability across zoom levels and devices

### Conversion Functions

**File**: `/src/lib/coordinates.ts`

- `viewportPositionToScaled(viewport, pdfViewer, page)` — Convert viewport to scaled (for saving)
- `scaledPositionToViewport(scaled, pdfViewer, page)` — Convert scaled to viewport (for rendering)

Available directly via `HighlightContainerContext.viewportToScaled()`.

---

## Context System

Two main contexts provide utilities to child components:

### PdfHighlighterContext

**File**: `/src/contexts/PdfHighlighterContext.ts`

Provides `PdfHighlighterUtils` for controlling viewer behavior.

**Available in**: Any component inside `PdfHighlighter` (via `usePdfHighlighterContext()`)

**Functions**:
- `scrollToHighlight(highlight)` — Navigate to and smoothly scroll to a highlight
- `setTip(tip)` — Show/update a custom popup
- `updateTipPosition()` — Reposition tip if size changes
- `getCurrentSelection()` — Get active text/area selection
- `getGhostHighlight()` — Get in-progress selection ghost
- `removeGhostHighlight()` — Clear ghost highlight
- `toggleEditInProgress(flag?)` — Disable tips during highlight editing
- `search(query, options)` — Full-text search with highlight matches
- `isEditingOrHighlighting()` — Check if selection or edit is in progress
- `isEditInProgress()` — Check if highlight is being edited
- `isSelectionInProgress()` — Check if text/area selection is active

### HighlightContainerContext

**File**: `/src/contexts/HighlightContext.ts`

Provides `HighlightContainerUtils` for rendering individual highlights.

**Available in**: Components inside `HighlightContainer` (via `useHighlightContainerContext()`)

**Properties**:
- `highlight: Highlight` — The highlight being rendered
- `viewportToScaled(viewport)` — Convert viewport to scaled coordinates
- `screenshot()` — Render highlight area as canvas image
- `isScrolledTo: boolean` — Whether this highlight is the scroll target
- `highlightBindings: DOMRect` — Page container bounds for positioning

---

## Highlight Types & Data Models

### Base Highlight Type

```typescript
interface Highlight {
  id: string;
  position: ScaledPosition;
  type?: "text" | "area" | "freetext" | "drawing" | "shape" | "signature" | "image";
  content?: Record<string, any>;  // Deprecated; use type-specific fields
}
```

### Text Highlight

Text selection from the PDF; supports multiple rectangular regions (e.g., text wrapped across lines).

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "text";
  content: { text: string };  // Extracted or provided text
}
```

**Component**: `TextHighlight` — Renders colored overlay with optional underline or strikethrough

### Area Highlight

Rectangular region annotation; user draws a box via Alt+drag or via `enableAreaSelection` callback.

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "area";
  content?: { text?: string };  // Text intersected by area
}
```

**Component**: `AreaHighlight` — Draggable/resizable box via react-rnd

### Freetext Highlight

Sticky note with text, position, and styling.

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "freetext";
  content: {
    text: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontFamily?: string;
  };
}
```

**Component**: `FreetextHighlight` — Draggable/editable sticky note

### Drawing Highlight

Freehand pen strokes with color and width.

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "drawing";
  content: {
    strokes: DrawingStroke[];  // { points: DrawingPoint[], color, width }
  };
}
```

**Component**: `DrawingHighlight` — Rendered canvas paths

### Shape Highlight

Vector shapes: rectangles, circles, or arrows with stroke styling.

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "shape";
  content: {
    shape: ShapeData;  // { type, x, y, width, height, ... }
  };
}
```

**Component**: `ShapeHighlight` — SVG or canvas shapes

### Image Highlight

Uploaded image or base64 data embedded on page.

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "image";
  content: { image: string };  // Base64 data URL
}
```

**Component**: `ImageHighlight` — Draggable/resizable image

### Signature Pad

Drawn signature with strokes and styling.

```typescript
{
  id: string;
  position: ScaledPosition;
  type: "signature";
  content: {
    strokes: DrawingStroke[];
  };
}
```

**Component**: `SignaturePad` — Canvas-based signature capture

---

## Data Flow

### Selection → Highlight Creation

1. User selects text or drags rectangle on PDF
2. `PdfHighlighter` detects selection via mouse events
3. **Ghost Highlight** (temporary) is created and displayed
4. User releases mouse
5. `onSelectionFinished()` callback fires with `position` (scaled), `content`, and `hideTipAndSelection()` function
6. App creates permanent `Highlight` object and adds to state
7. On next render, `HighlightContainer` receives updated `highlights` and renders permanent version

### Highlight Rendering

1. App provides `highlights` array to `PdfHighlighter`
2. `PdfHighlighter` groups highlights by page
3. For each page in viewport, a `HighlightLayer` is created
4. `HighlightLayer` renders a React root for that page
5. App's `HighlightContainer` maps over highlights for that page
6. For each highlight, `useHighlightContainerContext()` provides utilities
7. Coordinate conversion (scaled → viewport) happens in context
8. Highlight component (TextHighlight, AreaHighlight, etc.) renders with viewport coordinates

### Zoom & Scroll

1. User zooms or scrolls
2. `PdfHighlighter` re-renders with new viewport bounds
3. Scaled coordinates remain unchanged
4. Viewport coordinates are recalculated on render
5. Highlights update position in real-time

---

## Left Panel Components

**File**: `/src/components/leftpanel/`

Optional document navigation UI with outline tree and page thumbnails.

- **LeftPanel** — Container with tabs (outline, thumbnails)
- **DocumentOutline** — Interactive page outline tree from PDF metadata
- **ThumbnailPanel** — Page thumbnails for visual navigation
- **OutlineItem** — Recursive outline tree item with expand/collapse
- **ThumbnailItem** — Single page thumbnail with hover/click

**Context**: `LeftPanelContext` — Provides page navigation and selection utilities

---

## Styling & Theme System

**Files**: `/src/style/` (one CSS file per component type)

Each component type (TextHighlight, AreaHighlight, etc.) has dedicated styles with CSS custom properties for customization.

**Theme Modes**:
- **Light** (default) — Document colors as-is
- **Dark** — Hue-preserving recolor via OKLab algorithm (file: `/src/lib/dark-mode.ts`)

**Theme Configuration** (PdfHighlighterTheme):
```typescript
{
  mode?: "light" | "dark";
  containerBackgroundColor?: string;
  scrollbarThumbColor?: string;
  scrollbarTrackColor?: string;
  darkModeColors?: { background: string; foreground: string };
}
```

Dark mode recolors the PDF canvas at render time without inverting colors, preserving embedded photos and graphics.

---

## Key Libraries & Dependencies

| Library | Purpose | Notes |
|---------|---------|-------|
| **pdf-lib** | PDF manipulation and export | Used in `/src/lib/export-pdf.ts` |
| **pdfjs-dist** | PDF rendering and text extraction | Dynamic import to handle breaking changes |
| **react-rnd** | Draggable/resizable area highlights | Optional for AreaHighlight |
| **react-dom** | React DOM utilities (createRoot) | Per-page highlight rendering |
| **TypeScript** | Type safety | Strict mode enabled |

---

## Build & Output Structure

**Source**: `/src/`
**Output**: `/dist/esm/` (ESM only, no CommonJS)

**Build Process** (see `/tsup.config.ts`):
1. TypeScript → ESM JavaScript
2. CSS files copied to `dist/esm/style/`
3. TypeDoc documentation generated to `public/docs/`
4. Example app built with Vite

**Exported Types**: All major types and components in `/src/index.ts`

---

## Performance Considerations

1. **Per-Page Rendering** — Highlights for visible pages only; hidden pages unmount highlights
2. **Scaled Coordinates** — Reduced re-renders on zoom by reusing scaled data
3. **Range Loading** — Progressive PDF.js loading for large documents
4. **Document Caching** — Optional URL-keyed caching to avoid re-fetching
5. **Memory Management** — Highlight/note React roots unmounted on page unload

---

## Extending the Library

### Custom Highlight Types

1. Extend the `Highlight` interface:
   ```typescript
   interface CustomHighlight extends Highlight {
     category?: string;
     assignedTo?: string;
   }
   ```

2. Use generic context:
   ```typescript
   const ctx = useHighlightContainerContext<CustomHighlight>();
   ```

3. Add custom component to HighlightContainer

### Custom Styling

Override CSS custom properties in your app or component CSS:
```css
:root {
  --highlight-text-bg: rgba(255, 226, 143, 0.5);
  --highlight-text-hover-bg: rgba(255, 226, 143, 0.8);
  --highlight-area-border: 2px solid #f3d590;
}
```

### Custom Tips & Popups

Use `setTip()` from `PdfHighlighterContext` to show any custom React component as a popup over highlights.

---

## Source Map

| File/Directory | Purpose | Key Exports |
|---|---|---|
| `/src/index.ts` | Public API | All components, types, utils, hooks |
| `/src/components/PdfLoader.tsx` | Document loading | `PdfLoader` |
| `/src/components/PdfHighlighter.tsx` | Core viewer | `PdfHighlighter`, `PdfHighlighterTheme` |
| `/src/components/TextHighlight.tsx` | Text rendering | `TextHighlight`, `TextHighlightStyle` |
| `/src/components/AreaHighlight.tsx` | Area rendering | `AreaHighlight`, `AreaHighlightStyle` |
| `/src/components/FreetextHighlight.tsx` | Notes | `FreetextHighlight`, `FreetextStyle` |
| `/src/components/DrawingHighlight.tsx` | Freehand ink | `DrawingHighlight` |
| `/src/components/ShapeHighlight.tsx` | Vector shapes | `ShapeHighlight`, `ShapeStyle` |
| `/src/components/ImageHighlight.tsx` | Image overlays | `ImageHighlight` |
| `/src/components/SignaturePad.tsx` | Signature input | `SignaturePad` |
| `/src/components/leftpanel/LeftPanel.tsx` | Navigation UI | `LeftPanel` and sub-components |
| `/src/contexts/PdfHighlighterContext.ts` | Viewer utilities | `usePdfHighlighterContext`, `PdfHighlighterUtils` |
| `/src/contexts/HighlightContext.ts` | Per-highlight utils | `useHighlightContainerContext`, `HighlightContainerUtils` |
| `/src/lib/coordinates.ts` | Coordinate conversion | `viewportPositionToScaled`, `scaledPositionToViewport` |
| `/src/lib/export-pdf.ts` | PDF export | `exportPdf`, `ExportPdfOptions` |
| `/src/lib/extract-sentences.ts` | Text extraction | `extractSentences`, `getTextPosition`, `extractPageTextItems` |
| `/src/lib/dark-mode.ts` | Dark mode recolor | `applyDarkMode`, `recolorPage` |
| `/src/style/*.css` | Component styles | CSS files for each component |
| `/src/types.ts` | Type definitions | `Highlight`, `ScaledPosition`, `ViewportPosition`, etc. |

