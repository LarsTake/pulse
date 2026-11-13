// Lists every key passed to tr()/t() in src (the English text), for src/i18n/de.ts.  node scripts/i18n-keys.mjs > keys.json
import ts from "typescript"
import fs from "node:fs"
import path from "node:path"
const keys = new Set()
;(function walk(p) {
  const st = fs.statSync(p)
  if (st.isDirectory()) return fs.readdirSync(p).forEach((f) => walk(path.join(p, f)))
  if (!/\.(tsx?|mts)$/.test(p) || /\.test\.|src\/i18n\//.test(p)) return
  const sf = ts.createSourceFile(p, fs.readFileSync(p, "utf8"), ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  ;(function v(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ["tr", "t"].includes(n.expression.text) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0])))
      keys.add(n.arguments[0].text)
    ts.forEachChild(n, v)
  })(sf)
})("src")
console.log(JSON.stringify([...keys].sort(), null, 1))
