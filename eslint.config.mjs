import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import js from "@eslint/js";

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...nextVitals,
  {
    rules: {
      "no-empty": "warn",
      "no-prototype-builtins": "warn",
      "no-useless-escape": "warn",
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
    languageOptions: {
      globals: {
        // Add browser and node globals manually as needed or use a plugin
        window: "readonly",
        document: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
        URL: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        crypto: "readonly",
        Intl: "readonly",
        // k6 globals
        __ENV: "readonly",
        http: "readonly",
        check: "readonly",
        sleep: "readonly",
      }
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "dist/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
