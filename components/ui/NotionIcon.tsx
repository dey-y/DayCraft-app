import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';

export type NotionIconName =
  | 'zap'
  | 'search'
  | 'smartphone'
  | 'cup'
  | 'calendar'
  | 'calendar-week'
  | 'clock'
  | 'reminder'
  | 'lightbulb'
  | 'sparkle'
  | 'bell'
  | 'mic'
  | 'check-circle'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'plus'
  | 'folder'
  | 'tag'
  | 'dots'
  | 'close'
  | 'menu'
  | 'chat'
  | 'send'
  | 'checkbox-checked';

interface NotionIconProps {
  name: NotionIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Iconografía 100% Notion Icons (notionicons.so)
 * Trazo fino vectorial innegociable (`strokeWidth = 1.8`), cero emojis estridentes.
 */
export const NotionIcon: React.FC<NotionIconProps> = ({
  name,
  size = 16,
  color = '#e6edf3',
  strokeWidth = 1.8,
}) => {
  const commonProps = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  const renderPaths = () => {
    switch (name) {
      case 'zap':
        return <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...commonProps} />;
      case 'search':
        return (
          <>
            <Circle cx="11" cy="11" r="8" {...commonProps} />
            <Line x1="21" y1="21" x2="16.65" y2="16.65" {...commonProps} />
          </>
        );
      case 'smartphone':
        return (
          <>
            <Rect x="5" y="2" width="14" height="20" rx="3" {...commonProps} />
            <Line x1="12" y1="18" x2="12.01" y2="18" {...commonProps} />
          </>
        );
      case 'cup':
        return (
          <>
            <Path d="M18 8h1a4 4 0 0 1 0 8h-1" {...commonProps} />
            <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" {...commonProps} />
            <Line x1="6" y1="1" x2="6" y2="4" {...commonProps} />
            <Line x1="10" y1="1" x2="10" y2="4" {...commonProps} />
            <Line x1="14" y1="1" x2="14" y2="4" {...commonProps} />
          </>
        );
      case 'calendar':
        return (
          <>
            <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" {...commonProps} />
            <Line x1="16" y1="2" x2="16" y2="6" {...commonProps} />
            <Line x1="8" y1="2" x2="8" y2="6" {...commonProps} />
            <Line x1="3" y1="10" x2="21" y2="10" {...commonProps} />
          </>
        );
      case 'calendar-week':
        return (
          <>
            <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" {...commonProps} />
            <Line x1="16" y1="2" x2="16" y2="6" {...commonProps} />
            <Line x1="8" y1="2" x2="8" y2="6" {...commonProps} />
            <Line x1="3" y1="10" x2="21" y2="10" {...commonProps} />
            <Line x1="9" y1="10" x2="9" y2="22" {...commonProps} />
            <Line x1="15" y1="10" x2="15" y2="22" {...commonProps} />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle cx="12" cy="12" r="10" {...commonProps} />
            <Polyline points="12 6 12 12 16 14" {...commonProps} />
          </>
        );
      case 'reminder':
        return (
          <>
            <Circle cx="12" cy="12" r="10" {...commonProps} />
            <Polyline points="12 6 12 12 14 14" {...commonProps} />
          </>
        );
      case 'lightbulb':
        return (
          <>
            <Path d="M9 18h6" {...commonProps} />
            <Path d="M10 22h4" {...commonProps} />
            <Path
              d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"
              {...commonProps}
            />
          </>
        );
      case 'sparkle':
        return (
          <Polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            {...commonProps}
          />
        );
      case 'bell':
        return (
          <>
            <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...commonProps} />
            <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...commonProps} />
          </>
        );
      case 'mic':
        return (
          <>
            <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" {...commonProps} />
            <Path d="M19 10v2a7 7 0 0 1-14 0v-2" {...commonProps} />
            <Line x1="12" y1="19" x2="12" y2="23" {...commonProps} />
            <Line x1="8" y1="23" x2="16" y2="23" {...commonProps} />
          </>
        );
      case 'check-circle':
        return (
          <>
            <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" {...commonProps} />
            <Polyline points="22 4 12 14.01 9 11.01" {...commonProps} />
          </>
        );
      case 'check':
        return <Polyline points="20 6 9 17 4 12" {...commonProps} />;
      case 'checkbox-checked':
        return (
          <>
            <Polyline points="9 11 12 14 22 4" {...commonProps} />
            <Path
              d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
              {...commonProps}
            />
          </>
        );
      case 'chevron-right':
        return <Polyline points="9 18 15 12 9 6" {...commonProps} />;
      case 'chevron-left':
        return <Polyline points="15 18 9 12 15 6" {...commonProps} />;
      case 'plus':
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" {...commonProps} />
            <Line x1="5" y1="12" x2="19" y2="12" {...commonProps} />
          </>
        );
      case 'folder':
        return (
          <Path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            {...commonProps}
          />
        );
      case 'tag':
        return (
          <>
            <Path
              d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
              {...commonProps}
            />
            <Line x1="7" y1="7" x2="7.01" y2="7" {...commonProps} />
          </>
        );
      case 'dots':
        return (
          <>
            <Circle cx="12" cy="12" r="1" {...commonProps} />
            <Circle cx="19" cy="12" r="1" {...commonProps} />
            <Circle cx="5" cy="12" r="1" {...commonProps} />
          </>
        );
      case 'close':
        return (
          <>
            <Line x1="18" y1="6" x2="6" y2="18" {...commonProps} />
            <Line x1="6" y1="6" x2="18" y2="18" {...commonProps} />
          </>
        );
      case 'menu':
        return (
          <>
            <Line x1="3" y1="12" x2="21" y2="12" {...commonProps} />
            <Line x1="3" y1="6" x2="21" y2="6" {...commonProps} />
            <Line x1="3" y1="18" x2="21" y2="18" {...commonProps} />
          </>
        );
      case 'chat':
        return (
          <Path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            {...commonProps}
          />
        );
      case 'send':
        return (
          <>
            <Line x1="22" y1="2" x2="11" y2="13" {...commonProps} />
            <Polygon points="22 2 15 22 11 13 2 9 22 2" {...commonProps} />
          </>
        );
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths()}
    </Svg>
  );
};
