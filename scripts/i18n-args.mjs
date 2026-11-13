// Wraps English string literals passed as arguments to tr(..., [args]) so the fragments translate too.
import ts from "typescript";
import fs from "node:fs";
import { execSync } from "node:child_process";
const files = execSync("grep -rl 'tr(' src --include=*.ts --include=*.tsx").toString().trim().split("\n");
let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const lit = (n) => {
    if (!n) return;
    if (ts.isParenthesizedExpression(n)) return lit(n.expression);
    if (ts.isConditionalExpression(n)) { lit(n.whenTrue); lit(n.whenFalse); return; }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(n.operatorToken.kind)) { lit(n.right); return; }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /[A-Za-z]{2}/.test(n.text) && !/^[a-z]+[A-Z_]|^\/|^#|^var\(/.test(n.text)) {
      edits.push([n.getStart(sf), n.getEnd(), `tr(${JSON.stringify(n.text)})`]);
    }
  };
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "tr" && n.arguments.length === 2 && ts.isArrayLiteralExpression(n.arguments[1])) {
      for (const el of n.arguments[1].elements) lit(el);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);
  fs.writeFileSync(f, out);
  total += edits.length;
  console.log(f, edits.map((e) => e[2]).join(" "));
}
console.log("wrapped", total);
