/* -*- Mode: javascript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
"use strict";

/* global Components, Services */
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

// 全局日志函数
function log(msg) {
    try {
        if (typeof Zotero !== 'undefined' && Zotero.debug) {
            Zotero.debug("[ResearchNavigator] " + msg);
        }
        dump("[ResearchNavigator] " + msg + "\n");
        Services.console.logStringMessage("[ResearchNavigator] " + msg);
    } catch (e) {
        dump("[ResearchNavigator] Log error: " + e + "\n");
    }
}

// 插件主对象
var ResearchNavigator = {
    id: null,
    version: null,
    rootURI: null,
    initialized: false,
    windows: new Set(),
    addedElementIds: [],
    
    init(data) {
        this.id = data.id;
        this.version = data.version;
        this.rootURI = data.rootURI;
        this.initialized = true;
        
        log(`Initializing Research Navigator v${this.version}`);
        
        // 在 Zotero 对象上注册
        if (typeof Zotero !== 'undefined') {
            Zotero.ResearchNavigator = this;
            log("Registered as Zotero.ResearchNavigator");
            
            // 设置偏好设置
            try {
                Zotero.Prefs.set("extensions.researchnavigator.initialized", true);
                Zotero.Prefs.set("extensions.researchnavigator.version", this.version);
            } catch (e) {
                log("Error setting preferences: " + e);
            }
        }
    },
    
    shutdown() {
        log("Shutting down Research Navigator");
        
        // 清理所有窗口的 UI
        for (let win of this.windows) {
            this.removeWindowUI(win);
        }
        this.windows.clear();
        
        // 从 Zotero 对象移除
        if (typeof Zotero !== 'undefined' && Zotero.ResearchNavigator) {
            delete Zotero.ResearchNavigator;
        }
    },
    
    setupWindowUI(window) {
        if (this.windows.has(window)) {
            log("Window already initialized");
            return;
        }
        
        log(`Setting up UI for window: ${window.location.href}`);
        this.windows.add(window);
        
        try {
            const doc = window.document;
            
            // 等待 DOM 完全加载
            if (doc.readyState !== 'complete') {
                log("Document not ready, waiting...");
                window.addEventListener('load', () => this.setupWindowUI(window), { once: true });
                return;
            }
            
            // 1. 添加测试按钮（固定位置，确保可见）
            this.addTestButton(window);
            
            // 2. 添加工具栏按钮
            this.addToolbarButton(window);
            
            // 3. 添加菜单项
            this.addMenuItems(window);
            
            // 4. 添加右键菜单
            this.addContextMenuItems(window);
            
            log("UI setup completed successfully");
            
            // 显示成功消息（仅在开发时）
            window.setTimeout(() => {
                if (window.Zotero && window.Zotero.Prefs.get("extensions.researchnavigator.showWelcome", true)) {
                    window.Zotero.Prefs.set("extensions.researchnavigator.showWelcome", false);
                    window.alert("Research Navigator loaded successfully!\n\nLook for:\n- Red test button (top-right)\n- Toolbar button\n- Tools menu item\n- Right-click menu items");
                }
            }, 1000);
            
        } catch (e) {
            log(`Error setting up UI: ${e}\n${e.stack}`);
            Cu.reportError(e);
        }
    },
    
    addTestButton(window) {
        const doc = window.document;
        
        // 移除旧按钮（如果存在）
        const oldBtn = doc.getElementById('research-navigator-test-button');
        if (oldBtn) {
            oldBtn.remove();
        }
        
        // 创建测试按钮
        const btn = doc.createElement('button');
        btn.id = 'research-navigator-test-button';
        btn.textContent = '📚 RN';
        btn.style.cssText = `
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            z-index: 999999 !important;
            background: #e74c3c !important;
            color: white !important;
            border: none !important;
            padding: 8px 12px !important;
            cursor: pointer !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            font-weight: bold !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
        `;
        
        btn.addEventListener('click', () => {
            this.showPanel(window);
        });
        
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#c0392b !important';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#e74c3c !important';
        });
        
        // 添加到多个可能的父元素
        const possibleParents = [
            doc.body,
            doc.documentElement,
            doc.getElementById('zotero-pane-stack'),
            doc.getElementById('appcontent'),
            doc.querySelector('#main-window')
        ];
        
        let added = false;
        for (const parent of possibleParents) {
            if (parent) {
                try {
                    parent.appendChild(btn);
                    log(`Added test button to: ${parent.id || parent.tagName}`);
                    this.addedElementIds.push('research-navigator-test-button');
                    added = true;
                    break;
                } catch (e) {
                    log(`Failed to add test button to ${parent.id || parent.tagName}: ${e}`);
                }
            }
        }
        
        if (!added) {
            log("ERROR: Could not add test button to any parent element!");
        }
    },
    
    addToolbarButton(window) {
        const doc = window.document;
        
        // 尝试多个可能的工具栏位置
        const toolbarIds = [
            'zotero-items-toolbar',
            'zotero-tb-toolbar',
            'zotero-toolbar',
            'nav-bar'
        ];
        
        for (let toolbarId of toolbarIds) {
            const toolbar = doc.getElementById(toolbarId);
            if (toolbar) {
                // 检查是否已存在
                if (doc.getElementById('research-navigator-toolbar-button')) {
                    log("Toolbar button already exists");
                    return;
                }
                
                const button = doc.createXULElement('toolbarbutton');
                button.id = 'research-navigator-toolbar-button';
                button.className = 'zotero-tb-button';
                button.setAttribute('tooltiptext', 'Research Navigator - Click to open');
                button.setAttribute('label', 'RN');
                button.style.listStyleImage = 'url(chrome://zotero/skin/16/universal/tree-item.png)';
                
                button.addEventListener('command', () => {
                    this.showPanel(window);
                });
                
                toolbar.appendChild(button);
                this.addedElementIds.push('research-navigator-toolbar-button');
                log(`Added toolbar button to ${toolbarId}`);
                break;
            }
        }
    },
    
    addMenuItems(window) {
        const doc = window.document;
        
        // 添加到工具菜单
        const toolsMenu = doc.getElementById('menu_ToolsPopup');
        if (toolsMenu) {
            // 检查是否已存在
            if (doc.getElementById('research-navigator-menu')) {
                return;
            }
            
            const separator = doc.createXULElement('menuseparator');
            separator.id = 'research-navigator-menu-separator';
            toolsMenu.appendChild(separator);
            this.addedElementIds.push('research-navigator-menu-separator');
            
            const menuitem = doc.createXULElement('menuitem');
            menuitem.id = 'research-navigator-menu';
            menuitem.setAttribute('label', 'Research Navigator');
            menuitem.setAttribute('accesskey', 'R');
            menuitem.addEventListener('command', () => {
                this.showPanel(window);
            });
            
            toolsMenu.appendChild(menuitem);
            this.addedElementIds.push('research-navigator-menu');
            log("Added tools menu item");
        }
    },
    
    addContextMenuItems(window) {
        const doc = window.document;
        
        // 项目右键菜单
        const itemMenu = doc.getElementById('zotero-itemmenu');
        if (itemMenu) {
            // 检查是否已存在
            if (doc.getElementById('research-navigator-item-menu')) {
                return;
            }
            
            const separator = doc.createXULElement('menuseparator');
            separator.id = 'research-navigator-item-separator';
            itemMenu.appendChild(separator);
            this.addedElementIds.push('research-navigator-item-separator');
            
            const menuitem = doc.createXULElement('menuitem');
            menuitem.id = 'research-navigator-item-menu';
            menuitem.setAttribute('label', 'View in Research Navigator');
            menuitem.addEventListener('command', () => {
                const items = window.ZoteroPane.getSelectedItems();
                this.viewItems(window, items);
            });
            itemMenu.appendChild(menuitem);
            this.addedElementIds.push('research-navigator-item-menu');
            
            log("Added item context menu");
        }
        
        // 集合右键菜单
        const collectionMenu = doc.getElementById('zotero-collectionmenu');
        if (collectionMenu) {
            if (doc.getElementById('research-navigator-collection-menu')) {
                return;
            }
            
            const separator = doc.createXULElement('menuseparator');
            separator.id = 'research-navigator-collection-separator';
            collectionMenu.appendChild(separator);
            this.addedElementIds.push('research-navigator-collection-separator');
            
            const menuitem = doc.createXULElement('menuitem');
            menuitem.id = 'research-navigator-collection-menu';
            menuitem.setAttribute('label', 'View Collection History');
            menuitem.addEventListener('command', () => {
                this.viewCollectionHistory(window);
            });
            collectionMenu.appendChild(menuitem);
            this.addedElementIds.push('research-navigator-collection-menu');
            
            log("Added collection context menu");
        }
    },
    
    removeWindowUI(window) {
        const doc = window.document;
        
        // 移除所有添加的元素
        for (let id of this.addedElementIds) {
            const element = doc.getElementById(id);
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        
        this.windows.delete(window);
        log("Removed UI from window");
    },
    
    // 功能方法
    showPanel(window) {
        log("Showing Research Navigator panel");
        
        // 暂时使用 alert 显示信息
        const info = `Research Navigator v${this.version}

Plugin is working correctly!

Features:
- History tracking
- Search functionality
- Export capabilities

Zotero version: ${Zotero.version}
Items in library: ${window.Zotero.Items.getAll().length}`;
        
        window.alert(info);
    },
    
    viewItems(window, items) {
        if (items.length === 0) {
            window.alert("No items selected");
            return;
        }
        
        const itemInfo = items.map(item => {
            return `- ${item.getField('title')} (${item.itemType})`;
        }).join('\n');
        
        window.alert(`Selected ${items.length} items:\n\n${itemInfo}`);
        log(`Viewing ${items.length} items`);
    },
    
    viewCollectionHistory(window) {
        const collection = window.ZoteroPane.getSelectedCollection();
        if (collection) {
            window.alert(`Collection: ${collection.name}\nItems: ${collection.getChildItems().length}`);
        } else {
            window.alert("No collection selected");
        }
    }
};

