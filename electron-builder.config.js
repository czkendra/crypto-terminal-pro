/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.cnaxsoftware.cryptoterminal',
  productName: 'Crypto Terminal Pro',
  directories: {
    buildResources: 'resources',
    output: 'release'
  },
  files: [
    {
      from: 'out/main',
      to: 'out/main'
    },
    {
      from: 'out/preload',
      to: 'out/preload'
    },
    {
      from: 'out/renderer',
      to: 'out/renderer',
      filter: ['**/*', '!**/*.map']
    },
    'package.json'
  ],
  mac: {
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
    category: 'public.app-category.finance'
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }]
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }]
  }
}
