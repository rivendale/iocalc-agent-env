#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedLicense = "MIT-0 OR Apache-2.0";
const packagePaths = [
  "package.json",
  "packages/protocol/package.json",
  "packages/adapters/package.json",
  "packages/conformance/package.json",
  "packages/mcp-server/package.json",
];

const errors = [];

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function requireText(relPath, needle) {
  const text = readText(relPath);
  if (!text.includes(needle)) errors.push(`${relPath} missing ${needle}`);
}

requireText("LICENSE", `SPDX-License-Identifier: ${expectedLicense}`);
requireText("LICENSE-MIT-0", "MIT No Attribution");
requireText("LICENSE-APACHE-2.0", "Apache License");

for (const relPath of packagePaths) {
  const pkg = readJson(relPath);
  if (pkg.license !== expectedLicense) {
    errors.push(`${relPath} license is ${JSON.stringify(pkg.license)}, expected ${JSON.stringify(expectedLicense)}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`license metadata ok: ${expectedLicense}`);
