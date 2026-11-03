import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default [
  {
    files: [
      "src/components/report-canvas/**/*.{ts,tsx}",
      "src/components/ReportCanvas*.tsx",
      "src/components/CanvasShell.tsx",
    ],
    ignores: ["**/*.test.*"],
    languageOptions: { parser: ts.parser },
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error" },
  },
];
