# API Reference

Complete reference for all components, functions, and types in react-pdf-highlighter-extended.

---

## Components

### FreetextHighlight

A draggable, editable text annotation component.

```tsx
import { FreetextHighlight } from "react-pdf-highlighter-extended";
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
import { ImageHighlight } from "react-pdf-highlighter-extended";
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
import { DrawingHighlight } from "react-pdf-highlighter-extended";
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

### SignaturePad

A modal component for drawing signatures.

```tsx
import { SignaturePad } from "react-pdf-highlighter-extended";
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
import { exportPdf } from "react-pdf-highlighter-extended";
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
  /** Theme mode - controls PDF page color inversion */
  mode?: "light" | "dark";

  /** Background color of the viewer container */
  containerBackgroundColor?: string;

  /** Scrollbar thumb color */
  scrollbarThumbColor?: string;

  /** Scrollbar track color */
  scrollbarTrackColor?: string;

  /**
   * Inversion intensity for dark mode (0-1).
   * Lower values create softer dark backgrounds that are easier on the eyes.
   * - 1.0 = Pure black background (harsh)
   * - 0.9 = Dark gray ~#1a1a1a (recommended)
   * - 0.85 = Softer gray ~#262626 (very comfortable)
   * - 0.8 = Medium gray ~#333333 (maximum softness)
   * @default 0.9
   */
  darkModeInvertIntensity?: number;
}
```

#### Default Themes

**Light Theme (default):**
```typescript
{
  mode: "light",
  containerBackgroundColor: "#e0e0e0",
  scrollbarThumbColor: "#9f9f9f",
  scrollbarTrackColor: "#cccccc",
  darkModeInvertIntensity: 0.9,
}
```

**Dark Theme:**
```typescript
{
  mode: "dark",
  containerBackgroundColor: "#3a3a3a",  // Lighter than PDF (~#1a1a1a) for contrast
  scrollbarThumbColor: "#6b6b6b",
  scrollbarTrackColor: "#2c2c2c",
  darkModeInvertIntensity: 0.9,
}
```

#### Example

```tsx
// Simple dark mode
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{ mode: "dark" }}
/>

// Custom theme with softer inversion
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeInvertIntensity: 0.85,
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
| `enableDrawingCreation` | `(event: MouseEvent) => boolean` | Returns true when drawing mode is active |
| `onDrawingComplete` | `(position: ScaledPosition, dataUrl: string) => void` | Called when drawing is finished |
| `drawingConfig` | `DrawingConfig` | Stroke color and width settings |

#### DrawingConfig

```typescript
interface DrawingConfig {
  strokeColor?: string;  // Default: "#000000"
  strokeWidth?: number;  // Default: 2
}
```

---

## Types

### HighlightType

```typescript
type HighlightType = "text" | "area" | "freetext" | "image" | "drawing";
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
