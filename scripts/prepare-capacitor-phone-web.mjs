import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "dist-phone");
const phoneHtml = path.join(outDir, "phone.html");
const indexHtml = path.join(outDir, "index.html");

if (!fs.existsSync(phoneHtml)) {
  throw new Error(`Missing ${phoneHtml}. Run phone web build first.`);
}

fs.copyFileSync(phoneHtml, indexHtml);
console.log("[prepare-capacitor-phone-web] copied phone.html -> index.html");
