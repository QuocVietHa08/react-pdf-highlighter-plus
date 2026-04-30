# PDF Export

Export annotated PDFs with all highlights embedded directly into the document.

---

## Overview

The `exportPdf` function allows you to:
- Export PDFs with all highlight types embedded
- Customize highlight colors
- Track export progress for large documents
- Generate downloadable PDF files

---

## Quick Start

```tsx
import { exportPdf } from "react-pdf-highlighter-plus";

const handleExport = async () => {
  const pdfBytes = await exportPdf(pdfUrl, highlights);

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

---

## API Reference

### exportPdf Function

```typescript
async function exportPdf(
  pdfSource: string | Uint8Array | ArrayBuffer,
  highlights: ExportableHighlight[],
  options?: ExportPdfOptions
): Promise<Uint8Array>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pdfSource` | `string \| Uint8Array \| ArrayBuffer` | Yes | PDF source (URL, bytes, or buffer) |
| `highlights` | `ExportableHighlight[]` | Yes | Array of highlights to embed |
| `options` | `ExportPdfOptions` | No | Export configuration options |

### ExportPdfOptions

```typescript
interface ExportPdfOptions {
  /** Default color for text highlights */
  textHighlightColor?: string;  // Default: "rgba(255, 226, 143, 0.5)"

  /** Default color for area highlights */
  areaHighlightColor?: string;  // Default: "rgba(255, 226, 143, 0.5)"

  /** Default text color for freetext notes */
  defaultFreetextColor?: string;  // Default: "#333333"

  /** Default background color for freetext notes */
  defaultFreetextBgColor?: string;  // Default: "#ffffc8"

  /** Default font size for freetext notes */
  defaultFreetextFontSize?: number;  // Default: 14

  /** Progress callback for large PDFs */
  onProgress?: (current: number, total: number) => void;
}
```

### ExportableHighlight

```typescript
interface ExportableHighlight {
  id: string;
  type?: "text" | "area" | "freetext" | "image" | "drawing" | "shape";
  content?: {
    text?: string;    // For freetext
    image?: string;   // Base64 data URL for images/drawings
    shape?: ShapeData; // For rectangle, circle, and arrow annotations
  };
  position: ScaledPosition;

  /** Per-highlight color override (text/area highlights) */
  highlightColor?: string;

  /** Text color (freetext only) */
  color?: string;

  /** Background color (freetext only) */
  backgroundColor?: string;

  /** Font size (freetext only) */
  fontSize?: string;

  /** Font family (freetext only - uses Helvetica in export) */
  fontFamily?: string;

  /** Shape style overrides */
  shapeType?: "rectangle" | "circle" | "arrow";
  strokeColor?: string;
  strokeWidth?: number;
}
```

---

## Supported Highlight Types

### Text Highlights

Text highlights are rendered as semi-transparent colored rectangles over the selected text regions.

```tsx
// With per-highlight color
const highlight = {
  type: "text",
  highlightColor: "rgba(255, 0, 0, 0.3)",  // Red highlight
  position: { ... },
};

// Or use default color from options
await exportPdf(pdfUrl, highlights, {
  textHighlightColor: "rgba(255, 226, 143, 0.5)",
});
```

### Area Highlights

Area highlights are rendered as semi-transparent colored rectangles.

```tsx
const highlight = {
  type: "area",
  highlightColor: "rgba(0, 255, 0, 0.3)",  // Green highlight
  position: { ... },
};
```

### Freetext Notes

Freetext highlights are rendered with:
- Background rectangle with specified color
- Text content with proper wrapping
- Font size scaled proportionally to the box

```tsx
const highlight = {
  type: "freetext",
  content: { text: "This is a note with long text that will wrap automatically to fit within the box boundaries." },
  color: "#333333",
  backgroundColor: "#ffffc8",
  fontSize: "14px",
  position: { ... },
};
```

**Text Wrapping Behavior:**
- Text wraps at word boundaries
- Long words are broken character-by-character (like CSS `word-wrap: break-word`)
- Font size scales proportionally with the note box size
- Padding is also scaled to maintain visual consistency

### Images & Signatures

Images are embedded as PNG or JPG directly into the PDF.

```tsx
const highlight = {
  type: "image",
  content: { image: "data:image/png;base64,..." },
  position: { ... },
};
```

### Freehand Drawings

Drawings are embedded as PNG images with transparent backgrounds.

```tsx
const highlight = {
  type: "drawing",
  content: { image: "data:image/png;base64,..." },
  position: { ... },
};
```

### Shape Highlights

Shapes are rendered as vector annotations during export. Rectangle and circle highlights use their bounding box and stroke style. Arrow highlights use their stored start and end points when available.

```tsx
const highlight = {
  type: "shape",
  content: {
    shape: {
      shapeType: "arrow",
      strokeColor: "#000000",
      strokeWidth: 2,
    },
  },
  position: { ... },
};
```

---

## Complete Example

```tsx
import React, { useState, useRef } from "react";
import {
  PdfHighlighter,
  PdfLoader,
  exportPdf,
  Highlight,
} from "react-pdf-highlighter-plus";

