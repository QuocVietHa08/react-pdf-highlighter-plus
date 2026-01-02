import React from 'react';
import { Loader2, FileQuestion } from 'lucide-react';
import { OutlineItem, OutlineItemRenderProps, OutlineItemStyles, OutlineItemClassNames } from './OutlineItem';
import type { ProcessedOutlineItem } from '../../types';

/** Style configuration for DocumentOutline */
export interface DocumentOutlineStyles {
  /** Container styles */
  container?: React.CSSProperties;
  /** Loading state container styles */
  loadingContainer?: React.CSSProperties;
  /** Loading spinner styles */
  loadingSpinner?: React.CSSProperties;
  /** Loading text styles */
  loadingText?: React.CSSProperties;
  /** Empty state container styles */
  emptyContainer?: React.CSSProperties;
  /** Empty state icon container styles */
  emptyIconContainer?: React.CSSProperties;
  /** Empty state icon styles */
  emptyIcon?: React.CSSProperties;
  /** Empty state title styles */
  emptyTitle?: React.CSSProperties;
  /** Empty state description styles */
  emptyDescription?: React.CSSProperties;
}

/** Class name configuration for DocumentOutline (Tailwind-friendly) */
export interface DocumentOutlineClassNames {
  /** Container class */
  container?: string;
  /** Loading state container class */
  loadingContainer?: string;
  /** Loading spinner class */
  loadingSpinner?: string;
  /** Loading text class */
  loadingText?: string;
  /** Empty state container class */
  emptyContainer?: string;
  /** Empty state icon container class */
  emptyIconContainer?: string;
  /** Empty state icon class */
  emptyIcon?: string;
  /** Empty state title class */
  emptyTitle?: string;
  /** Empty state description class */
  emptyDescription?: string;
}

export interface DocumentOutlineProps {
  /** Processed outline data */
  outline: ProcessedOutlineItem[] | null;
  /** Whether outline is still loading */
  isLoading?: boolean;
  /** Current page number for highlighting */
  currentPage?: number;
  /** Callback when outline item is clicked */
  onNavigate: (item: ProcessedOutlineItem) => void;
  /** Show expand/collapse icons */
  showExpandIcons?: boolean;
  /** Default expanded state for all items */
  defaultExpanded?: boolean;
  /** Maximum depth to render */
  maxDepth?: number;
  /** Custom class name */
  className?: string;
  /** Custom styles for the outline */
  styles?: DocumentOutlineStyles;
  /** Custom class names for the outline (Tailwind-friendly) */
  classNames?: DocumentOutlineClassNames;
  /** Custom styles for outline items */
  itemStyles?: OutlineItemStyles;
  /** Custom class names for outline items (Tailwind-friendly) */
  itemClassNames?: OutlineItemClassNames;
  /** Custom item renderer */
  renderItem?: (
    item: ProcessedOutlineItem,
    props: OutlineItemRenderProps
  ) => React.ReactNode;
  /** Empty state content */
  emptyContent?: React.ReactNode;
  /** Loading content */
  loadingContent?: React.ReactNode;
}

/**
 * Document outline (table of contents) component.
 * Displays a hierarchical, navigable table of contents for the PDF.
 */
export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
  outline,
  isLoading = false,
  currentPage = 1,
  onNavigate,
  showExpandIcons = true,
  defaultExpanded = true,
  maxDepth = 10,
  className = '',
  styles,
  classNames,
  itemStyles,
  itemClassNames,
  renderItem,
  emptyContent,
  loadingContent,
}) => {
  // Default styles
  const defaultLoadingContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
  };

  const defaultLoadingSpinnerStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    color: '#94a3b8',
    marginBottom: 12,
    animation: 'spin 1s linear infinite',
  };

  const defaultLoadingTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: '#64748b',
  };

  const defaultEmptyContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
  };

  const defaultEmptyIconContainerStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  };

  const defaultEmptyIconStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    color: '#94a3b8',
  };

  const defaultEmptyTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: '#475569',
    marginBottom: 4,
  };

  const defaultEmptyDescriptionStyle: React.CSSProperties = {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  };

  const defaultContainerStyle: React.CSSProperties = {
    paddingTop: '8px',
    paddingBottom: '8px',
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={[className, classNames?.loadingContainer].filter(Boolean).join(' ') || undefined}
        style={{ ...defaultLoadingContainerStyle, ...styles?.loadingContainer }}
      >
        {loadingContent || (
          <>
            <Loader2 className={classNames?.loadingSpinner} style={{ ...defaultLoadingSpinnerStyle, ...styles?.loadingSpinner }} />
            <p className={classNames?.loadingText} style={{ ...defaultLoadingTextStyle, ...styles?.loadingText }}>Loading outline...</p>
          </>
        )}
      </div>
    );
  }

  // Empty state
  if (!outline || outline.length === 0) {
    return (
      <div
        className={[className, classNames?.emptyContainer].filter(Boolean).join(' ') || undefined}
        style={{ ...defaultEmptyContainerStyle, ...styles?.emptyContainer }}
      >
        {emptyContent || (
          <>
            <div className={classNames?.emptyIconContainer} style={{ ...defaultEmptyIconContainerStyle, ...styles?.emptyIconContainer }}>
              <FileQuestion className={classNames?.emptyIcon} style={{ ...defaultEmptyIconStyle, ...styles?.emptyIcon }} />
            </div>
            <p className={classNames?.emptyTitle} style={{ ...defaultEmptyTitleStyle, ...styles?.emptyTitle }}>
              No outline available
            </p>
            <p className={classNames?.emptyDescription} style={{ ...defaultEmptyDescriptionStyle, ...styles?.emptyDescription }}>
              This document doesn't have a table of contents
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={['document-outline', className, classNames?.container].filter(Boolean).join(' ')}
      style={{ ...defaultContainerStyle, ...styles?.container }}
    >
      {outline.map((item) => (
        <OutlineItem
          key={item.id}
          item={item}
          currentPage={currentPage}
          onNavigate={onNavigate}
          defaultExpanded={defaultExpanded}
          showExpandIcons={showExpandIcons}
          maxDepth={maxDepth}
          styles={itemStyles}
          classNames={itemClassNames}
          renderItem={renderItem}
        />
      ))}
    </div>
  );
};
