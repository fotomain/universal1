import React, { act } from "react";
import { Text, TouchableOpacity } from "react-native";
import renderer from "react-test-renderer";

// Mock vector icons and expo asset modules for clean Jest execution
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "MaterialCommunityIcons");
jest.mock("@expo/vector-icons/MaterialIcons", () => "MaterialIcons");
jest.mock("expo-asset", () => ({ Asset: { fromModule: jest.fn() } }), { virtual: true });
jest.mock("expo-font", () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
}), { virtual: true });

// Override react-native Animated.timing & spring to execute completion callbacks synchronously
const RN = require("react-native");
RN.Animated.timing = (value: any, config: any) => ({
  start: (callback?: any) => {
    if (value && typeof value.setValue === "function") {
      value.setValue(config.toValue);
    }
    if (typeof callback === "function") {
      callback({ finished: true });
    }
  },
  stop: () => {},
  reset: () => {},
});

RN.Animated.spring = (value: any, config: any) => ({
  start: (callback?: any) => {
    if (value && typeof value.setValue === "function") {
      value.setValue(config.toValue);
    }
    if (typeof callback === "function") {
      callback({ finished: true });
    }
  },
  stop: () => {},
  reset: () => {},
});

const RNWPanResponder = require("react-native-web").PanResponder;

// Override PanResponder.create to pass gestureState directly to config.onPanResponderRelease in tests
RNWPanResponder.create = (config: any) => {
  return {
    panHandlers: {
      onStartShouldSetPanResponder: config.onStartShouldSetPanResponder,
      onMoveShouldSetPanResponder: config.onMoveShouldSetPanResponder,
      onResponderGrant: (e: any) => config.onPanResponderGrant && config.onPanResponderGrant(e, { dx: 0, dy: 0, vx: 0, vy: 0 }),
      onResponderMove: (e: any, gState: any) => config.onPanResponderMove && config.onPanResponderMove(e, gState || { dx: 0, dy: 0, vx: 0, vy: 0 }),
      onResponderRelease: (e: any, gState: any) => {
        const gesture = gState || { dx: 0, dy: 0, vx: 0, vy: 0 };
        if (config.onPanResponderRelease) {
          config.onPanResponderRelease(e, gesture);
        }
      },
    },
  };
};

import { SwipeableCard } from "../components/list/web/lib/SwipeableCard";
import { CardSwipeUnderlayLeftComponent } from "../components/list/web/lib/CardSwipeUnderlayLeftComponent";
import { CardSwipeUnderlayRightComponent } from "../components/list/web/lib/CardSwipeUnderlayRightComponent";

