// Second pass: wraps any string/template literal whose fixed text shows up in English on a rendered page
// (crawl list in argv[2]). Skips keys, comparisons, types, imports and non-text JSX attributes.
import ts from "typescript"
import fs from "node:fs"
import path from "node:path"
const seen = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
const hay = seen.join("\n")
const SKIP = /(\.test\.|\.d\.ts$|\/dev\/|src\/i18n\/|src\/lib\/i18n\.ts|coach\/texts\.ts|\/testing\.ts$|\/seed\/|scripts\/)/
const NONTEXT_ATTR = /^(className|key|href|id|src|type|name|role|variant|size|tone|color|kind|sheet|htmlFor|value|as|side|align|format|metric|icon|data-.*|inputMode|autoComplete|method|action|rel|target|lang|dir|mode|sizes|media)$/
const files = []
;(function walk(p) { const s = fs.statSync(p); if (s.isDirectory()) fs.readdirSync(p).forEach((f) => walk(path.join(p, f))); else if (/\.tsx?$/.test(p) && !SKIP.test(p)) files.push(p) })("src")
const q = JSON.stringify
let changed = 0, wrapped = 0
const isTr = (n) => n && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "tr" || n.expression.text === "t")
function blocked(n) {
  const p = n.parent
  if (!p) return true
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true
  if (ts.isPropertyAssignment(p) && p.name === n) return true
  if (ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p)) return true
  if (ts.isCaseClause(p)) return true
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return true
  if (ts.isJsxAttribute(p) && NONTEXT_ATTR.test(p.name.getText())) return true
  if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent) && NONTEXT_ATTR.test(p.parent.name.getText())) return true
  if (ts.isCallExpression(p) && isTr(p)) return true
  if (ts.isCallExpression(p) && /^(cn|clsx|require|import|setAttribute|querySelector|getElementById|addEventListener|startsWith|endsWith|includes|split|replace|get|has|set|test|match|fetch|redirect|revalidatePath|push|router\.push|notFound|eq|sql|cookies|headers)$/.test(p.expression.getText().split(".").pop())) return true
  for (let a = p; a; a = a.parent) {
    if (ts.isTypeNode(a) || ts.isTypeAliasDeclaration(a) || ts.isInterfaceDeclaration(a) || ts.isEnumDeclaration(a)) return true
    if (isTr(a)) return true
    if (ts.isAsExpression(a) && a.type.getText() === "const") return true
    if (ts.isBlock(a) || ts.isSourceFile(a)) break
  }
  return false
}
function pieces(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return { parts: [n.text], key: n.text, args: [] }
  const parts = [n.head.text], args = []
  let key = n.head.text
  n.templateSpans.forEach((sp, i) => { args.push(sp.expression.getText()); parts.push(sp.literal.text); key += `{${i}}` + sp.literal.text })
  return { parts, key, args }
}
for (const f of files) {
  const src = fs.readFileSync(f, "utf8")
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  ;(function v(n) {
    if (isTr(n)) return
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && !blocked(n)) {
      const { parts, key, args } = pieces(n)
      const words = (key.match(/[A-Za-z]{2,}/g) || []).length
      const statics = parts.map((s) => s.trim()).filter((s) => /[A-Za-z]{2,}/.test(s))
      if (words >= 1 && statics.length && statics.every((s) => hay.includes(s)) && !/^[a-z0-9_.\-/:]+$/.test(key.trim()) && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.?$/.test(key.trim())) {
        const rep = args.length ? `tr(${q(key)}, [${args.join(", ")}])` : `tr(${q(key)})`
        const inJsxAttr = n.parent && ts.isJsxAttribute(n.parent)
        edits.push([n.getStart(), n.getEnd(), inJsxAttr ? `{${rep}}` : rep])
        return
      }
    }
    ts.forEachChild(n, v)
  })(sf)
  if (!edits.length) continue
  edits.sort((a, b) => b[0] - a[0])
  let out = src
  for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e)
  if (!/import \{[^}]*\bt as tr\b[^}]*\} from "@\/lib\/i18n"/.test(out) && !/from "\.\/i18n"/.test(out)) {
    const imports = sf.statements.filter(ts.isImportDeclaration)
    const at = imports.length ? imports.at(-1).getEnd() : (() => { const d = sf.statements[0]; return d && ts.isExpressionStatement(d) && ts.isStringLiteral(d.expression) ? d.getEnd() : 0 })()
    out = out.slice(0, at) + `\nimport { t as tr } from "@/lib/i18n"` + out.slice(at)
  }
  fs.writeFileSync(f, out)
  changed++; wrapped += edits.length
}
console.error(`files ${changed}, wrapped ${wrapped}`)
