const fs = require('fs');

function replace(file, find, rep) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(new RegExp(find, 'g'), rep);
    fs.writeFileSync(file, content, 'utf8');
}

// Fix index.ts
replace('e:\\klakoach\\server\\src\\db\\index.ts', '"BEGIN"', '"BEGIN" as any');
replace('e:\\klakoach\\server\\src\\db\\index.ts', '"COMMIT"', '"COMMIT" as any');
replace('e:\\klakoach\\server\\src\\db\\index.ts', '"ROLLBACK"', '"ROLLBACK" as any');

// Fix middleware/site-guard.ts
replace('e:\\klakoach\\server\\src\\middleware\\site-guard.ts', 'async function getSitePassword\\(\\): string', 'async function getSitePassword(): Promise<string>');

// Fix ai/router.ts - there are multiple getLiveCatalog() calls.
replace('e:\\klakoach\\server\\src\\modules\\ai\\router.ts', 'getLiveCatalog\\(\\)', '(await getLiveCatalog())');

// Fix customer/router.ts line 70
replace('e:\\klakoach\\server\\src\\modules\\customer\\router.ts', '\\(req, res\\) => \\{', 'async (req, res) => {');

// Fix notification.service.ts
replace('e:\\klakoach\\server\\src\\modules\\notifications\\notification.service.ts', 'export function scheduleBatchDelivery', 'export async function scheduleBatchDelivery');

console.log('Final fixes applied!');
