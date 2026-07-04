# Development Guide

This guide covers building, testing, and extending react-pdf-highlighter-plus.

---

## Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
cd /Users/admin/Workspace/learning/react/pdf-viewer-library/react-pdf-highlighter-plus
npm install
```

### Development Server

Run the example app with hot reload:

```bash
npm run dev
# or
npm start
```

Opens at http://localhost:5173 by default (Vite).

---

## Build Commands

### Full Build

```bash
npm run build
```

Runs the entire pipeline:
1. Clean dist/public/node_modules
2. Reinstall dependencies
3. Compile TypeScript to ESM
4. Copy styles to dist
5. Build example app
6. Generate TypeDoc documentation

### Individual Build Steps

```bash
# TypeScript compilation only
npm run build:esm

# Copy CSS to dist
npm run build:copy-styles

# Build example app
npm run build:example

# Generate TypeDoc docs
npm run build:docs

# Clean all artifacts
npm run clean
```

---

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── PdfLoader.tsx         # PDF loading wrapper
│   │   ├── PdfHighlighter.tsx    # Core viewer (590+ lines)
│   │   ├── TextHighlight.tsx     # Text highlight renderer
│   │   ├── AreaHighlight.tsx     # Area highlight (draggable)
│   │   ├── FreetextHighlight.tsx # Sticky notes
│   │   ├── DrawingHighlight.tsx  # Freehand strokes
│   │   ├── ShapeHighlight.tsx    # Vector shapes
│   │   ├── ImageHighlight.tsx    # Image overlays
│   │   ├── SignaturePad.tsx      # Signature capture
│   │   ├── DrawingCanvas.tsx     # Interactive drawing
│   │   ├── ShapeCanvas.tsx       # Interactive shapes
│   │   ├── HighlightLayer.tsx    # Per-page rendering
│   │   ├── MonitoredHighlightContainer.tsx
│   │   ├── MouseSelection.tsx    # Area selection handler
│   │   ├── MouseMonitor.tsx      # Mouse tracking
│   │   ├── TipContainer.tsx      # Popup positioning
│   │   └── leftpanel/            # Document navigation UI
│   ├── contexts/
│   │   ├── PdfHighlighterContext.ts  # Viewer utilities
│   │   ├── HighlightContext.ts       # Per-highlight utils
│   │   └── LeftPanelContext.ts       # Panel utilities
│   ├── hooks/
│   │   ├── usePageNavigation.ts
│   │   ├── useDocumentOutline.ts
│   │   └── useThumbnails.ts
│   ├── lib/
│   │   ├── coordinates.ts        # Viewport ↔ scaled
│   │   ├── export-pdf.ts         # PDF export (27 KB)
│   │   ├── extract-sentences.ts  # Text extraction (42 KB)
│   │   ├── dark-mode.ts          # OKLab recolor
│   │   ├── recolor-context.ts
│   │   ├── screenshot.ts
│   │   ├── pdfjs-dom.ts
│   │   ├── get-bounding-rect.ts
│   │   ├── get-client-rects.ts
│   │   ├── optimize-client-rects.ts
│   │   ├── group-highlights-by-page.ts
│   │   ├── copy-highlight-content.ts
│   │   ├── highlight-config-layer.ts
│   │   └── search.ts
│   ├── style/
│   │   ├── style.css             # Main styles
│   │   ├── pdf_viewer.css        # PDF.js overrides
│   │   ├── tokens.css            # Design tokens
│   │   ├── TextHighlight.css
│   │   ├── AreaHighlight.css
│   │   ├── FreetextHighlight.css
│   │   ├── DrawingHighlight.css
│   │   ├── ShapeHighlight.css
│   │   ├── ImageHighlight.css
│   │   ├── SignaturePad.css
│   │   ├── DrawingCanvas.css
│   │   ├── ShapeCanvas.css
│   │   ├── MouseSelection.css
│   │   └── PdfHighlighter.css
│   ├── types.ts                  # Shared type definitions
│   └── index.ts                  # Public API
├── example/
│   ├── src/
│   │   ├── App.tsx               # Full-featured demo app
│   │   ├── HighlightContainer.tsx
│   │   ├── Sidebar.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── FloatingActions.tsx
│   │   │   ├── CitationsPanel.tsx
│   │   │   └── ReaderToolbar.tsx
│   │   ├── lib/
│   │   │   ├── tts.ts            # Text-to-speech
│   │   │   └── useReader.ts      # Read-aloud hook
│   │   └── test-highlights.ts    # Test data (108 KB)
│   └── vite.config.ts
├── docs/
│   ├── api-reference.md          # API guide
│   ├── theming.md                # Theme customization
│   ├── text-area-highlights.md
│   ├── freetext-highlights.md
│   ├── drawing-highlights.md
│   ├── shape-highlights.md
│   ├── image-signature-highlights.md
│   └── pdf-export.md
├── dist/                         # Build output (ESM only)
├── public/                       # Static assets
├── tsup.config.ts               # Build config
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── CHANGELOG.md
├── CLAUDE.md                    # Claude instructions
└── README.md
```

