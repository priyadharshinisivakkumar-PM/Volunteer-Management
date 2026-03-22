import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const localizedSourceFiles = [
  resolve(process.cwd(), "src/App.jsx"),
  resolve(process.cwd(), "src/visitorPassUi.js"),
  resolve(process.cwd(), "../backend/src/index.js")
];

const mojibakeChecks = [
  {
    label: "replacement character",
    pattern: /\uFFFD/u
  },
  {
    label: "Latin-1 decoded Tamil prefix",
    pattern: /\u00E0\u00AE|\u00E0\u00AF/u
  },
  {
    label: "double-encoded UTF-8 marker",
    pattern: /\u00C3\u00A0|\u00C2[\u0080-\u00BF]/u
  }
];

afterEach(() => {
  localStorage.clear();
});

test("localized source files stay UTF-8 clean", () => {
  for (const filePath of localizedSourceFiles) {
    const source = readFileSync(filePath, "utf8");

    expect(/[\u0B80-\u0BFF]/u.test(source)).toBe(true);

    for (const { label, pattern } of mojibakeChecks) {
      expect(source, `${filePath} contains ${label}`).not.toMatch(pattern);
    }
  }
});
