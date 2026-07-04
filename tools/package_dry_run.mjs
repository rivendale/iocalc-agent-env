#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  "packages/protocol",
  "packages/adapters",
  "packages/conformance",
  "packages/mcp-server"
];

const errors = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

for (const relPath of packages) {
  const packageDir = path.join(root, relPath);
  const pkg = readJson(path.join(packageDir, "package.json"));
  const tarballName = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`;
  const tarballPath = path.join(packageDir, tarballName);
  if (fs.existsSync(tarballPath)) fs.unlinkSync(tarballPath);
  const result = spawnSync("npm", ["pack"], {
    cwd: packageDir,
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: path.join(root, ".tmp", "npm-pack-cache"),
      npm_config_cache: path.join(root, ".tmp", "npm-pack-cache")
    },
    encoding: "utf8"
  });
  const packOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0) {
    errors.push(`${pkg.name} pack failed with exit ${result.status}: ${packOutput.trim()}`);
    continue;
  }
  if (!fs.existsSync(tarballPath)) {
    errors.push(`${pkg.name} pack did not produce ${tarballName}`);
    continue;
  }
  const tar = spawnSync("tar", ["-tzf", tarballPath], {
    cwd: packageDir,
    encoding: "utf8"
  });
  fs.unlinkSync(tarballPath);
  if (tar.status !== 0) {
    errors.push(`${pkg.name} tarball inspection failed with exit ${tar.status}: ${(tar.stderr || "").trim()}`);
    continue;
  }
  const tarOutput = tar.stdout || "";
  const required = ["package.json", "README.md", "dist/index.js", "dist/index.d.ts"];
  for (const file of required) {
    if (!tarOutput.includes(`package/${file}`)) errors.push(`${pkg.name} pack missing ${file}`);
  }
  if (pkg.name === "@iocalc/mcp-server") {
    for (const file of ["dist/stdio.js", "dist/stdio.d.ts"]) {
      if (!tarOutput.includes(`package/${file}`)) errors.push(`${pkg.name} pack missing ${file}`);
    }
  }
  console.log(`${pkg.name}: pack contents ok`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
