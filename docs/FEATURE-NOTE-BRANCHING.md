# 笔记分支管理系统 - 功能设计文档

## 概述
实现类似 Git 的笔记版本控制系统，支持按段落分割、分支管理、合并等功能。

## 核心功能

### 1. 段落级版本控制
- 将笔记按段落/章节分割成独立单元
- 每个段落都有独立的版本历史
- 支持段落级的差异比较

### 2. 树状分支结构
- 分支以树状结构展示，直观显示父子关系
- 支持拖放操作移动分支
- 智能重基（rebase）机制

### 3. 分支操作
- 创建分支：从任意段落或版本创建新分支
- 切换分支：快速切换不同版本
- 合并分支：支持多种合并策略
- 删除/归档分支

### 4. 协作功能
- 分支权限管理（私有/共享/只读/协作/公开）
- 分支评论系统
- 变更追踪和归属

## 数据结构设计

```typescript
interface NoteVersion {
  id: string;
  noteId: number;
  branchName: string;
  parentVersionId?: string;
  blocks: NoteBlock[];
  timestamp: Date;
  author: string;
}

interface NoteBlock {
  id: string;
  content: string;
  type: 'paragraph' | 'heading' | 'list' | 'quote' | 'code';
  metadata: {
    position: number;
    hash: string;
  };
}

interface BranchNode {
  id: string;
  name: string;
  parentBranchId: string | null;
  children: BranchNode[];
  metadata: {
    createdAt: Date;
    lastModified: Date;
    author: string;
    tags: string[];
    color: string;
    icon: string;
  };
  stats: {
    blocksAdded: number;
    blocksModified: number;
    blocksDeleted: number;
  };
}
```

## UI 设计

### 分支树视图
```
📝 Research Paper Draft
├─ 🌿 main
│  ├─ 🔀 experiment-1
│  │  ├─ 🔀 experiment-1-results
│  │  └─ 🔀 experiment-1-discussion
│  ├─ 🔀 literature-review
│  └─ 🔀 reviewer-feedback
└─ 🗑️ Archived branches
```

### 段落操作菜单
- Create branch from here
- View history
- Compare with other branch
- Merge changes

## 高级功能

### 1. 智能功能
- AI 辅助合并建议
- 内容相似度检测
- 自动冲突预测
- 写作改进建议

### 2. 分支模板
- 学术论文模板
- 实验报告模板
- 创意写作模板

### 3. 导出选项
- 导出特定分支
- 生成版本历史文档
- 创建协作包

## 技术实现

### 存储方案
- 使用 SQLite 存储版本数据
- 增量存储优化空间
- 缓存机制提升性能

### 合并算法
- 基于三方合并（3-way merge）
- 支持自动和手动冲突解决
- 保留完整的合并历史

## 使用场景

1. **学术写作**
   - 不同版本的论文草稿
   - 针对不同期刊的修改版本
   - 审稿意见的响应版本

2. **创意写作**
   - 探索不同的故事走向
   - 管理角色发展的多种可能
   - 实验不同的写作风格

3. **知识管理**
   - 笔记的逐步完善过程
   - 不同视角的整理版本
   - 教学/研究/分享等不同用途版本

## 开发路线图

### Phase 1: 基础版本控制
- [ ] 实现笔记快照功能
- [ ] 版本历史查看
- [ ] 简单的差异比较

### Phase 2: 分支管理
- [ ] 创建和切换分支
- [ ] 树状分支视图
- [ ] 分支移动和重组织

### Phase 3: 高级功能
- [ ] 三方合并算法
- [ ] 冲突解决界面
- [ ] 协作功能
- [ ] AI 辅助功能

## 相关技术
- ProseMirror - 用于富文本编辑和协作
- Diff algorithms - 文本差异算法
- Operational Transformation - 协作编辑算法