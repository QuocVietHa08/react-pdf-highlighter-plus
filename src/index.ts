import {
  PdfHighlighter,
  PdfHighlighterProps,
  PdfHighlighterTheme,
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

// Left Panel components
import {
  LeftPanel,
  LeftPanelProps,
  LeftPanelTheme,
  TabStyles,
  TabClassNames,
  FooterStyles,
  FooterClassNames,
  ToggleButtonStyles,
  ToggleButtonClassNames,
} from "./components/leftpanel/LeftPanel";
import {
  DocumentOutline,
  DocumentOutlineProps,
  DocumentOutlineStyles,
  DocumentOutlineClassNames,
} from "./components/leftpanel/DocumentOutline";
import {
  ThumbnailPanel,
  ThumbnailPanelProps,
} from "./components/leftpanel/ThumbnailPanel";
import {
  ThumbnailItem,
  ThumbnailItemProps,
} from "./components/leftpanel/ThumbnailItem";
import {
  OutlineItem,
  OutlineItemProps,
  OutlineItemRenderProps,
  OutlineItemStyles,
  OutlineItemClassNames,
} from "./components/leftpanel/OutlineItem";
import {
  LeftPanelUtils,
  useLeftPanelContext,
} from "./contexts/LeftPanelContext";

// Left Panel hooks
import { useDocumentOutline } from "./hooks/useDocumentOutline";
import { useThumbnails } from "./hooks/useThumbnails";
import { usePageNavigation } from "./hooks/usePageNavigation";

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
  // Left Panel
  LeftPanel,
  DocumentOutline,
  ThumbnailPanel,
  ThumbnailItem,
  OutlineItem,
  useLeftPanelContext,
  useDocumentOutline,
  useThumbnails,
  usePageNavigation,
};

export type {
  HighlightContainerUtils,
  PdfHighlighterUtils,
  PdfHighlighterProps,
  PdfHighlighterTheme,
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
  // Left Panel types
  LeftPanelProps,
  LeftPanelTheme,
  TabStyles,
  TabClassNames,
  FooterStyles,
  FooterClassNames,
  ToggleButtonStyles,
  ToggleButtonClassNames,
  DocumentOutlineProps,
  DocumentOutlineStyles,
  DocumentOutlineClassNames,
  ThumbnailPanelProps,
  ThumbnailItemProps,
  OutlineItemProps,
  OutlineItemRenderProps,
  OutlineItemStyles,
  OutlineItemClassNames,
  LeftPanelUtils,
};
export * from "./types";
