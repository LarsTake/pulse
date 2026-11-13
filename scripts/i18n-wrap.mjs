// One-off codemod: wraps user-facing English text in `tr()` (src/lib/i18n.ts) and prints the keys it wrapped.
//   node scripts/i18n-wrap.mjs [--dry] [paths...]
// Wraps: JSX text; string/template literals in copy attributes and copy object properties; template literals that are
// JSX children. Skips type positions, className, imports, tests, dev pages, already-wrapped calls and keys.
import ts from "typescript"
import fs from "node:fs"
import path from "node:path"

const DRY = process.argv.includes("--dry")
const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const SKIP = /(\.test\.|\.d\.ts$|__fixtures__|\/dev\/|src\/i18n\/|src\/lib\/i18n\.ts|coach\/texts\.ts|\/testing\.ts$)/

const ATTRS = new Set(["aria-label", "title", "placeholder", "label", "description", "body", "summary", "alt", "caption", "hint", "aside", "text", "heading", "subtitle", "emptyText", "describe", "leadingText"])
const PROPS = new Set(["label", "title", "body", "short", "long", "word", "text", "description", "aside", "explain", "summary", "hint", "caption", "heading", "subtitle", "message", "error", "empty", "note", "cta", "headline", "detail", "tip", "why", "what", "action", "question", "answer", "lead", "intro", "sub", "subtext", "reason", "copy", "ctaLabel", "doneTitle", "doneBody", "line", "info", "tooltip", "legend", "prompt", "chip", "status"])

const files = []
function walk(p) {
  const st = fs.statSync(p)
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f))
  else if (/\.(tsx?|mts)$/.test(p) && !SKIP.test(p)) files.push(p)
}
for (const r of roots.length ? roots : ["src"]) walk(r)

const hasWords = (s) => /[A-Za-z]{2,}/.test(s)
const looksCode = (s) => /^[a-z0-9_.:/#@\-\[\]()%=*]+$/.test(s) || /^[A-Z0-9_]+$/.test(s) || /^(https?:|\/|\.\/|#|var\(|--|[a-z]+:\/\/)/.test(s) || /^\w+(\.\w+)+$/.test(s)
const isText = (s) => hasWords(s) && !looksCode(s.trim())
const q = (s) => JSON.stringify(s)

function inType(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isTypeNode(p) || ts.isLiteralTypeNode?.(p) || ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p)) return true
    if (ts.isBlock(p) || ts.isSourceFile(p)) return false
  }
  return false
}
const isTrCall = (n) => n && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "tr"
function insideTr(n) {
  for (let p = n.parent; p && !ts.isSourceFile(p); p = p.parent) if (isTrCall(p)) return true
  return false
}

/** `head ${a} mid ${b} tail` → { key: "head {0} mid {1} tail", args: [a, b] } (source text of each expression). */
function templ(node, src) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return { key: node.text, args: [] }
  let key = node.head.text
  const args = []
  node.templateSpans.forEach((sp, i) => {
    args.push(src.slice(sp.expression.getStart(), sp.expression.getEnd()))
    key += `{${i}}` + sp.literal.text
  })
  return { key, args }
}
const call = ({ key, args }) => (args.length ? `tr(${q(key)}, [${args.join(", ")}])` : `tr(${q(key)})`)

/** React's JSX text whitespace: lines trimmed, blank lines dropped, joined by single spaces. */
function jsxText(raw) {
  const lines = raw.split(/\r?\n/)
  if (lines.length === 1) return { lead: /^\s/.test(raw), text: raw.trim(), trail: /\s$/.test(raw) }
  const parts = lines.map((l, i) => (i === 0 ? l.trimEnd() : i === lines.length - 1 ? l.trimStart() : l.trim())).filter((l) => l.length)
  const joined = parts.join(" ")
  return { lead: /^[ \t]/.test(lines[0]) && lines[0].trim().length > 0, text: joined.trim(), trail: /[ \t]$/.test(lines.at(-1)) && lines.at(-1).trim().length > 0 }
}

const keys = new Set()
let changed = 0

for (const file of files) {
  const src = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []

  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
    if (isTrCall(n)) return

    if (ts.isJsxText(n) && isText(n.text)) {
      const { lead, text, trail } = jsxText(n.text)
      if (text && isText(text)) {
        keys.add(text)
        edits.push([n.getStart(), n.getEnd(), `${lead ? '{" "}' : ""}{tr(${q(text)})}${trail ? '{" "}' : ""}`])
      }
      return
    }

    // A template literal as a JSX child: {`${n} sets`}
    if ((ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ts.isJsxExpression(n.parent) && ts.isJsxElement(n.parent.parent) && !inType(n)) {
      const tp = templ(n, src)
      if (isText(tp.key.replace(/\{\d+\}/g, ""))) {
        keys.add(tp.key)
        edits.push([n.getStart(), n.getEnd(), call(tp)])
        return
      }
    }

    // Copy attributes: label="…" / label={"…"} / label={`…`}
    if (ts.isJsxAttribute(n) && n.initializer) {
      const name = n.name.getText()
      if (ATTRS.has(name)) {
        const init = n.initializer
        const lit = ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) ? init.expression : null
        if (lit && ts.isStringLiteral(lit) && isText(lit.text)) {
          keys.add(lit.text)
          edits.push([init.getStart(), init.getEnd(), `{tr(${q(lit.text)})}`])
          return
        }
        if (lit && (ts.isTemplateExpression(lit) || ts.isNoSubstitutionTemplateLiteral(lit))) {
          const tp = templ(lit, src)
          if (isText(tp.key.replace(/\{\d+\}/g, ""))) {
            keys.add(tp.key)
            edits.push([lit.getStart(), lit.getEnd(), call(tp)])
            return
          }
        }
      }
    }

    // Copy properties: { label: "…" } / { body: `…${x}…` }
    if (ts.isPropertyAssignment(n) && !inType(n)) {
      const name = n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) ? n.name.text : null
      const v = n.initializer
      if (name && PROPS.has(name)) {
        if (ts.isStringLiteral(v) && isText(v.text) && !insideTr(v)) {
          keys.add(v.text)
          edits.push([v.getStart(), v.getEnd(), `tr(${q(v.text)})`])
          return
        }
        if ((ts.isTemplateExpression(v) || ts.isNoSubstitutionTemplateLiteral(v)) && !insideTr(v)) {
          const tp = templ(v, src)
          if (isText(tp.key.replace(/\{\d+\}/g, ""))) {
            keys.add(tp.key)
            edits.push([v.getStart(), v.getEnd(), call(tp)])
            return
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue
  changed++
  if (DRY) continue

  edits.sort((a, b) => b[0] - a[0])
  let out = src
  for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e)
  if (!/import \{[^}]*\bt as tr\b[^}]*\} from "@\/lib\/i18n"/.test(out)) {
    // After the last top-level import (keeps "use client"/"use server" first).
    const imports = sf.statements.filter(ts.isImportDeclaration)
    const at = imports.length ? imports.at(-1).getEnd() : (() => {
      const d = sf.statements[0]
      return d && ts.isExpressionStatement(d) && ts.isStringLiteral(d.expression) ? d.getEnd() : 0
    })()
    // `at` is in the original text; every edit came after the imports, so the offset still holds.
    out = out.slice(0, at) + `\nimport { t as tr } from "@/lib/i18n"` + out.slice(at)
  }
  fs.writeFileSync(file, out)
}

fs.writeFileSync("/tmp/i18n-keys.json", JSON.stringify([...keys].sort(), null, 1))
console.error(`files changed: ${changed}, keys: ${keys.size}`)
