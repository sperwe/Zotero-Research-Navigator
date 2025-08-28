# 最简工作版本 - v2.0.3-minimal-working

## 关键改变

基于对 zotero-style 插件的分析，我创建了一个完全独立的、不依赖 TypeScript 编译的 bootstrap.js。

## 这个版本的特点

1. **完全独立的 bootstrap.js**
   - 不依赖任何 TypeScript 编译输出
   - 所有代码都在一个文件中
   - 使用 zotero-style 相同的 `waitForZotero` 方法

2. **四种 UI 元素确保可见性**
   - **蓝色浮动按钮**（右下角）- 最可靠的 HTML 元素
   - **工具菜单项** - Tools → Research Navigator (Working!)
   - **文献右键菜单** - Test Research Navigator
   - **状态栏图标**（如果有状态栏）

3. **多重父元素尝试**
   - 对每个 UI 元素都尝试多个可能的父元素
   - 确保至少有一个能成功添加

## 预期效果

安装后应该至少看到：

1. **蓝色浮动按钮**
   - 位置：右下角
   - 文字：RN Test
   - 点击显示工作确认消息

2. **工具菜单**
   - Tools → Research Navigator (Working!)
   - 点击显示确认消息

3. **右键菜单**
   - 在文献上右键 → Test Research Navigator
   - 显示选中文献数量

## 如果这个版本也不工作

可能的原因：

1. Zotero 版本问题（需要确认是 Zotero 7）
2. 插件没有正确加载（检查错误控制台）
3. 权限或安全限制

## 调试步骤

1. 打开错误控制台（Tools → Developer → Error Console）
2. 清除控制台
3. 重新安装插件
4. 查看是否有任何错误消息

5. 在控制台底部输入：

   ```javascript
   Zotero.ResearchNavigator;
   ```

   如果返回对象，说明插件已加载

6. 检查 DOM：
   ```javascript
   document.getElementById("research-navigator-float-button");
   ```
   如果返回元素，说明按钮已添加但可能被隐藏

## 基于的理解

这个版本基于：

- zotero-style 的插件结构
- 使用原生 JavaScript 而非 TypeScript
- 直接的 DOM 操作
- 窗口监听器模式

---

版本：v2.0.3-minimal-working
日期：2025-01-27
