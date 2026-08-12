import React, {useEffect, useRef, useState} from "react";
import {Animated, PanResponder, StyleSheet, TouchableOpacity, View} from "react-native";
import {SwipeableCardProps} from "./types";

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  swipeLeftToRightPercent = 25,
  swipeRightToLeftPercent = 25,
  forceSwipeToLeftPercent = 50,
  forceSwipeToRightPercent = 50,
  onSwipeLeft,
  onSwipeRight,
  onForceSwipeFromRightToLeft,
  onForceSwipeFromLeftToRight,
  crudCardSwipeUnderlayLeft,
  crudCardSwipeUnderlayRight,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [cardWidth, setCardWidth] = useState(350);
  const [swipedDirection, setSwipedDirection] = useState<"left" | "right" | null>(null);
  const [currentDirection, setCurrentDirection] = useState<"left" | "right" | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const isSwipedOpen = swipedDirection !== null;

  // Track translateX in real-time to determine which underlay is active and visible
  useEffect(() => {
    const listenerId = translateX.addListener(({ value }) => {
      if (value > 5) {
        setCurrentDirection("left");
      } else if (value < -5) {
        setCurrentDirection("right");
      } else if (Math.abs(value) <= 5 && !swipedDirection) {
        setCurrentDirection(null);
      }
    });
    return () => {
      translateX.removeListener(listenerId);
    };
  }, [swipedDirection, translateX]);

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 6,
      useNativeDriver: false,
    }).start(() => {
      setSwipedDirection(null);
      setCurrentDirection(null);
    });
  };

  // Click outside listener: reset swipe back to usual state when pressing outside of list
  useEffect(() => {
    if (!isSwipedOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        resetSwipe();
      }
    };

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("click", handleOutsideClick, true);
    }
    return () => {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("click", handleOutsideClick, true);
      }
    };
  }, [isSwipedOpen]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        if (swipedDirection === "right") {
          const openOffset = -1 * (cardWidth * (swipeRightToLeftPercent / 100));
          translateX.setValue(openOffset + gestureState.dx);
        } else if (swipedDirection === "left") {
          const openOffset = cardWidth * (swipeLeftToRightPercent / 100);
          translateX.setValue(openOffset + gestureState.dx);
        } else {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const forceLeftThreshold = -1 * (cardWidth * (forceSwipeToLeftPercent / 100));
        const forceRightThreshold = cardWidth * (forceSwipeToRightPercent / 100);

        const rightToLeftThreshold = -1 * (cardWidth * (swipeRightToLeftPercent / 100));
        const leftToRightThreshold = cardWidth * (swipeLeftToRightPercent / 100);

        // 1. Force Swipe Right-to-Left (dx < -50%): Delete element
        if ((gestureState.dx < forceLeftThreshold || gestureState.vx < -1.5) && onForceSwipeFromRightToLeft) {
          Animated.timing(translateX, {
            toValue: -cardWidth * 1.2,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            onForceSwipeFromRightToLeft();
            translateX.setValue(0);
            setSwipedDirection(null);
            setCurrentDirection(null);
          });
        }
        // 2. Force Swipe Left-to-Right (dx > +50%): Archive element
        else if ((gestureState.dx > forceRightThreshold || gestureState.vx > 1.5) && onForceSwipeFromLeftToRight) {
          Animated.timing(translateX, {
            toValue: cardWidth * 1.2,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            onForceSwipeFromLeftToRight();
            translateX.setValue(0);
            setSwipedDirection(null);
            setCurrentDirection(null);
          });
        }
        // 3. Partial Right-to-Left Swipe (dx < -25%): Shows UnderlayRight (Trash)
        else if (gestureState.dx < rightToLeftThreshold || (swipedDirection === "right" && gestureState.dx < 0)) {
          if (swipeRightToLeftPercent != null && swipeRightToLeftPercent !== 0) {
            const openOffset = -1 * (cardWidth * (swipeRightToLeftPercent / 100));
            Animated.spring(translateX, {
              toValue: openOffset,
              friction: 6,
              useNativeDriver: false,
            }).start(() => {
              setSwipedDirection("right");
              setCurrentDirection("right");
            });
          } else if (onSwipeRight) {
            Animated.timing(translateX, {
              toValue: -cardWidth * 1.2,
              duration: 200,
              useNativeDriver: false,
            }).start(() => {
              onSwipeRight();
              translateX.setValue(0);
              setSwipedDirection(null);
              setCurrentDirection(null);
            });
          } else {
            resetSwipe();
          }
        }
        // 4. Partial Left-to-Right Swipe (dx > +25%): Shows UnderlayLeft (Archive)
        else if (gestureState.dx > leftToRightThreshold || (swipedDirection === "left" && gestureState.dx > 0)) {
          if (swipeLeftToRightPercent != null && swipeLeftToRightPercent !== 0) {
            const openOffset = cardWidth * (swipeLeftToRightPercent / 100);
            Animated.spring(translateX, {
              toValue: openOffset,
              friction: 6,
              useNativeDriver: false,
            }).start(() => {
              setSwipedDirection("left");
              setCurrentDirection("left");
            });
          } else if (onSwipeLeft) {
            Animated.timing(translateX, {
              toValue: cardWidth * 1.2,
              duration: 200,
              useNativeDriver: false,
            }).start(() => {
              onSwipeLeft();
              translateX.setValue(0);
              setSwipedDirection(null);
              setCurrentDirection(null);
            });
          } else {
            resetSwipe();
          }
        } else {
          resetSwipe();
        }
      },
    })
  ).current;

  const activeDirection = swipedDirection || currentDirection;

  return (
    <View
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width || 350;
        setCardWidth(width);
      }}
      style={{ position: "relative", width: "100%" }}
    >
      <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
        {/* Underlay Component Container */}
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={resetSwipe}
            style={StyleSheet.absoluteFill}
          >
            {activeDirection === "left" && crudCardSwipeUnderlayLeft}
            {activeDirection === "right" && crudCardSwipeUnderlayRight}
            {!activeDirection && (
              <>
                {crudCardSwipeUnderlayLeft}
                {crudCardSwipeUnderlayRight}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Swiped Card Layer */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{ transform: [{ translateX }], position: "relative", zIndex: 1 }}
        >
          <TouchableOpacity
            activeOpacity={1}
            disabled={!isSwipedOpen}
            onPress={resetSwipe}
          >
            {children}
          </TouchableOpacity>
        </Animated.View>
      </div>
    </View>
  );
};
