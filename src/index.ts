import {
  PdfHighlighter,
  PdfHighlighterProps,
} from "./components/PdfHighlighter";
import { TextHighlight, TextHighlightProps } from "./components/TextHighlight";
import {
  MonitoredHighlightContainer,
  MonitoredHighlightContainerProps,
} from "./components/MonitoredHighlightContainer";
import { AreaHighlight, AreaHighlightProps } from "./components/AreaHighlight";
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
  MonitoredHighlightContainerProps,
  AreaHighlightProps,
  FreetextHighlightProps,
  FreetextStyle,
  ImageHighlightProps,
  SignaturePadProps,
  DrawingCanvasProps,
  DrawingHighlightProps,
  PdfLoaderProps,
  ExportPdfOptions,
  ExportableHighlight,
};
export * from "./types";
