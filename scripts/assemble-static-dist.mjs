import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const adminDist = path.join(rootDir, "apps", "admin", "dist");
const webDist = path.join(rootDir, "apps", "web", "dist");
const targetAdminDir = path.join(webDist, "admin");

console.log("[Assemble] Starting static artifact assembly...");

if (!fs.existsSync(webDist)) {
  console.error(`[Assemble Error] Public web dist directory does not exist: ${webDist}`);
  console.error("Please ensure '@nearvia/web' has been built first.");
  process.exit(1);
}

if (!fs.existsSync(adminDist)) {
  console.error(`[Assemble Error] Admin console dist directory does not exist: ${adminDist}`);
  console.error("Please ensure '@nearvia/admin' has been built first.");
  process.exit(1);
}

// Clean target directory if present to remove stale hash chunks
if (fs.existsSync(targetAdminDir)) {
  fs.rmSync(targetAdminDir, { recursive: true, force: true });
}

// Copy apps/admin/dist into apps/web/dist/admin
fs.cpSync(adminDist, targetAdminDir, { recursive: true });

// Verify critical artifacts exist
const webIndex = path.join(webDist, "index.html");
const adminIndex = path.join(targetAdminDir, "index.html");

if (!fs.existsSync(webIndex)) {
  console.error(`[Assemble Error] Missing ${webIndex}`);
  process.exit(1);
}

if (!fs.existsSync(adminIndex)) {
  console.error(`[Assemble Error] Missing ${adminIndex}`);
  process.exit(1);
}

console.log("[Assemble] Verified: apps/web/dist/index.html (Public Marketplace)");
console.log("[Assemble] Verified: apps/web/dist/admin/index.html (Admin Console)");
console.log("[Assemble] Successfully nested Admin Portal static build into web dist!");
