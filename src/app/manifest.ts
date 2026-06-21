import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "복기노트",
    short_name: "복기노트",
    description: "메모를 모아 읽고 다시 복기하는 기록 앱",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#f7f7f4",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