describe("SwipeableCard & Archivation Jest Tests", () => {
  const dummyItem = { id: "card-1", title: "Test Card", description: "Test Description" };

  const triggerPanRelease = (component: any, dx: number, vx: number = 0) => {
    // Unambiguously find the Animated.View node holding panResponder.panHandlers
    const targetNode = component.root.find((node: any) => node.props && node.props.onMoveShouldSetPanResponder);
    if (targetNode) {
      const dummyEvent = { nativeEvent: {}, persist: () => {}, stopPropagation: () => {} };
      const gestureState = { dx, dy: 0, vx, vy: 0 };
      targetNode.props.onResponderRelease(dummyEvent, gestureState);
    }
  };

  // Helper to get touchable wrapping card content
  const getCardTouchable = (component: any) => {
    const touchables = component.root.findAllByType(TouchableOpacity);
    return touchables.find((t: any) => {
      const textChild = t.findAll((n: any) => n.props && n.props.children === "Card Content");
      return textChild.length > 0;
    });
  };

  // --------------------------------------------------------------------------
  // 1. Right to Left Swiping Tests (Right underlay - Trash)
  // --------------------------------------------------------------------------
  test("slide Card from right to left then press on Card - Card must go back into normal position", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          swipeRightToLeftPercent={25}
          crudCardSwipeUnderlayRight={<CardSwipeUnderlayRightComponent currentIListtem={dummyItem} onDelete={jest.fn()} />}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // 1. Slide right to left (dx = -100)
    act(() => {
      triggerPanRelease(component, -100, 0);
    });

    // 2. Press on Card overlay touchable
    const swipedCardTouchable = getCardTouchable(component);
    expect(swipedCardTouchable).toBeDefined();

    act(() => {
      swipedCardTouchable?.props.onPress();
    });

    // 3. Card must go back into normal position (disabled === true)
    const swipedCardTouchableAfterReset = getCardTouchable(component);
    expect(swipedCardTouchableAfterReset?.props.disabled).toBe(true);
  });

  test("slide Card from right to left then press on Right underlay - Card must go back into normal position", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          swipeRightToLeftPercent={25}
          crudCardSwipeUnderlayRight={<CardSwipeUnderlayRightComponent currentIListtem={dummyItem} onDelete={jest.fn()} />}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // 1. Slide right to left (dx = -100)
    act(() => {
      triggerPanRelease(component, -100, 0);
    });

    // 2. Press on Right underlay container touchable
    const touchables = component.root.findAllByType(TouchableOpacity);
    const underlayTouchable = touchables.find((t: any) => t.props.style && t.props.style.bottom === 0);
    expect(underlayTouchable).toBeDefined();

    act(() => {
      underlayTouchable?.props.onPress();
    });

    // 3. Card must go back into normal position
    const swipedCardTouchableAfterReset = getCardTouchable(component);
    expect(swipedCardTouchableAfterReset?.props.disabled).toBe(true);
  });

  test("slide Card from right to left then press on Trashbox icon of Right underlay - Card must be deleted", () => {
    const onDeleteMock = jest.fn();
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          swipeRightToLeftPercent={25}
          crudCardSwipeUnderlayRight={<CardSwipeUnderlayRightComponent currentIListtem={dummyItem} onDelete={onDeleteMock} />}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // 1. Slide right to left (dx = -100)
    act(() => {
      triggerPanRelease(component, -100, 0);
    });

    // 2. Find Trashbox icon touchable inside Right Underlay
    const trashTouchable = component.root.findAllByType(TouchableOpacity).find((t: any) => t.props.style && t.props.style.padding === 8);
    expect(trashTouchable).toBeDefined();

    act(() => {
      trashTouchable?.props.onPress({ stopPropagation: () => {} });
    });

    // 3. Card must be deleted (onDelete callback called with dummyItem)
    expect(onDeleteMock).toHaveBeenCalledWith(dummyItem);
  });

  // --------------------------------------------------------------------------
  // 2. Left to Right Swiping Tests (Left underlay - Archive)
  // --------------------------------------------------------------------------
  test("slide Card from left to right then press on Card - Card must go back into normal position", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          swipeLeftToRightPercent={25}
          crudCardSwipeUnderlayLeft={<CardSwipeUnderlayLeftComponent currentIListtem={dummyItem} onArchive={jest.fn()} />}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // 1. Slide left to right (dx = 100)
    act(() => {
      triggerPanRelease(component, 100, 0);
    });

    // 2. Press on Card overlay touchable
    const swipedCardTouchable = getCardTouchable(component);
    expect(swipedCardTouchable).toBeDefined();

    act(() => {
      swipedCardTouchable?.props.onPress();
    });

    // 3. Card must go back into normal position
    const swipedCardTouchableAfterReset = getCardTouchable(component);
    expect(swipedCardTouchableAfterReset?.props.disabled).toBe(true);
  });

  test("slide Card from left to right then press on Left underlay - Card must go back into normal position", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          swipeLeftToRightPercent={25}
          crudCardSwipeUnderlayLeft={<CardSwipeUnderlayLeftComponent currentIListtem={dummyItem} onArchive={jest.fn()} />}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // 1. Slide left to right (dx = 100)
    act(() => {
      triggerPanRelease(component, 100, 0);
    });

    // 2. Press on Left underlay container touchable
    const touchables = component.root.findAllByType(TouchableOpacity);
    const underlayTouchable = touchables.find((t: any) => t.props.style && t.props.style.bottom === 0);
    expect(underlayTouchable).toBeDefined();

    act(() => {
      underlayTouchable?.props.onPress();
    });

    // 3. Card must go back into normal position
    const swipedCardTouchableAfterReset = getCardTouchable(component);
    expect(swipedCardTouchableAfterReset?.props.disabled).toBe(true);
  });

  test("slide Card from left to right then press on Archive icon of Left underlay - Card must be archived", () => {
    const onArchiveMock = jest.fn();
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          swipeLeftToRightPercent={25}
          crudCardSwipeUnderlayLeft={<CardSwipeUnderlayLeftComponent currentIListtem={dummyItem} onArchive={onArchiveMock} />}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // 1. Slide left to right (dx = 100)
    act(() => {
      triggerPanRelease(component, 100, 0);
    });

    // 2. Find Archive icon touchable inside Left Underlay
    const archiveTouchable = component.root.findAllByType(TouchableOpacity).find((t: any) => t.props.style && t.props.style.padding === 8);
    expect(archiveTouchable).toBeDefined();

    act(() => {
      archiveTouchable?.props.onPress({ stopPropagation: () => {} });
    });

    // 3. Card must be archived (onArchive callback called with dummyItem)
    expect(onArchiveMock).toHaveBeenCalledWith(dummyItem);
  });

  // --------------------------------------------------------------------------
  // 3. Force Swipe Tests
  // --------------------------------------------------------------------------
  test("on force swipe from left to right - test archivating functionality", () => {
    const onForceArchiveMock = jest.fn();
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          forceSwipeToRightPercent={50}
          onForceSwipeFromLeftToRight={onForceArchiveMock}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // Force swipe left to right (dx = 250 > 50% threshold of 350px width)
    act(() => {
      triggerPanRelease(component, 250, 2.0);
    });

    // Verify onForceSwipeFromLeftToRight is called
    expect(onForceArchiveMock).toHaveBeenCalledTimes(1);
  });

  test("on force swipe from right to left - test deleting functionality", () => {
    const onForceDeleteMock = jest.fn();
    let component: any;
    act(() => {
      component = renderer.create(
        <SwipeableCard
          forceSwipeToLeftPercent={50}
          onForceSwipeFromRightToLeft={onForceDeleteMock}
        >
          <Text>Card Content</Text>
        </SwipeableCard>
      );
    });

    // Force swipe right to left (dx = -250 < -50% threshold of 350px width)
    act(() => {
      triggerPanRelease(component, -250, -2.0);
    });

    // Verify onForceSwipeFromRightToLeft is called
    expect(onForceDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("urlIsYouTube helper tests", () => {
  test("urlIsYouTube returns true for standard YouTube URLs", () => {
    const { urlIsYouTube } = require("../types/origin");
    expect(urlIsYouTube("https://www.youtube.com/watch?v=1iygZ8j_SSs")).toBe(true);
    expect(urlIsYouTube("http://youtu.be/1iygZ8j_SSs")).toBe(true);
    expect(urlIsYouTube("https://www.youtube.com/shorts/1iygZ8j_SSs")).toBe(true);
    expect(urlIsYouTube("https://music.youtube.com/watch?v=1iygZ8j_SSs")).toBe(true);
  });

  test("urlIsYouTube returns false for non-YouTube URLs", () => {
    const { urlIsYouTube } = require("../types/origin");
    expect(urlIsYouTube("https://google.com")).toBe(false);
    expect(urlIsYouTube("https://vimeo.com/123456")).toBe(false);
    expect(urlIsYouTube("")).toBe(false);
  });

  test("readYouTubeTitle returns a string title for YouTube URL", async () => {
    const { readYouTubeTitle } = require("../types/origin");
    const title = await readYouTubeTitle("https://www.youtube.com/watch?v=1iygZ8j_SSs");
    expect(typeof title).toBe("string");
    expect(title.length).toBeGreaterThan(0);
  });

  test("readYouTubeDescription returns a string description for YouTube URL", async () => {
    const { readYouTubeDescription } = require("../types/origin");
    const desc = await readYouTubeDescription("https://www.youtube.com/watch?v=1iygZ8j_SSs");
    expect(typeof desc).toBe("string");
    expect(desc.length).toBeGreaterThan(0);
  });
});

describe("ListWebTopBarComponent tests", () => {
  test("renders ListWebTopBarComponent with createNewItem, scrollToCurrent, scrollTop, and scrollBottom icons", () => {
    const { ListWebTopBarComponent } = require("../components/list/web/ListWebTopBarComponent");
    const onNewMock = jest.fn();
    const onScrollCurrentMock = jest.fn();
    const onScrollTopMock = jest.fn();
    const onScrollBottomMock = jest.fn();

    let component: any;
    act(() => {
      component = renderer.create(
        <ListWebTopBarComponent
          onCreateNewItem={onNewMock}
          onScrollToCurrent={onScrollCurrentMock}
          onScrollTop={onScrollTopMock}
          onScrollBottom={onScrollBottomMock}
          isScrollToCurrentEnabled={true}
        />
      );
    });

    const tree = component.toJSON();
    expect(tree).toBeTruthy();
  });
});

