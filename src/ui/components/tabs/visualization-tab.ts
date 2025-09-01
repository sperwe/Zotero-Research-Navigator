import { HistoryService } from '../../../services/history-service';
import { HistoryNode } from '../../../services/database-service';
import { NoteAssociationSystem } from '../../../managers/note-association-system';

type VisualizationMode = 'timeline' | 'graph' | 'calendar' | 'heatmap';

interface TimelineEvent {
  node: HistoryNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class VisualizationTab {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentMode: VisualizationMode = 'timeline';
  private timelineEvents: TimelineEvent[] = [];
  private selectedNode: HistoryNode | null = null;
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {}
  
  create(container: HTMLElement): void {
    this.container = container;
    const doc = this.window.document;
    
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    `;
    
    // 工具栏
    const toolbar = this.createToolbar(doc);
    container.appendChild(toolbar);
    
    // 可视化区域
    const vizContainer = doc.createElement('div');
    vizContainer.style.cssText = `
      flex: 1;
      position: relative;
      overflow: hidden;
    `;
    
    // Canvas
    this.canvas = doc.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      cursor: crosshair;
    `;
    vizContainer.appendChild(this.canvas);
    
    // 详情面板
    const detailsPanel = this.createDetailsPanel(doc);
    vizContainer.appendChild(detailsPanel);
    
    container.appendChild(vizContainer);
    
    // 初始化
    this.initCanvas();
    this.attachEventListeners();
    this.render();
  }
  
  private createToolbar(doc: Document): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 10px;
      border-bottom: 1px solid var(--material-border-quarternary);
      background: var(--material-sidepane);
    `;
    
    // 模式选择
    const modes: { mode: VisualizationMode; label: string; icon: string }[] = [
      { mode: 'timeline', label: 'Timeline', icon: '📅' },
      { mode: 'graph', label: 'Graph', icon: '🕸️' },
      { mode: 'calendar', label: 'Calendar', icon: '📆' },
      { mode: 'heatmap', label: 'Heatmap', icon: '🔥' }
    ];
    
    modes.forEach(({ mode, label, icon }) => {
      const btn = doc.createElement('button');
      btn.textContent = `${icon} ${label}`;
      btn.style.cssText = `
        padding: 6px 12px;
        border: 1px solid var(--material-border-quarternary);
        background: ${mode === this.currentMode ? 'var(--accent-blue)' : 'white'};
        color: ${mode === this.currentMode ? 'white' : 'black'};
        border-radius: 4px;
        cursor: pointer;
      `;
      
      btn.addEventListener('click', () => {
        this.currentMode = mode;
        this.updateToolbar();
        this.render();
      });
      
      toolbar.appendChild(btn);
    });
    
    // 缩放控制
    const zoomControls = doc.createElement('div');
    zoomControls.style.cssText = `
      margin-left: auto;
      display: flex;
      gap: 5px;
      align-items: center;
    `;
    
    const zoomOut = doc.createElement('button');
    zoomOut.textContent = '−';
    zoomOut.style.cssText = `
      width: 30px;
      height: 30px;
      border: 1px solid var(--material-border-quarternary);
      background: white;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    const zoomIn = doc.createElement('button');
    zoomIn.textContent = '+';
    zoomIn.style.cssText = `
      width: 30px;
      height: 30px;
      border: 1px solid var(--material-border-quarternary);
      background: white;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    const zoomReset = doc.createElement('button');
    zoomReset.textContent = '100%';
    zoomReset.style.cssText = `
      padding: 6px 12px;
      border: 1px solid var(--material-border-quarternary);
      background: white;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    zoomControls.appendChild(zoomOut);
    zoomControls.appendChild(zoomReset);
    zoomControls.appendChild(zoomIn);
    
    toolbar.appendChild(zoomControls);
    
    return toolbar;
  }
  
  private createDetailsPanel(doc: Document): HTMLElement {
    const panel = doc.createElement('div');
    panel.id = 'viz-details-panel';
    panel.style.cssText = `
      position: absolute;
      right: 10px;
      top: 10px;
      width: 300px;
      background: white;
      border: 1px solid var(--material-border-quarternary);
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 15px;
      display: none;
    `;
    
    return panel;
  }
  
  private initCanvas(): void {
    if (!this.canvas) return;
    
    const parent = this.canvas.parentElement;
    if (!parent) return;
    
    // 设置 canvas 大小
    const rect = parent.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    this.ctx = this.canvas.getContext('2d');
  }
  
