# 🔄 Zotero Research Navigator - Agent Handover Prompt

## 📋 **项目交接信息**

### **基本信息**

- **项目名称**: Zotero Research Navigator
- **仓库地址**: https://github.com/sperwe/Zotero-Research-Navigator
- **当前版本**: v1.0.0
- **开发状态**: MVP已完成，XPI文件已生成，需要功能增强和完善

### **项目背景**

用户希望将浏览器扩展 "Tree Style History" (v4.3.1) 重构为 Zotero 插件。核心需求：

1. **树状历史追踪** - 在Zotero中追溯打开过的文献或笔记标签历史
2. **笔记管理** - 管理现有和新关联的笔记，与文献天然绑定
3. **卡片视图** - 借鉴 ZotCard 项目的卡片视图进行笔记切换

## 🎯 **接手任务说明**

你需要接手一个**已完成基础功能的Zotero插件开发项目**。请按照以下要求继续开发：

### **当前已完成的工作**

1. ✅ 基础插件框架搭建完成
2. ✅ 核心历史追踪逻辑实现
3. ✅ 简单的搜索功能
4. ✅ 基础UI界面（简化版本）
5. ✅ XPI打包和构建系统
6. ✅ 完整文档和安装指南

### **核心技术栈**

- **平台**: Zotero 6.0.27+
- **语言**: TypeScript, JavaScript
- **构建**: Webpack
- **UI**: 原生JavaScript + XUL (当前), 计划React增强
- **存储**: Zotero.Prefs API
- **事件**: Zotero.Notifier API

### **项目结构**

```
zotero-research-navigator/
├── src/
│   ├── modules/
│   │   ├── historyTracker.ts (✅核心历史追踪逻辑)
│   │   └── searchEngine.ts (✅模糊搜索引擎)
│   ├── components/
│   │   └── HistoryTreeView.tsx (🔄需要增强)
│   ├── simple-index.js (✅当前工作版本)
│   └── index.ts (🔄复杂版本，构建有问题)
├── addon/
│   ├── bootstrap.js (✅插件启动)
│   ├── chrome.manifest (✅资源映射)
│   └── chrome/content/overlay.xul (✅UI集成)
├── zotero-research-navigator-v1.0.0.xpi (✅可用插件)
└── 完整文档体系
```

## 🚀 **优先开发任务**

### **第一阶段：增强现有功能** (高优先级)

1. **改进UI体验**
   - 优化树状视图的展开/折叠动画
   - 添加更好的图标和视觉反馈
   - 实现更流畅的搜索高亮

2. **完善历史追踪**
   - 追踪PDF阅读器打开/关闭事件
   - 追踪笔记编辑器状态
   - 添加访问时长统计

3. **增强搜索功能**
   - 支持正则表达式搜索
   - 添加搜索历史
   - 实现搜索结果排序

### **第二阶段：卡片视图集成** (中优先级)

参考 ZotCard 项目实现：

- 为历史项目添加卡片预览
- 实现卡片式笔记切换界面
- 添加卡片拖拽排序功能

### **第三阶段：笔记网络** (低优先级)

- 实现笔记间的关联关系可视化
- 添加笔记标签系统
- 支持笔记导入/导出

## 🔧 **技术细节和注意事项**

### **核心API使用**

```javascript
// 历史追踪事件监听
Zotero.Notifier.registerObserver(this, ["item", "collection"]);

// 数据持久化
Zotero.Prefs.set("research-navigator.history", JSON.stringify(data));

// UI集成
document.getElementById("zotero-pane").appendChild(panel);
```

### **构建系统问题**

- `src/index.ts` 版本存在TypeScript编译问题
- 当前使用 `src/simple-index.js` 作为工作版本
- Webpack配置已优化，但TypeScript集成需要改进

### **已知技术债务**

1. React组件未完全集成到最终构建
2. 类型定义需要完善 (`src/types/zotero.d.ts`)
3. 错误处理机制需要加强
4. 性能优化空间较大

## 📊 **开发环境设置**

### **快速开始**

```bash
# 1. 克隆仓库
git clone https://github.com/sperwe/Zotero-Research-Navigator.git
cd Zotero-Research-Navigator

# 2. 安装依赖
npm install

# 3. 开发模式
npm run watch

# 4. 构建生产版本
npm run build-prod

# 5. 测试安装
# 将生成的XPI文件在Zotero中安装测试
```

### **调试技巧**

- 使用 Zotero 的开发者控制台: Help → Developer → Run JavaScript
- 检查插件日志: Help → Debug Output Logging
- 重启Zotero来重新加载插件代码

## 💡 **用户反馈和期望**

### **用户明确表达的需求**

1. **"更喜欢树状历史"** - 优先保证这个功能的完善
2. **"可以追溯打开过的文献或笔记标签历史"** - 核心价值主张
3. **"借用卡片视图给到笔记切换"** - 参考ZotCard但不完全复制
4. **"换个方式来互动"** - 不重复Zotero已有功能，而是提供新的交互方式

### **隐含需求分析**

- 学术研究者的工作流程优化
- 大量文献阅读时的导航需求
- 研究路径的可追溯性
- 笔记管理的效率提升

## 🎯 **成功标准**

### **功能完善度**

- [ ] 历史追踪准确率 > 95%
- [ ] 搜索响应时间 < 100ms
- [ ] UI操作流畅，无明显卡顿
- [ ] 支持1000+历史记录无性能问题

### **用户体验**

- [ ] 安装后立即可用，无需配置
- [ ] 界面直观，符合Zotero设计规范
- [ ] 快捷键支持，提高操作效率
- [ ] 多语言支持（英文/中文）

### **技术质量**

- [ ] 代码测试覆盖率 > 80%
- [ ] 构建系统稳定可靠
- [ ] 错误处理完善
- [ ] 内存泄漏检查通过

## 📚 **参考资源**

### **核心文档**

- [Zotero Plugin Development Guide](https://www.zotero.org/support/dev/client_coding)
- [原始Tree Style History插件](https://github.com/turanszkij/tree-style-history)
- [ZotCard项目参考](https://github.com/018/zotcard)
- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)

### **技术参考**

- Zotero API文档: https://www.zotero.org/support/dev/web_api/v3/start
- XUL参考: https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL
- TypeScript配置: https://www.typescriptlang.org/docs/

## 🔄 **交接检查清单**

开始工作前，请确认：

- [ ] 成功克隆仓库并运行 `npm install`
- [ ] 能够执行 `npm run build-prod` 生成XPI
- [ ] 在Zotero中成功安装和测试XPI文件
- [ ] 阅读完整的README.md和技术文档
- [ ] 理解当前的代码结构和核心逻辑
- [ ] 明确下一步开发优先级

## 💬 **联系和反馈**

如果在接手过程中遇到问题，请：

1. 检查现有的文档 (README.md, INSTALL.md, DEPLOYMENT.md)
2. 查看Git提交历史了解开发过程
3. 测试当前XPI文件的功能边界
4. 基于用户需求制定具体的开发计划

---

**目标**: 在现有MVP基础上，打造一个真正实用、高质量的Zotero研究导航插件，满足学术研究者的实际需求。

**时间预期**: 建议分阶段开发，每个阶段1-2周，持续迭代改进。

**成功指标**: 用户愿意在日常研究工作中持续使用，并向同事推荐。
