import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { List, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { LeftPanelContext, LeftPanelUtils } from '../../contexts/LeftPanelContext';
import { useDocumentOutline } from '../../hooks/useDocumentOutline';
import { useThumbnails } from '../../hooks/useThumbnails';
import { usePageNavigation } from '../../hooks/usePageNavigation';
import { DocumentOutline, DocumentOutlineStyles, DocumentOutlineClassNames } from './DocumentOutline';
import { ThumbnailPanel } from './ThumbnailPanel';
import type { LeftPanelTab, ProcessedOutlineItem, ThumbnailData } from '../../types';
import { OutlineItemRenderProps, OutlineItemStyles, OutlineItemClassNames } from './OutlineItem';

interface PDFViewer {
  scrollPageIntoView: (params: { pageNumber: number }) => void;
  pagesCount: number;
  currentPageNumber?: number;
}

interface PDFLinkService {
  goToDestination: (dest: unknown) => void;
}

interface EventBus {
  on: (event: string, callback: (evt: { pageNumber: number }) => void) => void;
  off: (event: string, callback: (evt: { pageNumber: number }) => void) => void;
}

/** Theme configuration for LeftPanel styling */
export interface LeftPanelTheme {
  /** Background color of the panel */
  backgroundColor?: string;
  /** Border color */
  borderColor?: string;
  /** Active tab/item accent color */
  accentColor?: string;
  /** Text color */
  textColor?: string;
  /** Muted text color */
  mutedTextColor?: string;
  /** Hover background color */
  hoverBackgroundColor?: string;
}

/** Style configuration for tab buttons */
export interface TabStyles {
  /** Container styles for the tab bar */
  container?: React.CSSProperties;
  /** Tab button styles */
  tab?: React.CSSProperties;
  /** Tab button styles when active */
  tabActive?: React.CSSProperties;
  /** Tab icon styles */
  tabIcon?: React.CSSProperties;
  /** Tab text styles */
  tabText?: React.CSSProperties;
}

/** Class name configuration for tab buttons (Tailwind-friendly) */
export interface TabClassNames {
  /** Container class for the tab bar */
  container?: string;
  /** Tab button class */
  tab?: string;
  /** Tab button class when active */
  tabActive?: string;
  /** Tab icon class */
  tabIcon?: string;
  /** Tab text class */
  tabText?: string;
}

/** Style configuration for the footer */
export interface FooterStyles {
  /** Footer container styles */
  container?: React.CSSProperties;
  /** Footer text styles */
  text?: React.CSSProperties;
}

/** Class name configuration for the footer (Tailwind-friendly) */
export interface FooterClassNames {
  /** Footer container class */
  container?: string;
  /** Footer text class */
  text?: string;
}

/** Style configuration for the toggle button */
export interface ToggleButtonStyles {
  /** Button container styles */
  button?: React.CSSProperties;
  /** Button icon styles */
  icon?: React.CSSProperties;
}

/** Class name configuration for the toggle button (Tailwind-friendly) */
export interface ToggleButtonClassNames {
  /** Button container class */
  button?: string;
  /** Button icon class */
  icon?: string;
}

const defaultTheme: LeftPanelTheme = {
  backgroundColor: '#ffffff',
  borderColor: '#e5e7eb',
  accentColor: '#3b82f6',
  textColor: '#374151',
  mutedTextColor: '#6b7280',
  hoverBackgroundColor: '#f9fafb',
};

export interface LeftPanelProps {
  /** PDF document from PdfLoader */
  pdfDocument: PDFDocumentProxy;
  /** PDF viewer instance */
  viewer?: PDFViewer | unknown | null;
  /** PDF link service for navigation */
  linkService?: PDFLinkService | unknown | null;
  /** Event bus for page change events */
  eventBus?: EventBus | unknown | null;
  /** Function to navigate to a page (from pdfHighlighterUtils.goToPage) */
  goToPage?: (pageNumber: number) => void;
  /** Whether panel is open */
  isOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (isOpen: boolean) => void;
  /** Initial active tab */
  defaultTab?: LeftPanelTab;
  /** Which tabs to show */
  tabs?: LeftPanelTab[];
  /** Panel width when open */
  width?: number | string;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Custom outline item renderer */
  renderOutlineItem?: (
    item: ProcessedOutlineItem,
    props: OutlineItemRenderProps
  ) => React.ReactNode;
  /** Custom thumbnail renderer */
  renderThumbnail?: (
    pageNumber: number,
    thumbnail: ThumbnailData,
    isActive: boolean
  ) => React.ReactNode;
  /** Callback when page is selected */
  onPageSelect?: (pageNumber: number) => void;
  /** Thumbnail width */
  thumbnailWidth?: number;
  /** Children for custom content */
  children?: React.ReactNode;
  /** Theme customization */
  theme?: LeftPanelTheme;
  /** Show page count in footer */
  showFooter?: boolean;
  /** Show toggle button */
  showToggleButton?: boolean;
  /** Custom styles for tabs */
  tabStyles?: TabStyles;
  /** Custom class names for tabs (Tailwind-friendly) */
  tabClassNames?: TabClassNames;
  /** Custom styles for footer */
  footerStyles?: FooterStyles;
  /** Custom class names for footer (Tailwind-friendly) */
  footerClassNames?: FooterClassNames;
  /** Custom styles for toggle button */
  toggleButtonStyles?: ToggleButtonStyles;
  /** Custom class names for toggle button (Tailwind-friendly) */
  toggleButtonClassNames?: ToggleButtonClassNames;
  /** Custom styles for document outline */
  outlineStyles?: DocumentOutlineStyles;
  /** Custom class names for document outline (Tailwind-friendly) */
  outlineClassNames?: DocumentOutlineClassNames;
  /** Custom styles for outline items */
  outlineItemStyles?: OutlineItemStyles;
  /** Custom class names for outline items (Tailwind-friendly) */
  outlineItemClassNames?: OutlineItemClassNames;
}

/**
 * Left panel component with Outline and Thumbnails tabs.
 * Provides a customizable sidebar for PDF navigation with page thumbnails and document outline.
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  pdfDocument,
  viewer = null,
  linkService = null,
  eventBus = null,
  goToPage: goToPageProp,
  isOpen: controlledIsOpen,
  onOpenChange,
  defaultTab = 'thumbnails',
  tabs = ['outline', 'thumbnails'],
  width = 260,
  className = '',
  style,
  renderOutlineItem,
  renderThumbnail,
  onPageSelect,
  thumbnailWidth = 180,
  children,
  theme: userTheme,
  showFooter = true,
  showToggleButton = true,
  tabStyles,
  tabClassNames,
  footerStyles,
  footerClassNames,
  toggleButtonStyles,
  toggleButtonClassNames,
  outlineStyles,
  outlineClassNames,
  outlineItemStyles,
  outlineItemClassNames,
}) => {
  // Merge user theme with defaults
  const theme = useMemo(() => ({ ...defaultTheme, ...userTheme }), [userTheme]);
  // Internal state for uncontrolled mode
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<LeftPanelTab>(defaultTab);

  // Use controlled or uncontrolled open state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (onOpenChange) {
        onOpenChange(open);
      } else {
        setInternalIsOpen(open);
      }
    },
    [onOpenChange]
  );

  // Initialize hooks - order matters: usePageNavigation before useDocumentOutline
  const { thumbnails, loadThumbnail, totalPages } = useThumbnails({
    pdfDocument,
    thumbnailWidth,
  });

  const { currentPage, goToPage: goToPageFromHook } = usePageNavigation({
    viewer,
    eventBus,
  });

  // Use ref to always get the latest goToPage function
  const goToPagePropRef = useRef(goToPageProp);

  // Sync ref with useEffect to ensure it's updated after render
  useEffect(() => {
    goToPagePropRef.current = goToPageProp;
  }, [goToPageProp]);

  // Handle page selection - use ref to always get latest goToPage
  const handlePageSelect = useCallback(
    (pageNumber: number) => {
      // Prefer the prop (from pdfHighlighterUtils) if available
      if (goToPagePropRef.current) {
        goToPagePropRef.current(pageNumber);
      } else {
        goToPageFromHook(pageNumber);
      }
      onPageSelect?.(pageNumber);
    },
    [goToPageFromHook, onPageSelect]
  );

  const {
    outline,
    isLoading: isOutlineLoading,
    hasOutline,
    navigateToItem,
  } = useDocumentOutline({
    pdfDocument,
    goToPage: handlePageSelect,
  });

  // Handle outline item navigation
  const handleOutlineNavigate = useCallback(
    (item: ProcessedOutlineItem) => {
      navigateToItem(item);
      onPageSelect?.(item.pageNumber);
    },
    [navigateToItem, onPageSelect]
  );

  // Context value
  const contextValue: LeftPanelUtils = useMemo(
    () => ({
      currentPage,
      totalPages,
      goToPage: handlePageSelect,
      goToOutlineItem: handleOutlineNavigate,
      pdfDocument,
      outline,
      hasOutline,
      isOutlineLoading,
      thumbnails,
      loadThumbnail,
      activeTab,
      setActiveTab,
      isOpen,
      setIsOpen,
    }),
    [
      currentPage,
      totalPages,
      handlePageSelect,
      handleOutlineNavigate,
      pdfDocument,
      outline,
      hasOutline,
      isOutlineLoading,
      thumbnails,
      loadThumbnail,
      activeTab,
      isOpen,
      setIsOpen,
    ]
  );

  const panelWidth = typeof width === 'number' ? `${width}px` : width;

  // CSS custom properties for theming
  const cssVars = {
    '--lp-bg': theme.backgroundColor,
    '--lp-border': theme.borderColor,
    '--lp-accent': theme.accentColor,
    '--lp-text': theme.textColor,
    '--lp-muted': theme.mutedTextColor,
    '--lp-hover': theme.hoverBackgroundColor,
  } as React.CSSProperties;

  return (
    <LeftPanelContext.Provider value={contextValue}>
      {/* Toggle button - placed outside panel for visibility when closed */}
      {showToggleButton && (
        <button
          className={toggleButtonClassNames?.button}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: isOpen ? `calc(${panelWidth} - 1px)` : '0',
            zIndex: 20,
            width: '24px',
            height: '48px',
            backgroundColor: theme.backgroundColor,
            border: `1px solid ${theme.borderColor}`,
            borderLeft: 'none',
            borderRadius: '0 6px 6px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
            transition: 'left 0.2s ease-in-out, background-color 0.15s ease',
            ...toggleButtonStyles?.button,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.hoverBackgroundColor || '#f9fafb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.backgroundColor || '#ffffff';
          }}
          aria-label={isOpen ? 'Close panel' : 'Open panel'}
        >
          {isOpen ? (
            <ChevronLeft className={toggleButtonClassNames?.icon} style={{ width: 14, height: 14, color: theme.mutedTextColor, ...toggleButtonStyles?.icon }} />
          ) : (
            <ChevronRight className={toggleButtonClassNames?.icon} style={{ width: 14, height: 14, color: theme.mutedTextColor, ...toggleButtonStyles?.icon }} />
          )}
        </button>
      )}

      <div
        className={`left-panel ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: theme.backgroundColor,
          borderRight: `1px solid ${theme.borderColor}`,
          transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
          position: 'relative',
          width: isOpen ? panelWidth : '0px',
          minWidth: isOpen ? panelWidth : '0px',
          overflow: 'hidden',
          ...cssVars,
          ...style,
        }}
      >

        {/* Panel content wrapper */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            width: panelWidth,
            minWidth: panelWidth,
          }}
        >
          {/* Tab headers */}
          {tabs.length > 1 && (
            <div
              className={tabClassNames?.container}
              style={{
                display: 'flex',
                borderBottom: `1px solid ${theme.borderColor}`,
                flexShrink: 0,
                ...tabStyles?.container,
              }}
            >
              {tabs.includes('outline') && (
                <button
                  className={[tabClassNames?.tab, activeTab === 'outline' ? tabClassNames?.tabActive : ''].filter(Boolean).join(' ') || undefined}
                  onClick={() => setActiveTab('outline')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: activeTab === 'outline' ? theme.accentColor : theme.mutedTextColor,
                    backgroundColor: activeTab === 'outline' ? `${theme.accentColor}08` : 'transparent',
                    borderBottom: activeTab === 'outline' ? `2px solid ${theme.accentColor}` : '2px solid transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    ...tabStyles?.tab,
                    ...(activeTab === 'outline' ? tabStyles?.tabActive : {}),
                  }}
                >
                  <FileText className={tabClassNames?.tabIcon} style={{ width: 15, height: 15, ...tabStyles?.tabIcon }} />
                  <span className={tabClassNames?.tabText} style={tabStyles?.tabText}>Outline</span>
                </button>
              )}
              {tabs.includes('thumbnails') && (
                <button
                  className={[tabClassNames?.tab, activeTab === 'thumbnails' ? tabClassNames?.tabActive : ''].filter(Boolean).join(' ') || undefined}
                  onClick={() => setActiveTab('thumbnails')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: activeTab === 'thumbnails' ? theme.accentColor : theme.mutedTextColor,
                    backgroundColor: activeTab === 'thumbnails' ? `${theme.accentColor}08` : 'transparent',
                    borderBottom: activeTab === 'thumbnails' ? `2px solid ${theme.accentColor}` : '2px solid transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    ...tabStyles?.tab,
                    ...(activeTab === 'thumbnails' ? tabStyles?.tabActive : {}),
                  }}
                >
                  <List className={tabClassNames?.tabIcon} style={{ width: 15, height: 15, ...tabStyles?.tabIcon }} />
                  <span className={tabClassNames?.tabText} style={tabStyles?.tabText}>Pages</span>
                </button>
              )}
            </div>
          )}

          {/* Single tab header */}
          {tabs.length === 1 && (
            <div
              className={tabClassNames?.container}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderBottom: `1px solid ${theme.borderColor}`,
                flexShrink: 0,
                ...tabStyles?.container,
              }}
            >
              {tabs[0] === 'outline' ? (
                <>
                  <FileText className={tabClassNames?.tabIcon} style={{ width: 15, height: 15, color: theme.mutedTextColor, ...tabStyles?.tabIcon }} />
                  <span className={tabClassNames?.tabText} style={{ fontSize: '13px', fontWeight: 500, color: theme.textColor, ...tabStyles?.tabText }}>Outline</span>
                </>
              ) : (
                <>
                  <List className={tabClassNames?.tabIcon} style={{ width: 15, height: 15, color: theme.mutedTextColor, ...tabStyles?.tabIcon }} />
                  <span className={tabClassNames?.tabText} style={{ fontSize: '13px', fontWeight: 500, color: theme.textColor, ...tabStyles?.tabText }}>Pages</span>
                </>
              )}
            </div>
          )}

          {/* Tab content - scrollable area */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {activeTab === 'outline' && tabs.includes('outline') && (
              <DocumentOutline
                outline={outline}
                isLoading={isOutlineLoading}
                currentPage={currentPage}
                onNavigate={handleOutlineNavigate}
                renderItem={renderOutlineItem}
                styles={outlineStyles}
                classNames={outlineClassNames}
                itemStyles={outlineItemStyles}
                itemClassNames={outlineItemClassNames}
              />
            )}

            {activeTab === 'thumbnails' && tabs.includes('thumbnails') && (
              <ThumbnailPanel
                totalPages={totalPages}
                currentPage={currentPage}
                thumbnails={thumbnails}
                loadThumbnail={loadThumbnail}
                onPageSelect={handlePageSelect}
                renderThumbnail={renderThumbnail}
              />
            )}

            {children}
          </div>

          {/* Footer with page info */}
          {showFooter && (
            <div
              className={footerClassNames?.container}
              style={{
                flexShrink: 0,
                borderTop: `1px solid ${theme.borderColor}`,
                padding: '10px 16px',
                backgroundColor: theme.hoverBackgroundColor,
                ...footerStyles?.container,
              }}
            >
              <div
                className={footerClassNames?.text}
                style={{
                  fontSize: '12px',
                  color: theme.mutedTextColor,
                  textAlign: 'center',
                  fontWeight: 500,
                  ...footerStyles?.text,
                }}
              >
                Page {currentPage} of {totalPages}
              </div>
            </div>
          )}
        </div>
      </div>
    </LeftPanelContext.Provider>
  );
};
