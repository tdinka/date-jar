import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Our Date Jar",
    short_name: "Date Jar",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F0F6",
    theme_color: "#2C2246",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
