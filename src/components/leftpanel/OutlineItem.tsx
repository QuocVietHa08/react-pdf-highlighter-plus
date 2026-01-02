import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { ProcessedOutlineItem } from '../../types';

/** Style configuration for outline items */
export interface OutlineItemStyles {
  /** Container styles for the item row */
  container?: React.CSSProperties;
  /** Container styles when item is hovered */
  containerHover?: React.CSSProperties;
  /** Container styles when item is active */
  containerActive?: React.CSSProperties;
  /** Expand/collapse button styles */
  expandButton?: React.CSSProperties;
  /** Expand/collapse icon styles */
  expandIcon?: React.CSSProperties;
  /** Active indicator dot styles */
  activeIndicator?: React.CSSProperties;
  /** Title text styles */
  title?: React.CSSProperties;
  /** Title text styles when active */
  titleActive?: React.CSSProperties;
  /** Page number styles */
  pageNumber?: React.CSSProperties;
  /** Page number styles when active */
  pageNumberActive?: React.CSSProperties;
  /** Children container styles */
  childrenContainer?: React.CSSProperties;
}

/** Class name configuration for outline items (Tailwind-friendly) */
export interface OutlineItemClassNames {
  /** Container class for the item row */
  container?: string;
  /** Container class when item is hovered */
  containerHover?: string;
  /** Container class when item is active */
  containerActive?: string;
  /** Expand/collapse button class */
  expandButton?: string;
  /** Expand/collapse icon class */
  expandIcon?: string;
  /** Active indicator dot class */
  activeIndicator?: string;
  /** Title text class */
  title?: string;
  /** Title text class when active */
  titleActive?: string;
  /** Page number class */
  pageNumber?: string;
  /** Page number class when active */
  pageNumberActive?: string;
  /** Children container class */
  childrenContainer?: string;
}

export interface OutlineItemProps {
  item: ProcessedOutlineItem;
  currentPage: number;
  onNavigate: (item: ProcessedOutlineItem) => void;
  defaultExpanded?: boolean;
  showExpandIcons?: boolean;
  maxDepth?: number;
  /** Custom styles for the item */
  styles?: OutlineItemStyles;
  /** Custom class names for the item (Tailwind-friendly) */
  classNames?: OutlineItemClassNames;
  renderItem?: (
    item: ProcessedOutlineItem,
    props: OutlineItemRenderProps
  ) => React.ReactNode;
}

export interface OutlineItemRenderProps {
  isExpanded: boolean;
  isActive: boolean;
  level: number;
  hasChildren: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}

/**
 * Recursive outline item component with collapsible children.
 * Clean, modern design with visual hierarchy and smooth interactions.
 */
