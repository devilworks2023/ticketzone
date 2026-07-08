declare module 'wav-decoder' {
  export interface WavDecoded {
    sampleRate: number;
    channelData: Float32Array[];
  }

  const wavDecoder: { decode: (buffer: ArrayBuffer) => Promise<WavDecoded> };
  export default wavDecoder;
}
