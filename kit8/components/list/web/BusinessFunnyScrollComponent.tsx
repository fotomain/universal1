import React, { useState } from "react";
import { MD3Theme } from "react-native-paper";

export interface BusinessFunnyScrollProps {
  children: React.ReactNode;
  theme: MD3Theme;
  primaryColor?: string;
  primaryLightColor?: string;
  height?: string | number;
  containerRef?: (el: HTMLDivElement | null) => void;
  droppableProps?: any;
  style?: React.CSSProperties;
  className?: string;
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

export function BusinessFunnyScrollComponent({
  children,
  theme,
  primaryColor = "#6750A4",
  primaryLightColor = "#f5f3ff",
  height = "600px",
  containerRef,
  droppableProps,
  style,
  className = "funny-scrollbar",
  onScroll,
}: BusinessFunnyScrollProps) {
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

  return (
    <>
      {/* Business Funny Scroll-O-Meter Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          marginBottom: "8px",
          borderRadius: "10px",
          backgroundColor: theme.dark ? "#1e1b4b" : "#eef2ff",
          border: `1.5px dashed ${theme.dark ? "#6366f1" : "#818cf8"}`,
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>💼</span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: theme.dark ? "#c7d2fe" : "#3730a3",
              letterSpacing: "0.3px",
            }}
          >
            {getBusinessMotto(scrollPercent)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "80px",
              height: "8px",
              backgroundColor: theme.dark ? "#312e81" : "#c7d2fe",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${scrollPercent}%`,
                height: "100%",
                backgroundColor: scrollPercent === 100 ? "#10b981" : "#6366f1",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "800",
              color: scrollPercent === 100 ? "#10b981" : primaryColor,
              minWidth: "36px",
              textAlign: "right",
            }}
          >
            {scrollPercent}%
          </span>
        </div>
      </div>

      <style>{`
        .${className}::-webkit-scrollbar {
          width: 22px;
        }
        .${className}::-webkit-scrollbar-track {
          background: ${theme.dark ? "#111827" : "#f0f4ff"};
          border-radius: 12px;
          border: 3px solid ${theme.dark ? "#1f2937" : "#ffffff"};
          background-image: repeating-linear-gradient(
            -45deg,
            ${theme.dark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.12)"} 0px,
            ${theme.dark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.12)"} 10px,
            transparent 10px,
            transparent 20px
          );
        }
        .${className}::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, 
            #4f46e5 0%, 
            #818cf8 25%, 
            #f59e0b 50%, 
            #10b981 75%, 
            #4f46e5 100%
          );
          border-radius: 12px;
          border: 3px solid ${theme.dark ? "#1f2937" : "#ffffff"};
          box-shadow: inset 0 0 6px rgba(255,255,255,0.4), 0 2px 8px rgba(99,102,241,0.4);
          min-height: 70px;
          cursor: grab;
        }
        .${className}::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, 
            #4338ca 0%, 
            #6366f1 25%, 
            #d97706 50%, 
            #059669 75%, 
            #4338ca 100%
          );
          box-shadow: inset 0 0 8px rgba(255,255,255,0.6), 0 0 14px rgba(99,102,241,0.7);
          cursor: grab;
        }
        .${className}::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg,
            #3730a3 0%,
            #4f46e5 50%,
            #3730a3 100%
          );
          cursor: grabbing;
        }
      `}</style>

      <div
        className={className}
        onScroll={handleScroll}
        {...droppableProps}
        ref={containerRef}
        style={{
          height: formattedHeight,
          overflowY: "auto",
          border: theme.dark ? "1px solid #444466" : "1px solid #c5b8e0",
          borderRadius: "8px",
          padding: "12px",
          backgroundColor: theme.dark ? (theme.colors.surfaceVariant || "#252538") : primaryLightColor,
          boxSizing: "border-box",
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
}

export default BusinessFunnyScrollComponent;
