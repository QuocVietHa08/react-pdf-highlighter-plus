# Image & Signature Highlights

This document describes the image and signature highlight features, which allow users to add images or hand-drawn signatures to PDF documents.

## Overview

Image highlights (`type: "image"`) enable users to:
- Upload images from their device and place them on a PDF
- Draw signatures using mouse or touch input
- Drag images/signatures to reposition them
- Resize while maintaining aspect ratio

## Quick Start

### 1. Enable Image Mode in PdfHighlighter

```tsx
<PdfHighlighter
  // ... other props
  enableImageCreation={() => imageMode}  // Return true when image mode is active
  onImageClick={handleImageClick}        // Handle click to place image
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

### 2. Handle Image Placement

```tsx
const [imageMode, setImageMode] = useState(false);
const [pendingImageData, setPendingImageData] = useState<string | null>(null);

const handleImageClick = (position: ScaledPosition) => {
  if (pendingImageData) {
    const newHighlight: Highlight = {
      id: generateId(),
      type: "image",
      position,
      content: { image: pendingImageData },
    };
    setHighlights([newHighlight, ...highlights]);
    setPendingImageData(null);
    setImageMode(false);
  }
};
```

### 3. Add Image Upload Handler

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);

const handleAddImage = () => {
  fileInputRef.current?.click();
};

const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPendingImageData(dataUrl);
      setImageMode(true);
    };
    reader.readAsDataURL(file);
  }
  event.target.value = ""; // Reset for re-selection
};

// In JSX:
<input
  type="file"
  ref={fileInputRef}
  style={{ display: "none" }}
  accept="image/*"
  onChange={handleFileSelect}
/>
```

### 4. Add Signature Pad

```tsx
import { SignaturePad } from "react-pdf-highlighter-extended";

const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);

const handleAddSignature = () => {
  setIsSignaturePadOpen(true);
};

const handleSignatureComplete = (dataUrl: string) => {
  setPendingImageData(dataUrl);
  setIsSignaturePadOpen(false);
  setImageMode(true);
};

// In JSX:
<SignaturePad
  isOpen={isSignaturePadOpen}
  onComplete={handleSignatureComplete}
  onClose={() => setIsSignaturePadOpen(false)}
/>
```

### 5. Render ImageHighlight in Your Container

```tsx
import { ImageHighlight, useHighlightContainerContext } from "react-pdf-highlighter-extended";

const HighlightContainer = ({ editHighlight }) => {
  const { highlight, viewportToScaled, isScrolledTo, highlightBindings } = useHighlightContainerContext();
  const { toggleEditInProgress } = usePdfHighlighterContext();

  if (highlight.type === "image") {
    return (
      <ImageHighlight
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

## Component API

### ImageHighlight Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `highlight` | `ViewportHighlight` | Yes | The highlight data to render (must have `content.image`) |
| `onChange` | `(rect: LTWHP) => void` | No | Called when position/size changes |
| `isScrolledTo` | `boolean` | No | Whether highlight was auto-scrolled to |
| `bounds` | `string \| Element` | No | Bounds for dragging (react-rnd) |
| `onContextMenu` | `(event: MouseEvent) => void` | No | Right-click handler |
| `onEditStart` | `() => void` | No | Called when drag/resize begins |
| `onEditEnd` | `() => void` | No | Called when drag/resize ends |
| `style` | `CSSProperties` | No | Custom container styling |
| `dragIcon` | `ReactNode` | No | Custom drag handle icon |

### SignaturePad Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Whether the signature pad modal is visible |
| `onComplete` | `(dataUrl: string) => void` | Yes | Called with PNG data URL when user clicks "Done" |
| `onClose` | `() => void` | Yes | Called when user cancels or closes the modal |
| `width` | `number` | No | Canvas width in pixels (default: 400) |
| `height` | `number` | No | Canvas height in pixels (default: 200) |

### PdfHighlighter Props (Image-related)

| Prop | Type | Description |
|------|------|-------------|
| `enableImageCreation` | `(event: MouseEvent) => boolean` | Returns true when image mode is active |
| `onImageClick` | `(position: ScaledPosition) => void` | Called when user clicks to place image |

## Styling

### ImageHighlight CSS Classes

```css
.ImageHighlight { }                    /* Container */
.ImageHighlight__container { }         /* Inner wrapper */
.ImageHighlight__toolbar { }           /* Toolbar with drag handle (hidden by default) */
.ImageHighlight__drag-handle { }       /* Drag handle icon */
.ImageHighlight__content { }           /* Image container */
.ImageHighlight__image { }             /* The actual image element */
.ImageHighlight--scrolledTo { }        /* When auto-scrolled to */
```

### Default Behavior

- **Drag handle appears on hover**: The toolbar with the drag icon is hidden by default and fades in when you hover over the image
- **Aspect ratio locked**: Resizing maintains the original aspect ratio
- **Minimum size**: 50x50 pixels

### SignaturePad CSS Classes

```css
.SignaturePad__overlay { }             /* Modal overlay background */
.SignaturePad__modal { }               /* Modal container */
.SignaturePad__title { }               /* "Draw your signature" title */
.SignaturePad__canvas { }              /* Drawing canvas */
.SignaturePad__buttons { }             /* Button container */
.SignaturePad__button { }              /* All buttons */
.SignaturePad__button--clear { }       /* Clear button */
.SignaturePad__button--cancel { }      /* Cancel button */
.SignaturePad__button--done { }        /* Done button */
```

## Complete Example

```tsx
import React, { useState, useRef } from "react";
import {
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  ImageHighlight,
  SignaturePad,
  TextHighlight,
  AreaHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
  ScaledPosition,
  Highlight,
} from "react-pdf-highlighter-extended";

