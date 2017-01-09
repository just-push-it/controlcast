'use strict';
/* eslint no-console: 0 */

const packager = require('electron-packager');
const version = require('../package.json').version;

const pack_options = {
  platform: 'win32',
  arch: 'x64',
  dir: '../',
  out: '../dist',
  asar: false,
  prune: true,
  overwrite: true,
  icon: '../images/icon.ico',
  ignore: '^/.idea|^/build|^/dist|^/node_modules/(electron-*|grunt|grunt-*|rmdir)|^/Gruntfile.js|^/clr/assets/images/*',
  'version-string': {
    CompanyName: 'DBKynd',
    LegalCopyright: 'Copyright (C) 2017 DBKynd',
    FileDescription: 'ControlCast',
    OriginalFilename: 'ControlCast.exe',
    ProductName: 'ControlCast',
    InternalName: 'ControlCast',
  },
  'app-copyright': 'Copyright (C) 2017 DBKynd',
  'app-version': version,
  'build-version': version,
};

packager(pack_options, (err) => {
  if (err) {
    console.log('error:', err);
    return;
  }
  console.log('Packaging complete');
});
