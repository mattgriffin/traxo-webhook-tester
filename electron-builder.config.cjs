module.exports = {
  appId: 'com.traxo.webhook-tester',
  productName: 'Traxo Webhook Tester',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
  ],
  mac: {
    target: ['dmg'],
    category: 'public.app-category.developer-tools',
  },
  win: {
    target: ['nsis'],
  },
  nsis: {
    oneClick: true,
    perMachine: false,
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Development',
  },
  publish: {
    provider: 'github',
    owner: 'mattgriffin',
    repo: 'traxo-webhook-tester',
  },
};
