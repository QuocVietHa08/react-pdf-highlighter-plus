# API Reference

Complete reference for all components, functions, and types in react-pdf-highlighter-plus.

---

## Utilities

### extractSentences

Extracts sentence-level text from a PDF.js document and returns sentence metadata with optional highlight-compatible positions.

```tsx
import { extractSentences } from "react-pdf-highlighter-plus";

const sentences = await extractSentences(pdfDocument);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pages` | `"all" \| number[]` | `"all"` | Pages to extract from |
| `includePositions` | `boolean` | `true` | Include `ScaledPosition` values for rendering highlights |
| `normalize` | `boolean` | `true` | Normalize whitespace, line-break hyphenation, and citation spacing |
| `locale` | `string` | `"en"` | Locale used by `Intl.Segmenter` |
| `idPrefix` | `string` | `""` | Prefix applied to generated sentence ids |
| `readingOrder` | `"auto" \| "document" \| "position"` | `"auto"` | Controls whether extraction uses detected layout order or raw PDF order |
| `columnDetection` | `"auto" \| "none"` | `"auto"` | Detect body columns and read each column top-to-bottom |

```tsx
const sentences = await extractSentences(pdfDocument, {
  pages: [1, 2],
  idPrefix: "ai-",
});

console.log(sentences[0]);
// {
//   id: "ai-p1-s0",
//   text: "JavaScript enables rich interactions.",
//   rawText: "JavaScript enables rich interactions.",
//   pageNumber: 1,
//   indexInPage: 0,
//   globalIndex: 0,
//   position: { boundingRect, rects },
//   source: { startOffset, endOffset, textItemIndexes }
// }
```

### extractPageTextItems

Returns lower-level PDF.js text items with page-relative rectangles. Use this when you need custom text grouping instead of sentence extraction.

```tsx
import { extractPageTextItems } from "react-pdf-highlighter-plus";

const pages = await extractPageTextItems(pdfDocument, { pages: [1] });
```

### extractTextUnits

Extracts layout-aware text units before sentence splitting. This is useful for research papers where titles, author blocks, section headings, footnotes, reference links, and two-column body layouts need local layout handling before sentence extraction.

```tsx
import { extractTextUnits } from "react-pdf-highlighter-plus";

const units = await extractTextUnits(pdfDocument, { pages: [1] });
```

Each unit has a `type`:

```ts
"paragraph" | "title" | "heading" | "author" | "affiliation" | "footnote" | "reference" | "unknown"
```

`extractSentences()` uses this layer and splits only `"paragraph"` units by default. To include other unit types:

```tsx
const sentences = await extractSentences(pdfDocument, {
  includeTextUnitTypes: ["paragraph", "title", "heading"],
});
```

Two-column academic pages are detected automatically. Extracted units and sentences include `columnIndex` when a page has detected body columns. Use `columnDetection: "none"` to disable this and keep single-column grouping.

The extractor also repairs common PDF text artifacts: per-glyph output such as `T h i n k`, jammed word boundaries in common academic prose, spaced hyphen compounds, citation spacing, and common ligatures such as `ﬁ`.

The example app JSON export groups results by page:

```json
{
  "pageSelection": "all",
  "pages": [
    {
      "pageNumber": 1,
      "columns": [],
      "textUnits": [],
      "sentences": []
    }
  ]
}
```

### sentenceToHighlight

Converts a positioned sentence into a standard text highlight.

```tsx
import {
  extractSentences,
  sentenceToHighlight,
} from "react-pdf-highlighter-plus";

const sentences = await extractSentences(pdfDocument);
const highlights = sentences
  .filter((sentence) => sentence.position)
  .map((sentence) => sentenceToHighlight(sentence));
```

For AI workflows, keep model calls in your app layer:

```tsx
const sentences = await extractSentences(pdfDocument);
const aiInput = sentences.map(({ id, text }) => ({ id, text }));
const aiResults = await analyzeSentences(aiInput);

const highlights = sentences
  .filter((sentence) => aiResults[sentence.id]?.important)
  .map((sentence) => sentenceToHighlight(sentence));
```

---

### getTextPosition

Locate a piece of text in the PDF and return its **precise** position (the rects
of the exact phrase, per line — not a whole sentence). Use it to turn an external
quote / AI citation into a highlight you can render or scroll to. Matching ignores
whitespace and line-wraps, with a bounded fuzzy fallback.

