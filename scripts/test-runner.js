#!/usr/bin/env node

/**
 * 测试运行器 - 提供便捷的测试命令
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const command = process.argv[2];
const args = process.argv.slice(3);

const commands = {
  unit: {
    desc: "Run unit tests",
    cmd: 'jest --testPathPattern="src/(services|managers|utils)/__tests__"',
  },
  integration: {
    desc: "Run integration tests",
    cmd: 'jest --testPathPattern="src/test/integration"',
  },
  ui: {
    desc: "Run UI component tests",
    cmd: 'jest --testPathPattern="src/ui/components/__tests__"',
  },
  watch: {
    desc: "Run tests in watch mode",
    cmd: "jest --watch",
  },
  coverage: {
    desc: "Run all tests with coverage",
    cmd: "jest --coverage",
  },
  changed: {
    desc: "Run tests for changed files only",
    cmd: "jest --onlyChanged",
  },
  debug: {
    desc: "Run tests with debugging enabled",
    cmd: "node --inspect-brk ./node_modules/.bin/jest --runInBand",
  },
  specific: {
    desc: "Run a specific test file",
    cmd: (file) => `jest ${file}`,
  },
};

function showHelp() {
  console.log("Zotero Research Navigator Test Runner\n");
  console.log("Usage: npm run test:runner <command> [options]\n");
  console.log("Commands:");

  Object.entries(commands).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(12)} ${config.desc}`);
  });

  console.log("\nExamples:");
  console.log("  npm run test:runner unit");
  console.log(
    "  npm run test:runner specific src/services/__tests__/history-service.test.ts",
  );
  console.log("  npm run test:runner watch");
}

function runCommand(cmd) {
  console.log(`Running: ${cmd}\n`);

  try {
    execSync(cmd, {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });
  } catch (error) {
    process.exit(1);
  }
}

// Main execution
if (!command || command === "help") {
  showHelp();
} else if (commands[command]) {
  const config = commands[command];
  const cmd =
    typeof config.cmd === "function" ? config.cmd(...args) : config.cmd;

  runCommand(cmd);
} else {
  console.error(`Unknown command: ${command}\n`);
  showHelp();
  process.exit(1);
}

// Generate test report if coverage exists
const coverageDir = path.join(__dirname, "..", "coverage");
if (fs.existsSync(coverageDir)) {
  const summaryPath = path.join(coverageDir, "coverage-summary.json");

  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const total = summary.total;

    console.log("\n📊 Coverage Summary:");
    console.log(`  Statements: ${total.statements.pct}%`);
    console.log(`  Branches:   ${total.branches.pct}%`);
    console.log(`  Functions:  ${total.functions.pct}%`);
    console.log(`  Lines:      ${total.lines.pct}%`);
  }
}
