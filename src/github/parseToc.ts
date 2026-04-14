import yaml from "js-yaml";

export interface TocNode {
  href: string;
  title: string;
  parentPath: string | null;
  tocOrder: number;
  children: TocNode[];
}

interface RawTocEntry {
  href?: string;
  topics?: RawTocEntry[];
}

/**
 * Parses `toc.yml` content into a flat list of TocNodes with parent references.
 *
 * OutSystems docs use a peculiar YAML format:
 * ```yaml
 * # Section title
 * - href: eap/getting-started/intro.md       # anchor for the section
 * - topics:                                   # children of the anchor above
 *     - href: eap/getting-started/system-requirements.md
 *     - href: eap/getting-started/configure-http-proxy.md
 * ```
 *
 * Rules:
 * - Top-level `href` entries are "anchors" (intro pages for a section)
 * - A sibling `topics:` list means "these are children of the most recent anchor"
 * - Nested `topics:` inside an href entry means "these are children of that entry"
 */
export function parseToc(tocContent: string): TocNode[] {
  const docs: unknown[] = [];
  try {
    yaml.loadAll(tocContent, (doc) => {
      if (doc !== null && doc !== undefined) docs.push(doc);
    });
  } catch (err) {
    throw new Error(`Failed to parse toc.yml: ${err instanceof Error ? err.message : String(err)}`);
  }

  const flat: TocNode[] = [];
  let order = 0;

  function walk(entries: RawTocEntry[], parentOverride: string | null): void {
    // Track last anchor in this list to use as parent for sibling topics
    let lastAnchor: string | null = parentOverride;

    for (const entry of entries) {
      if (entry.href && !entry.topics) {
        // Plain anchor/leaf entry
        flat.push({
          href: entry.href,
          title: deriveTitle(entry.href),
          parentPath: parentOverride,
          tocOrder: order++,
          children: [],
        });
        lastAnchor = entry.href;
      } else if (entry.href && entry.topics) {
        // Entry with nested topics — entry itself is parent of its children
        flat.push({
          href: entry.href,
          title: deriveTitle(entry.href),
          parentPath: parentOverride,
          tocOrder: order++,
          children: [],
        });
        walk(entry.topics, entry.href);
        lastAnchor = entry.href;
      } else if (!entry.href && entry.topics) {
        // Orphan `- topics:` list — these are children of the last anchor at current level
        walk(entry.topics, lastAnchor);
      }
    }
  }

  for (const doc of docs) {
    if (Array.isArray(doc)) {
      walk(doc as RawTocEntry[], null);
    } else if (doc && typeof doc === "object") {
      const obj = doc as RawTocEntry;
      if (obj.href && obj.topics) {
        flat.push({
          href: obj.href,
          title: deriveTitle(obj.href),
          parentPath: null,
          tocOrder: order++,
          children: [],
        });
        walk(obj.topics, obj.href);
      } else if (obj.href) {
        flat.push({
          href: obj.href,
          title: deriveTitle(obj.href),
          parentPath: null,
          tocOrder: order++,
          children: [],
        });
      } else if (obj.topics) {
        walk(obj.topics, null);
      }
    }
  }

  return flat;
}

function deriveTitle(href: string): string {
  const filename = href.split("/").pop() ?? href;
  const base = filename.replace(/\.md$/i, "");
  return base
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Builds a tree from the flat list for consumers that want hierarchy.
 */
export function buildTree(flat: TocNode[]): TocNode[] {
  const byPath = new Map<string, TocNode>();
  const roots: TocNode[] = [];

  for (const node of flat) {
    byPath.set(node.href, { ...node, children: [] });
  }

  for (const node of flat) {
    const copy = byPath.get(node.href)!;
    if (node.parentPath && byPath.has(node.parentPath)) {
      byPath.get(node.parentPath)!.children.push(copy);
    } else {
      roots.push(copy);
    }
  }

  return roots;
}