```tsx
import { getTextPosition } from "react-pdf-highlighter-plus";

const match = await getTextPosition(pdfDocument, "the quote to locate");
// match: { position: ScaledPosition; pageNumber: number;
//          matchedText: string; confidence: "exact" | "fuzzy" } | null

if (match) {
  const highlight = {
    id: "cite-1",
    type: "text",
    content: { text: match.matchedText },
    position: match.position,
  };
  setHighlights((prev) => [highlight, ...prev]);
  utils.scrollToHighlight(highlight); // smooth scroll + flash
}
```

**Options:** `getTextPosition(pdfDocument, query, { pages?: "all" | number[]; fuzzy?: boolean })`

---

## Components

### TextHighlight

Renders selected PDF text as highlight rectangles.

```tsx
import { TextHighlight } from "react-pdf-highlighter-plus";
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `highlight` | `ViewportHighlight` | Required | Text highlight data |
| `isScrolledTo` | `boolean` | `false` | Whether highlight was auto-scrolled to |
| `highlightColor` | `string` | Yellow | Highlight color |
| `highlightStyle` | `"highlight" \| "underline" \| "strikethrough"` | `"highlight"` | Text highlight style |
| `copyText` | `string` | - | Text copied by the toolbar copy button |
| `onStyleChange` | `(style: TextHighlightStyle) => void` | - | Called when style changes |
| `onDelete` | `() => void` | - | Called when delete is clicked |

Geometry renders in `.PdfHighlighter__highlight-layer`; toolbar, style panel, and copy button render in `.PdfHighlighter__config-layer`.

---

### AreaHighlight

Renders a draggable, resizable rectangular area annotation.

```tsx
import { AreaHighlight } from "react-pdf-highlighter-plus";
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `highlight` | `ViewportHighlight` | Required | Area highlight data |
| `onChange` | `(rect: LTWHP) => void` | - | Called when position/size changes |
| `isScrolledTo` | `boolean` | `false` | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | - | Bounds for dragging/resizing |
| `highlightColor` | `string` | Yellow | Area color |
| `copyText` | `string` | - | Text copied by the toolbar copy button |
| `onStyleChange` | `(style: AreaHighlightStyle) => void` | - | Called when style changes |
| `onDelete` | `() => void` | - | Called when delete is clicked |

When `copyText` is not provided, the copy button extracts intersecting text from the PDF.js text layer.

---

### FreetextHighlight

A draggable, editable text annotation component.

```tsx
import { FreetextHighlight } from "react-pdf-highlighter-plus";
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `highlight` | `ViewportHighlight` | Required | The highlight data to render |
| `onChange` | `(rect: LTWHP) => void` | - | Called when position changes |
| `onTextChange` | `(text: string) => void` | - | Called when text content changes |
| `onStyleChange` | `(style: FreetextStyle) => void` | - | Called when style changes via panel |
| `isScrolledTo` | `boolean` | `false` | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | - | Bounds for dragging (react-rnd) |
| `onContextMenu` | `(event: MouseEvent) => void` | - | Right-click handler |
| `onEditStart` | `() => void` | - | Called when editing begins |
| `onEditEnd` | `() => void` | - | Called when editing ends |
| `style` | `CSSProperties` | - | Custom container styling |
| `color` | `string` | `"#333333"` | Text color |
| `backgroundColor` | `string` | `"#ffffc8"` | Background color |
| `fontFamily` | `string` | `"inherit"` | Font family |
| `fontSize` | `string` | `"14px"` | Font size |
| `dragIcon` | `ReactNode` | 6-dot grid | Custom drag handle icon |
| `editIcon` | `ReactNode` | Pencil | Custom edit button icon |
| `styleIcon` | `ReactNode` | Palette | Custom style button icon |
| `backgroundColorPresets` | `string[]` | See below | Background color presets |
| `textColorPresets` | `string[]` | See below | Text color presets |
| `compact` | `boolean` | `false` | Render the note as a compact marker until opened |
| `compactSize` | `number` | `32` | Compact marker size in pixels |
| `compactIcon` | `ReactNode` | Note icon | Custom compact marker icon |

**Default Color Presets:**
- Background: `["#ffffc8", "#ffcdd2", "#c8e6c9", "#bbdefb", "#e1bee7"]`
- Text: `["#333333", "#d32f2f", "#1976d2", "#388e3c", "#7b1fa2"]`

#### Example

```tsx
<FreetextHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  onChange={(rect) => updatePosition(highlight.id, rect)}
  onTextChange={(text) => updateText(highlight.id, text)}
  onStyleChange={(style) => updateStyle(highlight.id, style)}
  color={highlight.color}
  backgroundColor={highlight.backgroundColor}
  fontSize={highlight.fontSize}
