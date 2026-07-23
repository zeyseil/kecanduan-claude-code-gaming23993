module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["react-refresh", "react-hooks"],
  ignorePatterns: ["dist", ".eslintrc.cjs", "*.config.js", "*.config.ts"],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    // Izinkan pola strip field lewat rest destructuring (mis. buang `id` UI-only).
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
  },
};
