# Unreleased

### Dark mode
- Rewrote dark mode to recolor pages **at render time** with a hue-preserving OKLab map — colors keep their hue and embedded photos keep their pixels (no more CSS `invert()`). Configure via `theme.darkModeColors` (`{ background, foreground }`).
- **Deprecated** `theme.darkModeInvertIntensity` (ignored).
- Highlights, text selection, and the drag-select rectangle stay readable in dark mode (translucent fill + border, `--hl-fill-alpha`).
- `LeftPanel` gained a `mode` prop (`"light" | "dark"`); outline/thumbnail colors follow it.
- Drawing/shape default ink is white in dark mode.
- Scroll position **and** zoom are preserved when toggling the theme.

### Navigation & zoom
- Added `initialPage` and `onPageChange` props for deep-linking (`?page=N`).
- Built-in **pinch / ctrl(⌘)+wheel zoom**, smooth via a GPU transform during the gesture with one crisp re-render on settle; added `onZoomChange`.
- `scrollToHighlight` now scrolls **smoothly** and respects `prefers-reduced-motion`.

### Loading & performance
- `PdfLoader`: progressive range loading (`disableAutoFetch`, `disableStream`, `rangeChunkSize`), auth (`httpHeaders`, `withCredentials`), URL-keyed document cache (`enableCache`), and a skeleton loader.
- Fixed a memory leak: per-page highlight/note React roots are now unmounted on page unload and on viewer unmount.
- Stopped re-rendering all highlight layers on every scroll tick (large annotated docs).

### Text & citations
- Added `getTextPosition(pdfDocument, query)` — locate text and get a precise `ScaledPosition` (whitespace-insensitive + fuzzy fallback). Turn an external quote / AI citation into a highlight you can render or scroll to.

# 8.0.0
- Added safety check to `onProgress` hook in `PdfLoader` to prevent potential races and resets to loading state after a PDF has been loaded in. #1 Thank you @orausch ❤.
- Removed `MouseSelectionRenderer` and moved any necessary logic into `MouseSelection`.
- Removed `TipRenderer` and moved any necessary logic into `TipContainer`.
- Removed `PdfLoaderContext` in favour of callback style child components, much like the original branch.
- Removed `SelectionContext` and `TipContext`, moving all functionality into a new `PdfHighlighterContext`. This streamlines the library massively and makes tasks like getting the current tip, setting a tip, getting the current selection, making a ghost highlight, etc. much simpler and accessible across an entire application.
- Added strict mode to example app for better testing.
- Fixed PDF document stacking by debouncing PDF Loading #2 .
- Removed `Comment` and added generic types to `ViewportHighlight`. This allows the user to create their own Highlight types and typehint them inside their `HighlightContext`.
- Added `highlightTip` to `MonitoredHighlightContainer` directly, so users can simply specify the component they want to display above a hovered highlight.
- Added `onCreateGhostHighlight` and `onRemoveGhostHighlight` events
- Renamed `MonitoredHighlightContainer` events
- Added tip position clipping on the left of the screen.
- Rolled back to PDF.js v2.16.05 for a better selection experience. This may change in future. #3 .
- Added TypeDocs.
- Updated example app.
- Updated usage examples
- Updated dependencies.

*NOTE: This was labelled 7.1.0 originally, but since backward compatibility is broken, the version number is being updated to be semantically corect.*

# 7.0.0

- Exposed pdfScaleValue as a stateful prop
- Made all components functional based
- Updated PDF.js dependency to 3.8.162
- Added onContextMenu event listeners to Highlight components
- Fixed clamping bug / tips not being displayed correctly on ultrawide monitors
- Exposed styling on all componenets
- Added default dark grey background to PdfHighlighter
- Removed generic types for Highlight and added GhostHighlight as a public type.
- Exposed selection color styling and changed default color to blue.
- Replaced callbacks for afterSelection with selectionTip prop and onSelectionFinished events.
- Created `useHighlightUtils`, `useTipContainerUtils`, `useTipViewerUtils`, and `useSelectionUtils` hooks.
- Removed callbacks for rendering highlights in PdfHighlighter and instead replaced it with expecting a user-defined HighlightContainer which will be supplied `useHighlightUtils`
- Expoed `viewer` and `tipViewerUtils` as optionl reference callbacks in the PdfHighlighter. This allows more customisable control of displaying tips or accessing PDF.js settings
- Changed PdfLoader props to accept document parameters inside of `document`. Also added `onProgressParameters` as a variable to `beforeLoad`
- Added option to specify bounds for AreaHighlight, defaulted to the page in the example app.
- Added documentation to almost all components
- **Lots** of refactoring.

# 6.0.0

- Support for React 18 (https://github.com/agentcooper/react-pdf-highlighter/pull/232)
- Fix for `usePdfCoordinates` (https://github.com/agentcooper/react-pdf-highlighter/pull/244)

# 5.3.0

- [Added support of multi-page highlights](https://github.com/agentcooper/react-pdf-highlighter/pull/167), thanks to @jonathanbyrne!

# 3.0.0

- Update PDF.js dependency to 2.2.228.

# 2.1.1

- Enabled hyperlinks inside the PDF document (thanks @steevn).

# 2.0.0

- Renamed `PdfAnnotator` to `PdfHighlighter` all over the code for naming consistency.