/>
```

---

### ImageHighlight

A draggable, resizable image annotation component.

```tsx
import { ImageHighlight } from "react-pdf-highlighter-plus";
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `highlight` | `ViewportHighlight` | Required | The highlight data (must have `content.image`) |
| `onChange` | `(rect: LTWHP) => void` | - | Called when position/size changes |
| `isScrolledTo` | `boolean` | `false` | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | - | Bounds for dragging |
| `onContextMenu` | `(event: MouseEvent) => void` | - | Right-click handler |
| `onEditStart` | `() => void` | - | Called when drag/resize begins |
| `onEditEnd` | `() => void` | - | Called when drag/resize ends |
| `style` | `CSSProperties` | - | Custom container styling |
| `dragIcon` | `ReactNode` | 6-dot grid | Custom drag handle icon |
| `onStyleChange` | `(image: string, strokes: DrawingStroke[]) => void` | - | Called after editing drawing color/width |
| `onDelete` | `() => void` | - | Called when delete is clicked |

Drawing geometry renders in `.PdfHighlighter__highlight-layer`; toolbar/style controls render in `.PdfHighlighter__config-layer`.

#### Example

```tsx
<ImageHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  bounds={highlightBindings.textLayer}
  onChange={(rect) => updatePosition(highlight.id, rect)}
  onEditStart={() => toggleEditInProgress(true)}
  onEditEnd={() => toggleEditInProgress(false)}
/>
```

---

### DrawingHighlight

A draggable, resizable freehand drawing component.

```tsx
import { DrawingHighlight } from "react-pdf-highlighter-plus";
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `highlight` | `ViewportHighlight` | Required | The highlight data (must have `content.image`) |
| `onChange` | `(rect: LTWHP) => void` | - | Called when position/size changes |
| `isScrolledTo` | `boolean` | `false` | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | - | Bounds for dragging |
| `onContextMenu` | `(event: MouseEvent) => void` | - | Right-click handler |
| `onEditStart` | `() => void` | - | Called when drag/resize begins |
| `onEditEnd` | `() => void` | - | Called when drag/resize ends |
| `style` | `CSSProperties` | - | Custom container styling |
| `dragIcon` | `ReactNode` | 6-dot grid | Custom drag handle icon |

#### Example

```tsx
<DrawingHighlight
  highlight={highlight}
  isScrolledTo={isScrolledTo}
  bounds={highlightBindings.textLayer}
  onChange={(rect) => updatePosition(highlight.id, rect)}
  onEditStart={() => toggleEditInProgress(true)}
  onEditEnd={() => toggleEditInProgress(false)}
/>
```

---

### ShapeHighlight

A draggable, resizable rectangle, circle, or arrow annotation.

```tsx
import { ShapeHighlight } from "react-pdf-highlighter-plus";
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `highlight` | `ViewportHighlight` | Required | The highlight data |
| `shapeType` | `"rectangle" \| "circle" \| "arrow"` | `"rectangle"` | Shape type to render |
| `strokeColor` | `string` | `"#000000"` | Stroke color |
| `strokeWidth` | `number` | `2` | Stroke width |
| `startPoint` | `{ x: number; y: number }` | - | Arrow start point as a ratio of bounds |
| `endPoint` | `{ x: number; y: number }` | - | Arrow end point as a ratio of bounds |
| `onChange` | `(rect: LTWHP) => void` | - | Called when position/size changes |
| `onStyleChange` | `(style: ShapeStyle) => void` | - | Called when stroke style changes |
| `onDelete` | `() => void` | - | Called when delete is clicked |

Shape geometry renders in `.PdfHighlighter__highlight-layer`; toolbar/style controls render in `.PdfHighlighter__config-layer`.

---

### SignaturePad

A modal component for drawing signatures.

