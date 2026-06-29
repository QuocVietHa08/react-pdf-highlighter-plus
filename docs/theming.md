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
  /** Theme mode */
  mode?: "light" | "dark";

  /** Background color of the viewer container */
  containerBackgroundColor?: string;

  /** Scrollbar thumb color */
  scrollbarThumbColor?: string;

  /** Scrollbar track color */
  scrollbarTrackColor?: string;

  /**
   * Dark-mode recolor palette. White paper maps to `background`, black text /
   * line-art to `foreground`. Only used when `mode === "dark"`.
   * @default { background: "#141210", foreground: "#eae6e0" }
   */
  darkModeColors?: { background: string; foreground: string };

  /** @deprecated No longer used — dark mode no longer uses a CSS invert filter. */
  darkModeInvertIntensity?: number;
}
```

### Default Themes

**Light Theme (default):**

| Property | Value | Description |
|----------|-------|-------------|
| `mode` | `"light"` | Document colors as-is |
| `containerBackgroundColor` | `#e5e5e5` | Light gray container |
| `scrollbarThumbColor` | `#9f9f9f` | Medium gray thumb |
| `scrollbarTrackColor` | `#d1d1d1` | Light gray track |

**Dark Theme:**

| Property | Value | Description |
|----------|-------|-------------|
| `mode` | `"dark"` | Recolors pages (OKLab) |
| `darkModeColors.background` | `#141210` | Replaces white paper |
| `darkModeColors.foreground` | `#eae6e0` | Replaces black text / line-art |
| `containerBackgroundColor` | `#3a3a3a` | Dark gray container |
| `scrollbarThumbColor` | `#6b6b6b` | Visible gray thumb |
| `scrollbarTrackColor` | `#2c2c2c` | Dark track |

---

## Dark Mode Palette

`darkModeColors` sets the two ends of the recolor ramp: `background` (where white
paper lands) and `foreground` (where black text lands). Everything in between is
mapped along an OKLab ramp that **preserves hue and chroma**, so colored text and
accents stay recognizable.

```tsx
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeColors: { background: "#0d1117", foreground: "#e6edf3" }, // cool gray
  }}
/>
```

---

## How Dark Mode Works

Dark mode recolors each page **at render time** (not with a CSS filter):

1. **Page recolor**: as PDF.js paints a page, every fill/stroke color is mapped
   through a hue-preserving OKLab map — white → `background`, black → `foreground`,
   colors keep their hue.

2. **Photos preserved**: image draws (`drawImage`) are left untouched, so embedded
   photos don't get inverted/distorted.

3. **Highlights**: render normally over the already-recolored page. Their fill is
   made translucent (`--hl-fill-alpha`) so the light text stays readable, with a
   border for definition — no `mix-blend` wash-out.

4. **Left panel**: pass `mode="dark"` to `LeftPanel` so the outline/thumbnails
   match.

> The previous CSS `invert()` approach (and `darkModeInvertIntensity`) is gone —
> it distorted photos and colored text.

---

## Custom Themes

### Fully Custom Theme

```tsx
<PdfHighlighter
  pdfDocument={pdfDocument}
  theme={{
    mode: "dark",
    darkModeColors: { background: "#141210", foreground: "#eae6e0" },
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
    darkModeColors: { background: "#1c1917", foreground: "#e7e0d6" }, // warm
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
    darkModeColors: { background: "#000000", foreground: "#ffffff" }, // max contrast
    containerBackgroundColor: "#000000",
  }}
/>
```

---

## Container vs PDF Page Colors

In dark mode, it's important to distinguish between:

1. **Container Background**: The area around the PDF pages (controlled by `containerBackgroundColor`)
2. **PDF Page Background**: The recolored PDF content (controlled by `darkModeColors.background`)

The default dark theme uses `#3a3a3a` for the container, which is lighter than the recolored PDF pages (`#141210`), creating clear visual separation.

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
  /* Page-level styling (recolor happens on the canvas) */
}

.PdfHighlighter--dark .PdfHighlighter__highlight-layer {
  /* Highlight layer styling */
}
```

---

## Best Practices

1. **Pick a comfortable `darkModeColors` palette** (warm grays read well for long sessions)
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
              // Optional: customize the dark palette
              darkModeColors: { background: "#141210", foreground: "#eae6e0" },
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
