const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "server/tsconfig.json",
});

let updatedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
  let changed = false;

  // Fix: Return type of async functions
  const functions = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const fn of functions) {
    if (fn.isAsync()) {
      const returnTypeNode = fn.getReturnTypeNode();
      if (returnTypeNode && returnTypeNode.getText() !== "Promise<void>" && returnTypeNode.getText() === "void") {
        returnTypeNode.replaceWithText("Promise<void>");
        changed = true;
      }
    }
  }

  // Fix: AsExpression
  const asExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);
  asExpressions.reverse();
  for (const asExpr of asExpressions) {
    const exprText = asExpr.getExpression().getText();
    if (exprText.includes(".get") || exprText.includes(".all") || exprText.includes(".run") || exprText.includes("db.exec")) {
      const typeNode = asExpr.getTypeNode();
      if (typeNode && !typeNode.getText().includes("unknown")) {
        asExpr.replaceWithText(`${exprText} as unknown as ${typeNode.getText()}`);
        changed = true;
      }
    }
  }

  if (changed) {
    sourceFile.saveSync();
    updatedFiles++;
    console.log(`Fixed ${sourceFile.getFilePath()}`);
  }
}

console.log(`Updated ${updatedFiles} files.`);
