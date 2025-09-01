#!/usr/bin/env node

/**
 * 检查 BetterNotes 兼容性的脚本
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 Checking BetterNotes compatibility...\n");

// 检查兼容性模块
const compatPath = path.join(__dirname, "../src/utils/betternotes-compat.ts");
if (fs.existsSync(compatPath)) {
  console.log("✅ BetterNotes compatibility module found");
} else {
  console.log("❌ BetterNotes compatibility module missing!");
}

// 检查是否正确使用了兼容性模块
const quickNoteFile = path.join(
  __dirname,
  "../src/ui/components/quick-note-window-v2.ts",
);
if (fs.existsSync(quickNoteFile)) {
  const content = fs.readFileSync(quickNoteFile, "utf8");

  if (content.includes("BetterNotesCompat")) {
    console.log("✅ Quick note window uses BetterNotes compatibility");
  } else {
    console.log("⚠️  Quick note window does not use BetterNotes compatibility");
  }

  // 检查已废弃的直接访问
  if (
    content.includes("_betterNotesIgnore = true") &&
    !content.includes("BetterNotesCompat.markEditorAsManaged")
  ) {
    console.log("⚠️  Found deprecated direct BetterNotes flag setting");
  }
}

// 检查笔记关系标签页
const noteRelationsFile = path.join(
  __dirname,
  "../src/ui/components/tabs/note-relations-tab.ts",
);
if (fs.existsSync(noteRelationsFile)) {
  const content = fs.readFileSync(noteRelationsFile, "utf8");

  if (content.includes("_betterNotesIgnore = true")) {
    console.log("⚠️  Note relations tab should use BetterNotesCompat module");
  }
}

console.log("\n📋 Recommendations:");
console.log("1. Always use BetterNotesCompat module for compatibility");
console.log("2. Test with BetterNotes installed and uninstalled");
console.log("3. Monitor for BetterNotes API changes in updates");
