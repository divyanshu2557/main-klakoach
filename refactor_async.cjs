const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "server/tsconfig.json",
});

const sourceFiles = project.getSourceFiles();

let changed = 0;

for (const sourceFile of sourceFiles) {
  let fileChanged = false;

  // Find all db.prepare(...).all(), db.prepare(...).get(), db.prepare(...).run() and db.exec(...)
  // and add await if not already awaited.
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const callExpr of callExpressions) {
    const expr = callExpr.getExpression();
    const text = expr.getText();
    
    // Check if it's an execution call (get, all, run, exec)
    const isDbExecution = 
      text.endsWith(".all") || 
      text.endsWith(".get") || 
      text.endsWith(".run") ||
      text === "db.exec" ||
      text === "insertCat.run" ||
      text === "ins.run";
      
    if (!isDbExecution) continue;

    // Check if it's already awaited
    const parent = callExpr.getParent();
    if (parent.getKind() === SyntaxKind.AwaitExpression) continue;

    // Check if it involves db.prepare or db.exec somewhere inside
    // (A bit hacky, but generally if it's .get/.all/.run on a prepare, it stems from db)
    if (isDbExecution) {
      callExpr.replaceWithText(`await ${callExpr.getText()}`);
      fileChanged = true;
      
      // Bubble up async to enclosing function
      let current = callExpr.getParent();
      while (current) {
        if (
          current.getKind() === SyntaxKind.FunctionDeclaration ||
          current.getKind() === SyntaxKind.ArrowFunction ||
          current.getKind() === SyntaxKind.FunctionExpression ||
          current.getKind() === SyntaxKind.MethodDeclaration
        ) {
          if (!current.isAsync()) {
            current.setIsAsync(true);
          }
          break;
        }
        current = current.getParent();
      }
    }
  }
  
  // Find db.transaction
  const txCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => c.getExpression().getText() === "db.transaction");
  for (const txCall of txCalls) {
    const args = txCall.getArguments();
    if (args.length > 0) {
      const fn = args[0];
      if (fn.getKind() === SyntaxKind.ArrowFunction || fn.getKind() === SyntaxKind.FunctionExpression) {
        if (!fn.isAsync()) {
          fn.setIsAsync(true);
          fileChanged = true;
        }
      }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
    changed++;
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}

console.log(`Updated ${changed} files.`);