---

## Code Organization Patterns

### Component Structure

Most components follow this pattern:

1. **Type definitions** — Props and styles interfaces
2. **Context extraction** — Get utilities via hooks
3. **Coordinate conversion** — Convert scales when needed
4. **Render logic** — Return JSX with inline handlers

**Example: TextHighlight.tsx**
```tsx
import { useHighlightContainerContext } from "../contexts/HighlightContext";

export function TextHighlight(props: TextHighlightProps) {
  const { highlight, viewportToScaled, isScrolledTo } =
    useHighlightContainerContext();

  return (
    <div
      style={{
        backgroundColor: props.style?.backgroundColor,
        cursor: props.style?.cursor,
      }}
      onClick={props.onClick}
    >
      {/* Render highlight */}
    </div>
  );
}
```

### Library Functions

Pure functions in `/src/lib/` handle:
- Coordinate transformations
- Text extraction
- PDF export
- Dark mode recolor
- Screenshot generation

**Example: coordinates.ts**
```tsx
export function viewportPositionToScaled(
  viewport: ViewportPosition,
  pdfViewer: PDFViewer,
  pageNumber: number
): ScaledPosition {
  const page = pdfViewer.pdfDocument.getPage(pageNumber);
  // ... normalize coordinates
  return { boundingRect, rects };
}
```

### Context Patterns

- **PdfHighlighterContext** — One per viewer, provides viewer-level utilities
- **HighlightContainerContext** — One per highlight, provides highlight-specific rendering utilities
- **LeftPanelContext** — One per panel, provides navigation utilities

---

## TypeScript Configuration

**Target**: ESNext with ES modules

