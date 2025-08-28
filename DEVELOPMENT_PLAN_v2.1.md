# Research Navigator v2.1.0 开发计划

## 📋 概述

本开发计划聚焦于两个核心功能的实现：
1. **集成已关闭标签页历史** - 追踪和恢复已关闭的研究标签页
2. **历史导航与笔记双向关联系统** - 建立研究路径与笔记之间的智能连接

## 🎯 核心目标

- 提供完整的研究路径追踪，包括已关闭的标签页
- 建立笔记与历史的双向关联，增强研究的可追溯性
- 保持与 Zotero 生态系统的无缝集成
- 提供直观、高效的用户界面

## 🏗️ UI 架构设计

### 推荐方案：混合式 UI（方案 A + B 的结合）

1. **主要界面**：增强现有浮动面板
   - 添加标签页切换：历史树 | 已关闭 | 笔记关联
   - 保持快速访问的便利性

2. **扩展界面**：可选的侧边栏模式
   - 用户可以选择将面板"停靠"到 Zotero 侧边栏
   - 提供更大的显示空间用于复杂操作

3. **展示模式**：
   - 已关闭标签页采用树形展示（类似 Tree Style History）
   - 支持时间分组（今天、昨天、本周等）
   - 视觉区分：使用灰色图标和虚线边框

---

## 📅 第一阶段：已关闭标签页历史（第1周）

### Day 1-2: 数据模型和基础架构

**任务清单**：
- [ ] 扩展数据库 schema，添加标签页状态字段
- [ ] 创建 `ClosedTabsManager` 类
- [ ] 实现与 `Zotero_Tabs._history` 的数据同步
- [ ] 设计已关闭节点的数据结构

**技术要点**：
```javascript
// 节点状态扩展
NodeStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  RESTORED: 'restored'
}

// 关闭上下文
ClosedContext = {
  closedAt: timestamp,
  closedFrom: nodeId,
  sessionId: string,
  tabIndex: number
}
```

### Day 3-4: UI 实现

**任务清单**：
- [ ] 在浮动面板添加"已关闭"标签页
- [ ] 实现已关闭标签页的树形视图
- [ ] 设计视觉样式（灰色主题、图标变化）
- [ ] 添加时间分组功能

**UI 规范**：
```css
/* 已关闭节点样式 */
.closed-node {
  opacity: 0.6;
  border: 1px dashed #ccc;
}
.closed-node-icon {
  filter: grayscale(100%);
}
```

### Day 5: 恢复功能

**任务清单**：
- [ ] 实现双击恢复功能
- [ ] 添加右键菜单"恢复标签页"
- [ ] 调用 `Zotero_Tabs.undoClose()` API
- [ ] 更新节点状态和视觉反馈

### Day 6-7: 优化和测试

**任务清单**：
- [ ] 批量恢复功能
- [ ] 自动清理过期记录（可配置）
- [ ] 性能优化（大量已关闭标签页）
- [ ] 单元测试和集成测试

---

## 📅 第二阶段：笔记关联系统（第2-3周）

### Week 2, Day 1-2: 数据架构

**任务清单**：
- [ ] 创建笔记关联表
- [ ] 实现 `NoteHistoryRelation` 类
- [ ] 设计关联类型系统
- [ ] 数据迁移和兼容性处理

**数据模型**：
```sql
CREATE TABLE research_navigator_note_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    noteId INTEGER NOT NULL,
    nodeId TEXT NOT NULL,
    relationType TEXT DEFAULT 'created_during',
    createdAt INTEGER NOT NULL,
    context TEXT, -- JSON
    UNIQUE(noteId, nodeId)
);
```

### Week 2, Day 3-4: 自动关联机制

**任务清单**：
- [ ] 监听笔记创建事件
- [ ] 捕获当前历史上下文
- [ ] 实现自动关联逻辑
- [ ] 处理边缘情况（批量导入等）

### Week 2, Day 5-7: 历史视图 UI

**任务清单**：
- [ ] 在历史节点显示笔记数量徽章
- [ ] 实现笔记预览悬浮窗
- [ ] 创建关联笔记列表面板
- [ ] 添加快速创建笔记入口

