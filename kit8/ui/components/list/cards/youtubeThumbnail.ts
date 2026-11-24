// YouTube video id and thumbnail address of a YouTube link. Pure; used by the web card (CardFullVersion) and the phone cards (mediapost).
/**
 * Extracts 11-character YouTube Video ID from standard, shortened, shorts, or embed URLs.
 */
export function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}

/**
 * Generates direct YouTube thumbnail image URL from video URL or Video ID.
 */
export function getYouTubeThumbnail(urlOrId?: string | null, quality: "maxres" | "hq" | "mq" | "default" = "hq"): string | null {
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

