import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// A simple jar with a heart, in the app's colours.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2C2246" }}>
        <div style={{ width: 110, height: 124, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 74, height: 17, background: "#F0B04A", borderRadius: 5 }} />
          <div style={{ marginTop: 4, width: 110, height: 103, background: "#F5EFFF", borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B47A8", fontSize: 62 }}>♥</div>
        </div>
      </div>
    ),
    size,
  );
}
