const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'server', 'src'));
let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/await db\.prepare/g, 'db.prepare');
  content = content.replace(/await db\.exec/g, 'db.exec');
  if (file.endsWith('seed.ts') || file.endsWith('index.ts')) {
     // Don't touch seed.ts specific things or handle if needed
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplaced++;
    console.log(`Fixed ${file}`);
  }
}

console.log(`Fixed ${totalReplaced} files.`);
