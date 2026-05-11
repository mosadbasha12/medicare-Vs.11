const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('href="/favicon.png"')) {
  html = html.replace(
    '<link rel="icon" href="/favicon.ico" />',
    '<link rel="icon" href="/favicon.ico" />\n  <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" />\n  <link rel="apple-touch-icon" href="/favicon.png" />'
  );
}

fs.writeFileSync(indexPath, html);
