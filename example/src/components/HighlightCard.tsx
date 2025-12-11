import React from "react";
import {
  FileText,
  Square,
  StickyNote,
  Image,
  Pencil,
  MoreVertical,
  MessageSquare,
  Trash2,
  Edit,
} from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { CommentedHighlight } from "../types";
import { HighlightType } from "../react-pdf-highlighter-extended";
import { cn } from "../lib/utils";

interface HighlightCardProps {
  highlight: CommentedHighlight;
  isScrolledTo: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const typeConfig: Record<
  HighlightType,
  { icon: typeof FileText; label: string; color: string }
> = {
  text: {
    icon: FileText,
    label: "Text",
    color: "bg-blue-100 text-blue-700",
  },
  area: {
    icon: Square,
    label: "Area",
    color: "bg-purple-100 text-purple-700",
  },
  freetext: {
    icon: StickyNote,
    label: "Note",
    color: "bg-yellow-100 text-yellow-700",
  },
  image: {
    icon: Image,
    label: "Image",
    color: "bg-green-100 text-green-700",
  },
  drawing: {
    icon: Pencil,
    label: "Drawing",
    color: "bg-orange-100 text-orange-700",
  },
};

export function HighlightCard({
  highlight,
  isScrolledTo,
  onClick,
  onEdit,
  onDelete,
}: HighlightCardProps) {
  const type = highlight.type || "area";
  const config = typeConfig[type];
  const Icon = config.icon;
  const pageNumber = highlight.position.boundingRect.pageNumber;

  // Get preview content
  const textPreview = highlight.content?.text
    ? highlight.content.text.slice(0, 100) +
      (highlight.content.text.length > 100 ? "..." : "")
    : null;
  const imagePreview = highlight.content?.image;

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md",
        isScrolledTo && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onClick}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-md p-1.5", config.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              Page {pageNumber}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Comment
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content preview */}
        {textPreview && (
          <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
            "{textPreview}"
          </p>
        )}

        {imagePreview && type !== "drawing" && (
          <div className="mb-2 overflow-hidden rounded-md border">
            <img
              src={imagePreview}
              alt="Highlight preview"
              className="h-20 w-full object-cover"
            />
          </div>
        )}

        {type === "drawing" && imagePreview && (
          <div className="mb-2 overflow-hidden rounded-md border bg-muted/30">
            <img
              src={imagePreview}
              alt="Drawing preview"
              className="h-16 w-full object-contain"
            />
          </div>
        )}

        {/* Comment */}
        {highlight.comment && (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <p className="line-clamp-2 text-sm">{highlight.comment}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