  private attachEventListeners(): void {
    if (!this.canvas) return;
    
    // 鼠标移动
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.handleMouseMove(x, y);
    });
    
    // 点击
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.handleClick(x, y);
    });
    
    // 窗口大小变化
    this.window.addEventListener('resize', () => {
      this.initCanvas();
      this.render();
    });
  }
  
  private render(): void {
    if (!this.ctx || !this.canvas) return;
    
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    switch (this.currentMode) {
      case 'timeline':
        this.renderTimeline();
        break;
      case 'graph':
        this.renderGraph();
        break;
      case 'calendar':
        this.renderCalendar();
        break;
      case 'heatmap':
        this.renderHeatmap();
        break;
    }
  }
  
  /**
   * 渲染时间线视图
   */
  private renderTimeline(): void {
    if (!this.ctx || !this.canvas) return;
    
    const sessions = this.historyService.getAllSessions();
    const allNodes: HistoryNode[] = [];
    
    // 收集所有节点
    for (const { nodes } of sessions) {
      allNodes.push(...nodes);
    }
    
    // 按时间排序
    allNodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (allNodes.length === 0) return;
    
    // 计算时间范围
    const startTime = new Date(allNodes[0].timestamp).getTime();
    const endTime = new Date(allNodes[allNodes.length - 1].timestamp).getTime();
    const timeRange = endTime - startTime;
    
    // 绘制时间轴
    const margin = 50;
    const timelineY = this.canvas.height / 2;
    const timelineWidth = this.canvas.width - 2 * margin;
    
    // 主线
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(margin, timelineY);
    this.ctx.lineTo(this.canvas.width - margin, timelineY);
    this.ctx.stroke();
    
    // 清空事件列表
    this.timelineEvents = [];
    
    // 绘制节点
    const nodeHeight = 30;
    const nodeSpacing = 10;
    let currentY = 0;
    
    for (const node of allNodes) {
      const nodeTime = new Date(node.timestamp).getTime();
      const x = margin + ((nodeTime - startTime) / timeRange) * timelineWidth;
      const y = timelineY + (currentY % 2 === 0 ? -40 : 40);
      
      // 保存事件位置
      this.timelineEvents.push({
        node,
        x: x - 5,
        y: y - 15,
        width: 10,
        height: 30
      });
      
      // 连接线
      this.ctx.strokeStyle = '#ddd';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, timelineY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      
      // 节点圆圈
      this.ctx.fillStyle = node.status === 'open' ? '#4CAF50' : '#2196F3';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 标题
      this.ctx.fillStyle = '#333';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'center';
      const title = node.title || 'Untitled';
      const maxWidth = 100;
      const truncated = this.truncateText(title, maxWidth);
      this.ctx.fillText(truncated, x, y - 20);
      
      currentY++;
    }
    
    // 绘制时间标签
    this.renderTimeLabels(startTime, endTime, margin, timelineY + 30, timelineWidth);
  }
  
  /**
   * 渲染关系图谱
   */
  private renderGraph(): void {
    if (!this.ctx || !this.canvas) return;
    
    const sessions = this.historyService.getAllSessions();
    const nodes: HistoryNode[] = [];
    const edges: { from: HistoryNode; to: HistoryNode }[] = [];
    
    // 收集节点和边
    for (const { nodes: sessionNodes } of sessions) {
      nodes.push(...sessionNodes);
      
      // 创建会话内的连接
      for (let i = 1; i < sessionNodes.length; i++) {
        edges.push({
          from: sessionNodes[i - 1],
          to: sessionNodes[i]
        });
      }
    }
    
    // 使用力导向布局
    const positions = this.forceDirectedLayout(nodes, edges);
    
    // 绘制边
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;
    for (const edge of edges) {
      const fromPos = positions.get(edge.from.id);
      const toPos = positions.get(edge.to.id);
      if (fromPos && toPos) {
        this.ctx.beginPath();
        this.ctx.moveTo(fromPos.x, fromPos.y);
        this.ctx.lineTo(toPos.x, toPos.y);
        this.ctx.stroke();
      }
    }
    
    // 绘制节点
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      
      // 节点圆圈
      this.ctx.fillStyle = node.status === 'open' ? '#4CAF50' : '#2196F3';
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 节点图标
      this.ctx.fillStyle = 'white';
      this.ctx.font = '16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('📄', pos.x, pos.y);
    }
  }
  
  /**
   * 渲染日历视图
   */
  private renderCalendar(): void {
    if (!this.ctx || !this.canvas) return;
    
    const sessions = this.historyService.getAllSessions();
    const nodesByDate = new Map<string, HistoryNode[]>();
    
    // 按日期分组节点
    for (const { nodes } of sessions) {
      for (const node of nodes) {
        const date = new Date(node.timestamp).toDateString();
        if (!nodesByDate.has(date)) {
          nodesByDate.set(date, []);
        }
        nodesByDate.get(date)!.push(node);
      }
    }
    
    // 获取当前月份
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    
    // 计算单元格大小
    const cellWidth = this.canvas.width / 7;
    const cellHeight = (this.canvas.height - 50) / 6;
    
    // 绘制星期标题
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    this.ctx.fillStyle = '#666';
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    
    for (let i = 0; i < 7; i++) {
      this.ctx.fillText(weekdays[i], i * cellWidth + cellWidth / 2, 20);
    }
    
    // 绘制日期格子
    let currentDate = 1;
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        if (week === 0 && day < startWeekday) continue;
        if (currentDate > daysInMonth) break;
        
        const x = day * cellWidth;
        const y = week * cellHeight + 40;
        
        // 绘制格子
        this.ctx.strokeStyle = '#ddd';
        this.ctx.strokeRect(x, y, cellWidth, cellHeight);
        
        // 日期数字
        this.ctx.fillStyle = '#333';
        this.ctx.font = '16px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(currentDate.toString(), x + 5, y + 20);
        
        // 检查该日期的节点数
        const dateStr = new Date(year, month, currentDate).toDateString();
        const dayNodes = nodesByDate.get(dateStr) || [];
        
        if (dayNodes.length > 0) {
          // 显示活动指标
          this.ctx.fillStyle = '#2196F3';
          this.ctx.beginPath();
          this.ctx.arc(x + cellWidth - 15, y + 15, 5, 0, Math.PI * 2);
          this.ctx.fill();
          
          // 显示数量
          this.ctx.fillStyle = 'white';
          this.ctx.font = '10px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(dayNodes.length.toString(), x + cellWidth - 15, y + 18);
        }
        
        currentDate++;
      }
    }
  }
  
  /**
   * 渲染热力图
   */
  private renderHeatmap(): void {
    if (!this.ctx || !this.canvas) return;
    
    const sessions = this.historyService.getAllSessions();
    const activityByHour = new Map<string, number>();
    
    // 统计每小时的活动
    for (const { nodes } of sessions) {
      for (const node of nodes) {
        const date = new Date(node.timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        const key = `${day}-${hour}`;
        
        activityByHour.set(key, (activityByHour.get(key) || 0) + 1);
      }
    }
    
    // 找出最大值
    const maxActivity = Math.max(...activityByHour.values());
    
    // 绘制热力图
    const cellWidth = this.canvas.width / 24;
    const cellHeight = (this.canvas.height - 50) / 7;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // 绘制标题
    this.ctx.fillStyle = '#666';
    this.ctx.font = '12px sans-serif';
    
    // 小时标签
    this.ctx.textAlign = 'center';
    for (let hour = 0; hour < 24; hour++) {
      this.ctx.fillText(hour.toString(), hour * cellWidth + cellWidth / 2, 20);
    }
    
    // 星期标签
    this.ctx.textAlign = 'right';
    for (let day = 0; day < 7; day++) {
      this.ctx.fillText(days[day], 40, day * cellHeight + cellHeight / 2 + 40);
    }
    
    // 绘制热力格子
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const activity = activityByHour.get(`${day}-${hour}`) || 0;
        const intensity = maxActivity > 0 ? activity / maxActivity : 0;
        
        const x = hour * cellWidth + 50;
        const y = day * cellHeight + 30;
        
        // 根据强度设置颜色
        const hue = 200; // 蓝色
        const saturation = 100;
        const lightness = 100 - intensity * 50;
        this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        this.ctx.fillRect(x, y, cellWidth - 2, cellHeight - 2);
        
        // 显示数值
        if (activity > 0) {
          this.ctx.fillStyle = intensity > 0.5 ? 'white' : '#333';
          this.ctx.font = '10px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(activity.toString(), x + cellWidth / 2, y + cellHeight / 2);
        }
      }
    }
  }
  
  /**
   * 力导向布局算法
   */
  private forceDirectedLayout(
    nodes: HistoryNode[], 
    edges: { from: HistoryNode; to: HistoryNode }[]
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    
    // 初始化随机位置
    const centerX = this.canvas!.width / 2;
    const centerY = this.canvas!.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;
    
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });
    
    // 简化的力导向算法
    for (let iteration = 0; iteration < 50; iteration++) {
      const forces = new Map<string, { x: number; y: number }>();
      
      // 初始化力
      for (const node of nodes) {
        forces.set(node.id, { x: 0, y: 0 });
      }
      
      // 排斥力
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const pos1 = positions.get(nodes[i].id)!;
          const pos2 = positions.get(nodes[j].id)!;
          
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const force = 1000 / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            forces.get(nodes[i].id)!.x -= fx;
            forces.get(nodes[i].id)!.y -= fy;
            forces.get(nodes[j].id)!.x += fx;
            forces.get(nodes[j].id)!.y += fy;
          }
        }
      }
      
      // 吸引力（边）
      for (const edge of edges) {
        const pos1 = positions.get(edge.from.id)!;
        const pos2 = positions.get(edge.to.id)!;
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const force = distance * 0.1;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          forces.get(edge.from.id)!.x += fx;
          forces.get(edge.from.id)!.y += fy;
          forces.get(edge.to.id)!.x -= fx;
          forces.get(edge.to.id)!.y -= fy;
        }
      }
      
      // 应用力
      for (const node of nodes) {
        const pos = positions.get(node.id)!;
        const force = forces.get(node.id)!;
        
        pos.x += force.x * 0.1;
        pos.y += force.y * 0.1;
        
        // 限制在画布内
        pos.x = Math.max(30, Math.min(this.canvas!.width - 30, pos.x));
        pos.y = Math.max(30, Math.min(this.canvas!.height - 30, pos.y));
      }
    }
    
    return positions;
  }
  
  /**
   * 渲染时间标签
   */
  private renderTimeLabels(startTime: number, endTime: number, x: number, y: number, width: number): void {
    if (!this.ctx) return;
    
    this.ctx.fillStyle = '#666';
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'center';
    
    // 绘制开始时间
    const startDate = new Date(startTime);
    this.ctx.fillText(this.formatDate(startDate), x, y);
    
    // 绘制结束时间
    const endDate = new Date(endTime);
    this.ctx.fillText(this.formatDate(endDate), x + width, y);
    
    // 绘制中间时间点
    const midTime = startTime + (endTime - startTime) / 2;
    const midDate = new Date(midTime);
    this.ctx.fillText(this.formatDate(midDate), x + width / 2, y);
  }
  
  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  /**
   * 截断文本
   */
  private truncateText(text: string, maxWidth: number): string {
    if (!this.ctx) return text;
    
    const metrics = this.ctx.measureText(text);
    if (metrics.width <= maxWidth) return text;
    
    let truncated = text;
    while (truncated.length > 0 && this.ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
  }
  
  /**
   * 处理鼠标移动
   */
  private handleMouseMove(x: number, y: number): void {
    if (this.currentMode === 'timeline') {
      // 检查是否悬停在节点上
      for (const event of this.timelineEvents) {
        if (x >= event.x && x <= event.x + event.width &&
            y >= event.y && y <= event.y + event.height) {
          this.canvas!.style.cursor = 'pointer';
          this.showNodeTooltip(event.node, x, y);
          return;
        }
      }
    }
    
    this.canvas!.style.cursor = 'default';
    this.hideTooltip();
  }
  
  /**
   * 处理点击
   */
  private handleClick(x: number, y: number): void {
    if (this.currentMode === 'timeline') {
      // 检查是否点击了节点
      for (const event of this.timelineEvents) {
        if (x >= event.x && x <= event.x + event.width &&
            y >= event.y && y <= event.y + event.height) {
          this.selectNode(event.node);
          return;
        }
      }
    }
    
    this.selectedNode = null;
    this.hideDetailsPanel();
  }
  
  /**
   * 选择节点
   */
  private selectNode(node: HistoryNode): void {
    this.selectedNode = node;
    this.showDetailsPanel(node);
  }
  
  /**
   * 显示节点提示
   */
  private showNodeTooltip(node: HistoryNode, x: number, y: number): void {
    // 实现提示框显示
  }
  
  /**
   * 隐藏提示
   */
  private hideTooltip(): void {
    // 实现提示框隐藏
  }
  
  /**
   * 显示详情面板
   */
  private async showDetailsPanel(node: HistoryNode): Promise<void> {
    const panel = this.container?.querySelector('#viz-details-panel') as HTMLElement;
    if (!panel) return;
    
    panel.style.display = 'block';
    
    // 获取关联笔记
    const notes = await this.noteAssociationSystem.getNodeNotes(node.id);
    
    panel.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">${node.title || 'Untitled'}</h3>
      <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
        <div>Status: ${node.status}</div>
        <div>Date: ${new Date(node.timestamp).toLocaleString()}</div>
        <div>Notes: ${notes.length}</div>
      </div>
      <div style="margin-top: 15px;">
        <button onclick="Zotero.getActiveZoteroPane().selectItem(${node.itemId})" style="
          padding: 6px 12px;
          background: var(--accent-blue);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Open in Library</button>
      </div>
    `;
  }
  
  /**
   * 隐藏详情面板
   */
  private hideDetailsPanel(): void {
    const panel = this.container?.querySelector('#viz-details-panel') as HTMLElement;
    if (panel) {
      panel.style.display = 'none';
    }
  }
  
  /**
   * 更新工具栏
   */
  private updateToolbar(): void {
    const buttons = this.container?.querySelectorAll('.viz-mode-btn');
    // 更新按钮状态
  }
  
  refresh(): void {
    this.render();
  }
  
  destroy(): void {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
  }
}