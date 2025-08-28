/**
 * 调试插件问题的脚本
 * 模拟 Research Navigator 的打开逻辑
 */

// 模拟插件的 openItemFromNode 逻辑
async function debugOpenItemFromNode(itemId) {
  console.log(`\n=== 调试 openItemFromNode (itemId: ${itemId}) ===`);

  const item = Zotero.Items.get(itemId);
  if (!item) {
    console.log("✗ 找不到 item");
    return;
  }

  console.log(`Item 类型: ${item.itemType}`);
  console.log(`Is attachment: ${item.isAttachment()}`);
  console.log(`Is regular item: ${item.isRegularItem()}`);

  var win = Services.wm.getMostRecentWindow("navigator:browser");
  if (!win || !win.ZoteroPane) {
    console.log("✗ 找不到窗口或 ZoteroPane");
    return;
  }

  // 模拟插件逻辑：先选择项目
  console.log("\n1. 在库中选择项目");
  win.ZoteroPane.selectItem(item.id);
  console.log("✓ 已在库中选择项目");

  if (item.isAttachment()) {
    console.log("\n2. 处理附件");
    await debugOpenOrSwitchToAttachment(win, item);
  } else if (item.isRegularItem()) {
    console.log("\n2. 处理常规项目，查找附件");
    const attachments = item.getAttachments();
    console.log(`找到 ${attachments.length} 个附件`);

    for (let id of attachments) {
      const attachment = Zotero.Items.get(id);
      if (attachment) {
        console.log(`\n附件: ${attachment.getField("title")}`);
        console.log(`- ContentType: ${attachment.attachmentContentType}`);
        console.log(`- ReaderType: ${attachment.attachmentReaderType}`);
        console.log(`- IsPDF: ${attachment.isPDFAttachment()}`);

        if (attachment.isPDFAttachment() || attachment.attachmentReaderType) {
          await debugOpenOrSwitchToAttachment(win, attachment);
          break;
        }
      }
    }
  }
}

// 模拟 openOrSwitchToAttachment 逻辑
async function debugOpenOrSwitchToAttachment(win, attachment) {
  console.log(`\n=== 调试 openOrSwitchToAttachment ===`);
  console.log(`附件 ID: ${attachment.id}`);
  console.log(`附件标题: ${attachment.getField("title")}`);

  // 检查标签页是否已经打开
  console.log("\n检查标签页系统...");
  console.log(`- Zotero_Tabs 存在: ${!!win.Zotero_Tabs}`);
  console.log(
    `- getTabIDByItemID 方法存在: ${!!(win.Zotero_Tabs && win.Zotero_Tabs.getTabIDByItemID)}`,
  );

  if (win.Zotero_Tabs && win.Zotero_Tabs.getTabIDByItemID) {
    const existingTabID = win.Zotero_Tabs.getTabIDByItemID(attachment.id);
    console.log(`- 查找已存在的标签页: ${existingTabID || "未找到"}`);

    if (existingTabID) {
      console.log("✓ 找到已存在的标签页，切换到该标签页");
      win.Zotero_Tabs.select(existingTabID);
      return;
    }
  }

  // 标签页不存在，需要打开新的
  console.log("\n标签页不存在，尝试打开新标签页");
  console.log(`- attachmentReaderType: ${attachment.attachmentReaderType}`);

  if (attachment.attachmentReaderType) {
    console.log("尝试使用 Zotero.Reader.open...");
    try {
      await Zotero.Reader.open(attachment.id);
      console.log("✓ Zotero.Reader.open 成功");

      // 再次检查标签页是否打开
      await Zotero.Promise.delay(500);
      if (win.Zotero_Tabs && win.Zotero_Tabs.getTabIDByItemID) {
        const newTabID = win.Zotero_Tabs.getTabIDByItemID(attachment.id);
        console.log(`新标签页 ID: ${newTabID || "未找到"}`);
      }
    } catch (e) {
      console.log("✗ Zotero.Reader.open 失败:", e);
      console.log("尝试后备方案...");

      if (attachment.isPDFAttachment()) {
        console.log("使用 Zotero.OpenPDF.openToPage...");
        try {
          Zotero.OpenPDF.openToPage(attachment, null, null);
          console.log("✓ Zotero.OpenPDF.openToPage 成功");
        } catch (e2) {
          console.log("✗ Zotero.OpenPDF.openToPage 失败:", e2);
        }
      }
    }
  }
}

// 测试函数
async function runDebugTest() {
  console.log("=== 开始调试测试 ===");

  // 获取一个有 PDF 附件的项目
  const items = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
  let testItem = null;

  for (let item of items) {
    if (item.isRegularItem()) {
      const attachments = item.getAttachments();
      for (let id of attachments) {
        const att = Zotero.Items.get(id);
        if (att && att.isPDFAttachment()) {
          testItem = item;
          break;
        }
      }
      if (testItem) break;
    }
  }

  if (testItem) {
    console.log(
      `\n找到测试项目: ${testItem.getField("title")} (ID: ${testItem.id})`,
    );
    await debugOpenItemFromNode(testItem.id);
  } else {
    console.log("✗ 没有找到合适的测试项目");
  }
}

// 运行测试
runDebugTest().catch(console.error);