**Key Settings** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler"
  }
}
```

---

## Build Output

**Output Directory**: `/dist/esm/`

**Files Generated**:
- `index.js` — Main bundle (ESM)
- `index.d.ts` — Type declarations
- `style/` — CSS files (copied from `/src/style/`)
- `style/style.css` — Main stylesheet
- `style/*.css` — Component-specific styles

**Package.json Exports**:
```json
{
  "main": "./dist/esm/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js"
    },
    "./style/style.css": {
      "import": "./dist/esm/style/style.css"
    },
    "./style/*.css": {
      "import": "./dist/esm/style/*.css"
    }
  }
}
```

---

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `pdfjs-dist` | 4.4.168+ | PDF rendering & text extraction |
| `pdf-lib` | Latest | PDF export & manipulation |
| `react` | 16.8+ | React library |
| `react-dom` | 16.8+ | React DOM |
| `react-rnd` | Latest | Draggable/resizable areas |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tsup` | Build tool |
| `vite` | Dev server & example build |
| `tailwindcss` | Styling (example app) |
| `postcss` | CSS processing |

---

## Key Implementation Notes

### Coordinate Conversion

The library maintains two coordinate systems:
- **Viewport** — Pixel coordinates in current view
- **Scaled** — Normalized (0–1) coordinates relative to page

Conversion happens in `HighlightContainerContext.viewportToScaled()` or directly via:
```tsx
import { viewportPositionToScaled, scaledPositionToViewport } from "react-pdf-highlighter-plus";
```

### Per-Page Rendering

`HighlightLayer` creates a React root for each visible page. Highlights are re-rendered on scroll/zoom, but hidden pages are unmounted to save memory.

### Dark Mode

Dark mode recolors the PDF canvas at render time using OKLab algorithm (see `/src/lib/dark-mode.ts`). This preserves embedded photos and colors unlike CSS `invert()`.

### PDF Export

The `exportPdf()` function uses `pdf-lib` to:
1. Parse highlight positions (scaled to PDF coordinates)
2. Render text/area highlight overlays
3. Embed freetext annotations
4. Composite images and drawings
5. Return a new `PDFDocument` ready for download

See `/src/lib/export-pdf.ts` for implementation (26 KB).

---

## Testing

### No Built-in Test Suite

Currently, the library relies on:
- Manual testing in the example app
- TypeScript strict mode for type safety
- Git history for regression tracking

### Running the Example App

The example app in `/example/` is a full-featured reference implementation:

```bash
npm run dev
```

This loads the example at http://localhost:5173 with:
- Text, area, freetext, drawing, shape, image, signature highlights
- Dark mode toggle
- Document outline and thumbnails
- PDF search
- PDF export
- Read-aloud (text-to-speech)
- Citations panel

### Manual Testing Checklist

Before releasing:
- [ ] Text selection creates highlights
- [ ] Area selection (Alt+drag) works
- [ ] Freetext notes are editable
- [ ] Drawing and shapes render
- [ ] Dark mode recolors PDF correctly
- [ ] Zoom/scroll preserve highlight positions
- [ ] PDF export includes all annotations
- [ ] Example app runs without errors

### TypeScript Type Checking

```bash
npx tsc --noEmit
```

Validates all type definitions without emitting code.

---

## Extending the Library

### Custom Highlight Types

1. Extend the `Highlight` interface:
   ```typescript
   interface CustomHighlight extends Highlight {
     customField?: string;
     metadata?: Record<string, any>;
   }
   ```

2. Add a custom component:
   ```tsx
   function CustomHighlight(props: CustomHighlightProps) {
     const { highlight } = useHighlightContainerContext<CustomHighlight>();
     return <div>{highlight.customField}</div>;
   }
   ```

3. Use in `HighlightContainer`:
   ```tsx
   {highlight.type === "custom" && <CustomHighlight />}
   ```

### Custom Styling

Override CSS custom properties:
```css
:root {
  --highlight-text-bg: rgba(255, 0, 0, 0.3);
  --highlight-area-border: 3px solid #ff0000;
}
```

Or pass inline styles to components:
```tsx
<TextHighlight style={{ backgroundColor: "rgba(255, 0, 0, 0.3)" }} />
```

### Custom Tips/Popups

Use `setTip()` from `PdfHighlighterContext`:
```tsx
const { setTip } = usePdfHighlighterContext();

const handleHover = () => {
  setTip({
    highlight: someHighlight,
    content: <CustomPopup />,
  });
};
```

### Custom PDF Export

Extend `exportPdf()` or write your own using `pdf-lib`:
```tsx
import { PDFDocument } from "pdf-lib";

const doc = await PDFDocument.load(pdfBytes);
// Customize export logic
```

---

## Debugging

### Browser DevTools

1. Open http://localhost:5173 during `npm run dev`
2. Inspect element to examine highlight DOM structure
3. Use React DevTools to trace context and props
4. Console logs in handlers to debug selection flow

### TypeScript Errors

```bash
npx tsc --noEmit
```

Shows all type errors without building.

### Component Props

Check actual props vs. expected props using React DevTools:
1. Open React DevTools tab
2. Select a component
3. View props in the sidebar

---

## Recent Changes & Architecture Decisions

### Latest Commits (from git log)

**356e7ff** — Simplify drawing and shape controls (remove pre-draw panels)
- Removes configuration panels before drawing
- Streamlines UI for drawing/shape annotations

**af79a1a** — Update highlight rendering for transparent backgrounds
- Uses transparent backgrounds for ink-only effects
- Better visual consistency

**a14c9d5** — Enhance PDF export with rounded rectangles and compositing
- Adds support for rounded rectangle exports
- Improves image compositing in PDFs

**e67d1c1** — Add launch config and design tokens
- Adds `.claude/launch.json` for Claude integration
- Introduces CSS design tokens for consistent styling

**cdf48ff** — Implement read-aloud with text-to-speech
- Adds `extractSentences()` utility
- Adds `useReader()` hook for TTS coordination
- Example app includes ReaderToolbar

**d190ada** — Dark mode with hue-preserving recolor and citations
- Implements OKLab-based dark mode
- Adds citation panel to example app
- Improves scrolling performance

**86b5807** — Dark mode support and color handling
- Initial dark mode implementation

### Key Architectural Choices

1. **Scaled Coordinates** — Store highlights in normalized (0–1) space for portability
2. **Context API** — Two-level context (viewer + per-highlight) for clean utilities
3. **Per-Page Rendering** — React roots per page for memory efficiency
4. **PDF.js Integration** — Use PDF.js for rendering and text extraction
5. **No CommonJS** — ESM only for cleaner output
6. **Component-Centric** — Each annotation type is a component, extensible by users

---

## Common Pitfalls

### 1. Forgetting to Call `hideTipAndSelection()`

After creating a highlight, always hide the selection tip:
```tsx
onSelectionFinished={(position, content, hideTipAndSelection) => {
  setHighlights([...highlights, { id: "h1", position }]);
  hideTipAndSelection();  // Required!
});
```

### 2. Not Converting Coordinates

Always use `viewportToScaled()` when saving highlights or `scaledPositionToViewport()` when rendering. The library handles this in context, but custom logic must account for it.

### 3. Editing Without `toggleEditInProgress()`

When dragging/resizing highlights, disable selections:
```tsx
<AreaHighlight
  onSelectionFinished={(newPos) => {
    toggleEditInProgress(true);
    updateHighlight(newPos);
    toggleEditInProgress(false);
  }}
/>
```

### 4. Missing CSS Import

Always import styles:
```tsx
import "react-pdf-highlighter-plus/style/style.css";
```

---

## Performance Tips

1. **Memoize HighlightContainer** — Avoid re-rendering all highlights on every change
   ```tsx
   const HighlightContainer = React.memo(({ highlights }) => ...);
   ```

2. **Use `key` Props** — Ensure highlight DOM nodes are stable
   ```tsx
   {highlights.map((h) => <Highlight key={h.id} highlight={h} />)}
   ```

3. **Lazy Load PDFs** — Use `enableCache` and range loading
   ```tsx
   <PdfLoader enableCache disableAutoFetch rangeChunkSize={65536}>
   ```

4. **Limit Highlights Per Page** — Large numbers of highlights slow down rendering

5. **Use CSS Transform** — Animate with GPU-backed transforms instead of left/top

---

## Releases & Versioning

**Current Version**: 1.2.0 (from package.json)

**Version Strategy**: Semantic versioning
- Major: Breaking API changes
- Minor: New features
- Patch: Bug fixes

**Changelog**: See `/CHANGELOG.md` for detailed history.

---

## Support & Issues

- **GitHub**: https://github.com/QuocVietHa08/react-pdf-highlighter-plus
- **NPM**: https://www.npmjs.com/package/react-pdf-highlighter-plus
- **Issues**: Report bugs with minimal reproduction in example app

