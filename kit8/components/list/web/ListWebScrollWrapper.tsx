import React, { useState } from "react";
import { MD3Theme } from "react-native-paper";
import { ListWebOnScrollInfo } from "./ListWebOnScrollInfo";

export interface ListWebScrollWrapperProps {
  children: React.ReactNode;
  theme: MD3Theme;
  primaryColor?: string;
  primaryLightColor?: string;
  height?: string | number;
  containerRef?: (el: HTMLDivElement | null) => void;
  droppableProps?: any;
  style?: React.CSSProperties;
  className?: string;
  testID?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const getBusinessMotto = (pct: number): string => {
  if (pct === 0) return "💼 Initializing Q4 Synergy Protocols... Scroll for Profit!";
  if (pct < 25) return "📈 Leveraging Core Competencies! (+15% Productivity)";
  if (pct < 50) return "🚀 Circle Back & Touch Base! Actionable Content Detected!";
  if (pct < 75) return "🔥 Paradigms Shifted! Maximizing Stakeholder Engagement!";
  if (pct < 100) return "🎯 Closing the Loop! Final Deliverables in Sight!";
  return "🎉 100% PROFITABILITY REACHED! Take a Coffee Break! ☕";
};

export function ListWebScrollWrapper({
  children,
  theme,
  primaryColor = "#6750A4",
  primaryLightColor = "#f5f3ff",
  height = "600px",
  containerRef,
  droppableProps,
  style,
  className = "funny-scrollbar",
  testID = "testScrollDesibn",
  onScroll,
}: ListWebScrollWrapperProps) {
  const [scrollPercent, setScrollPercent] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const totalScroll = target.scrollHeight - target.clientHeight;
    if (totalScroll > 0) {
      const current = Math.min(100, Math.max(0, Math.round((target.scrollTop / totalScroll) * 100)));
      setScrollPercent(current);
    }
    onScroll?.(e);
  };

  const formattedHeight = typeof height === "number" ? `${height}px` : height;

  const trackBg = theme.dark
    ? (theme.colors as any).surfaceContainerHighest || theme.colors.surfaceVariant || "#36343b"
    : (theme.colors as any).surfaceContainerHighest || theme.colors.surfaceVariant || "#e7e0ec";

  const thumbBg = primaryColor || theme.colors.primary || "#6750A4";
  const thumbHoverBg = theme.dark
    ? (theme.colors as any).primaryContainer || "#d0bcff"
    : (theme.colors as any).onPrimaryContainer || "#4f378b";
  const thumbActiveBg = theme.dark ? "#e8def8" : "#381e72";

  return (
    <>
      <ListWebOnScrollInfo scrollPercent={scrollPercent} theme={theme} primaryColor={primaryColor} />

      {/* Material Design 3 Custom Scroller Styles for Cards List */}
      <style>{`
        #${testID},
        .${className} {
          scrollbar-width: thin;
          scrollbar-color: ${thumbBg} ${trackBg};
        }
        #${testID}::-webkit-scrollbar-button,
        .${className}::-webkit-scrollbar-button {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        #${testID}::-webkit-scrollbar,
        .${className}::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        #${testID}::-webkit-scrollbar-track,
        .${className}::-webkit-scrollbar-track {
          background: ${trackBg};
          border-radius: 9999px;
          border: 3px solid transparent;
          background-clip: padding-box;
          margin: 4px 0;
        }
        #${testID}::-webkit-scrollbar-thumb,
        .${className}::-webkit-scrollbar-thumb {
          background: ${thumbBg};
          border-radius: 9999px;
          border: 3px solid transparent;
          background-clip: padding-box;
          min-height: 52px;
          box-shadow: ${theme.dark ? "0 2px 8px rgba(0,0,0,0.6)" : "0 2px 8px rgba(103,80,164,0.25)"};
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
        }
        #${testID}::-webkit-scrollbar-thumb:hover,
        .${className}::-webkit-scrollbar-thumb:hover {
          background: ${thumbHoverBg};
          box-shadow: ${theme.dark ? "0 4px 14px rgba(208,188,255,0.4)" : "0 4px 14px rgba(79,55,139,0.4)"};
        }
        #${testID}::-webkit-scrollbar-thumb:active,
        .${className}::-webkit-scrollbar-thumb:active {
          background: ${thumbActiveBg};
          box-shadow: ${theme.dark ? "0 6px 18px rgba(232,222,248,0.5)" : "0 6px 18px rgba(56,30,114,0.5)"};
          cursor: grabbing;
        }
      `}</style>

      <div
        data-testid={testID}
        id={testID}
        className={className}
        onScroll={handleScroll}
        {...droppableProps}
        ref={containerRef}
        style={{
          overflowY: "auto",
          border: theme.dark ? "1px solid #444466" : "1px solid #c5b8e0",
          borderRadius: "8px",
          padding: "12px",
          backgroundColor: theme.dark ? (theme.colors.surfaceVariant || "#252538") : primaryLightColor,
          boxSizing: "border-box",
          ...style,
          height: formattedHeight,
          minHeight: formattedHeight,
          maxHeight: formattedHeight,
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        {children}
      </div>
    </>
  );
}

export default ListWebScrollWrapper;
