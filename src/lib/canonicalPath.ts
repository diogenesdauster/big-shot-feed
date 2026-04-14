/**
 * Normalizes a Markdown link relative to the current file path.
 *
 * Input: ("eap/agentic-development/intro.md", "./mentor-web/create-app.md")
 * Output: "eap/agentic-development/mentor-web/create-app.md"
 *
 * Used to rewrite intra-doc links so API consumers can navigate via absolute paths.
 */
export function resolveRelativePath(currentFile: string, relativeLink: string): string {
  // Absolute path — return as-is
  if (relativeLink.startsWith("/")) {
    return relativeLink.replace(/^\/+/, "");
  }

  // Anchor only (#section) — keep current file
  if (relativeLink.startsWith("#")) {
    return currentFile + relativeLink;
  }

  // External URL — return as-is
  if (/^https?:\/\//.test(relativeLink)) {
    return relativeLink;
  }

  const dir = currentFile.split("/").slice(0, -1);
  const segments = relativeLink.split("/");

  for (const seg of segments) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      dir.pop();
      continue;
    }
    dir.push(seg);
  }

  return dir.join("/");
}

/**
 * Normalizes a URL by removing tracking params and trailing slash.
 * Used for dedup (although less relevant now since we key by path).
 */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove common tracking params
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "fbclid", "gclid"];
    for (const k of drop) u.searchParams.delete(k);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}
