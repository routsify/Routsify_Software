import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app", "components"];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) files.push(target);
  }
}

for (const root of roots) if (fs.existsSync(root)) walk(root);

const failures = [];
const pageRoutePatterns = files
  .filter((file) => /app\/.*page\.(tsx|jsx)$/.test(file) && !file.startsWith(`app${path.sep}api${path.sep}`))
  .map((file) => {
    const relative = path.relative("app", path.dirname(file));
    const segments = relative === "" ? [] : relative.split(path.sep).filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith("@"));
    const source = segments.map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return ".*";
      if (/^\[\.\.\..+\]$/.test(segment)) return ".+";
      if (/^\[.+\]$/.test(segment)) return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("/");
    return new RegExp(`^/${source}${source ? "/?" : ""}$`);
  });

function tagName(node) {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : node.tagName.getText();
}

function attribute(node, name) {
  return node.attributes.properties.find((property) =>
    ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function stringAttribute(node, name) {
  const found = attribute(node, name);
  if (!found || !ts.isJsxAttribute(found) || !found.initializer) return null;
  if (ts.isStringLiteral(found.initializer)) return found.initializer.text;
  return "expression";
}

function hrefTemplate(node) {
  const found = attribute(node, "href");
  if (!found || !ts.isJsxAttribute(found) || !found.initializer) return null;
  if (ts.isStringLiteral(found.initializer)) return found.initializer.text;
  if (!ts.isJsxExpression(found.initializer) || !found.initializer.expression) return null;
  const expression = found.initializer.expression;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (!ts.isTemplateExpression(expression)) return null;
  return expression.head.text + expression.templateSpans.map((span) => `__param__${span.literal.text}`).join("");
}

function isKnownPageHref(value) {
  if (!value.startsWith("/") || value.startsWith("/api/")) return true;
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  return pageRoutePatterns.some((pattern) => pattern.test(pathname));
}

function ancestorForm(node) {
  let current = node.parent;
  while (current) {
    if ((ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) && tagName(ts.isJsxElement(current) ? current.openingElement : current) === "form") {
      return ts.isJsxElement(current) ? current.openingElement : current;
    }
    current = current.parent;
  }
  return null;
}

for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const tag = tagName(opening);
      const line = source.getLineAndCharacterOfPosition(opening.getStart()).line + 1;
      if (tag === "button") {
        const type = stringAttribute(opening, "type");
        if (!type) failures.push(`${file}:${line} button without an explicit type`);
        if (type === "button" && !attribute(opening, "onClick") && !attribute(opening, "formAction")) {
          failures.push(`${file}:${line} type="button" has no action`);
        }
        if (type === "submit") {
          const form = ancestorForm(opening);
          if (!form || (!attribute(form, "onSubmit") && !attribute(form, "action") && !attribute(opening, "formAction"))) {
            failures.push(`${file}:${line} submit button is not connected to a form action`);
          }
        }
      }
      if (tag === "a" || tag === "Link") {
        const href = stringAttribute(opening, "href");
        if (!href || href === "#" || href.toLowerCase().startsWith("javascript:")) {
          failures.push(`${file}:${line} ${tag} has no meaningful href`);
        }
        const localHref = hrefTemplate(opening);
        if (localHref && !isKnownPageHref(localHref)) {
          failures.push(`${file}:${line} internal href does not match an application page: ${localHref}`);
        }
      }
      if (["div", "span", "article", "tr", "td"].includes(tag) && attribute(opening, "onClick")) {
        failures.push(`${file}:${line} non-semantic <${tag}> uses onClick`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (failures.length) {
  console.error("UI action validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UI action validation passed across ${files.length} TSX/JSX files.`);
