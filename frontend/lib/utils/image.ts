export function getImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  
  if (path.startsWith("http")) {
    return path;
  }
  
  if (path.startsWith("/uploads")) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
  }
  
  return path;
}
