# react-pdf-highlighter-plus — Quick Start

**react-pdf-highlighter-plus** is a production-ready React library for annotating PDF documents with text highlights, area highlights, freetext notes, drawings, shapes, signatures, and images. It builds on PDF.js and stores all annotation positions in viewport-independent (scaled) coordinates, making them portable across zoom levels and screen sizes.

## What This Library Does

- **Annotations**: Text highlights, rectangular area highlights, sticky notes (freetext), drawings, shapes (rectangles, circles, arrows), signature pads, and image overlays
- **Text & Search**: Document outline, page thumbnails, full-text search with next/previous navigation, text extraction for citations and read-aloud
- **Export & Persistence**: Export annotated PDFs with all highlights embedded; save highlight data as JSON for database storage
- **Theming**: Light/dark mode with hue-preserving recolor (OKLab algorithm), customizable component styling
- **Navigation & Zoom**: Smooth scroll-to-highlight with reduced-motion support, pinch/wheel zoom with position-independent data
- **Performance**: Progressive PDF loading with range requests, per-page highlight rendering, document caching
- **Accessibility**: Outline tree, thumbnail navigation, high-contrast dark mode, semantic HTML

## Key Links

- **[Live Demo](https://quocvietha08.github.io/react-pdf-highlighter-plus/example-app/)** — See all features in action
- **[Existing Docs](/docs)** — API reference, theming, feature guides, examples
- **[Example App](/example)** — Full-featured reference implementation with citations, read-aloud, dark mode

## Getting Started

### Install

```bash
npm install react-pdf-highlighter-plus
```

### Basic Setup

```tsx
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
  useHighlightContainerContext,
} from "react-pdf-highlighter-plus";
import "react-pdf-highlighter-plus/style/style.css";

export default function App() {
  const [highlights, setHighlights] = useState([]);

  return (
    <PdfLoader url="https://example.com/document.pdf">
      <PdfHighlighter
        onSelectionFinished={(position, content, hideTipAndSelection) => {
          setHighlights([
            ...highlights,
            { id: Date.now().toString(), position, content },
          ]);
          hideTipAndSelection();
        }}
        highlights={highlights}
      >
        <HighlightContainer highlights={highlights} />
      </PdfHighlighter>
    </PdfLoader>
  );
}

function HighlightContainer({ highlights }) {
  const { highlight, viewportToScaled, screenshot } =
    useHighlightContainerContext();

  return (
    <TextHighlight
      isScrolledTo={false}
      onClick={() => console.log(highlight)}
    />
  );
}
```

See the [Example App](/example/src) for a complete, production-ready implementation with dark mode, citations, read-aloud, and more.

## Architecture at a Glance

The library uses a three-level component stack:

1. **PdfLoader** — Loads a PDF.js document from a URL or file
2. **PdfHighlighter** — Core viewer component; manages PDF.js rendering, selections, and context
3. **HighlightContainer** — Your custom component (e.g., `TextHighlight`, `AreaHighlight`, `FreetextHighlight`) that renders annotations

Highlights are stored in **scaled coordinates** (normalized 0–1 range relative to page dimensions) for portability, then converted to **viewport coordinates** (pixel positions at current zoom) for rendering.

Two main contexts provide utilities:
- **`PdfHighlighterContext`** — Viewer control (selections, tips, scroll, search)
- **`HighlightContainerContext`** — Per-highlight rendering utilities (position, screenshot, bindings)

## Documentation Structure

- **[Architecture Overview](./architecture/)** — Component hierarchy, coordinate systems, context layers, data flow
- **[Highlights & Annotations](./highlights/)** — Text, area, freetext, drawing, shape, signature, and image highlights; styles and configuration
- **[API & Components Reference](./api/)** — Component props, exported functions, types, and utilities
- **[Development Guide](./development/)** — Build, tests, extending the library, debugging

## Common Tasks

### Render Text & Area Highlights

```tsx
<PdfHighlighter highlights={highlights}>
  <HighlightContainer />
</PdfHighlighter>

function HighlightContainer() {
  const { highlight, isScrolledTo, viewportToScaled } =
    useHighlightContainerContext();

  if (highlight.type === "text") {
    return <TextHighlight isScrolledTo={isScrolledTo} />;
  } else if (highlight.type === "area") {
    return <AreaHighlight isScrolledTo={isScrolledTo} />;
  }
  return null;
}
```

### Support Dark Mode

```tsx
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: darkMode ? "dark" : "light",
    darkModeColors: { background: "#141210", foreground: "#eae6e0" },
  }}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

### Export Annotated PDF

```tsx
import { exportPdf } from "react-pdf-highlighter-plus";

const pdf = await exportPdf(pdfDocument, highlights, {
  textHighlightColor: "rgba(255, 226, 143, 0.5)",
});

// Download
const blob = pdf.asBlob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "annotated.pdf";
a.click();
```

### Find Text & Create Highlights (Citations)

```tsx
import { getTextPosition } from "react-pdf-highlighter-plus";

const position = await getTextPosition(pdfDocument, "your quote here");
const highlight = { id: crypto.randomUUID(), position };
```

### Extract Sentences for Read-Aloud

```tsx
import { extractSentences } from "react-pdf-highlighter-plus";

const sentences = await extractSentences(pdfDocument);
// Use sentences for text-to-speech with scrollToHighlight()
```

### Navigate Pages & Support Deep Linking

```tsx
<PdfHighlighter
  initialPage={new URLSearchParams(location.search).get("page") || 1}
  onPageChange={(page) => {
    window.history.pushState(null, "", `?page=${page}`);
  }}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

## Key Concepts

### Scaled vs. Viewport Coordinates

- **Scaled** (`ScaledPosition`): Normalized (0–1) relative to page dimensions; zoom-agnostic and portable
- **Viewport** (`ViewportPosition`): Pixel positions in the current view; used for rendering

Conversion is automatic in `HighlightContainerContext`, but you can also use `viewportPositionToScaled()` and `scaledPositionToViewport()` directly.

### Ghost Highlights

A temporary highlight shown while the user is making a selection. Use `onSelectionFinished()` to convert it to a permanent highlight.

### Tips & Popups

Call `setTip()` from `PdfHighlighterContext` to show a custom UI above/below a highlight. Tips auto-position and dismiss on Escape or mouse down.

### Edit Mode

If a highlight is being dragged/resized (e.g., `AreaHighlight` with `react-rnd`) or edited, call `toggleEditInProgress()` to prevent conflicting selections.

## Dependency Overview

- **pdf-lib** — PDF export and manipulation
- **pdfjs-dist** — PDF rendering and text extraction
- **react-rnd** — Draggable/resizable area highlights
- **tailwindcss** (optional) — Styling in example app

## Next Steps

1. **Run the example app**: `npm run dev` to see all features live
2. **Read [Architecture Overview](./architecture/)** for component design and data flow
3. **Check [Highlights & Annotations](./highlights/)** to understand each annotation type and styling
4. **Explore [API & Components Reference](./api/)** for complete component props and utilities
5. **Follow [Development Guide](./development/)** to set up your own build or extend the library

## Support & Contribution

- **GitHub**: https://github.com/QuocVietHa08/react-pdf-highlighter-plus
- **NPM**: https://www.npmjs.com/package/react-pdf-highlighter-plus
- **Issues & PRs**: Contributions welcome

---

**Last Updated**: See openwiki/.last-update.json