const App = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const highlighterUtilsRef = useRef<PdfHighlighterUtils>();

  const handleImageClick = (position: ScaledPosition) => {
    if (pendingImageData) {
      const newHighlight: Highlight = {
        id: String(Math.random()).slice(2),
        type: "image",
        position,
        content: { image: pendingImageData },
      };
      setHighlights([newHighlight, ...highlights]);
      setPendingImageData(null);
      setImageMode(false);
    }
  };

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPendingImageData(e.target?.result as string);
        setImageMode(true);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = "";
  };

  const handleAddSignature = () => {
    setIsSignaturePadOpen(true);
  };

  const handleSignatureComplete = (dataUrl: string) => {
    setPendingImageData(dataUrl);
    setIsSignaturePadOpen(false);
    setImageMode(true);
  };

  const editHighlight = (id: string, edit: Partial<Highlight>) => {
    setHighlights(
      highlights.map((h) => (h.id === id ? { ...h, ...edit } : h))
    );
  };

  return (
    <div>
      <button onClick={handleAddImage}>Add Image</button>
      <button onClick={handleAddSignature}>Add Signature</button>

      <PdfLoader document="https://example.com/document.pdf">
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            highlights={highlights}
            utilsRef={(utils) => (highlighterUtilsRef.current = utils)}
            enableImageCreation={() => imageMode}
            onImageClick={handleImageClick}
          >
            <HighlightContainer editHighlight={editHighlight} />
          </PdfHighlighter>
        )}
      </PdfLoader>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileSelect}
      />

      <SignaturePad
        isOpen={isSignaturePadOpen}
        onComplete={handleSignatureComplete}
        onClose={() => setIsSignaturePadOpen(false)}
      />
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

  if (highlight.type === "image") {
    return (
      <ImageHighlight
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

## User Interaction

### Adding an Image
1. Click "Add Image" button
2. Select an image file from your device
3. Cursor changes to crosshair
4. Click on the PDF where you want to place the image
5. Image appears at the clicked position

### Adding a Signature
1. Click "Add Signature" button
2. Signature pad modal opens
3. Draw your signature using mouse or touch
4. Click "Clear" to start over, "Cancel" to close, or "Done" to save
5. Cursor changes to crosshair
6. Click on the PDF where you want to place the signature
7. Signature appears at the clicked position

### Moving an Image/Signature
1. Hover over the image to reveal the drag handle
2. Click and drag the handle icon (6-dot grid)
3. Release to save new position

### Resizing an Image/Signature
1. Hover over the image corners/edges
2. Drag to resize (aspect ratio is maintained)
3. Release to save new size

## Data Structure

Image highlights use the standard `Highlight` interface with `type: "image"`:

```typescript
interface Highlight {
  id: string;
  type: "image";
  position: ScaledPosition;
  content?: {
    image?: string;  // Base64 data URL (PNG)
  };
}
```

The `content.image` field contains a base64-encoded data URL of the image or signature.
