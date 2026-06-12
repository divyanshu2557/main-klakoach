const fs = require('fs');
let file = 'e:\\klakoach\\server\\src\\modules\\ai\\router.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix missing awaits
content = content.replace(/const products = getLiveCatalog\((.*?)\);/g, 'const products = await getLiveCatalog($1);');
content = content.replace(/const catalog = getLiveCatalog\((.*?)\);/g, 'const catalog = await getLiveCatalog($1);');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ai/router.ts');
