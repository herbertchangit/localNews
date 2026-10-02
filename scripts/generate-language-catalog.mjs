import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const output = path.join(sourceRoot, "generatedLanguageCatalog.ts");
const visibleAttributes = new Set(["aria-label", "alt", "placeholder", "title"]);
const visibleProperties = new Set(["description", "emptyText", "label", "placeholder", "title"]);
const noticeFunctions = new Set(["alert", "confirm", "flash", "setError", "setNotice", "setSuccess"]);
const entries = new Map();

function pageName(file) {
  return path.basename(file, path.extname(file))
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isWording(value) {
  if (value.length < 2 || value.length > 500 || !/[A-Za-z]/.test(value)) return false;
  if (/^(https?:|\/api\/|\/newsroom|\.\/|\.\.|data:)/i.test(value)) return false;
  if (/^[a-z][\w-]*(?:\s+[a-z][\w-]*){0,1}$/i.test(value) && /[-_]/.test(value)) return false;
  if (/^(button|checkbox|dialog|email|password|submit|text|true|false|null|undefined)$/i.test(value)) return false;
  if (/^[.#][\w-]+$/.test(value) || /^[\w-]+\.(?:css|tsx?|json|png|jpe?g|webp|svg)$/i.test(value)) return false;
  return true;
}

function add(raw, page) {
  const normalized = normalize(raw);
  const firstChinese = normalized.search(/[\u3400-\u9fff]/);
  let source = normalized;
  let inlineChinese;
  if (firstChinese > 0) {
    let divider = -1;
    let dividerLength = 0;
    for (const separator of [" / ", " · "]) {
      const position = normalized.lastIndexOf(separator, firstChinese);
      if (position > divider) {
        divider = position;
        dividerLength = separator.length;
      }
    }
    const english = normalized.slice(0, divider).trim();
    const chinese = normalized.slice(divider + dividerLength).trim();
    if (divider > 0 && /[A-Za-z]/.test(english) && /[\u3400-\u9fff]/.test(chinese)) {
      source = english;
      inlineChinese = chinese;
    }
  }
  if (!isWording(source)) return;
  const entry = entries.get(source) || { pages: new Set(), inlineChinese: undefined };
  entry.pages.add(page);
  if (!entry.inlineChinese && inlineChinese) entry.inlineChinese = inlineChinese;
  entries.set(source, entry);
}

function literalText(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function collectExpression(node, page) {
  const value = literalText(node);
  if (value !== null) {
    add(value, page);
    return;
  }
  if (ts.isParenthesizedExpression(node)) collectExpression(node.expression, page);
  if (ts.isConditionalExpression(node)) {
    collectExpression(node.whenTrue, page);
    collectExpression(node.whenFalse, page);
  }
}

function visit(node, page) {
  if (ts.isJsxText(node)) add(node.getText(), page);

  if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.text)) {
    if (node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer.text, page);
    if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      collectExpression(node.initializer.expression, page);
    }
  }

  if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
    if (node.expression) collectExpression(node.expression, page);
  }

  if (ts.isPropertyAssignment(node)) {
    const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
    if (visibleProperties.has(name)) {
      const value = literalText(node.initializer);
      if (value !== null) add(value, page);
    }
  }

  if (ts.isCallExpression(node)) {
    const expressionName = ts.isIdentifier(node.expression)
      ? node.expression.text
      : ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : "";
    if (noticeFunctions.has(expressionName)) {
      for (const argument of node.arguments) {
        const value = literalText(argument);
        if (value !== null) add(value, page);
      }
    }
  }

  ts.forEachChild(node, (child) => visit(child, page));
}

const files = fs.readdirSync(sourceRoot, { recursive: true })
  .map((file) => String(file))
  .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx") && file !== "generatedLanguageCatalog.ts")
  .sort();

for (const relative of files) {
  const absolute = path.join(sourceRoot, relative);
  const contents = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(absolute, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  visit(sourceFile, pageName(relative));
}

const catalog = [...entries.entries()]
  .map(([source, entry]) => ({ source, pages: [...entry.pages].sort(), ...(entry.inlineChinese ? { inlineChinese: entry.inlineChinese } : {}) }))
  .sort((a, b) => a.source.localeCompare(b.source));
const banner = "// Generated by scripts/generate-language-catalog.mjs. Do not edit manually.\n";
fs.writeFileSync(output, `${banner}export type LanguageCatalogEntry = { source: string; pages: string[]; inlineChinese?: string };\nexport const GENERATED_LANGUAGE_CATALOG: LanguageCatalogEntry[] = ${JSON.stringify(catalog, null, 2)};\n`);
console.log(`Generated ${catalog.length} interface wordings from ${files.length} pages.`);
