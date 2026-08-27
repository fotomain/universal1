import * as Crypto from "expo-crypto";

const uuid = Crypto.randomUUID

export const mediaPostExample = {
    "rowOwnerGUID": "111459c1-b433-47d4-bf99-031d23a7a389",
    "rowGUID": "222459c1-b433-47d4-bf99-031d23a7a389",
    "orderInList": 0,
    "rowJSON": {
        "mediaPostMIME": "youtube",
        "mediaPostOriginType": "url",
        "mediaPostOrigin": "https://youtu.be/1iygZ8j_SSs",
        "mediaPostDescription": "Who is responsible for music?\nTo do the analysis of it",
        "mediaPostTitle": "▼▼▼Sia's Big Reveal",
        "mediaPostSubTitle": "who is responsible for music?",
        // "mediaPostFilePrefix": "sia1",
        "mediaOutputSpecification": {
            "mediaOutputFilesPrefix": "Interview1-",
            "mediaOutputDataParametersArray": [
                {
                    "mediaOutputRunGUID": uuid(),//"3ee459c1-b433-47d4-bf99-031d23a11111",
                    "mediaOutputFunctionName": "YOUTUBE_TO_GOOGLE_DRIVE",
                    "mediaOutputMode": {"mainMode":"allBestQuality"},
                },
                {
                    "mediaOutputRunGUID": uuid(), //"a1948560-4c8c-4723-be15-ce271ec22222",
                    "mediaOutputFunctionName": "YOUTUBE_TO_GOOGLE_DRIVE",
                    "mediaOutputMode": {"mainMode":"allMaximumQuality"},
                },
                {
                    "mediaOutputRunGUID": uuid(), //"0b990639-f9e6-4b6c-a49f-7e1424d33333",
                    "mediaOutputFunctionName": "YOUTUBE_TO_GOOGLE_DRIVE",
                    "mediaOutputMode": {"mainMode":"videoSubtitles"},
                }
            ]
        }
    }
}