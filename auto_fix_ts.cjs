const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Asus rog\\.gemini\\antigravity-ide\\brain\\732ed983-c4c1-4350-a9b6-c9de6016cc47\\.system_generated\\tasks\\task-2166.log";
const logContent = fs.readFileSync(logFile, 'utf8');

const lines = logContent.split('\n');
const rootDir = "e:\\klakoach";

const fileModifications = {}; // file -> { line: change }

for (const line of lines) {
  const match = line.match(/^([^:]+)\((\d+),(\d+)\): error (TS\d+):/);
  if (match) {
    const file = path.join(rootDir, match[1]);
    const lineNum = parseInt(match[2], 10);
    const tsError = match[4];

    if (!fileModifications[file]) {
      fileModifications[file] = fs.readFileSync(file, 'utf8').split('\n');
    }
    const linesArr = fileModifications[file];
    let codeLine = linesArr[lineNum - 1];

    if (tsError === 'TS2352' || tsError === 'TS2339' || tsError === 'TS7006') {
      // Fix casts
      if (codeLine.includes(' as ')) {
        linesArr[lineNum - 1] = codeLine.replace(' as ', ' as unknown as ');
      }
    } else if (tsError === 'TS1308') {
      // Find enclosing function to make async
      let funcLine = lineNum - 1;
      while (funcLine >= 0) {
        if (linesArr[funcLine].includes('function ') && !linesArr[funcLine].includes('async ')) {
          linesArr[funcLine] = linesArr[funcLine].replace('function ', 'async function ');
          break;
        } else if (linesArr[funcLine].includes('=>') && !linesArr[funcLine].includes('async ')) {
           // For arrow functions inside map or transactions
           // We have to be careful. Let's just add async before the first parameter list.
           // e.g. `(req, res) =>` -> `async (req, res) =>`
           linesArr[funcLine] = linesArr[funcLine].replace(/(\([^)]*\)\s*=>)/, 'async $1');
           // e.g. `req =>` -> `async req =>`
           linesArr[funcLine] = linesArr[funcLine].replace(/([a-zA-Z0-9_]+\s*=>)/, 'async $1');
           break;
        }
        funcLine--;
      }
    }
  }
}

for (const file in fileModifications) {
  fs.writeFileSync(file, fileModifications[file].join('\n'), 'utf8');
  console.log(`Auto-fixed ${file}`);
}
