/* eslint-disable security/detect-non-literal-fs-filename */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const appDir = path.join(rootDir, "app");
const scanDirs = ["app", "lib"];
const issues = [];

const walk = (dir) => {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if ([".next", "node_modules"].includes(entry)) return [];
      return walk(fullPath);
    }

    return /\.(tsx?|jsx?|mjs|cjs|js)$/.test(entry) ? [fullPath] : [];
  });
};

const relative = (filePath) => path.relative(rootDir, filePath);

const middlewareFiles = [rootDir, appDir]
  .flatMap((dir) => walk(dir))
  .filter((filePath) =>
    /(^|\/)middleware\.(tsx?|jsx?|mjs|cjs|js)$/.test(filePath),
  );

for (const filePath of middlewareFiles) {
  issues.push(
    `${relative(filePath)}: Next.js 16 uses proxy.ts/proxy.js instead of middleware.ts.`,
  );
}

const requestApiPattern = /\b(cookies|headers|draftMode)\s*\(\s*\)/g;
const syncRoutePropTypePattern =
  /^\s*(params|searchParams)\??\s*:\s*(?!(?:Promise|Awaited)\b)[{<A-Za-z]/;
const appRouterEntryPattern =
  /\/(page|layout|route|default|opengraph-image|twitter-image|icon|apple-icon)\.(tsx?|jsx?|mjs|cjs|js)$/;

for (const dirName of scanDirs) {
  for (const filePath of walk(path.join(rootDir, dirName))) {
    const source = readFileSync(filePath, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) return;

      for (const match of trimmed.matchAll(requestApiPattern)) {
        const before = trimmed.slice(0, match.index).trimEnd();
        if (!before.endsWith("await")) {
          issues.push(
            `${relative(filePath)}:${index + 1}: await ${match[1]}() in Next.js 16.`,
          );
        }
      }

      if (
        filePath.startsWith(appDir) &&
        appRouterEntryPattern.test(filePath) &&
        syncRoutePropTypePattern.test(trimmed)
      ) {
        issues.push(
          `${relative(filePath)}:${index + 1}: type route params/searchParams as Promise in Next.js 16.`,
        );
      }
    });
  }
}

if (issues.length > 0) {
  console.error("Next.js 16 request API guard failed:");
  console.error(issues.map((issue) => `- ${issue}`).join("\n"));
  process.exit(1);
}

console.log("Next.js 16 request API guard passed.");
