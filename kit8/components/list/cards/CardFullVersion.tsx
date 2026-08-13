import React from "react";
import {Image, Linking, StyleSheet, TouchableOpacity, View} from "react-native";
import {IconButton, Text, useTheme} from "react-native-paper";
import CardApp from "../../../../components/common/CardApp";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {CardItem} from "../web/lib/types";
import {CardThreeDotsMenu} from "../web/lib/CardThreeDotsMenu";
import {CardIconsBottomComponent} from "../web/lib/CardIconsBottomComponent";
import {FABForCardComponent} from "../../fab/FABForCardComponent";

/**
 * Extracts 11-character YouTube Video ID from standard, shortened, shorts, or embed URLs.
 */
function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}

/**
 * Generates direct YouTube thumbnail image URL from video URL or Video ID.
 */
function getYouTubeThumbnail(urlOrId?: string | null, quality: "maxres" | "hq" | "mq" | "default" = "hq"): string | null {
  if (!urlOrId) return null;
  const videoId = urlOrId.length === 11 && !urlOrId.includes("/")
    ? urlOrId
    : extractYouTubeId(urlOrId);

  if (!videoId) return null;

  const qualityMap = {
    maxres: "maxresdefault.jpg",
    hq: "hqdefault.jpg",
    mq: "mqdefault.jpg",
    default: "default.jpg",
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality] || qualityMap.hq}`;
}

export interface CardFullVersionProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  primaryColor?: string;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCreateBeforeCurrent?: (id: string) => void;
  onCreateAfterCurrent?: (id: string) => void;
  onCopyPasteBeforeCurrent?: (id: string) => void;
  onCopyPasteAfterCurrent?: (id: string) => void;
  onMakeFirst?: (id: string) => void;
  onMakeLast?: (id: string) => void;
  onMenuOpenStateChange?: (isOpen: boolean) => void;
  dragHandleProps?: any;
  testID?: string;
  crudCardHeight?: number;
}

export const CardFullVersion: React.FC<CardFullVersionProps> = ({
  card,
  isSelected = false,
  isDragging = false,
  primaryColor = "#1D827D",
  onArchive,
  onDelete,
  onShare,
  onEdit,
  onCreateBeforeCurrent,
  onCreateAfterCurrent,
  onCopyPasteBeforeCurrent,
  onCopyPasteAfterCurrent,
  onMakeFirst,
  onMakeLast,
  onMenuOpenStateChange,
  dragHandleProps,
  testID = "cardFull",
  crudCardHeight,
}) => {
  const paperTheme = useTheme();
  const themePrimary = primaryColor || paperTheme.colors.primary || "#1D827D";

  // MediaPost Data Extraction
  const uuidString = card.rawItem?.mediaPostGUID || card.id;
  const videoUrl =
    card.rawItem?.mediaPostJSON?.mediaPostOrigin ||
    card.rawItem?.mediaPostJSON?.mediaPostURL ||
    (card as any).originUrl ||
    "";
  const title = card.title || card.rawItem?.mediaPostJSON?.mediaPostTitle || "[MASTERCLASS] Effective Digital Marketing Strategy 2024";
  const description = card.description || card.rawItem?.mediaPostJSON?.mediaPostDescription || "Explore comprehensive frameworks, case studies, and actionable techniques to scale your business online.";

  // Dynamically computed thumbnail URL
  const computedThumbnailUrl = card.rawItem?.mediaPostJSON?.thumbnailUrl || getYouTubeThumbnail(videoUrl, "hq") ||
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`UUID: ${uuidString}\nLink: ${videoUrl}`);
    }
    console.log(`Copied UUID and YouTube link: UUID: ${uuidString}`);
  };

  const handleDownload = () => {
    console.log("Downloading resource package...");
  };

  const handleViewNow = async () => {
    if (typeof window !== "undefined" && videoUrl) {
      window.open(videoUrl, "_blank");
    } else if (videoUrl) {
      const supported = await Linking.canOpenURL(videoUrl);
      if (supported) {
        await Linking.openURL(videoUrl);
      }
    }
  };

  return (
    <CardApp
      testID={testID}
      elevation={isDragging ? 4 : 1}
      style={{
        ...styles.card,
        backgroundColor: isSelected
          ? (paperTheme.dark ? "#1e3a5f" : "#e3f2fd")
          : paperTheme.colors.surface,
        minHeight: crudCardHeight,
      }}
    >
      {/* Header: UUID, Share, and Menu */}
      <View style={[styles.headerContainer, { borderBottomColor: paperTheme.colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.uuidText, { color: paperTheme.colors.onSurfaceVariant }]} numberOfLines={1}>
            UUID: {uuidString}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <IconButton
            icon="share-variant"
            size={18}
            iconColor="#6B7280"
            onPress={() => onShare?.(card.id)}
            style={styles.iconButton}
          />
          <CardThreeDotsMenu
            onEdit={() => onEdit?.(card.id)}
            onDelete={() => onDelete?.(card.id)}
            onShare={() => onShare?.(card.id)}
            onMenuOpenStateChange={onMenuOpenStateChange}
            primaryColor={themePrimary}
          />
        </View>
      </View>

      {/* Thumbnail Section */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleViewNow}
        style={styles.thumbnailContainer}
      >
        <Image
          source={{ uri: computedThumbnailUrl }}
          style={styles.cover}
          resizeMode="cover"
        />

        {/* Play Icon Badge Overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playButtonCircle}>
            <MaterialCommunityIcons name="play" size={28} color="#FFFFFF" />
          </View>
        </View>

        {/* Video Type Badge */}
        <View style={{ ...styles.videoBadge, backgroundColor: themePrimary }}>
          <Text style={styles.videoBadgeText}>VIDEO</Text>
        </View>
      </TouchableOpacity>

      {/* Read-Only Info Content */}
      <View style={styles.contentContainer}>
        <Text variant="titleMedium" style={[styles.titleText, { color: paperTheme.colors.onSurface }]}>
          {title}
        </Text>
        <Text variant="bodySmall" style={[styles.descriptionText, { color: paperTheme.colors.onSurfaceVariant }]}>
          {description}
        </Text>

        {/* URL Direct Link Display */}
        <View style={styles.linkSection}>
          <MaterialCommunityIcons name="link-variant" size={16} color={themePrimary} />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleViewNow}
          >
            <Text
              variant="bodySmall"
              style={{ ...styles.urlText, color: themePrimary }}
              numberOfLines={1}
            >
              {videoUrl}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Footer: Icon Group & FAB Button */}
      <View style={[styles.actionsContainer, { borderTopColor: paperTheme.colors.surfaceVariant }]}>
        <View style={styles.iconActionsGroup}>
          {/* Edit Icon Button */}
          <IconButton
            icon="pencil"
            size={18}
            iconColor={themePrimary}
            onPress={() => onEdit?.(card.id)}
            style={{ ...styles.outlinedIconButton, borderColor: themePrimary }}
          />

          {/* Copy Icon Button */}
          <IconButton
            icon="content-copy"
            size={18}
            iconColor={themePrimary}
            onPress={handleCopy}
            style={{ ...styles.outlinedIconButton, borderColor: themePrimary }}
          />

          {/* Download Icon Button */}
          <IconButton
            icon="download"
            size={18}
            iconColor={themePrimary}
            onPress={handleDownload}
            style={{ ...styles.outlinedIconButton, borderColor: themePrimary }}
          />
        </View>

        {/* FABForCardComponent positioned at the right bottom site of the card */}
        <FABForCardComponent
          cardId={card.id}
          size="small"
          onViewNow={handleViewNow}
          onEdit={() => onEdit?.(card.id)}
          onShare={() => onShare?.(card.id)}
          onDelete={() => onDelete?.(card.id)}
          onCreateBeforeCurrent={() => onCreateBeforeCurrent?.(card.id)}
          onCreateAfterCurrent={() => onCreateAfterCurrent?.(card.id)}
          onCopyPasteBeforeCurrent={() => onCopyPasteBeforeCurrent?.(card.id)}
          onCopyPasteAfterCurrent={() => onCopyPasteAfterCurrent?.(card.id)}
        />
      </View>

      {/* CardIconsBottomComponent: Drag handle + archive & delete icons */}
      <CardIconsBottomComponent
        onArchive={() => onArchive?.(card.id)}
        onDelete={() => onDelete?.(card.id)}
        onMakeFirst={() => onMakeFirst?.(card.id)}
        onMakeLast={() => onMakeLast?.(card.id)}
        dragHandleProps={dragHandleProps}
        primaryColor={themePrimary}
      />
    </CardApp>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  uuidText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "300",
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    margin: 0,
    width: 30,
    height: 30,
  },
  thumbnailContainer: {
    position: "relative",
    height: 190,
    backgroundColor: "#111827",
  },
  cover: {
    width: "100%",
    height: "100%",
    opacity: 0.9,
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  playButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 2,
  },
  videoBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(29, 130, 125, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleText: {
    color: "#1F2937",
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
  },
  descriptionText: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  linkSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  urlText: {
    color: "#1D827D",
    marginLeft: 6,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F9FAFB",
  },
  iconActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  outlinedIconButton: {
    margin: 0,
    borderWidth: 1,
    borderColor: "#1D827D",
    borderRadius: 20,
    width: 36,
    height: 36,
  },
  viewNowButton: {
    backgroundColor: "#1D827D",
    borderRadius: 20,
    paddingHorizontal: 8,
  },
  viewNowLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

export default CardFullVersion;