// Bootstrap 函数 - 必须在全局作用域
function install(data, reason) {
    log("Install: " + reason);
}

function uninstall(data, reason) {
    log("Uninstall: " + reason);
}

function startup(data, reason) {
    log("=== STARTUP BEGIN ===");
    log("Startup reason: " + reason);
    log("Data: " + JSON.stringify(data));
    
    try {
        ResearchNavigator.init(data);
        log("=== STARTUP SUCCESS ===");
    } catch (e) {
        log("ERROR in startup: " + e + "\n" + e.stack);
        Cu.reportError(e);
    }
}

function shutdown(data, reason) {
    log("=== SHUTDOWN BEGIN ===");
    log("Shutdown reason: " + reason);
    
    try {
        ResearchNavigator.shutdown();
        log("=== SHUTDOWN SUCCESS ===");
    } catch (e) {
        log("ERROR in shutdown: " + e + "\n" + e.stack);
    }
}

function onMainWindowLoad(params, reason) {
    log("=== MAIN WINDOW LOAD ===");
    const { window } = params;
    log(`Window load reason: ${reason}`);
    log(`Window location: ${window ? window.location.href : 'null'}`);
    
    if (!window) {
        log("ERROR: No window in params!");
        return;
    }
    
    try {
        ResearchNavigator.setupWindowUI(window);
    } catch (e) {
        log("ERROR in onMainWindowLoad: " + e + "\n" + e.stack);
        Cu.reportError(e);
    }
}

function onMainWindowUnload(params, reason) {
    log("=== MAIN WINDOW UNLOAD ===");
    const { window } = params;
    log(`Window unload reason: ${reason}`);
    
    if (!window) {
        return;
    }
    
    try {
        ResearchNavigator.removeWindowUI(window);
    } catch (e) {
        log("ERROR in onMainWindowUnload: " + e + "\n" + e.stack);
    }
}

// 验证函数在全局作用域
log("Bootstrap.js loaded - verifying global functions:");
log("startup: " + (typeof startup));
log("shutdown: " + (typeof shutdown));
log("onMainWindowLoad: " + (typeof onMainWindowLoad));
log("onMainWindowUnload: " + (typeof onMainWindowUnload));