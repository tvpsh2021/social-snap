#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const MANIFEST_JSON = path.join(ROOT, 'manifest.json');

const BUMP_TYPES = ['major', 'minor', 'patch'];

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const [major, minor, patch] = parts;
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

const bumpType = process.argv[2];

if (!BUMP_TYPES.includes(bumpType)) {
  console.error(`Usage: node scripts/bump-version.js <major|minor|patch>`);
  process.exit(1);
}

const pkg = readJson(PACKAGE_JSON);
const manifest = readJson(MANIFEST_JSON);

const currentVersion = pkg.version;
const newVersion = bumpVersion(currentVersion, bumpType);

pkg.version = newVersion;
manifest.version = newVersion;

writeJson(PACKAGE_JSON, pkg);
writeJson(MANIFEST_JSON, manifest);

console.log(`${currentVersion} -> ${newVersion}`);
