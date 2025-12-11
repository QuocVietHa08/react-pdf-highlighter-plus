import React, { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

interface PageGroupProps {
  pageNumber: number;
  highlightCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PageGroup({
  pageNumber,
  highlightCount,
  children,
  defaultOpen = true,
}: PageGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              !isOpen && "-rotate-90"
            )}
          />
          <span>Page {pageNumber}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {highlightCount}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 py-2 pl-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
