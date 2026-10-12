import { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://sadyerbazar.pages.dev";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop", "/pre-orders", "/product/"],
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
