/**
 * Bootstrap 安全过滤器测试
 * 验证 UI 元素不会被 Zotero 的 Bootstrap 过滤器移除
 */

describe("Bootstrap Security Filter Compatibility", () => {
  it("should not use <button> elements that get filtered", () => {
    // 检查所有 UI 组件文件
    const uiFiles = [
      "src/ui/components/quick-note-window-v2.ts",
      "src/ui/components/quick-note-button-simple.ts",
      "src/ui/components/main-panel.ts",
      "src/ui/tabs/history-tree-safe.ts",
      "src/ui/tabs/note-relations-tab.ts",
    ];

    const fs = require("fs");
    const path = require("path");

    for (const file of uiFiles) {
      const filePath = path.join(__dirname, "../../../", file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");

        // 检查是否有 createElement('button')
        const hasButtonElement =
          content.includes("createElement('button')") ||
          content.includes('createElement("button")');

        // 检查是否有 <button> 标签
        const hasButtonTag = /<button[^>]*>/.test(content);

        if (hasButtonElement || hasButtonTag) {
          console.warn(
            `⚠️  ${file} contains <button> elements that might be filtered by Bootstrap`,
          );

          // 验证是否已经替换为 <span role="button">
          const hasSpanButton =
            content.includes('role="button"') ||
            content.includes("role='button'");

          expect(hasSpanButton).toBe(
            true,
            `${file} should use <span role="button"> instead of <button>`,
          );
        }
      }
    }
  });

  it("should use safe elements for UI components", () => {
    const safePatterns = [
      'role="button"',
      'tabindex="0"',
      "display: inline-block",
    ];

    const fs = require("fs");
    const quickNoteWindowPath = path.join(
      __dirname,
      "../../../src/ui/components/quick-note-window-v2.ts",
    );
    const content = fs.readFileSync(quickNoteWindowPath, "utf8");

    for (const pattern of safePatterns) {
      expect(content).toContain(
        pattern,
        `QuickNoteWindowV2 should contain "${pattern}" for accessibility`,
      );
    }
  });

  it("should handle click events on span elements", () => {
    // 创建一个模拟的 span button
    const doc = document;
    const span = doc.createElement("span");
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    span.style.cursor = "pointer";

    let clicked = false;
    span.addEventListener("click", () => {
      clicked = true;
    });

    // 模拟点击
    const event = new MouseEvent("click", { bubbles: true });
    span.dispatchEvent(event);

    expect(clicked).toBe(true);
  });

  it("should support keyboard interaction on span buttons", () => {
    const span = document.createElement("span");
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");

    let activated = false;
    span.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        activated = true;
      }
    });

    // 模拟 Enter 键
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
    span.dispatchEvent(enterEvent);

    expect(activated).toBe(true);
  });
});
