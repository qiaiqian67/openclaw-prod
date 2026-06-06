const a = require('@electron/asar');
const c = a.extractFile('release-v5/win-unpacked/resources/app.asar', 'dist\\assets\\index-79q9DUJw.css').toString('utf8');
const i = c.indexOf('-webkit-app-region');
console.log('drag region at offset:', i);
console.log('---');
console.log(c.substring(Math.max(0, i - 100), i + 600));
