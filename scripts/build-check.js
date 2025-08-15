#!/usr/bin/env node

/**
 * Build Check Script
 * Validates that all required files exist and the extension structure is correct
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'manifest.json',
  'src/background/background-main.js',
  'src/content/content-main.js',
  'src/popup/popup.html',
  'src/popup/popup-main.js'
];

const requiredDirectories = [
  'src/core/interfaces',
  'src/core/services',
  'src/core/types',
  'src/platforms/base',
  'src/platforms/threads',
  'src/platforms/instagram',
  'src/platforms/facebook',
  'src/shared/utils',
  'src/shared/constants'
];

function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required file: ${filePath}`);
    return false;
  }
  console.log(`✅ Found: ${filePath}`);
  return true;
}

function checkDirectoryExists(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    console.error(`❌ Missing required directory: ${dirPath}`);
    return false;
  }
  console.log(`✅ Found directory: ${dirPath}`);
  return true;
}

function validateManifest() {
  try {
    const manifestPath = path.join(process.cwd(), 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Check manifest version
    if (manifest.manifest_version !== 3) {
      console.error('❌ Manifest must use version 3');
      return false;
    }

    // Check required permissions
    const requiredPermissions = ['activeTab', 'downloads', 'storage'];
    for (const permission of requiredPermissions) {
      if (!manifest.permissions.includes(permission)) {
        console.error(`❌ Missing required permission: ${permission}`);
        return false;
      }
    }

    console.log('✅ Manifest validation passed');
    return true;
  } catch (error) {
    console.error('❌ Failed to validate manifest:', error.message);
    return false;
  }
}

function main() {
  console.log('🔍 Running build check...\n');

  let allChecksPass = true;

  // Check required files
  console.log('Checking required files:');
  for (const file of requiredFiles) {
    if (!checkFileExists(file)) {
      allChecksPass = false;
    }
  }

  console.log('\nChecking required directories:');
  for (const dir of requiredDirectories) {
    if (!checkDirectoryExists(dir)) {
      allChecksPass = false;
    }
  }

  console.log('\nValidating manifest:');
  if (!validateManifest()) {
    allChecksPass = false;
  }

  if (allChecksPass) {
    console.log('\n🎉 All build checks passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Build check failed. Please fix the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFileExists, checkDirectoryExists, validateManifest };
