import React, { useState, useRef, useEffect } from "react";
// @ts-ignore
import ReactDOM from "react-dom";
import { Platform, Text, TouchableOpacity } from "react-native";
import { CardThreeDotsMenuProps } from "./types";

let MaterialIcons: any;
let MaterialCommunityIcons: any;

if (Platform.OS !== "web") {
  MaterialIcons = require("@expo/vector-icons/MaterialIcons").default;
  MaterialCommunityIcons = require("@expo/vector-icons/MaterialCommunityIcons").default;
}

export const getWebFallbackGlyph = (name: string): string => {
  const glyphs: Record<string, string> = {
    more: "⋮",
    "more-vert": "⋮",
    edit: "✎",
    delete: "🗑",
    share: "↗",
    primary: "•",
  };

  return glyphs[name.toLowerCase()] || glyphs.primary;
};

export const CardThreeDotsMenu: React.FC<CardThreeDotsMenuProps> = ({
  onEdit,
  onDelete,
  onShare,
  onMenuOpenStateChange,
  primaryColor = "#6200ee",
}) => {
  const [visible, setVisible] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLeaveTimer();
    };
  }, []);

  const updatePosition = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 2,
        left: rect.right - 140,
      });
    }
  };

  const handleOpen = () => {
    clearLeaveTimer();
    updatePosition();
    setVisible(true);
    onMenuOpenStateChange?.(true);
  };

  const handleCloseDelayed = () => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setVisible(false);
      onMenuOpenStateChange?.(false);
    }, 250);
  };

  const handleCloseImmediate = () => {
    clearLeaveTimer();
    setVisible(false);
    onMenuOpenStateChange?.(false);
  };

  const handleToggle = () => {
    clearLeaveTimer();
    const nextState = !visible;
    if (nextState) {
      updatePosition();
    }
    setVisible(nextState);
    onMenuOpenStateChange?.(nextState);
  };

  const renderWebFallbackIcon = (name: string, label?: string) => (
    <Text
      accessibilityLabel={label || name}
      style={{
        color: primaryColor,
        fontSize: 24,
        lineHeight: 24,
        textAlign: "center",
      }}
    >
      {getWebFallbackGlyph(name)}
    </Text>
  );

  return (
    <div
      ref={anchorRef}
      onMouseEnter={handleOpen}
      onMouseLeave={handleCloseDelayed}
      style={{ display: "inline-block", padding: "4px" }}
    >
      <div title="Card Options" style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
        <TouchableOpacity activeOpacity={0.7} onPress={handleToggle}>
          {Platform.OS === "web"
            ? renderWebFallbackIcon("more-vert", "More options")
            : <MaterialIcons name="more-vert" size={24} color={primaryColor} />}
        </TouchableOpacity>
      </div>

      {visible && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
          onMouseEnter={handleOpen}
          onMouseLeave={handleCloseDelayed}
          style={{
            position: "fixed",
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.45)",
            border: "1px solid #d0d0d0",
            zIndex: 99999999,
            minWidth: "140px",
            padding: "6px 0",
            fontFamily: "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}
        >
          {/* Edit Item */}
          <div
            onClick={() => {
              handleCloseImmediate();
              onEdit();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 14px",
              cursor: "pointer",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              handleOpen();
              e.currentTarget.style.backgroundColor = "#f0f0f0";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {Platform.OS === "web" ? (
              <Text style={{ marginRight: 10, color: primaryColor, fontSize: 18, lineHeight: 18 }}>✎</Text>
            ) : (
              <MaterialCommunityIcons name="pencil-outline" size={18} color={primaryColor} style={{ marginRight: 10 }} />
            )}
            <span style={{ fontSize: "14px", color: primaryColor, fontFamily: "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif", fontWeight: 500 }}>
              Edit
            </span>
          </div>

          {/* Delete Item */}
          <div
            onClick={() => {
              handleCloseImmediate();
              onDelete();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 14px",
              cursor: "pointer",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              handleOpen();
              e.currentTarget.style.backgroundColor = "#f0f0f0";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {Platform.OS === "web" ? (
              <Text style={{ marginRight: 10, color: primaryColor, fontSize: 18, lineHeight: 18 }}>🗑</Text>
            ) : (
              <MaterialCommunityIcons name="delete-outline" size={18} color={primaryColor} style={{ marginRight: 10 }} />
            )}
            <span style={{ fontSize: "14px", color: primaryColor, fontFamily: "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif", fontWeight: 500 }}>
              Delete
            </span>
          </div>

          {/* Share Item */}
          <div
            onClick={() => {
              handleCloseImmediate();
              onShare();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 14px",
              cursor: "pointer",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              handleOpen();
              e.currentTarget.style.backgroundColor = "#f0f0f0";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {Platform.OS === "web" ? (
              <Text style={{ marginRight: 10, color: primaryColor, fontSize: 18, lineHeight: 18 }}>↗</Text>
            ) : (
              <MaterialCommunityIcons name="share-outline" size={18} color={primaryColor} style={{ marginRight: 10 }} />
            )}
            <span style={{ fontSize: "14px", color: primaryColor, fontFamily: "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif", fontWeight: 500 }}>
              Share
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
