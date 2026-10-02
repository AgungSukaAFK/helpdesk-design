const PRODUCTION_SITE_URL = "https://design.lourdes.cloud";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const deploymentHost = process.env.VERCEL_URL;
  return deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000";
}

export function getSiteRedirectUrl(path: string) {
  return new URL(path, `${getSiteUrl()}/`).toString();
}