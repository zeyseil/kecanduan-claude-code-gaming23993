// Script migrasi SEKALI-JALAN: Astra tidak bisa mengubah opsi indexing pada
// collection yang sudah ada, jadi collection "comics" harus di-drop dan
// dibuat ulang dengan cover_url dikecualikan dari indexing (field yang
// di-index Astra punya limit ketat 8000 byte — cover_url berisi base64
// gambar yang gampang melebihi itu).
//
// AMAN dijalankan tanpa --confirm: hanya export + tulis file backup lokal,
// TIDAK mengubah apapun di Astra. Baca ringkasan yang ditampilkan dulu,
// lalu jalankan ulang dengan --confirm untuk benar-benar drop + recreate + restore.
//
// Jalankan: `pnpm --filter worker run migrate-cover-index -- --confirm`
import { readFileSync, writeFileSync } from "node:fs";
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

async function main() {
  const vars = loadDevVars();
  const endpoint = vars.ASTRA_DB_API_ENDPOINT;
  const token = vars.ASTRA_DB_APPLICATION_TOKEN;
  const collectionName = vars.ASTRA_DB_COLLECTION ?? "comics";
  const confirmed = process.argv.includes("--confirm");

  if (!endpoint || !token) {
    throw new Error(
      "ASTRA_DB_API_ENDPOINT / ASTRA_DB_APPLICATION_TOKEN tidak ditemukan di apps/worker/.dev.vars",
    );
  }

  const client = new DataAPIClient(token);
  const db = client.db(endpoint);
  const collection = db.collection(collectionName);

  const docs = await collection.find({}).toArray();
  console.log(`Ditemukan ${docs.length} dokumen di collection "${collectionName}".`);

  const backupDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const backupPath = join(backupDir, `backup-${collectionName}-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(docs, null, 2));
  console.log(`Backup ditulis ke: ${backupPath}`);

  if (!confirmed) {
    console.log(
      "\nDry run selesai — belum ada yang diubah di Astra. " +
        "Cek backup di atas dulu, lalu jalankan ulang dengan flag --confirm untuk lanjut " +
        `drop + recreate collection "${collectionName}" + restore ${docs.length} dokumen.`,
    );
    return;
  }

  console.log(`\nMenghapus collection "${collectionName}"...`);
  await db.dropCollection(collectionName);

  console.log(`Membuat ulang "${collectionName}" dengan cover_url dikecualikan dari indexing...`);
  await db.createCollection(collectionName, { indexing: { deny: ["cover_url"] } });

  const restored = db.collection(collectionName);
  // Buang _id internal Astra lama — biarkan Astra generate _id baru, comic_id
  // aplikasi (field terpisah) sudah cukup untuk identitas dokumen.
  const cleanDocs = docs.map((doc) => {
    const clone = { ...doc };
    delete (clone as { _id?: unknown })._id;
    return clone;
  });
  if (cleanDocs.length > 0) {
    await restored.insertMany(cleanDocs);
  }

  console.log(`Migrasi selesai. ${cleanDocs.length} dokumen dikembalikan ke "${collectionName}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
