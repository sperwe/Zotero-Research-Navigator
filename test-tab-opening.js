/**
 * 测试脚本：验证标签页打开逻辑
 * 在 Zotero 的 Tools -> Developer -> Run JavaScript 中运行
 */

// 测试函数：检查标签页系统
async function testTabSystem() {
  console.log("=== 测试 Zotero 标签页系统 ===");

  // 1. 检查 Zotero_Tabs 是否可用
  if (typeof Zotero_Tabs !== "undefined") {
    console.log("✓ Zotero_Tabs 可用");

    // 获取当前打开的标签页
    const tabs = Zotero_Tabs._tabs;
    console.log(`当前打开的标签页数量: ${tabs.length}`);

    tabs.forEach((tab, index) => {
      console.log(
        `标签页 ${index}: ID=${tab.id}, Type=${tab.type}, Title=${tab.title}`,
      );
      if (tab.data && tab.data.itemID) {
        console.log(`  - ItemID: ${tab.data.itemID}`);
      }
    });

    // 检查 getTabIDByItemID 方法
    if (typeof Zotero_Tabs.getTabIDByItemID === "function") {
      console.log("✓ getTabIDByItemID 方法可用");
    } else {
      console.log("✗ getTabIDByItemID 方法不可用");
    }
  } else {
    console.log("✗ Zotero_Tabs 不可用");
  }

  // 2. 测试打开一个 PDF
  console.log("\n=== 测试打开 PDF ===");

  // 获取第一个 PDF 附件
  const items = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
  let pdfItem = null;

  for (let item of items) {
    if (item.isPDFAttachment()) {
      pdfItem = item;
      break;
    }
  }

  if (pdfItem) {
    console.log(`找到 PDF: ${pdfItem.getField("title")} (ID: ${pdfItem.id})`);

    // 测试不同的打开方式
    console.log("\n测试 1: 使用 Zotero.OpenPDF.openToPage");
    try {
      Zotero.OpenPDF.openToPage(pdfItem, null, null);
      console.log("✓ Zotero.OpenPDF.openToPage 成功");
    } catch (e) {
      console.log("✗ Zotero.OpenPDF.openToPage 失败:", e);
    }

    // 等待一下让标签页打开
    await Zotero.Promise.delay(1000);

    // 检查是否能找到这个标签页
    if (Zotero_Tabs && Zotero_Tabs.getTabIDByItemID) {
      const tabID = Zotero_Tabs.getTabIDByItemID(pdfItem.id);
      console.log(`标签页 ID: ${tabID}`);

      if (tabID) {
        console.log("✓ 找到了对应的标签页");

        // 测试切换到其他标签页再切换回来
        console.log("\n测试切换标签页");
        Zotero_Tabs.select("zotero-pane");
        await Zotero.Promise.delay(500);
        Zotero_Tabs.select(tabID);
        console.log("✓ 标签页切换成功");
      }
    }

    console.log("\n测试 2: 使用 Zotero.Reader.open");
    try {
      await Zotero.Reader.open(pdfItem.id);
      console.log("✓ Zotero.Reader.open 成功");
    } catch (e) {
      console.log("✗ Zotero.Reader.open 失败:", e);
    }
  } else {
    console.log("✗ 没有找到 PDF 附件");
  }

  // 3. 测试 HTML 快照
  console.log("\n=== 测试打开 HTML 快照 ===");

  let htmlItem = null;
  for (let item of items) {
    if (item.isAttachment() && item.attachmentContentType === "text/html") {
      htmlItem = item;
      break;
    }
  }

  if (htmlItem) {
    console.log(
      `找到 HTML 快照: ${htmlItem.getField("title")} (ID: ${htmlItem.id})`,
    );
    console.log(`ContentType: ${htmlItem.attachmentContentType}`);
    console.log(`ReaderType: ${htmlItem.attachmentReaderType}`);

    try {
      await Zotero.Reader.open(htmlItem.id);
      console.log("✓ HTML 快照打开成功");
    } catch (e) {
      console.log("✗ HTML 快照打开失败:", e);
    }
  } else {
    console.log("✗ 没有找到 HTML 快照");
  }
}

// 运行测试
testTabSystem().catch(console.error);
