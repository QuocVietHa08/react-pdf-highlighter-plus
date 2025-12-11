import React, { Edit, Trash2 } from "lucide-react";

export interface ContextMenuProps {
  xPos: number;
  yPos: number;
  editComment: () => void;
  deleteHighlight: () => void;
}

const ContextMenu = ({
  xPos,
  yPos,
  editComment,
  deleteHighlight,
}: ContextMenuProps) => {
  return (
    <div
      className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ top: yPos + 2, left: xPos + 2 }}
    >
      <button
        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={editComment}
      >
        <Edit className="mr-2 h-4 w-4" />
        Edit Comment
      </button>
      <button
        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground"
        onClick={deleteHighlight}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </button>
    </div>
  );
};

export default ContextMenu;
