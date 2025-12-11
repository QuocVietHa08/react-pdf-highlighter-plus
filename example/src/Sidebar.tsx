import React, { useMemo, useState } from "react";
import type { Highlight, HighlightType } from "./react-pdf-highlighter-extended";
import { CommentedHighlight } from "./types";
import { HighlightFilters, SortOption } from "./components/HighlightFilters";
import { HighlightCard } from "./components/HighlightCard";
import { PageGroup } from "./components/PageGroup";
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import { FileText, RefreshCw, ArrowLeftRight } from "lucide-react";
import { cn } from "./lib/utils";

interface SidebarProps {
  highlights: Array<CommentedHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
  scrolledToHighlightId: string | null;
  onEditHighlight: (highlight: CommentedHighlight) => void;
  onDeleteHighlight: (highlight: CommentedHighlight) => void;
  isOpen: boolean;
}

const updateHash = (highlight: Highlight) => {
  document.location.hash = `highlight-${highlight.id}`;
};

declare const APP_VERSION: string;

const Sidebar = ({
  highlights,
  toggleDocument,
  resetHighlights,
  scrolledToHighlightId,
  onEditHighlight,
  onDeleteHighlight,
  isOpen,
}: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<HighlightType[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("page");

  // Filter and sort highlights
  const filteredHighlights = useMemo(() => {
    let result = [...highlights];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.content?.text?.toLowerCase().includes(query) ||
          h.comment?.toLowerCase().includes(query)
      );
    }

    // Apply type filters
    if (activeFilters.length > 0) {
      result = result.filter((h) => {
        const type = h.type || "area";
        return activeFilters.includes(type);
      });
    }

    // Apply sorting
    switch (sortBy) {
      case "page":
        result.sort(
          (a, b) =>
            a.position.boundingRect.pageNumber -
            b.position.boundingRect.pageNumber
        );
        break;
      case "newest":
        // Reverse order (assuming highlights are added in order)
        result.reverse();
        break;
      case "type":
        result.sort((a, b) => {
          const typeA = a.type || "area";
          const typeB = b.type || "area";
          return typeA.localeCompare(typeB);
        });
        break;
    }

    return result;
  }, [highlights, searchQuery, activeFilters, sortBy]);

  // Group highlights by page
  const highlightsByPage = useMemo(() => {
    const groups: Record<number, CommentedHighlight[]> = {};
    filteredHighlights.forEach((highlight) => {
      const page = highlight.position.boundingRect.pageNumber;
      if (!groups[page]) {
        groups[page] = [];
      }
      groups[page].push(highlight);
    });
    return groups;
  }, [filteredHighlights]);

  const pageNumbers = Object.keys(highlightsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-background transition-all duration-300",
        isOpen ? "w-80" : "w-0 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Highlights</h2>
            <p className="text-xs text-muted-foreground">
              {highlights.length} annotation{highlights.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 border-b p-4">
        <HighlightFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      {/* Highlights list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {pageNumbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-2 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {highlights.length === 0
                  ? "No highlights yet"
                  : "No matching highlights"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {highlights.length === 0
                  ? "Select text or hold Alt to create area highlights"
                  : "Try adjusting your filters"}
              </p>
            </div>
          ) : sortBy === "page" ? (
            // Grouped by page view
            pageNumbers.map((pageNumber) => (
              <PageGroup
                key={pageNumber}
                pageNumber={pageNumber}
                highlightCount={highlightsByPage[pageNumber].length}
              >
                {highlightsByPage[pageNumber].map((highlight) => (
                  <HighlightCard
                    key={highlight.id}
                    highlight={highlight}
                    isScrolledTo={scrolledToHighlightId === highlight.id}
                    onClick={() => updateHash(highlight)}
                    onEdit={() => onEditHighlight(highlight)}
                    onDelete={() => onDeleteHighlight(highlight)}
                  />
                ))}
              </PageGroup>
            ))
          ) : (
            // Flat list view
            <div className="space-y-2 p-2">
              {filteredHighlights.map((highlight) => (
                <HighlightCard
                  key={highlight.id}
                  highlight={highlight}
                  isScrolledTo={scrolledToHighlightId === highlight.id}
                  onClick={() => updateHash(highlight)}
                  onEdit={() => onEditHighlight(highlight)}
                  onDelete={() => onDeleteHighlight(highlight)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t p-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={toggleDocument}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Switch PDF
          </Button>
          {highlights.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={resetHighlights}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
