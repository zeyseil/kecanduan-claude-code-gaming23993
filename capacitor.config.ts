import type { CapacitorConfig } from "@capacitor/cli";

// App Android selalu connect ke Worker production — konsisten dengan keputusan
// Tauri (tidak ada mode arah-ke-lokal dari build yang sama). webDir menunjuk ke
// output build production apps/web (VITE_WORKER_URL production ter-bake saat
// `pnpm --filter web build`, proses yang sama seperti deploy Pages).
const config: CapacitorConfig = {
  appId: "com.zeyseil.komiktracker",
  appName: "Komik Tracker",
  webDir: "apps/web/dist",
};

export default config;
