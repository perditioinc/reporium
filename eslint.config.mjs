import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // KnowledgeGraph.tsx and KnowledgeGraphV2.tsx have been deleted.
      // All graph rendering must go through KnowledgeGraph3D.tsx.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/KnowledgeGraph", "**/KnowledgeGraph.tsx"],
              message: "KnowledgeGraph.tsx was deleted — use KnowledgeGraph3D instead.",
            },
            {
              group: ["**/KnowledgeGraphV2", "**/KnowledgeGraphV2.tsx"],
              message: "KnowledgeGraphV2.tsx was deleted — use KnowledgeGraph3D instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
