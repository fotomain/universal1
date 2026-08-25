import React, { useState } from "react";
import IconApp from "./IconApp";

let useDesignSystem: any;
try {
  useDesignSystem = require("../../providers/WithDesignSystem").useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: "#6750A4", onPrimary: "#ffffff" } });
}

export interface OnOffButtonAppProps {
  isOn?: boolean;
  onIcon?: React.ReactNode;
  offIcon?: React.ReactNode;
  onOffCallback?: (isOn: boolean) => void;
  primaryColor?: string;
  size?: number;
  testID?: string;
  style?: any;
}

export function OnOffButtonApp({
  isOn: controlledIsOn,
  onIcon,
  offIcon,
  onOffCallback,
  primaryColor: customPrimaryColor,
  size = 16,
  testID = "onOffButtonApp",
  style,
}: OnOffButtonAppProps) {
  let themeColors: any = { primary: "#6750A4", onPrimary: "#ffffff" };
  try {
    if (useDesignSystem) {
      themeColors = useDesignSystem()?.themeColors || themeColors;
    }
  } catch (e) {
    // fallback
  }

  const primaryColor = customPrimaryColor || themeColors.primary || "#6750A4";

  const [internalIsOn, setInternalIsOn] = useState(false);
  const isOn = controlledIsOn !== undefined ? controlledIsOn : internalIsOn;

  const handleToggle = (e?: any) => {
    e?.stopPropagation?.();
    console.log("handleToggle1", !isOn);
    const nextState = !isOn;
    if (controlledIsOn === undefined) {
      setInternalIsOn(nextState);
    }
    onOffCallback?.(nextState);
  };

  if (isOn) {
    if (onIcon) {
      return (
        <div onClick={handleToggle} style={{ cursor: "pointer", display: "inline-flex" }}>
          {onIcon}
        </div>
      );
    }
    return (
      <IconApp
        testID={testID}
        name="check"
        size={size}
        color={themeColors.onPrimary || "#ffffff"}
        onPress={handleToggle}
        style={[
          {
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: primaryColor,
            borderColor: primaryColor,
          },
          style,
        ]}
      />
    );
  }

  if (offIcon) {
    return (
      <div onClick={handleToggle} style={{ cursor: "pointer", display: "inline-flex" }}>
        {offIcon}
      </div>
    );
  }

  return (
    <IconApp
      testID={testID}
      name="check"
      size={size}
      color="transparent"
      onPress={handleToggle}
      style={[
        {
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "transparent",
          borderColor: primaryColor,
        },
        style,
      ]}
    />
  );
}

export default OnOffButtonApp;
