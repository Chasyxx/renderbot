export {};

import configData from '../../config.json' with { type: 'json' };

export type configType = {
    token: string;
    disabledChannels: string[];
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
        extra: { [key: string]: (string | number)[] }
    }
};

export const renderbotConfig: configType = configData;