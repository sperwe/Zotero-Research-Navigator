# Zotero 笔记关联架构说明

## Zotero 的笔记数据结构

### 1. 基本概念

在 Zotero 中，笔记（Notes）的关联关系如下：

```
文献条目 (Parent Item)
├── 附件1 (PDF/EPUB/HTML等)
├── 附件2 
└── 笔记1, 笔记2, ... (Notes)
```

**重要**：当你在阅读 PDF 时创建的笔记，实际上是关联到 PDF 的**父文献条目**，而不是 PDF 本身。

### 2. 数据结构示例

```javascript
// 主文献条目
Item {
  id: 1001,
  itemType: "journalArticle",
  title: "某篇论文",
  getNotes(): [2001, 2002], // 返回所有子笔记的ID
  getAttachments(): [3001, 3002] // 返回所有附件的ID
}

// PDF 附件
Item {
  id: 3001,
  itemType: "attachment",
  attachmentType: "application/pdf",
  parentID: 1001, // 指向父文献条目
  isAttachment(): true,
  getNotes(): [] // 附件本身不能有笔记
}

// 笔记
Item {
  id: 2001,
  itemType: "note",
  parentID: 1001, // 指向父文献条目
  isNote(): true,
  getNote(): "<p>笔记内容...</p>"
}
```

## Research Navigator 的处理方案

### 1. 笔记自动关联逻辑

在 `note-association-system.ts` 中，我们实现了以下逻辑：

```typescript
// 当前节点是附件（如PDF）
if (currentItem.isAttachment()) {
  const attachmentParentID = currentItem.parentID;
  if (attachmentParentID && note.parentID === attachmentParentID) {
    // 笔记和附件有相同的父项 = 应该关联
    shouldAssociate = true;
  }
}
```

### 2. 获取节点相关笔记

在 `getNodeNotes` 方法中：

```typescript
// 1. 获取直接关联的笔记（通过数据库）
const directAssociations = await getFromDatabase(nodeId);

// 2. 如果节点是附件，也获取同父项的笔记
if (item.isAttachment() && item.parentID) {
  const parentItem = await Zotero.Items.getAsync(item.parentID);
  const parentNoteIds = parentItem.getNotes();
  // 将这些笔记作为"虚拟关联"返回
}
```

### 3. 用户界面展示

在 Note Relations 标签页中，这些笔记会被正确显示：
- 直接关联的笔记：显示实际的关联类型
- 通过父项关联的笔记：显示为 "created_during" 类型

## 调试方法

使用以下命令测试笔记关联：

```javascript
// 在 Zotero 控制台中运行
await Zotero.ResearchNavigator.testNoteRelations()
```

这会显示：
1. 选中项目的基本信息
2. 如果是附件，显示其父项的所有笔记
3. 如果是主条目，显示其所有笔记和附件
4. 历史节点的笔记关联情况

## 总结

通过理解 Zotero 的笔记数据结构，我们实现了智能的笔记关联系统：
- 自动识别通过父项关联的笔记
- 在用户界面中正确显示这些关联
- 提供调试工具帮助验证功能