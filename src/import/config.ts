export {};

import configData from '../../config.json' with { type: 'json' };

export type configType = {
    token: string;
    disabledChannels: string[];
    disabledServers: string[];
    print: {
        ms: number,
        terminal: boolean,
        barSize: number
    };
    audio: {
        sampleLimit: number,
        defaultSeconds: number,
        maximumProcessingTime: number,
    };
    credit: {
        message: boolean,
        command: boolean
    };
    ffmpeg: {
        enable: boolean,
        location: string,
        format: string,
        fileExtension: string,
        bitrate: number | null,
        extra: { [key: string]: (string | number)[] }
    },
    bitDepth: 8 | 16
};

export const renderbotConfig: configType = configData as configType;