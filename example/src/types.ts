import { Highlight, Content } from "./react-pdf-highlighter-extended";

export interface CommentedHighlight extends Highlight {
  content: Content;
  comment?: string;
  // Freetext style properties
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  // Text/Area highlight style properties
  highlightColor?: string;
  highlightStyle?: "highlight" | "underline" | "strikethrough";
  // Shape highlight style properties
  shapeType?: "rectangle" | "circle" | "arrow";
  strokeColor?: string;
  strokeWidth?: number;
}
