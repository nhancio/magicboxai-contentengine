import { AbsoluteFill, useVideoConfig } from "remotion";

export const HelloWorld: React.FC = () => {
  const { fps, durationInFrames, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ flex: 1, backgroundColor: "white", justifyContent: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: 80, fontFamily: "sans-serif", textAlign: "center" }}>
        MagicBox AI<br/>Video Pipeline
      </h1>
      <p style={{ fontSize: 40, fontFamily: "sans-serif" }}>
        {width}x{height} | {fps}fps | {durationInFrames} frames
      </p>
    </AbsoluteFill>
  );
};
