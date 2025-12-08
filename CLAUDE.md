# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`react-pdf-highlighter-extended` is a React library for annotating PDF documents with text and area highlights. It's built on top of PDF.js and provides a highly customizable highlighting experience with viewport-independent position data.

This is a fork of `react-pdf-highlighter` with significant architectural changes including context-based APIs, zoom support, and enhanced styling capabilities.

## Development Commands

### Running the Example App
```bash
npm run dev
# or
npm start
```
This runs the example app locally using Vite at `example/` directory.

### Building the Library
```bash
npm run build
```
This runs a full build pipeline:
1. Cleans dist/public/node_modules
2. Reinstalls dependencies
3. Compiles TypeScript to ESM (`dist/esm/`)
4. Copies styles from `src/style/` to `dist/esm/style/`
5. Builds the example app
6. Generates TypeDoc documentation to `public/docs/`

### Individual Build Steps
```bash
npm run build:esm        # TypeScript compilation only
npm run build:copy-styles # Copy CSS files to dist
npm run build:example    # Build example app with Vite
npm run build:docs       # Generate TypeDoc documentation
npm run clean            # Remove all build artifacts
```

## Architecture

### Component Hierarchy

The library uses a three-level component structure:

1. **PdfLoader** - Handles PDF.js document loading
   - Accepts a document URL string or `DocumentInitParameters` object
   - Renders children with loaded `PDFDocumentProxy`

2. **PdfHighlighter** - Core viewer component
   - Manages PDF.js viewer instance, event bus, and link service
   - Handles text/area selections and coordinate transformations
   - Does NOT render highlights itself - expects a user-defined highlight container as child
   - Provides utilities via `PdfHighlighterContext` and `utilsRef` prop

3. **User-defined HighlightContainer** - Custom component for rendering individual highlights
   - Receives context via `useHighlightContainerContext` hook
   - Typically uses `TextHighlight` or `AreaHighlight` components
   - Can be extended with custom highlight types/properties

### Context System

Two main contexts provide utilities to child components:

**PdfHighlighterContext** (`usePdfHighlighterContext`)
- Controls viewer behavior: selections, ghost highlights, tips
- Functions: `scrollToHighlight`, `setTip`, `getCurrentSelection`, `toggleEditInProgress`, etc.
- Available to any component inside `PdfHighlighter`

**HighlightContext** (`useHighlightContainerContext`)
- Provides per-highlight rendering utilities
- Properties: `highlight`, `viewportToScaled`, `screenshot`, `isScrolledTo`, `highlightBindings`
- Only available inside highlight container components

### Coordinate Systems

The library uses two coordinate systems:

**Viewport Coordinates** (`LTWHP`, `ViewportPosition`)
- Pixel coordinates relative to current viewport/zoom level
- Used for rendering highlights on screen
- Format: `{ left, top, width, height, pageNumber }`

**Scaled Coordinates** (`Scaled`, `ScaledPosition`)
- Normalized (0, 1) coordinates relative to page dimensions
- Platform/zoom-agnostic, suitable for persistence
- Format: `{ x1, y1, x2, y2, width, height, pageNumber }`

Conversion functions:
- `viewportPositionToScaled()` - viewport → scaled (for saving)
- `scaledPositionToViewport()` - scaled → viewport (for rendering)
- `viewportToScaled()` - available in `HighlightContainerUtils`

### Highlight Types

**Highlight** - Permanent highlight with ID and scaled position
- Required properties: `id`, `position` (ScaledPosition)
- Optional: `type` ("text" | "area"), `content` (deprecated)

**GhostHighlight** - Temporary highlight without ID
- Used as intermediary between selection and permanent highlight
- Created via `PdfSelection.makeGhostHighlight()`

**ViewportHighlight** - Rendered highlight with viewport coordinates
- Internal type used when rendering highlights on pages
- Position converted from scaled to viewport coordinates

## Key Implementation Patterns

### Extending Highlights
Create custom highlight interfaces by extending the base `Highlight` type:

```typescript
interface CustomHighlight extends Highlight {
  category: string;
  comment?: string;
}
```

Then use the generic type in `useHighlightContainerContext<CustomHighlight>()`.

### MonitoredHighlightContainer
Wrap highlights with `MonitoredHighlightContainer` to:
- Track mouse hover events over highlights
- Display popups/tips on hover
- Prevent tip from disappearing when hovering over popup content

### Tips and Popups
Use `setTip()` from `PdfHighlighterContext` to show custom UI:
- Automatically positions above/below highlights
- Call `updateTipPosition()` if tip size changes
- Cleared on mouse down or Escape key

### Area Selection
Enable with `enableAreaSelection` prop on `PdfHighlighter`:
```typescript
enableAreaSelection={(event) => event.altKey}
```
This allows rectangular selection when condition is met (e.g., Alt key held).

## File Structure

```
src/
  components/          # React components
    PdfLoader.tsx      # Document loader
    PdfHighlighter.tsx # Main viewer (590+ lines)
    TextHighlight.tsx  # Text highlight renderer
    AreaHighlight.tsx  # Area highlight renderer with react-rnd
    MonitoredHighlightContainer.tsx
    HighlightLayer.tsx # Renders highlights for single page
    TipContainer.tsx   # Manages tip positioning
    MouseSelection.tsx # Handles rectangular selection
    MouseMonitor.tsx   # Mouse tracking utility
  contexts/
    PdfHighlighterContext.ts # Viewer utilities
    HighlightContext.ts      # Per-highlight utilities
  lib/                 # Pure functions
    coordinates.ts     # Coordinate conversions
    screenshot.ts      # Canvas-based screenshot
    pdfjs-dom.ts       # PDF.js DOM utilities
    get-bounding-rect.ts
    get-client-rects.ts
    optimize-client-rects.ts
    group-highlights-by-page.ts
  style/              # CSS files
  types.ts            # TypeScript definitions
  index.ts            # Public API exports
example/              # Example/demo application
```

## TypeScript Configuration

- Target: ESNext with ESM modules
- Output: `dist/esm/` with declaration files
- Strict mode enabled with `noUnusedLocals` and `noImplicitReturns`
- JSX: React mode
- TypeDoc theme: navigation with category-nav plugin

## PDF.js Integration

- Uses `pdfjs-dist` v4.4.168
- Dynamic import of PDF.js viewer components to handle breaking changes
- Custom CSS overrides in `src/style/pdf_viewer.css`
- Text layer mode: 2 (enhanced text selection)

## Important Notes

- PDF.js renders pages with `absolute` positioning - account for this in custom styling
- Highlight container must be defined by library users - no default renderer
- The `content` property on `Highlight` is deprecated - use `type` instead
- Ghost highlights are automatically removed on mouse down or Escape key
- Selection tips only appear when `selectionTip` prop is provided
