import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "El cuchitril de WALL y Eva",
    short_name: "WALL y Eva",
    description: "Sistema de ventas de figuritas",
    start_url: "/ventas",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#101827",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
