import { eq } from "drizzle-orm";
import { db, schema } from "./client";
import { log } from "../lib/logger";

const MODULE = "seed";

const REPOS = [
  { slug: "docs-odc", owner: "OutSystems", name: "docs-odc", branch: "main" },
  { slug: "docs-product", owner: "OutSystems", name: "docs-product", branch: "main" },
  { slug: "docs-howtos", owner: "OutSystems", name: "docs-howtos", branch: "main" },
];

async function seed(): Promise<void> {
  log(MODULE, "Seeding initial repos");
  for (const r of REPOS) {
    const existing = await db.select().from(schema.repos).where(eq(schema.repos.slug, r.slug)).limit(1);
    if (existing.length > 0) {
      log(MODULE, `Skipping existing repo`, { slug: r.slug });
      continue;
    }
    await db.insert(schema.repos).values(r);
    log(MODULE, `Inserted repo`, { slug: r.slug });
  }
  log(MODULE, "Seed complete");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
