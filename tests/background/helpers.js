const fs = require('fs');
const path = require('path');

function loadBackgroundScript() {
  // Load shared modules into global scope (simulates importScripts)
  const constants = require('../../src/shared/constants.js');
  Object.assign(global, constants);
  global.PLATFORMS = constants.PLATFORMS;
  global.PLATFORM_HOSTNAMES = constants.PLATFORM_HOSTNAMES;
  const utils = require('../../src/shared/utils.js');
  Object.assign(global, utils);

  // Load background.js source and wrap it so local variables become global
  let bgSource = fs.readFileSync(
    path.join(__dirname, '../../src/background/background.js'),
    'utf8'
  );

  // Replace const/let declarations at top level with global assignments
  // so they are accessible from test code
  const globalsToExpose = [
    'dataManager', 'downloadManager', 'extractingTabs',
    'fbVideoUrls', 'cleanFbVideoUrl', 'parseEfgParam'
  ];

  // Replace 'const dataManager' etc. with assignments that also set global
  globalsToExpose.forEach(name => {
    // Match const/let/var followed by the name and =
    const regex = new RegExp(`(?:const|let|var)\\s+(${name})\\s*=`, 'g');
    bgSource = bgSource.replace(regex, `global.${name} =`);
  });

  // Replace function declarations with global assignments
  ['cleanFbVideoUrl', 'parseEfgParam'].forEach(name => {
    bgSource = bgSource.replace(
      new RegExp(`function\\s+${name}\\s*\\(`),
      `global.${name} = function(`
    );
  });

  eval(bgSource); // background.js has no module exports; eval is the only viable loader
}

module.exports = { loadBackgroundScript };
