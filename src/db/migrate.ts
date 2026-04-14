import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../env";
import { log, logError } from "../lib/logger";

const MODULE = "migrate";

async function main(): Promise<void> {
  log(MODULE, "Connecting to database");
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    log(MODULE, "Running migrations from src/db/migrations");
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    log(MODULE, "Migrations complete");
  } catch (err) {
    logError(MODULE, "Migration failed", { error: String(err) });
    throw err;
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
