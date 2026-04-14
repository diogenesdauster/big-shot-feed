import matter from "gray-matter";
import { resolveRelativePath } from "../lib/canonicalPath";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  content: string;
  title: string;
  wordCount: number;
}

/**
 * Parses a Markdown file with YAML frontmatter.
 * Normalizes relative .md links to absolute paths based on the file location.
 */
export function parseMarkdown(rawContent: string, filePath: string): ParsedMarkdown {
  const parsed = matter(rawContent);
  const frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
  let content = parsed.content;

  // Extract title: prefer H1, fall back to filename-derived
  const h1Match = content.match(/^#\s+(.+)$/m);
  const title = h1Match?.[1]?.trim() ?? deriveTitle(filePath);

  // Normalize relative .md links
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    if (/^https?:\/\//.test(href) || href.startsWith("#")) {
      return `[${label}](${href})`;
    }
    const resolved = resolveRelativePath(filePath, href);
    return `[${label}](${resolved})`;
  });

  const wordCount = countWords(content);

  return { frontmatter, content, title, wordCount };
}

function countWords(text: string): number {
  // Strip code blocks and inline code, count remaining words
  const stripped = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[#*_[\]()!-]/g, " ");
  const words = stripped.match(/\S+/g);
  return words?.length ?? 0;
}

function deriveTitle(filePath: string): string {
  const filename = filePath.split("/").pop() ?? filePath;
  return filename
    .replace(/\.md$/i, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
