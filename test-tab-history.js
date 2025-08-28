/**
 * 测试脚本：检查 Zotero 的标签页历史功能
 * 在 Zotero 的 Tools -> Developer -> Run JavaScript 中运行
 */

// 检查 Zotero_Tabs 对象
if (typeof Zotero_Tabs !== 'undefined') {
    console.log("✓ Zotero_Tabs 对象存在");
    
    // 检查 _history 属性
    if (Zotero_Tabs._history !== undefined) {
        console.log("✓ Zotero_Tabs._history 存在");
        console.log(`历史记录数量: ${Zotero_Tabs._history.length}`);
        
        // 显示历史记录
        Zotero_Tabs._history.forEach((entry, index) => {
            console.log(`\n历史条目 ${index + 1}:`);
            entry.forEach(tab => {
                console.log(`  - Index: ${tab.index}, ItemID: ${tab.data?.itemID}`);
            });
        });
    } else {
        console.log("✗ Zotero_Tabs._history 不存在");
    }
    
    // 检查 undoClose 方法
    if (typeof Zotero_Tabs.undoClose === 'function') {
        console.log("✓ Zotero_Tabs.undoClose 方法存在");
    }
    
    // 获取当前打开的标签页
    console.log(`\n当前打开的标签页数量: ${Zotero_Tabs._tabs.length}`);
    Zotero_Tabs._tabs.forEach((tab, index) => {
        console.log(`标签页 ${index}: ${tab.id} (${tab.type}) - ${tab.title}`);
    });
} else {
    console.log("✗ Zotero_Tabs 对象不存在");
}