```tsx
import { SignaturePad } from "react-pdf-highlighter-plus";
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | Required | Whether the modal is visible |
| `onComplete` | `(dataUrl: string) => void` | Required | Called with PNG data URL when done |
| `onClose` | `() => void` | Required | Called when modal is closed |
| `width` | `number` | `400` | Canvas width in pixels |
| `height` | `number` | `200` | Canvas height in pixels |

#### Example

```tsx
<SignaturePad
  isOpen={isOpen}
  onComplete={(dataUrl) => {
    setPendingImage(dataUrl);
    setImageMode(true);
    setIsOpen(false);
  }}
  onClose={() => setIsOpen(false)}
  width={400}
  height={200}
/>
```

---

## Functions

### exportPdf

Export a PDF with annotations embedded.

```tsx
import { exportPdf } from "react-pdf-highlighter-plus";
```

#### Signature

```typescript
async function exportPdf(
  pdfSource: string | Uint8Array | ArrayBuffer,
  highlights: ExportableHighlight[],
  options?: ExportPdfOptions
): Promise<Uint8Array>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pdfSource` | `string \| Uint8Array \| ArrayBuffer` | PDF as URL, bytes, or buffer |
| `highlights` | `ExportableHighlight[]` | Highlights to embed |
| `options` | `ExportPdfOptions` | Export configuration |

#### ExportPdfOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `textHighlightColor` | `string` | `"rgba(255, 226, 143, 0.5)"` | Default text highlight color |
| `areaHighlightColor` | `string` | `"rgba(255, 226, 143, 0.5)"` | Default area highlight color |
| `defaultFreetextColor` | `string` | `"#333333"` | Default freetext text color |
| `defaultFreetextBgColor` | `string` | `"#ffffc8"` | Default freetext background |
| `defaultFreetextFontSize` | `number` | `14` | Default freetext font size |
| `onProgress` | `(current, total) => void` | - | Progress callback |

#### Example

```tsx
const pdfBytes = await exportPdf(pdfUrl, highlights, {
  textHighlightColor: "rgba(255, 226, 143, 0.5)",
  onProgress: (current, total) => console.log(`${current}/${total}`),
});

// Download
const blob = new Blob([pdfBytes], { type: "application/pdf" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "annotated.pdf";
a.click();
URL.revokeObjectURL(url);
```

---

## PdfHighlighter Props

### Theme

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `PdfHighlighterTheme` | Light theme | Theme configuration for light/dark mode |

#### PdfHighlighterTheme

```typescript
interface PdfHighlighterTheme {
  /** Theme mode */
  mode?: "light" | "dark";

  /** Background color of the viewer container */
  containerBackgroundColor?: string;

  /** Scrollbar thumb color */
  scrollbarThumbColor?: string;

  /** Scrollbar track color */
  scrollbarTrackColor?: string;

  /**
   * Dark-mode recolor palette (hue-preserving OKLab). White paper maps to
   * `background`, black text / line-art to `foreground`. Only used in dark mode.
   * @default { background: "#141210", foreground: "#eae6e0" }
   */
  darkModeColors?: { background: string; foreground: string };

  /** @deprecated No longer used — dark mode no longer uses a CSS invert filter. */
  darkModeInvertIntensity?: number;
}
```

#### Default Themes

**Light Theme (default):**
```typescript
{
  mode: "light",
  containerBackgroundColor: "#e5e5e5",
  scrollbarThumbColor: "#9f9f9f",
  scrollbarTrackColor: "#d1d1d1",
}
```

**Dark Theme:**
```typescript
{
  mode: "dark",
  darkModeColors: { background: "#141210", foreground: "#eae6e0" },
  containerBackgroundColor: "#3a3a3a",  // Lighter than the page for contrast
  scrollbarThumbColor: "#6b6b6b",
  scrollbarTrackColor: "#2c2c2c",
}
```

#### Example

```tsx
// Simple dark mode
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{ mode: "dark" }}
/>

// Custom dark palette
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeColors: { background: "#0d1117", foreground: "#e6edf3" },
    containerBackgroundColor: "#2a2a2a",
  }}
/>

// Dynamic theme toggle
const [darkMode, setDarkMode] = useState(false);

