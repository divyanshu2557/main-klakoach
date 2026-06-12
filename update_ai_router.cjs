const fs = require('fs');
let code = fs.readFileSync('e:/klakoach/server/src/modules/ai/router.ts', 'utf8');

code = code.replace(
  /const CHAT_MODEL = .+/g,
  `const CHAT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const DEFAULT_AI_PARAMS = {
  temperature: 1,
  top_p: 0.95,
  max_tokens: 16384,
  extra_body: { chat_template_kwargs: { enable_thinking: true }, reasoning_budget: 16384 }
};`
);

// Find all openai.chat.completions.create calls and inject ...DEFAULT_AI_PARAMS
code = code.replace(/model: CHAT_MODEL,/g, `model: CHAT_MODEL,\n      ...DEFAULT_AI_PARAMS,`);

// Remove any existing max_tokens that might conflict after our injection
code = code.replace(/max_tokens:\s*\d+,/g, '');

// Now fix the stream loop in /chat
code = code.replace(
  /const delta = chunk\.choices\[0\]\?\.delta\?\.content \?\? \"\";\n\s*if \(delta\) \{/g,
  `const contentDelta = chunk.choices[0]?.delta?.content ?? "";
      const reasoningDelta = (chunk.choices[0]?.delta as any)?.reasoning_content ?? "";
      const delta = reasoningDelta + contentDelta;
      if (delta) {`
);

fs.writeFileSync('e:/klakoach/server/src/modules/ai/router.ts', code);
console.log('Successfully updated AI router');
