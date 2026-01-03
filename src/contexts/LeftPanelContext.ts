import { createContext, useContext } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ProcessedOutlineItem, LeftPanelTab, ThumbnailData } from '../types';

/**
 * Utilities and state available within the LeftPanel context
 */
export interface LeftPanelUtils {
  // Navigation
  currentPage: number;
  totalPages: number;
  goToPage: (pageNumber: number) => void;
  goToOutlineItem: (item: ProcessedOutlineItem) => void;

  // Document info
  pdfDocument: PDFDocumentProxy | null;
  outline: ProcessedOutlineItem[] | null;
  hasOutline: boolean;
  isOutlineLoading: boolean;

  // Thumbnails
  thumbnails: Map<number, ThumbnailData>;
  loadThumbnail: (pageNumber: number) => Promise<void>;

  // Panel state
  activeTab: LeftPanelTab;
  setActiveTab: (tab: LeftPanelTab) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const LeftPanelContext = createContext<LeftPanelUtils | undefined>(
  undefined
);

/**
 * Hook to access LeftPanel context utilities
 *
 * @throws Error if used outside of LeftPanel
 * @returns LeftPanel utilities
 */
export const useLeftPanelContext = (): LeftPanelUtils => {
  const context = useContext(LeftPanelContext);
  if (context === undefined) {
    throw new Error('useLeftPanelContext must be used within LeftPanel');
  }
  return context;
};
