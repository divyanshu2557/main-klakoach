const fs = require('fs');

const file = 'e:\\klakoach\\server\\src\\db\\index.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace ensureColumn definition
content = content.replace(/function ensureColumn\([\s\S]*?\}/, 
`async function ensureColumn(table: string, column: string, definition: string) {
  try {
    let pgDef = definition.replace(/INTEGER DEFAULT 0/g, 'INTEGER DEFAULT 0');
    pgDef = pgDef.replace(/TEXT DEFAULT ''/g, "TEXT DEFAULT ''");
    await sql(\`ALTER TABLE \${table} ADD COLUMN IF NOT EXISTS \${pgDef}\`);
  } catch (e) { }
}`);

// Change ensureColumn( to await ensureColumn(
content = content.replace(/^ensureColumn\(/gm, 'await ensureColumn(');

// Wait, top-level await is supported in ES modules. Let's make sure it's awaited.
// But earlier db.exec(...) isn't awaited. Let's await it too!
content = content.replace(/db\.exec\(\`/g, 'await db.exec(`');

// There are a few sync operations at the bottom:
content = content.replace(/const settingsCount = \(await db/g, 'const settingsCount = (await db');
content = content.replace(/seedDemoData\(\)/g, 'await seedDemoData()');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ensureColumn');