export const OutlineItem: React.FC<OutlineItemProps> = ({
  item,
  currentPage,
  onNavigate,
  defaultExpanded = true,
  showExpandIcons = true,
  maxDepth = 10,
  styles,
  classNames,
  renderItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);

  const hasChildren = item.children && item.children.length > 0;
  const isActive = currentPage === item.pageNumber;
  const canShowChildren = item.level < maxDepth;

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleNavigate = () => {
    onNavigate(item);
  };

  const renderProps: OutlineItemRenderProps = {
    isExpanded,
    isActive,
    level: item.level,
    hasChildren,
    onToggle: handleToggle,
    onNavigate: handleNavigate,
  };

  // Allow custom rendering
  if (renderItem) {
    return <>{renderItem(item, renderProps)}</>;
  }

  // Visual hierarchy based on level
  const indent = 12 + item.level * 16;

  // Default styles
  const defaultContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    paddingLeft: `${indent}px`,
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.15s ease',
    backgroundColor: 'transparent',
    borderRadius: '4px',
    margin: '1px 4px',
  };

  const defaultExpandButtonStyle: React.CSSProperties = {
    padding: '2px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '3px',
    flexShrink: 0,
    transition: 'background-color 0.15s ease',
  };

  const defaultExpandIconStyle: React.CSSProperties = {
    width: 12,
    height: 12,
    color: '#64748b',
  };

  const defaultActiveIndicatorStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    flexShrink: 0,
  };

  const defaultTitleStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 400,
    fontStyle: item.italic ? 'italic' : 'normal',
    color: '#475569',
    lineHeight: 1.4,
  };

  const defaultTitleActiveStyle: React.CSSProperties = {
    fontWeight: 500,
    color: '#1e40af',
  };

  const defaultPageNumberStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#94a3b8',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
    minWidth: '20px',
    textAlign: 'right',
  };

  const defaultPageNumberActiveStyle: React.CSSProperties = {
    color: '#3b82f6',
  };

  const defaultChildrenContainerStyle: React.CSSProperties = {
    position: 'relative',
  };

  // Merge styles
  const containerStyle: React.CSSProperties = {
    ...defaultContainerStyle,
    ...styles?.container,
    ...(isHovered && !isActive ? { backgroundColor: '#f8fafc', ...styles?.containerHover } : {}),
    ...(isActive ? styles?.containerActive : {}),
  };

  const expandButtonStyle: React.CSSProperties = {
    ...defaultExpandButtonStyle,
    ...styles?.expandButton,
  };

  const expandIconStyle: React.CSSProperties = {
    ...defaultExpandIconStyle,
    ...styles?.expandIcon,
  };

  const activeIndicatorStyle: React.CSSProperties = {
    ...defaultActiveIndicatorStyle,
    ...styles?.activeIndicator,
  };

  const titleStyle: React.CSSProperties = {
    ...defaultTitleStyle,
    ...styles?.title,
    ...(isActive ? { ...defaultTitleActiveStyle, ...styles?.titleActive } : {}),
  };

  const pageNumberStyle: React.CSSProperties = {
    ...defaultPageNumberStyle,
    ...styles?.pageNumber,
    ...(isActive ? { ...defaultPageNumberActiveStyle, ...styles?.pageNumberActive } : {}),
  };

  const childrenContainerStyle: React.CSSProperties = {
    ...defaultChildrenContainerStyle,
    ...styles?.childrenContainer,
  };

  // Build class names
  const containerClassName = [
    classNames?.container,
    isHovered && !isActive ? classNames?.containerHover : '',
    isActive ? classNames?.containerActive : '',
  ].filter(Boolean).join(' ');

  const titleClassName = [
    classNames?.title,
    isActive ? classNames?.titleActive : '',
  ].filter(Boolean).join(' ');

  const pageNumberClassName = [
    classNames?.pageNumber,
    isActive ? classNames?.pageNumberActive : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="outline-item">
      <div
        className={containerClassName || undefined}
        style={containerStyle}
        onClick={handleNavigate}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNavigate();
          }
        }}
      >
        {/* Expand/collapse icon */}
        {showExpandIcons && hasChildren && canShowChildren ? (
          <button
            className={classNames?.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            style={expandButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className={classNames?.expandIcon} style={expandIconStyle} />
            ) : (
              <ChevronRight className={classNames?.expandIcon} style={expandIconStyle} />
            )}
          </button>
        ) : (
          <div style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Active indicator dot */}
        {isActive && (
          <div className={classNames?.activeIndicator} style={activeIndicatorStyle} />
        )}

        {/* Title */}
        <span className={titleClassName || undefined} style={titleStyle} title={item.title}>
          {item.title}
        </span>

        {/* Page number */}
        <span className={pageNumberClassName || undefined} style={pageNumberStyle}>
          {item.pageNumber}
        </span>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && canShowChildren && (
        <div className={classNames?.childrenContainer} style={childrenContainerStyle}>
          {item.children.map((child) => (
            <OutlineItem
              key={child.id}
              item={child}
              currentPage={currentPage}
              onNavigate={onNavigate}
              defaultExpanded={defaultExpanded}
              showExpandIcons={showExpandIcons}
              maxDepth={maxDepth}
              styles={styles}
              classNames={classNames}
              renderItem={renderItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};