<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{ mode: darkMode ? "dark" : "light" }}
/>
```

---

### Freetext-related

| Prop | Type | Description |
|------|------|-------------|
| `enableFreetextCreation` | `(event: MouseEvent) => boolean` | Returns true when freetext mode is active |
| `onFreetextClick` | `(position: ScaledPosition) => void` | Called when user clicks to create freetext |

### Image-related

| Prop | Type | Description |
|------|------|-------------|
| `enableImageCreation` | `(event: MouseEvent) => boolean` | Returns true when image mode is active |
| `onImageClick` | `(position: ScaledPosition) => void` | Called when user clicks to place image |

### Drawing-related

| Prop | Type | Description |
|------|------|-------------|
| `enableDrawingMode` | `boolean` | Whether drawing mode is active |
| `onDrawingComplete` | `(dataUrl: string, position: ScaledPosition, strokes: DrawingStroke[]) => void` | Called when drawing is finished |
| `drawingStrokeColor` | `string` | Drawing stroke color |
| `drawingStrokeWidth` | `number` | Drawing stroke width |

### Shape-related

| Prop | Type | Description |
|------|------|-------------|
| `enableShapeMode` | `"rectangle" \| "circle" \| "arrow" \| null` | Active shape creation mode |
| `onShapeComplete` | `(position: ScaledPosition, shape: ShapeData) => void` | Called when shape creation is finished |
| `shapeStrokeColor` | `string` | Shape stroke color |
| `shapeStrokeWidth` | `number` | Shape stroke width |

### Search utilities

`PdfHighlighterUtils` exposes `search(query, options)`, `findNext()`, `findPrevious()`, and `clearSearch()` using PDF.js `PDFFindController`.

---

## Types

### HighlightType

```typescript
type HighlightType = "text" | "area" | "freetext" | "image" | "drawing" | "shape";
```

### Highlight

```typescript
interface Highlight {
  id: string;
  type?: HighlightType;
  position: ScaledPosition;
  content?: {
    text?: string;
    image?: string;
    strokes?: DrawingStroke[];
    shape?: ShapeData;
  };
}
```

### ExportableHighlight

```typescript
interface ExportableHighlight {
  id: string;
  type?: HighlightType;
  content?: {
    text?: string;
    image?: string;
  };
  position: ScaledPosition;
  highlightColor?: string;      // For text/area
  color?: string;               // For freetext
  backgroundColor?: string;     // For freetext
  fontSize?: string;            // For freetext
  fontFamily?: string;          // For freetext
}
```

### FreetextStyle

```typescript
interface FreetextStyle {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
}
```

### LTWHP

```typescript
interface LTWHP {
  left: number;
  top: number;
  width: number;
  height: number;
  pageNumber: number;
}
```

### ScaledPosition

```typescript
interface ScaledPosition {
  boundingRect: Scaled;
  rects: Array<Scaled>;
  usePdfCoordinates?: boolean;
}
```

### Scaled

```typescript
interface Scaled {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}
```

### ViewportHighlight

```typescript
type ViewportHighlight<T extends Highlight = Highlight> = Omit<T, "position"> & {
  position: ViewportPosition;
};
```

### ViewportPosition

```typescript
interface ViewportPosition {
  boundingRect: LTWHP;
  rects: Array<LTWHP>;
}
```

---

## CSS Classes

### FreetextHighlight

```css
.FreetextHighlight { }
.FreetextHighlight__container { }
.FreetextHighlight__toolbar { }
.FreetextHighlight__drag-handle { }
.FreetextHighlight__edit-button { }
.FreetextHighlight__style-button { }
.FreetextHighlight__style-panel { }
.FreetextHighlight__text { }
.FreetextHighlight__input { }
.FreetextHighlight--scrolledTo { }
.FreetextHighlight--editing { }
```

### ImageHighlight

```css
.ImageHighlight { }
.ImageHighlight__container { }
.ImageHighlight__toolbar { }
.ImageHighlight__drag-handle { }
.ImageHighlight__content { }
.ImageHighlight__image { }
.ImageHighlight--scrolledTo { }
```

### DrawingHighlight

```css
.DrawingHighlight { }
.DrawingHighlight__container { }
.DrawingHighlight__toolbar { }
.DrawingHighlight__drag-handle { }
.DrawingHighlight__content { }
.DrawingHighlight__image { }
.DrawingHighlight--scrolledTo { }
```

### SignaturePad

```css
.SignaturePad__overlay { }
.SignaturePad__modal { }
.SignaturePad__title { }
.SignaturePad__canvas { }
.SignaturePad__buttons { }
.SignaturePad__button { }
.SignaturePad__button--clear { }
.SignaturePad__button--cancel { }
.SignaturePad__button--done { }
```
