# Zotero Research Navigator 测试策略分析

## 一、Zotero 官方测试框架分析

### 1.1 Zotero 使用的测试工具

通过分析 Zotero 源代码，我发现他们使用了以下测试技术栈：

- **测试框架**: Mocha + Chai
- **断言库**: Chai (with `chai.config.truncateThreshold = 0`)
- **Mock 库**: Sinon.js
- **异步支持**: co-mocha (支持 generator functions)
- **运行环境**: XUL 环境内的测试运行器

### 1.2 测试运行方式

```javascript
// Zotero 的测试通过 chrome://zotero/content/test/runtests.html 运行
// 测试文件位于 test/tests/ 目录
// 使用 describe/it 标准的 BDD 风格
```

### 1.3 关键发现

1. **没有使用 Selenium/WebDriver**：Zotero 测试直接在应用内部运行
2. **没有 E2E UI 自动化**：主要是单元和集成测试
3. **测试与 Zotero 紧密集成**：依赖 Zotero 的内部 API

## 二、插件测试策略建议

### 2.1 单元测试（推荐）✅

**适用性：高**

我们已经开始使用 Jest，这是正确的方向。继续扩展单元测试覆盖：

```typescript
// 已实施的例子
describe("HistoryService", () => {
  // 测试业务逻辑，mock Zotero API
});
```

**优势**：

- 快速执行
- 易于 CI/CD 集成
- 不依赖 Zotero 运行环境

### 2.2 集成测试（部分适用）⚠️

**使用 Zotero 测试框架的挑战**：

1. **环境搭建复杂**：需要完整的 Zotero 开发环境
2. **文档缺失**：没有官方的插件测试文档
3. **版本兼容性**：不同 Zotero 版本可能有差异

**折中方案**：

```javascript
// 创建一个简化的集成测试环境
// 模拟关键的 Zotero API
class ZoteroMockEnvironment {
  constructor() {
    this.Items = {
      /* mock */
    };
    this.Collections = {
      /* mock */
    };
  }
}
```

### 2.3 E2E/UI 测试（不推荐）❌

**为什么 Selenium/GeckoDriver 不适合**：

1. **技术栈不匹配**：
   - Zotero 是 XUL/XULRunner 应用，不是标准 Web
   - DOM 结构和事件模型与 Web 不同
   - 许多 UI 元素是 XUL 特有的

2. **维护成本高**：
   - UI 变化频繁
   - 跨平台差异大
   - 调试困难

3. **更好的替代方案**：
   - 手动测试关键用户流程
   - 录制操作视频作为回归参考
   - Beta 用户反馈

## 三、推荐的测试路线图

### Phase 1：强化单元测试（立即）

```bash
src/
├── services/__tests__/
│   ├── history-service.test.ts ✅
│   ├── database-service.test.ts 📝
│   └── navigation-service.test.ts 📝
├── managers/__tests__/
│   ├── note-association-system.test.ts 📝
│   └── closed-tabs-manager.test.ts 📝
└── utils/__tests__/
    └── date-utils.test.ts 📝
```

### Phase 2：模拟集成测试（1-2周）

创建 Zotero 环境模拟器：

```typescript
// test/helpers/zotero-mock.ts
export class ZoteroMock {
  static setup() {
    global.Zotero = {
      Items: mockItems,
      Collections: mockCollections,
      // ... 其他必要的 API
    };
  }
}
```

### Phase 3：手动测试方案（持续）

1. **测试清单**：
   - [ ] 安装/卸载流程
   - [ ] 主要功能路径
   - [ ] 跨版本兼容性

2. **测试记录**：
   - 使用 GitHub Issues 记录 bug
   - 维护测试用例文档
   - 收集 Beta 用户反馈

## 四、实施建议

### 4.1 立即行动

1. **扩展单元测试**：

   ```bash
   npm test -- --coverage
   # 目标：核心模块覆盖率 > 70%
   ```

2. **CI 集成**：
   ```yaml
   # .github/workflows/test.yml
   - name: Run Tests
     run: |
       npm install
       npm test
   ```

### 4.2 不建议投入的方向

1. ❌ **Selenium/WebDriver E2E 测试**
   - ROI 太低
   - 技术障碍大
   - 维护成本高

2. ❌ **完整的 Zotero 测试环境**
   - 搭建复杂
   - 文档缺失
   - 版本依赖

### 4.3 折中方案

1. ✅ **Mock 驱动的集成测试**
2. ✅ **关键路径的手动测试**
3. ✅ **社区 Beta 测试计划**

## 五、总结

对于 Zotero 插件开发：

- **单元测试是基础**：继续使用 Jest
- **集成测试要务实**：Mock 优于真实环境
- **E2E 测试不划算**：手动测试更实际
- **用户反馈很重要**：建立 Beta 测试渠道

这种测试策略平衡了质量保证和开发效率，适合个人或小团队维护的 Zotero 插件项目。
