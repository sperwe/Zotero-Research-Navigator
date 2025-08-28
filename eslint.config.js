export default [
  {
    files: ["**/*.js", "**/*.ts", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "writable",
        module: "writable",
        require: "readonly",
        global: "writable",
        URL: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-undef": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "*.min.js",
      "coverage/**",
      ".git/**",
    ],
  },
];
