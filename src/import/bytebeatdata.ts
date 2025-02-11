export {};

export const linkDetector = /(http|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])/g;

export type BytebeatMode = "Bytebeat" | "Signed Bytebeat" | "Floatbeat" | "Funcbeat";

export type BytebeatSongData = {
    sampleRate: number,
    mode: BytebeatMode,
    code: string
}