const App = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const pdfUrl = "https://example.com/document.pdf";

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const pdfBytes = await exportPdf(pdfUrl, highlights, {
        textHighlightColor: "rgba(255, 226, 143, 0.5)",
        areaHighlightColor: "rgba(255, 226, 143, 0.5)",
        defaultFreetextColor: "#333333",
        defaultFreetextBgColor: "#ffffc8",
        defaultFreetextFontSize: 14,
        onProgress: (current, total) => {
          setExportProgress({ current, total });
        },
      });

      // Download the file
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "annotated-document.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <button onClick={handleExport} disabled={isExporting}>
          {isExporting
            ? `Exporting... ${exportProgress.current}/${exportProgress.total}`
            : "Export PDF"}
        </button>
      </div>

      <PdfLoader document={pdfUrl}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            highlights={highlights}
          >
            {/* Your highlight container */}
          </PdfHighlighter>
        )}
      </PdfLoader>
    </div>
  );
};

export default App;
```

---

## Loading PDFs from Different Sources

### From URL

```tsx
const pdfBytes = await exportPdf(
  "https://example.com/document.pdf",
  highlights
);
```

### From Uint8Array

```tsx
const fileInput = document.querySelector("input[type=file]");
const file = fileInput.files[0];
const arrayBuffer = await file.arrayBuffer();
const pdfBytes = await exportPdf(
  new Uint8Array(arrayBuffer),
  highlights
);
```

### From ArrayBuffer

```tsx
const response = await fetch(pdfUrl);
const arrayBuffer = await response.arrayBuffer();
const pdfBytes = await exportPdf(arrayBuffer, highlights);
```

---

## Progress Tracking

For large PDFs, track export progress:

```tsx
const [progress, setProgress] = useState({ current: 0, total: 0 });

await exportPdf(pdfUrl, highlights, {
  onProgress: (current, total) => {
    setProgress({ current, total });
    console.log(`Processing page ${current} of ${total}`);
  },
});
```

---

## Color Formats

The export function accepts colors in multiple formats:

### RGBA

```tsx
"rgba(255, 226, 143, 0.5)"  // Yellow with 50% opacity
"rgba(255, 0, 0, 0.3)"      // Red with 30% opacity
```

### RGB

```tsx
"rgb(255, 226, 143)"  // Yellow (full opacity)
```

### Hex

```tsx
"#ffe28f"    // 6-digit hex
"#ff0"       // 3-digit hex (expands to #ffff00)
```

---

## Technical Details

### PDF Coordinate System

- PDF origin is at bottom-left (vs screen origin at top-left)
- The export function automatically converts coordinates
- Positions are scaled from normalized (0-1) to PDF points

### Font Handling

- Freetext notes use Helvetica (built into PDF standard)
- Font size is scaled proportionally with the note box
- Custom font families from the UI are not preserved (Helvetica is always used)

### Image Embedding

- PNG and JPG formats are supported
- Images are embedded at their exact position and size
- Transparent backgrounds are preserved for PNG

### Text Wrapping

The export function implements intelligent text wrapping:
1. Splits text by newlines to preserve paragraph breaks
2. Wraps at word boundaries
3. Breaks long words character-by-character when they exceed the box width
4. Scales font size and padding proportionally with the box size

---

## Troubleshooting

### Text Overflowing

If freetext content overflows the box:
- Text now wraps automatically at word boundaries
- Long words are broken mid-character to fit
- Font size scales with box size

### Faded Colors

If highlight colors appear too faded:
- Use higher alpha values (e.g., `0.5` instead of `0.3`)
- Check the `highlightColor` property on individual highlights

### Missing Highlights

If some highlights don't appear in the export:
- Ensure highlights have valid `position.boundingRect.pageNumber`
- Verify the `type` property is set correctly
- Check that image data URLs are valid for image/drawing types

### Large File Size

For PDFs with many image/drawing highlights:
- Consider compressing images before storing
- Use smaller canvas sizes for drawings
- Signature pad default (400x200) is optimized for file size
