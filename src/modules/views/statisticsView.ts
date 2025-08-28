/**
 * 统计视图
 */

import { getString } from "../../utils/locale";
import { HistoryNode } from "../historyTree";

interface Statistics {
  totalNodes: number;
  totalSessions: number;
  totalNotes: number;
  averagePathLength: number;
  mostVisitedItems: Array<{
    item: Zotero.Item;
    count: number;
  }>;
  dailyActivity: Array<{
    date: Date;
    count: number;
  }>;
  tagDistribution: Array<{
    tag: string;
    count: number;
  }>;
}

export class StatisticsView {
  private container: HTMLDivElement | null = null;
  private stats: Statistics | null = null;
  
  constructor(private addon: any) {}

  /**
   * 初始化视图
   */
  public async init() {
    // 初始化时计算统计数据
    await this.calculateStatistics();
  }

  /**
   * 渲染视图
   */
  public async render(): Promise<HTMLElement> {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    this.container = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["statistics-view"],
      styles: {
        height: "100%",
        overflow: "auto",
        padding: "16px",
      },
    }) as HTMLDivElement;

    // 标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "h2", {
      styles: {
        marginBottom: "20px",
        fontSize: "20px",
        fontWeight: "bold",
      },
      properties: {
        textContent: getString("statistics-title"),
      },
    });
    this.container.appendChild(title);

    // 如果还没有统计数据，先计算
    if (!this.stats) {
      await this.calculateStatistics();
    }

    // 渲染统计卡片
    const grid = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["stats-grid"],
      styles: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      },
    });

    // 总览卡片
    grid.appendChild(this.createStatCard(
      getString("stat-total-nodes"),
      this.stats!.totalNodes.toString(),
      "📊"
    ));

    grid.appendChild(this.createStatCard(
      getString("stat-total-sessions"),
      this.stats!.totalSessions.toString(),
      "🔄"
    ));

    grid.appendChild(this.createStatCard(
      getString("stat-total-notes"),
      this.stats!.totalNotes.toString(),
      "📝"
    ));

    grid.appendChild(this.createStatCard(
      getString("stat-avg-path-length"),
      this.stats!.averagePathLength.toFixed(1),
      "🛤️"
    ));

    this.container.appendChild(grid);

    // 详细统计部分
    const sections = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["stats-sections"],
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      },
    });

    // 最常访问的文献
    sections.appendChild(this.createMostVisitedSection());

    // 每日活动
    sections.appendChild(this.createDailyActivitySection());

    // 标签分布
    sections.appendChild(this.createTagDistributionSection());

    this.container.appendChild(sections);

    // 导出按钮
    const exportBtn = this.addon.data.ztoolkit.UI.createElement(doc, "button", {
      styles: {
        marginTop: "24px",
        padding: "8px 16px",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "4px",
        backgroundColor: "var(--material-button)",
        cursor: "pointer",
      },
      properties: {
        textContent: getString("export-statistics"),
      },
      listeners: [
        {
          type: "click",
          listener: () => this.exportStatistics(),
        },
      ],
    });
    this.container.appendChild(exportBtn);

    return this.container;
  }

  /**
   * 创建统计卡片
   */
  private createStatCard(label: string, value: string, icon: string): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    return this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["stat-card"],
      styles: {
        padding: "16px",
        backgroundColor: "var(--material-sidepane)",
        border: "1px solid var(--material-border-quarternary)",
        borderRadius: "8px",
        textAlign: "center",
      },
      children: [
        {
          tag: "div",
          styles: {
            fontSize: "24px",
            marginBottom: "8px",
          },
          properties: {
            textContent: icon,
          },
        },
        {
          tag: "div",
          styles: {
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "4px",
          },
          properties: {
            textContent: value,
          },
        },
        {
          tag: "div",
          styles: {
            fontSize: "12px",
            color: "var(--fill-secondary)",
          },
          properties: {
            textContent: label,
          },
        },
      ],
    });
  }

  /**
   * 创建最常访问部分
   */
  private createMostVisitedSection(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    const section = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["most-visited-section"],
    });

    // 标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "h3", {
      styles: {
        marginBottom: "12px",
        fontSize: "16px",
        fontWeight: "bold",
      },
      properties: {
        textContent: getString("most-visited-items"),
      },
    });
    section.appendChild(title);

    // 列表
    const list = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      },
    });

    this.stats!.mostVisitedItems.slice(0, 10).forEach((item, index) => {
      const itemElement = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
        styles: {
          display: "flex",
          alignItems: "center",
          padding: "8px",
          backgroundColor: "var(--material-sidepane)",
          borderRadius: "4px",
          cursor: "pointer",
        },
        listeners: [
          {
            type: "click",
            listener: () => this.addon.hooks.onOpenItem(item.item.id),
          },
        ],
        children: [
          {
            tag: "span",
            styles: {
              marginRight: "12px",
              fontWeight: "bold",
              color: "var(--fill-secondary)",
            },
            properties: {
              textContent: `${index + 1}.`,
            },
          },
          {
            tag: "span",
            styles: {
              flex: "1",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            properties: {
              textContent: item.item.getField("title"),
            },
          },
          {
            tag: "span",
            styles: {
              marginLeft: "12px",
              padding: "2px 8px",
              backgroundColor: "var(--accent-blue)",
              color: "white",
              borderRadius: "12px",
              fontSize: "12px",
            },
            properties: {
              textContent: item.count.toString(),
            },
          },
        ],
      });
      list.appendChild(itemElement);
    });

    section.appendChild(list);
    return section;
  }

  /**
   * 创建每日活动部分
   */
  private createDailyActivitySection(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    const section = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["daily-activity-section"],
    });

    // 标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "h3", {
      styles: {
        marginBottom: "12px",
        fontSize: "16px",
        fontWeight: "bold",
      },
      properties: {
        textContent: getString("daily-activity"),
      },
    });
    section.appendChild(title);

    // 活动图表（简化版本，使用条形图）
    const chart = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      styles: {
        display: "flex",
        alignItems: "flex-end",
        height: "100px",
        gap: "4px",
        padding: "8px",
        backgroundColor: "var(--material-sidepane)",
        borderRadius: "4px",
      },
    });

    // 获取最近30天的数据
    const recentDays = this.stats!.dailyActivity.slice(-30);
    const maxCount = Math.max(...recentDays.map(d => d.count));

    recentDays.forEach(day => {
      const height = maxCount > 0 ? (day.count / maxCount) * 80 : 0;
      const bar = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
        styles: {
          flex: "1",
          height: `${height}px`,
          backgroundColor: "var(--accent-blue)",
          borderRadius: "2px 2px 0 0",
          transition: "height 0.3s ease",
        },
        attributes: {
          title: `${day.date.toLocaleDateString()}: ${day.count} visits`,
        },
      });
      chart.appendChild(bar);
    });

    section.appendChild(chart);
    return section;
  }

  /**
   * 创建标签分布部分
   */
  private createTagDistributionSection(): HTMLElement {
    const doc = this.addon.data.ztoolkit.getGlobal("document");
    
    const section = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      classList: ["tag-distribution-section"],
    });

    // 标题
    const title = this.addon.data.ztoolkit.UI.createElement(doc, "h3", {
      styles: {
        marginBottom: "12px",
        fontSize: "16px",
        fontWeight: "bold",
      },
      properties: {
        textContent: getString("tag-distribution"),
      },
    });
    section.appendChild(title);

    // 标签云
    const tagCloud = this.addon.data.ztoolkit.UI.createElement(doc, "div", {
      styles: {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "12px",
        backgroundColor: "var(--material-sidepane)",
        borderRadius: "4px",
      },
    });

    // 计算标签大小
    const maxCount = Math.max(...this.stats!.tagDistribution.map(t => t.count));
    
    this.stats!.tagDistribution.slice(0, 20).forEach(tag => {
      const size = 12 + (tag.count / maxCount) * 12; // 12-24px
      const tagElement = this.addon.data.ztoolkit.UI.createElement(doc, "span", {
        styles: {
          padding: "4px 8px",
          backgroundColor: "var(--material-button)",
          borderRadius: "4px",
          fontSize: `${size}px`,
          cursor: "pointer",
        },
        properties: {
          textContent: `${tag.tag} (${tag.count})`,
        },
        listeners: [
          {
            type: "click",
            listener: () => this.filterByTag(tag.tag),
          },
        ],
      });
      tagCloud.appendChild(tagElement);
    });

    section.appendChild(tagCloud);
    return section;
  }

  /**
   * 计算统计数据
   */
  private async calculateStatistics() {
    const nodes = this.addon.data.researchNavigator.getAllNodes();
    const sessions = new Set(nodes.map(n => n.sessionId));
    
    // 计算访问次数
    const visitCounts = new Map<number, number>();
    nodes.forEach(node => {
      const count = visitCounts.get(node.itemId) || 0;
      visitCounts.set(node.itemId, count + node.visitCount);
    });

    // 获取最常访问的项目
    const mostVisited = Array.from(visitCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([itemId, count]) => ({
        item: Zotero.Items.get(itemId),
        count,
      }))
      .filter(item => item.item); // 过滤掉已删除的项目

    // 计算平均路径长度
    const pathLengths = nodes.map(node => {
      let depth = 0;
      let current = node;
      while (current.parentId) {
        depth++;
        current = this.addon.data.researchNavigator.nodeMap.get(current.parentId);
        if (!current || depth > 100) break; // 防止循环
      }
      return depth;
    });
    const avgPathLength = pathLengths.length > 0 
      ? pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length 
      : 0;

    // 计算每日活动
    const dailyActivity = this.calculateDailyActivity(nodes);

    // 计算标签分布
    const tagDistribution = this.calculateTagDistribution(nodes);

    // 计算关联的笔记数
    const noteRelations = await this.addon.data.researchNavigator.db.getAllNoteRelations();
    const uniqueNotes = new Set(noteRelations.map(r => r.noteId));

    this.stats = {
      totalNodes: nodes.length,
      totalSessions: sessions.size,
      totalNotes: uniqueNotes.size,
      averagePathLength: avgPathLength,
      mostVisitedItems: mostVisited,
      dailyActivity,
      tagDistribution,
    };
  }

  /**
   * 计算每日活动
   */
  private calculateDailyActivity(nodes: HistoryNode[]): Array<{date: Date, count: number}> {
    const activityMap = new Map<string, number>();
    
    nodes.forEach(node => {
      const date = new Date(node.timestamp);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      
      const count = activityMap.get(dateKey) || 0;
      activityMap.set(dateKey, count + 1);
    });

    // 填充最近30天的数据
    const result: Array<{date: Date, count: number}> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      result.push({
        date,
        count: activityMap.get(dateKey) || 0,
      });
    }

    return result;
  }

  /**
   * 计算标签分布
   */
  private calculateTagDistribution(nodes: HistoryNode[]): Array<{tag: string, count: number}> {
    const tagCounts = new Map<string, number>();
    
    nodes.forEach(node => {
      node.tags.forEach(tag => {
        const count = tagCounts.get(tag) || 0;
        tagCounts.set(tag, count + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 按标签过滤
   */
  private filterByTag(tag: string) {
    // 切换到历史树视图并应用标签过滤
    this.addon.hooks.onFilterByTag(tag);
  }

  /**
   * 导出统计数据
   */
  private async exportStatistics() {
    if (!this.stats) return;

    const report = {
      generatedAt: new Date().toISOString(),
      statistics: this.stats,
      version: this.addon.data.version,
    };

    const jsonStr = JSON.stringify(report, null, 2);
    
    // 使用 Zotero 的文件选择器
    const fp = new FilePickerUtil();
    const file = await fp.save(
      getString("export-statistics-title"),
      `research-navigator-stats-${new Date().toISOString().split('T')[0]}.json`,
      [["JSON Files", "*.json"], ["All Files", "*.*"]]
    );

    if (file) {
      await Zotero.File.putContentsAsync(file, jsonStr);
      this.addon.hooks.onShowMessage(getString("export-success"), "success");
    }
  }

  /**
   * 刷新统计数据
   */
  public async refresh() {
    await this.calculateStatistics();
    if (this.container) {
      const parent = this.container.parentElement;
      if (parent) {
        const newContent = await this.render();
        parent.replaceChild(newContent, this.container);
        this.container = newContent as HTMLDivElement;
      }
    }
  }

  /**
   * 销毁视图
   */
  public destroy() {
    this.container = null;
    this.stats = null;
  }
}

// 文件选择器工具类
class FilePickerUtil {
  async save(title: string, defaultName: string, filters: Array<[string, string]>): Promise<string | null> {
    const fp = Components.classes["@mozilla.org/filepicker;1"]
      .createInstance(Components.interfaces.nsIFilePicker);
    
    fp.init(window, title, Components.interfaces.nsIFilePicker.modeSave);
    fp.defaultString = defaultName;
    
    filters.forEach(([name, ext]) => {
      fp.appendFilter(name, ext);
    });
    
    return new Promise((resolve) => {
      fp.open((result: number) => {
        if (result === Components.interfaces.nsIFilePicker.returnOK) {
          resolve(fp.file.path);
        } else {
          resolve(null);
        }
      });
    });
  }
}