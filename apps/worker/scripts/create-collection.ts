// Script sekali-jalan: buat collection Astra DB kalau belum ada.
// Jalankan manual: `pnpm --filter worker exec tsx scripts/create-collection.ts`
// (baca kredensial dari .dev.vars di root apps/worker). Worker TIDAK memanggil
// ini otomatis — pembuatan collection bukan bagian dari hot path request.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DataAPIClient } from "@datastax/astra-db-ts";

function loadDevVars(): Record<string, string> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const path = join(dir, "..", ".dev.vars");
  const content = readFileSync(path, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key) vars[key] = rest.join("=");
  }
  return vars;
}

async function ensureCollection(
  db: ReturnType<DataAPIClient["db"]>,
  collectionName: string,
): Promise<void> {
  const existing = await db.listCollections();
  if (existing.some((c) => c.name === collectionName)) {
    console.log(`Collection "${collectionName}" sudah ada, tidak ada yang dilakukan.`);
    return;
  }

  await db.createCollection(collectionName);
  console.log(`Collection "${collectionName}" berhasil dibuat.`);
}

async function main() {
  const vars = loadDevVars();
  const endpoint = vars.ASTRA_DB_API_ENDPOINT;
  const token = vars.ASTRA_DB_APPLICATION_TOKEN;
  const comicsCollection = vars.ASTRA_DB_COLLECTION ?? "comics";
  const processLogCollection = vars.PROCESS_LOG_COLLECTION ?? "process_log";

  if (!endpoint || !token) {
    throw new Error(
      "ASTRA_DB_API_ENDPOINT / ASTRA_DB_APPLICATION_TOKEN tidak ditemukan di apps/worker/.dev.vars",
    );
  }

  const client = new DataAPIClient(token);
  const db = client.db(endpoint);

  await ensureCollection(db, comicsCollection);
  await ensureCollection(db, processLogCollection);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
