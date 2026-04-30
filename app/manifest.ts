import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Home_Made — Stock",
    short_name: "Home_Made",
    description:
      "Gestion stock matériaux & consommables — terrasses sur plots",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f4",
    theme_color: "#5f5240",
    lang: "fr",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        type: "image/png",
        sizes: "180x180",
      },
    ],
    shortcuts: [
      {
        name: "Scanner",
        short_name: "Scan",
        url: "/scan",
      },
      {
        name: "Stock",
        url: "/inventory",
      },
    ],
  };
}
