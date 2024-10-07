export type configType = {
    token: string;
    disabledChannels: string[];
    audio: {
        sampleLimit: number;
        defaultSeconds: number;
    }
    ffmpeg: {
        enable: boolean,
        location: string,
        format: string,
        fileExtension: string,
        extra: { [key: string]: any[] }
    }
};
import configData from '../config.json' with { type: 'json' };
export const renderbotConfig: configType = configData;
export const bytebeatPlayerLinkDetectionRegexp = /https:\/\/dollchan\.net\/bytebeat\/?(\/index\.html)?#v3b64[^\)\r\n]+?(?=$|\)| )/;