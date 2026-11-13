// Turns English template literals into tr("… {0} …", [expr]) calls. Skips class names, URLs, keys and model prompts.
import ts from "typescript";
import fs from "node:fs";
import { execSync } from "node:child_process";
const SKIP = /(__fixtures__|\.test\.|src\/core\/scoring|src\/server\/coach|src\/server\/sources|src\/server\/db|src\/i18n|src\/lib\/i18n|\/dev\/)/;
const files = execSync("find src -name '*.ts' -o -name '*.tsx'").toString().trim().split("\n").filter((f) => !SKIP.test(f));
const english = (s) => /[A-Za-z]{2,}[,.:]? [a-z]{2,}/.test(s) && !/\b[a-z]+-[a-z0-9[]|^\s*\/|https?:|[{}<>=;]|\bvar\(|\bselect\b|\bfrom "|\bwhere\b.*=|\$\{/.test(s);
let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const bad = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p) && /^(className|href|key|id|src|style|d|viewBox|data-|htmlFor|role|type|name|value)/.test(p.name.getText(sf))) return true;
      if (ts.isPropertyAssignment(p) && /^(key|href|className|id|path|code|url|query)$/.test(p.name.getText(sf))) return true;
      if (ts.isCallExpression(p)) {
        const c = p.expression.getText(sf);
        if (/^(cn|clsx|console\.\w+|tr|t|request|fetch|redirect|revalidatePath|sql|new Error|Error|log|logger\.\w+|URL|encodeURIComponent|generateText|streamText)$/.test(c) || /\.(get|set|has|startsWith|endsWith|includes|split|join|replace|match|test|querySelector|push|log|warn|error)$/.test(c)) return true;
      }
      if (ts.isNewExpression(p) || ts.isThrowStatement(p) || ts.isTaggedTemplateExpression(p) || ts.isImportDeclaration(p)) return true;
      if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return true;
      if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isMethodDeclaration(p)) break;
    }
    return false;
  };
  const visit = (n) => {
    if (ts.isTemplateExpression(n)) {
      let text = n.head.text;
      const args = [];
      n.templateSpans.forEach((sp, i) => {
        text += `{${i}}` + sp.literal.text;
        args.push(sp.expression.getText(sf));
      });
      const stat = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ");
      if (english(stat) && !bad(n)) {
        edits.push([n.getStart(sf), n.getEnd(), `tr(${JSON.stringify(text)}, [${args.join(", ")}])`]);
        return; // nested templates stay inside the args
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);
  if (!/import \{[^}]*\bt as tr\b[^}]*\} from "@\/lib\/i18n"/.test(out)) {
    const m = out.match(/^(?:(?:"use (?:client|server)";?\s*\n)|(?:\/\/[^\n]*\n))*/);
    const at = m ? m[0].length : 0;
    out = out.slice(0, at) + 'import { t as tr } from "@/lib/i18n";\n' + out.slice(at);
  }
  fs.writeFileSync(f, out);
  total += edits.length;
  console.log(f, edits.length);
}
console.log("wrapped", total);
