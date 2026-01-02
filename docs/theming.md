# Theming

The `PdfHighlighter` component supports light and dark themes with customizable styling for comfortable PDF reading.

---

## Quick Start

### Enable Dark Mode

```tsx
import { PdfHighlighter } from "react-pdf-highlighter-plus";

<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{ mode: "dark" }}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>
```

### Toggle Between Themes

```tsx
const [darkMode, setDarkMode] = useState(false);

<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{ mode: darkMode ? "dark" : "light" }}
  highlights={highlights}
>
  <HighlightContainer />
</PdfHighlighter>

<button onClick={() => setDarkMode(!darkMode)}>
  {darkMode ? "Light Mode" : "Dark Mode"}
</button>
```

---

## Theme Configuration

### PdfHighlighterTheme Interface

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
   * Lower values create softer dark backgrounds.
   * @default 0.9
   */
  darkModeInvertIntensity?: number;
}
```

### Default Themes

**Light Theme (default):**

| Property | Value | Description |
|----------|-------|-------------|
| `mode` | `"light"` | No PDF inversion |
| `containerBackgroundColor` | `#e0e0e0` | Light gray container |
| `scrollbarThumbColor` | `#9f9f9f` | Medium gray thumb |
| `scrollbarTrackColor` | `#cccccc` | Light gray track |
| `darkModeInvertIntensity` | `0.9` | Not used in light mode |

**Dark Theme:**

| Property | Value | Description |
|----------|-------|-------------|
| `mode` | `"dark"` | Inverts PDF pages |
| `containerBackgroundColor` | `#3a3a3a` | Dark gray container |
| `scrollbarThumbColor` | `#6b6b6b` | Visible gray thumb |
| `scrollbarTrackColor` | `#2c2c2c` | Dark track |
| `darkModeInvertIntensity` | `0.9` | Soft inversion |

---

## Dark Mode Inversion Intensity

The `darkModeInvertIntensity` property controls how dark the PDF pages appear in dark mode. Lower values create softer backgrounds that are easier on the eyes during extended reading.

### Intensity Guide

| Value | Result | Use Case |
|-------|--------|----------|
| `1.0` | Pure black (`#000000`) | Maximum contrast (harsh) |
| `0.9` | Dark gray (`~#1a1a1a`) | **Recommended default** |
| `0.85` | Softer gray (`~#262626`) | Long reading sessions |
| `0.8` | Medium gray (`~#333333`) | Maximum comfort |

### Visual Comparison

```
invert(1.0):   ████████████████  Pure black - harsh on eyes
invert(0.9):   ░░████████████░░  Dark gray - recommended
invert(0.85):  ░░░░████████░░░░  Softer gray - comfortable
invert(0.8):   ░░░░░░████░░░░░░  Medium gray - very soft
```

### Example: Custom Intensity

```tsx
// Very comfortable for night reading
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeInvertIntensity: 0.85,
  }}
/>
```

---

## How Dark Mode Works

Dark mode uses CSS filters to invert PDF page colors:

1. **Page Inversion**: PDF pages are inverted using `filter: invert() hue-rotate(180deg)`, turning white backgrounds dark and dark text light.

2. **Highlight Preservation**: Highlights are double-inverted to preserve their original colors, so a yellow highlight stays yellow in dark mode.

3. **Brightness Adjustment**: A subtle brightness adjustment ensures text remains readable.

### CSS Applied

```css
/* Dark mode page inversion */
.PdfHighlighter--dark .page {
  filter: invert(0.9) hue-rotate(180deg) brightness(1.05);
}

/* Double-invert highlights to preserve colors */
.PdfHighlighter--dark .PdfHighlighter__highlight-layer {
  filter: invert(0.9) hue-rotate(180deg) brightness(0.95);
}
```

---

## Custom Themes

### Fully Custom Theme

```tsx
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeInvertIntensity: 0.85,
    containerBackgroundColor: "#2d2d2d",
    scrollbarThumbColor: "#555555",
    scrollbarTrackColor: "#1a1a1a",
  }}
/>
```

### Sepia-like Warm Dark Mode

```tsx
// Warm tinted dark mode for night reading
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeInvertIntensity: 0.85,
    containerBackgroundColor: "#1c1917",  // Warm brown-tinted dark
  }}
/>
```

### High Contrast Dark Mode

```tsx
// Maximum contrast for accessibility
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeInvertIntensity: 1.0,  // Pure black
    containerBackgroundColor: "#000000",
  }}
/>
```

---

## Container vs PDF Page Colors

In dark mode, it's important to distinguish between:

1. **Container Background**: The area around the PDF pages (controlled by `containerBackgroundColor`)
2. **PDF Page Background**: The inverted PDF content (controlled by `darkModeInvertIntensity`)

The default dark theme uses `#3a3a3a` for the container, which is lighter than the inverted PDF pages (`~#1a1a1a`), creating clear visual separation.

```
┌─────────────────────────────────────┐
│  Container (#3a3a3a - lighter)      │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  PDF Page (~#1a1a1a - darker) │  │
│  │                               │  │
│  │  Light text on dark bg        │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

## CSS Classes

The following CSS classes are applied based on theme mode:

| Class | Applied When |
|-------|--------------|
| `.PdfHighlighter--dark` | Dark mode is enabled |
| `.PdfHighlighter--light` | Light mode is enabled (or no theme specified) |

### Custom CSS Overrides

```css
/* Custom dark mode styling */
.PdfHighlighter--dark {
  /* Container styles */
}

.PdfHighlighter--dark .page {
  /* Override PDF page inversion */
}

.PdfHighlighter--dark .PdfHighlighter__highlight-layer {
  /* Override highlight inversion */
}
```

---

## Best Practices

1. **Use `0.9` intensity** for most users - balances readability and comfort
2. **Match container color** to your app's dark theme for visual consistency
3. **Test highlight colors** in dark mode to ensure they remain visible
4. **Consider user preference** - store theme choice in localStorage or user settings
5. **Provide a toggle** - let users switch between light and dark modes easily

---

## Example: Complete Implementation

```tsx
import { useState, useEffect } from "react";
import { PdfLoader, PdfHighlighter } from "react-pdf-highlighter-plus";

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Load preference from localStorage
    return localStorage.getItem("pdfDarkMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("pdfDarkMode", String(darkMode));
  }, [darkMode]);

  return (
    <div className={darkMode ? "app-dark" : "app-light"}>
      <header>
        <button onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      <PdfLoader document="document.pdf">
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            theme={{
              mode: darkMode ? "dark" : "light",
              // Optional: customize intensity for user comfort
              darkModeInvertIntensity: 0.9,
            }}
            highlights={highlights}
          >
            <HighlightContainer />
          </PdfHighlighter>
        )}
      </PdfLoader>
    </div>
  );
}
```
