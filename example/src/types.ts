import { Highlight, Content } from "./react-pdf-highlighter-extended";

export interface CommentedHighlight extends Highlight {
  content: Content;
  comment?: string;
  // Freetext style properties
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
}