**UI 设计**：
```
历史节点
├─ 📄 文献标题 [3] ← 笔记数量徽章
│   ├─ 📝 研究笔记
│   ├─ 📝 实验记录
│   └─ 📝 问题总结
└─ 🔗 相关文献
```

### Week 3, Day 1-2: 笔记视图集成

**任务清单**：
- [ ] 在笔记编辑器添加历史信息栏
- [ ] 显示创建路径和时间
- [ ] 实现"跳转到历史"功能
- [ ] 支持修改关联关系

### Week 3, Day 3-4: 手动管理功能

**任务清单**：
- [ ] 关联现有笔记对话框
- [ ] 拖拽关联支持
- [ ] 批量操作界面
- [ ] 关联类型选择器

### Week 3, Day 5-7: 搜索和导航

**任务清单**：
- [ ] 整合笔记内容到搜索
- [ ] 实现双向导航快捷键
- [ ] 添加关联关系可视化
- [ ] 性能优化和测试

---

## 📅 第三阶段：高级功能和优化（第4周）

### Day 1-2: 智能功能

**功能列表**：
- [ ] 相似路径检测和推荐
- [ ] 笔记完整性提醒
- [ ] 自动标签建议
- [ ] 研究模式识别

### Day 3-4: 导出和报告

**功能列表**：
- [ ] 研究路径导出（含笔记）
- [ ] 时间线生成
- [ ] Markdown 报告
- [ ] 图表可视化

### Day 5-7: 性能和稳定性

**优化任务**：
- [ ] 大数据集优化
- [ ] 内存使用优化
- [ ] 启动速度优化
- [ ] 错误处理完善

---

## 📊 技术规范

### API 使用

1. **Zotero 原生 API**：
   - `Zotero_Tabs._history` - 已关闭标签页数据
   - `Zotero_Tabs.undoClose()` - 恢复标签页
   - `Zotero.Notifier` - 事件监听
   - `Zotero.Items` - 笔记操作

2. **事件监听**：
   ```javascript
   // 标签页事件
   Zotero.Notifier.registerObserver({
     notify: (event, type, ids, extraData) => {
       if (type === 'tab') {
         switch(event) {
           case 'close': handleTabClose(ids); break;
           case 'select': handleTabSelect(ids); break;
         }
       }
     }
   }, ['tab', 'item'], 'ResearchNavigator');
   ```

### 性能指标

- 历史加载时间：< 500ms
- 关联查询响应：< 100ms
- 内存占用增长：< 20%
- UI 响应时间：< 50ms

---

## 🚀 发布计划

### v2.1.0-beta.1（第2周末）
- 已关闭标签页基础功能
- 基础 UI 实现

### v2.1.0-beta.2（第3周末）
- 完整的笔记关联系统
- 双向导航功能

### v2.1.0-rc.1（第4周中）
- 所有功能完成
- 性能优化

### v2.1.0（第5周）
- 正式发布
- 完整文档

---

## 📝 风险管理

1. **API 兼容性**：
   - 风险：Zotero 更新可能改变内部 API
   - 缓解：添加 API 版本检查，提供降级方案

2. **性能问题**：
   - 风险：大量历史数据影响性能
   - 缓解：实现分页加载，数据清理机制

3. **UI 冲突**：
   - 风险：与其他插件的 UI 冲突
   - 缓解：使用独立的命名空间，提供配置选项

---

## ✅ 成功标准

1. **功能完整性**：
   - 所有已关闭标签页可追踪和恢复
   - 笔记关联准确无遗漏
   - 双向导航流畅自然

2. **用户体验**：
   - 学习成本低
   - 操作直观
   - 响应迅速

3. **稳定性**：
   - 无数据丢失
   - 错误处理完善
   - 向后兼容

---

## 📚 相关文档

- [技术架构文档](./ARCHITECTURE.md)
- [API 参考文档](./API_REFERENCE.md)
- [用户使用指南](./USER_GUIDE.md)
- [贡献指南](./CONTRIBUTING.md)