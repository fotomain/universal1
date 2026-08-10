// 1. Add `as const` so TypeScript infers string literal types instead of generic `string`
export const DATA_ORIGIN_TYPE = {
    youtube: "youtube",
    webpage: "webpage",
    pdf: "pdf",
    msword: "msword",
    msexcel: "msexcel",
    html: "html",
    text: "text",
} as const;

// 2. Derive the Union Type of the VALUES ("youtube" | "msword" | "msexcel" | "url")
export type DataOriginType = typeof DATA_ORIGIN_TYPE[keyof typeof DATA_ORIGIN_TYPE];

// 3. Derive the Union Type of the KEYS ("youtube" | "msword" | "msexcel" | "url")
export type DataOriginTypeKey = keyof typeof DATA_ORIGIN_TYPE;

// 4. Derive the Type representing the entire object shape
export type DataOriginTypeObject = typeof DATA_ORIGIN_TYPE;

/**
 * Checks if a string URL is a valid YouTube URL (standard, shortened, shorts, embed, or music).
 */
export function urlIsYouTube(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    const regExp = /^(?:https?:\/\/)?(?:www\.|music\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)/i;
    return regExp.test(trimmed);
}

/**
 * Reads and fetches the YouTube video title asynchronously from a YouTube URL.
 */
export async function readYouTubeTitle(url: string): Promise<string> {
    if (!url || typeof url !== 'string') return "YouTube Video";
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
            const data = await response.json();
            if (data && data.title) {
                return data.title;
            }
        }
    } catch (err) {
        console.warn("Failed to fetch YouTube title via oEmbed:", err);
    }
    return "YouTube Video";
}

/**
 * Reads and fetches the actual YouTube video description asynchronously from a YouTube URL.
 */
export async function readYouTubeDescription(url: string): Promise<string> {
    if (!url || typeof url !== 'string') return "";
    const trimmed = url.trim();
    if (!urlIsYouTube(trimmed)) return "";

    try {
        let fetchUrl = trimmed;
        if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
            fetchUrl = 'https://' + fetchUrl;
        }

        const response = await fetch(fetchUrl);
        if (response.ok) {
            const html = await response.text();

            // 1. Try extracting shortDescription from ytInitialPlayerResponse
            const shortDescIdx = html.indexOf('"shortDescription":"');
            if (shortDescIdx !== -1) {
                const start = shortDescIdx + '"shortDescription":"'.length;
                let desc = '';
                for (let i = start; i < html.length; i++) {
                    if (html[i] === '"' && html[i - 1] !== '\\') {
                        desc = html.substring(start, i);
                        break;
                    }
                }
                if (desc) {
                    desc = desc
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                        .replace(/\\u0026/g, '&')
                        .replace(/\\u003c/g, '<')
                        .replace(/\\u003e/g, '>');
                    return desc.trim();
                }
            }

            // 2. Try extracting <meta name="description" content="..."> or og:description
            const metaMatch = html.match(/<meta\s+(?:name|property)="(?:og:description|description)"\s+content="([^"]*)"/i) ||
                              html.match(/<meta\s+content="([^"]*)"\s+(?:name|property)="(?:og:description|description)"/i);
            if (metaMatch && metaMatch[1]) {
                let desc = metaMatch[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
                return desc.trim();
            }
        }
    } catch (err) {
        console.warn("Failed to fetch YouTube description HTML:", err);
    }

    // Fallback via oEmbed author if direct HTML fetch is blocked
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
            const data = await response.json();
            if (data && data.title) {
                return `${data.title} - Uploaded by ${data.author_name || 'YouTube'}`;
            }
        }
    } catch (err) {
        console.warn("Failed to fetch YouTube description via oEmbed:", err);
    }

    return "";
}

// --- Usage Examples ---

// Function receiving the value union type ("youtube" | "msword" | "msexcel" | "url")
function processDataOrigin(origin: DataOriginType) {
    switch (origin) {
        case DATA_ORIGIN_TYPE.youtube:
            console.log("Processing YouTube stream...");
            break;
        case DATA_ORIGIN_TYPE.msword:
            console.log("Parsing Word document...");
            break;
        case DATA_ORIGIN_TYPE.msexcel:
            console.log("Parsing Excel sheet...");
            break;
        case DATA_ORIGIN_TYPE.webpage:
            console.log("Fetching web URL...");
            break;
    }
}