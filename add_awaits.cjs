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

for (const file of files) {
  if (file.endsWith('db\\index.ts') || file.endsWith('db/index.ts')) continue;
  if (file.endsWith('db\\migrate.ts') || file.endsWith('db/migrate.ts')) continue;
  if (file.endsWith('db\\seed.ts') || file.endsWith('db/seed.ts')) continue;

  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Add await to db.prepare and db.exec
  content = content.replace(/(?<!await\s)db\.prepare/g, 'await db.prepare');
  content = content.replace(/(?<!await\s)db\.exec/g, 'await db.exec');

  // Add async to transactions
  content = content.replace(/db\.transaction\(\s*\(\s*\)\s*=>/g, 'db.transaction(async () =>');
  content = content.replace(/db\.transaction\(\s*\(([^)]+)\)\s*=>/g, 'db.transaction(async ($1) =>');

  // Add async to specific sync functions that are now async
  content = content.replace(/function isRegistrationEnabled\(/g, 'async function isRegistrationEnabled(');
  content = content.replace(/function getLiveCatalog\(/g, 'async function getLiveCatalog(');
  content = content.replace(/function getCustomerProfile\(/g, 'async function getCustomerProfile(');
  content = content.replace(/function getArtisanProfile\(/g, 'async function getArtisanProfile(');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
