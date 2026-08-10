async function readYouTubeDescription(url) {
    if (!url || typeof url !== 'string') return "";
    const trimmed = url.trim();

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

    return "";
}

async function run() {
    const desc = await readYouTubeDescription('https://www.youtube.com/watch?v=1iygZ8j_SSs');
    console.log("RESULT:\n" + desc);
}
run();
