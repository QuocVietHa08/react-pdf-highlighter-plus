import {
  PdfHighlighter,
  PdfHighlighterProps,
} from "./components/PdfHighlighter";
import {
  TextHighlight,
  TextHighlightProps,
  TextHighlightStyle,
} from "./components/TextHighlight";
import {
  MonitoredHighlightContainer,
  MonitoredHighlightContainerProps,
} from "./components/MonitoredHighlightContainer";
import {
  AreaHighlight,
  AreaHighlightProps,
  AreaHighlightStyle,
} from "./components/AreaHighlight";
import {
  FreetextHighlight,
  FreetextHighlightProps,
  FreetextStyle,
} from "./components/FreetextHighlight";
import {
  ImageHighlight,
  ImageHighlightProps,
} from "./components/ImageHighlight";
import {
  SignaturePad,
  SignaturePadProps,
} from "./components/SignaturePad";
import {
  DrawingCanvas,
  DrawingCanvasProps,
} from "./components/DrawingCanvas";
import {
  DrawingHighlight,
  DrawingHighlightProps,
} from "./components/DrawingHighlight";
import {
  ShapeCanvas,
  ShapeCanvasProps,
} from "./components/ShapeCanvas";
import {
  ShapeHighlight,
  ShapeHighlightProps,
  ShapeStyle,
} from "./components/ShapeHighlight";
import { PdfLoader, PdfLoaderProps } from "./components/PdfLoader";
import {
  HighlightContainerUtils,
  useHighlightContainerContext,
} from "./contexts/HighlightContext";
import {
  viewportPositionToScaled,
  scaledPositionToViewport,
} from "./lib/coordinates";
import {
  exportPdf,
  ExportPdfOptions,
  ExportableHighlight,
} from "./lib/export-pdf";

import {
  PdfHighlighterUtils,
  usePdfHighlighterContext,
} from "./contexts/PdfHighlighterContext";

export {
  PdfHighlighter,
  PdfLoader,
  TextHighlight,
  MonitoredHighlightContainer,
  AreaHighlight,
  FreetextHighlight,
  ImageHighlight,
  SignaturePad,
  DrawingCanvas,
  DrawingHighlight,
  ShapeCanvas,
  ShapeHighlight,
  useHighlightContainerContext,
  viewportPositionToScaled,
  scaledPositionToViewport,
  usePdfHighlighterContext,
  exportPdf,
};

export type {
  HighlightContainerUtils,
  PdfHighlighterUtils,
  PdfHighlighterProps,
  TextHighlightProps,
  TextHighlightStyle,
  MonitoredHighlightContainerProps,
  AreaHighlightProps,
  AreaHighlightStyle,
  FreetextHighlightProps,
  FreetextStyle,
  ImageHighlightProps,
  SignaturePadProps,
  DrawingCanvasProps,
  DrawingHighlightProps,
  ShapeCanvasProps,
  ShapeHighlightProps,
  ShapeStyle,
  PdfLoaderProps,
  ExportPdfOptions,
  ExportableHighlight,
};
export * from "./types";
