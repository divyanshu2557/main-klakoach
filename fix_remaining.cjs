const fs = require('fs');

function replace(file, find, rep) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(find, rep);
    fs.writeFileSync(file, content, 'utf8');
}

// 1. db/index.ts - TemplateStringsArray
replace('e:\\klakoach\\server\\src\\db\\index.ts', 'await sql(pgQuery, args)', 'await sql(pgQuery as any, args as any)');
replace('e:\\klakoach\\server\\src\\db\\index.ts', 'await sql(pgQuery, args)', 'await sql(pgQuery as any, args as any)');
replace('e:\\klakoach\\server\\src\\db\\index.ts', 'await sql(pgQuery, args)', 'await sql(pgQuery as any, args as any)');
replace('e:\\klakoach\\server\\src\\db\\index.ts', 'await sql(pgSchema)', 'await sql(pgSchema as any)');

// 2. ai/router.ts
replace('e:\\klakoach\\server\\src\\modules\\ai\\router.ts', 'async async function', 'async function');
replace('e:\\klakoach\\server\\src\\modules\\ai\\router.ts', 'const catalog = getLiveCatalog();', 'const catalog = await getLiveCatalog();');

// 3. auth/router.ts return type
replace('e:\\klakoach\\server\\src\\modules\\auth\\router.ts', 'async function isRegistrationEnabled(): boolean', 'async function isRegistrationEnabled(): Promise<boolean>');

// 4. middleware/site-guard.ts return type
replace('e:\\klakoach\\server\\src\\middleware\\site-guard.ts', 'async function getSitePassword(): string', 'async function getSitePassword(): Promise<string>');

// 5. customer/router.ts missing await
replace('e:\\klakoach\\server\\src\\modules\\customer\\router.ts', 'const result = db', 'const result = await db');

// 6. notification.service.ts TS1308
replace('e:\\klakoach\\server\\src\\modules\\notifications\\notification.service.ts', 'async export function scheduleBatchDelivery(', 'export async function scheduleBatchDelivery(');
replace('e:\\klakoach\\server\\src\\modules\\notifications\\notification.service.ts', 'export function scheduleBatchDelivery(', 'export async function scheduleBatchDelivery(');

// 7. migrate.ts TemplateStringsArray
replace('e:\\klakoach\\server\\src\\db\\migrate.ts', 'await sql(query, values)', 'await sql(query as any, values as any)');

console.log('Fixed remaining files!');
