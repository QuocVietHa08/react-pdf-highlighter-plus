# react-pdf-highlighter-plus

<p align="center">
  <a href="https://github.com/QuocVietHa08/react-pdf-highlighter-plus/stargazers">
    <img src="https://img.shields.io/github/stars/QuocVietHa08/react-pdf-highlighter-plus?style=social" alt="GitHub stars">
  </a>
  <a href="https://github.com/QuocVietHa08/react-pdf-highlighter-plus/actions/workflows/node.js.yml">
    <img src="https://github.com/QuocVietHa08/react-pdf-highlighter-plus/actions/workflows/node.js.yml/badge.svg" alt="Node.js CI">
  </a>
  <a href="https://badge.fury.io/js/react-pdf-highlighter-plus">
    <img src="https://badge.fury.io/js/react-pdf-highlighter-plus.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/react-pdf-highlighter-plus">
    <img src="https://img.shields.io/npm/dm/react-pdf-highlighter-plus.svg" alt="npm downloads">
  </a>
</p>

<p align="center">
  <strong>A powerful React library for annotating PDF documents</strong>
</p>

<p align="center">
  Text highlights • Area highlights • Freetext notes • Images & signatures • Freehand drawing • PDF export
</p>

---

## Overview

`react-pdf-highlighter-plus` provides a highly customizable annotation experience for PDF documents in React applications. Built on [PDF.js](https://github.com/mozilla/pdf.js), it stores highlight positions in viewport-independent coordinates, making them portable across different screen sizes.

## Features

| Feature | Description |
|---------|-------------|
| **Text Highlights** | Select and highlight text passages |
| **Area Highlights** | Draw rectangular regions on PDFs |
| **Freetext Notes** | Draggable, editable sticky notes with custom styling |
| **Images & Signatures** | Upload images or draw signatures directly on PDFs |
| **Freehand Drawing** | Draw freehand annotations with customizable stroke |
| **PDF Export** | Export annotated PDF with all highlights embedded |
| **Light/Dark Theme** | Eye-friendly dark mode with customizable intensity |
| **Zoom Support** | Full zoom functionality with position-independent data |
| **Fully Customizable** | Exposed styling on all components |

## Quick Links

| Resource | Link |
|----------|------|
| Live Demo | [View Demo](https://quocvietha08.github.io/react-pdf-highlighter-plus/example-app/) |
| Documentation | [API Docs](https://quocvietha08.github.io/react-pdf-highlighter-plus/docs/) |
| NPM Package | [npm](https://www.npmjs.com/package/react-pdf-highlighter-plus) |

---

## Installation

```bash
npm install react-pdf-highlighter-plus
```

### Import Styles

```tsx
import "react-pdf-highlighter-plus/style/style.css";
```

---

## Quick Start

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

function App() {
  const [highlights, setHighlights] = useState([]);

  return (
    <PdfLoader document="https://example.com/document.pdf">
      {(pdfDocument) => (
        <PdfHighlighter
          pdfDocument={pdfDocument}
          highlights={highlights}
          enableAreaSelection={(e) => e.altKey}
        >
          <HighlightContainer />
        </PdfHighlighter>
      )}
    </PdfLoader>
  );
}

function HighlightContainer() {
  const { highlight, isScrolledTo } = useHighlightContainerContext();

  return highlight.type === "text" ? (
    <TextHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
  ) : (
    <AreaHighlight highlight={highlight} isScrolledTo={isScrolledTo} />
  );
}
```

---

## Highlight Types

### 1. Text Highlights

Select text in the PDF to create highlights.

```tsx
<TextHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  style={{ background: "rgba(255, 226, 143, 1)" }}
/>
```

### 2. Area Highlights

Hold `Alt` and drag to create rectangular highlights.

```tsx
<PdfHighlighter
  enableAreaSelection={(event) => event.altKey}
  // ...
>
```

### 3. Freetext Notes

Create draggable, editable text annotations with customizable styling.

```tsx
import { FreetextHighlight } from "react-pdf-highlighter-plus";

<PdfHighlighter
  enableFreetextCreation={() => freetextMode}
  onFreetextClick={(position) => {
    addHighlight({ type: "freetext", position, content: { text: "Note" } });
  }}
>

// In your highlight container:
<FreetextHighlight
  highlight={highlight}
  onChange={handlePositionChange}
  onTextChange={handleTextChange}
  onStyleChange={handleStyleChange}
  color="#333333"
  backgroundColor="#ffffc8"
  fontSize="14px"
/>
```

**Features:**
- Drag to reposition
- Click to edit text
- Built-in style panel (colors, font size, font family)
- Toolbar appears on hover

[Full Documentation →](docs/freetext-highlights.md)

### 4. Images & Signatures

Upload images or draw signatures and place them on PDFs.

```tsx
import { ImageHighlight, SignaturePad } from "react-pdf-highlighter-plus";

// Signature pad modal
<SignaturePad
  isOpen={isOpen}
  onComplete={(dataUrl) => setPendingImage(dataUrl)}
  onClose={() => setIsOpen(false)}
/>

// In your highlight container:
<ImageHighlight
  highlight={highlight}
  onChange={handlePositionChange}
  onEditStart={() => toggleEditInProgress(true)}
  onEditEnd={() => toggleEditInProgress(false)}
/>
```

**Features:**
- Upload any image format
- Draw signatures with mouse or touch
- Drag to reposition
- Resize while maintaining aspect ratio
- Toolbar appears on hover

[Full Documentation →](docs/image-signature-highlights.md)

### 5. Freehand Drawing

Draw freehand annotations directly on PDFs.

```tsx
import { DrawingHighlight } from "react-pdf-highlighter-plus";

<PdfHighlighter
  enableDrawingCreation={() => drawingMode}
  onDrawingComplete={(position, dataUrl) => {
    addHighlight({ type: "drawing", position, content: { image: dataUrl } });
  }}
  drawingConfig={{
    strokeColor: "#ff0000",
    strokeWidth: 2,
  }}
>

// In your highlight container:
<DrawingHighlight
  highlight={highlight}
  onChange={handlePositionChange}
/>
```

**Features:**
- Freehand drawing with mouse or touch
- Customizable stroke color and width
- Stored as PNG for PDF export compatibility
- Drag to reposition

[Full Documentation →](docs/drawing-highlights.md)

---

## Light/Dark Theme

Toggle between light and dark modes with customizable styling for comfortable reading.

```tsx
// Enable dark mode
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{ mode: "dark" }}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>

// Customize dark mode intensity and colors
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeInvertIntensity: 0.85,  // Softer (0.8-1.0)
    containerBackgroundColor: "#3a3a3a",
    scrollbarThumbColor: "#6b6b6b",
    scrollbarTrackColor: "#2c2c2c",
  }}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

**Features:**
- Eye-friendly dark mode using CSS filter inversion
- Customizable inversion intensity (0.8-1.0)
- Preserve original highlight colors in dark mode
- Custom scrollbar styling
- Full theming control for container background

**Inversion Intensity Guide:**
| Value | Result | Use Case |
|-------|--------|----------|
| `1.0` | Pure black | High contrast |
| `0.9` | Dark gray (~#1a1a1a) | **Recommended** |
| `0.85` | Softer gray (~#262626) | Long reading sessions |
| `0.8` | Medium gray (~#333333) | Maximum comfort |

[Full Documentation →](docs/theming.md)

---

## PDF Export

Export your annotated PDF with all highlights embedded.

```tsx
import { exportPdf } from "react-pdf-highlighter-plus";

const handleExport = async () => {
  const pdfBytes = await exportPdf(pdfUrl, highlights, {
    textHighlightColor: "rgba(255, 226, 143, 0.5)",
    areaHighlightColor: "rgba(255, 226, 143, 0.5)",
    onProgress: (current, total) => console.log(`${current}/${total} pages`),
  });

  // Download the file
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "annotated.pdf";
  a.click();
  URL.revokeObjectURL(url);
};
```

**Supported highlight types:**
- Text highlights (colored rectangles)
- Area highlights (colored rectangles)
- Freetext notes (background + wrapped text)
- Images & signatures (embedded PNG/JPG)
- Freehand drawings (embedded PNG)

[Full Documentation →](docs/pdf-export.md)

---

## Component Architecture

```
┌─────────────────────────────────────────────────────┐
│                    PdfLoader                         │
│  Loads PDF document via PDF.js                       │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │               PdfHighlighter                   │  │
│  │  Manages viewer, events, coordinate systems   │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │      User-defined HighlightContainer    │  │  │
│  │  │  Renders highlights using context hooks │  │  │
│  │  │                                         │  │  │
│  │  │  • TextHighlight                        │  │  │
│  │  │  • AreaHighlight                        │  │  │
│  │  │  • FreetextHighlight                    │  │  │
│  │  │  • ImageHighlight                       │  │  │
│  │  │  • DrawingHighlight                     │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Context Hooks

| Hook | Purpose |
|------|---------|
| `usePdfHighlighterContext()` | Viewer utilities: `scrollToHighlight`, `setTip`, `getCurrentSelection` |
| `useHighlightContainerContext()` | Per-highlight utilities: `highlight`, `viewportToScaled`, `screenshot` |

---

## Coordinate Systems

The library uses two coordinate systems:

| System | Description | Use Case |
|--------|-------------|----------|
| **Viewport** | Pixel coordinates relative to current zoom | Rendering on screen |
| **Scaled** | Normalized (0-1) coordinates relative to page | Storage & retrieval |

```tsx
// Converting between systems
const { viewportToScaled } = useHighlightContainerContext();

// Save position (viewport → scaled)
const scaledPosition = viewportToScaled(boundingRect);

// Highlights are automatically converted to viewport when rendering
```

---

## Customization

### Custom Highlight Interface

```tsx
interface MyHighlight extends Highlight {
  category: string;
  comment?: string;
  author?: string;
}

// Use the generic type
const { highlight } = useHighlightContainerContext<MyHighlight>();
```

### Custom Styling

```tsx
// Via props
<TextHighlight
  highlight={highlight}
  style={{ background: categoryColors[highlight.category] }}
/>

// Via CSS classes
.TextHighlight { }
.AreaHighlight { }
.FreetextHighlight { }
.ImageHighlight { }
.DrawingHighlight { }
```

### Tips and Popups

```tsx
import { MonitoredHighlightContainer } from "react-pdf-highlighter-plus";

<MonitoredHighlightContainer
  highlightTip={{
    position: highlight.position,
    content: <MyPopup highlight={highlight} />,
  }}
>
  <TextHighlight highlight={highlight} />
</MonitoredHighlightContainer>
```

---

## Running Locally

```bash
git clone https://github.com/QuocVietHa08/react-pdf-highlighter-plus.git
cd react-pdf-highlighter-plus
npm install
npm run dev
```

---

## API Reference

See the full [API Reference](docs/api-reference.md) for detailed documentation on all components and types.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For bugs, please [open an issue](https://github.com/QuocVietHa08/react-pdf-highlighter-plus/issues) with clear reproduction steps.

---

## License

MIT

---

## Credits

Originally forked from [`react-pdf-highlighter`](https://github.com/agentcooper/react-pdf-highlighter) with significant architectural changes including context-based APIs, zoom support, freetext/image/drawing highlights, and PDF export functionality.
