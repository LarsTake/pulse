// Merges translation JSON files ({ english: german }) into src/i18n/de.ts, sorted by key.
import fs from "node:fs";
const path = "src/i18n/de.ts";
const src = fs.readFileSync(path, "utf8");
const head = src.split("export const de")[0];
const de = new Function(src.replace(/^export const de[^=]*=/m, "return "))();
for (const f of process.argv.slice(2)) Object.assign(de, JSON.parse(fs.readFileSync(f, "utf8")));
const keys = Object.keys(de).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
fs.writeFileSync(path, `${head}export const de: Record<string, string> = {\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(de[k])},`).join("\n")}\n};\n`);
console.log(keys.length, "entries");
