import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// A simple jar with a heart, in the app's colours.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2C2246" }}>
        <div style={{ width: 300, height: 340, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 200, height: 46, background: "#F0B04A", borderRadius: 14 }} />
          <div style={{ marginTop: 10, width: 300, height: 284, background: "#F5EFFF", borderRadius: 70, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B47A8", fontSize: 170 }}>♥</div>
        </div>
      </div>
    ),
    size,
  );
}
