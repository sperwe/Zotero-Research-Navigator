import { HistoryNode } from '../services/database-service';
import { HistoryService } from '../services/history-service';
import { NoteAssociationSystem } from './note-association-system';

export interface ExportData {
  version: string;
  exportDate: string;
  sessions: any[];
  nodes: HistoryNode[];
  associations: any[];
  metadata: {
    totalNodes: number;
    totalSessions: number;
    totalAssociations: number;
  };
}

export type ExportFormat = 'json' | 'csv' | 'html' | 'markdown' | 'opml';

export class ExportImportManager {
  private version = '1.0.0';
  
  constructor(
    private window: Window,
    private historyService: HistoryService,
    private noteAssociationSystem: NoteAssociationSystem
  ) {}
  
  /**
   * 导出数据
   */
  async export(format: ExportFormat = 'json', options?: {
    includeNotes?: boolean;
    dateRange?: { start: Date; end: Date };
    sessionIds?: string[];
  }): Promise<string> {
    const data = await this.prepareExportData(options);
    
    switch (format) {
      case 'json':
        return this.exportToJSON(data);
      case 'csv':
        return this.exportToCSV(data);
      case 'html':
        return this.exportToHTML(data);
      case 'markdown':
        return this.exportToMarkdown(data);
      case 'opml':
        return this.exportToOPML(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * 准备导出数据
   */
  private async prepareExportData(options?: any): Promise<ExportData> {
    let sessions = this.historyService.getAllSessions();
    let nodes: HistoryNode[] = [];
    let associations: any[] = [];
    
    // 应用过滤
    if (options?.sessionIds) {
      sessions = sessions.filter(s => options.sessionIds.includes(s.session.id));
    }
    
    // 收集节点
    for (const { session, nodes: sessionNodes } of sessions) {
      for (const node of sessionNodes) {
        // 日期过滤
        if (options?.dateRange) {
          const nodeDate = new Date(node.timestamp);
          if (nodeDate < options.dateRange.start || nodeDate > options.dateRange.end) {
            continue;
          }
        }
        
        nodes.push(node);
        
        // 收集关联
        if (options?.includeNotes) {
          const nodeAssociations = await this.noteAssociationSystem.getNodeNotes(node.id);
          associations.push(...nodeAssociations);
        }
      }
    }
    
    return {
      version: this.version,
      exportDate: new Date().toISOString(),
      sessions: sessions.map(s => s.session),
      nodes,
      associations,
      metadata: {
        totalNodes: nodes.length,
        totalSessions: sessions.length,
        totalAssociations: associations.length
      }
    };
  }
  
  /**
   * 导出为 JSON
   */
  private exportToJSON(data: ExportData): string {
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * 导出为 CSV
   */
  private exportToCSV(data: ExportData): string {
    const headers = ['Session ID', 'Node ID', 'Title', 'Item ID', 'Status', 'Timestamp', 'URL'];
    const rows = [headers];
    
    for (const node of data.nodes) {
      rows.push([
        node.sessionId || '',
        node.id,
        node.title || '',
        node.itemId.toString(),
        node.status,
        new Date(node.timestamp).toLocaleString(),
        node.url || ''
      ]);
    }
    
    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }
  
  /**
   * 导出为 HTML
   */
  private exportToHTML(data: ExportData): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Research Navigator Export - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .metadata { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
    .session { margin-bottom: 30px; }
    .session h2 { color: #1a73e8; }
    .node { margin-left: 20px; padding: 10px; background: #fff; border: 1px solid #e0e0e0; border-radius: 5px; margin-bottom: 10px; }
    .node-title { font-weight: bold; }
    .node-meta { font-size: 0.9em; color: #666; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>Research Navigator Export</h1>
  <div class="metadata">
    <p>Export Date: ${new Date().toLocaleString()}</p>
    <p>Total Sessions: ${data.metadata.totalSessions}</p>
    <p>Total Nodes: ${data.metadata.totalNodes}</p>
  </div>
`;
    
    // 按会话分组节点
    const nodesBySession = new Map<string, HistoryNode[]>();
    for (const node of data.nodes) {
      const sessionId = node.sessionId || 'no-session';
      if (!nodesBySession.has(sessionId)) {
        nodesBySession.set(sessionId, []);
      }
      nodesBySession.get(sessionId)!.push(node);
    }
    
    let content = '';
    for (const [sessionId, nodes] of nodesBySession) {
      const session = data.sessions.find(s => s.id === sessionId);
      content += `
  <div class="session">
    <h2>Session: ${sessionId}</h2>
    ${nodes.map(node => `
    <div class="node">
      <div class="node-title">${node.title || 'Untitled'}</div>
      <div class="node-meta">
        <span>Status: ${node.status}</span> | 
        <span>Date: ${new Date(node.timestamp).toLocaleString()}</span>
        ${node.url ? ` | <a href="${node.url}">Link</a>` : ''}
      </div>
    </div>
    `).join('')}
  </div>
`;
    }
    
    return html + content + '</body></html>';
  }
  
  /**
   * 导出为 Markdown
   */
  private exportToMarkdown(data: ExportData): string {
    let markdown = `# Research Navigator Export\n\n`;
    markdown += `**Export Date:** ${new Date().toLocaleString()}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- Total Sessions: ${data.metadata.totalSessions}\n`;
    markdown += `- Total Nodes: ${data.metadata.totalNodes}\n\n`;
    
    // 按会话分组
    const nodesBySession = new Map<string, HistoryNode[]>();
    for (const node of data.nodes) {
      const sessionId = node.sessionId || 'no-session';
      if (!nodesBySession.has(sessionId)) {
        nodesBySession.set(sessionId, []);
      }
      nodesBySession.get(sessionId)!.push(node);
    }
    
    markdown += `## History\n\n`;
    
    for (const [sessionId, nodes] of nodesBySession) {
      markdown += `### Session: ${sessionId}\n\n`;
      
      for (const node of nodes) {
        markdown += `- **${node.title || 'Untitled'}**\n`;
        markdown += `  - Status: ${node.status}\n`;
        markdown += `  - Date: ${new Date(node.timestamp).toLocaleString()}\n`;
        if (node.url) {
          markdown += `  - [Link](${node.url})\n`;
        }
        markdown += '\n';
      }
    }
    
    return markdown;
  }
  
  /**
   * 导出为 OPML (Outline Processor Markup Language)
   */
  private exportToOPML(data: ExportData): string {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Research Navigator Export</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
`;
    
    // 按会话分组
    const nodesBySession = new Map<string, HistoryNode[]>();
    for (const node of data.nodes) {
      const sessionId = node.sessionId || 'no-session';
      if (!nodesBySession.has(sessionId)) {
        nodesBySession.set(sessionId, []);
      }
      nodesBySession.get(sessionId)!.push(node);
    }
    
    let outlines = '';
    for (const [sessionId, nodes] of nodesBySession) {
      outlines += `    <outline text="Session: ${sessionId}">\n`;
      
      for (const node of nodes) {
        const title = this.escapeXML(node.title || 'Untitled');
        const created = new Date(node.timestamp).toISOString();
        outlines += `      <outline text="${title}" created="${created}"`;
        
        if (node.url) {
          outlines += ` url="${this.escapeXML(node.url)}"`;
        }
        
        outlines += ` />\n`;
      }
      
      outlines += `    </outline>\n`;
    }
    
    return opml + outlines + '  </body>\n</opml>';
  }
  
  /**
   * 导入数据
   */
  async import(content: string, format: ExportFormat = 'json'): Promise<{
    success: boolean;
    imported: {
      sessions: number;
      nodes: number;
      associations: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let data: ExportData;
    
    try {
      // 解析导入数据
      switch (format) {
        case 'json':
          data = JSON.parse(content);
          break;
        default:
          throw new Error(`Import not supported for format: ${format}`);
      }
      
      // 验证数据
      if (!this.validateImportData(data)) {
        throw new Error('Invalid import data format');
      }
      
      // 导入数据
      let importedSessions = 0;
      let importedNodes = 0;
      let importedAssociations = 0;
      
      // 导入会话和节点
      for (const sessionData of data.sessions) {
        try {
          // 创建会话
          const sessionNodes = data.nodes.filter(n => n.sessionId === sessionData.id);
          
          for (const node of sessionNodes) {
            try {
              await this.historyService.createOrUpdateNode(node.itemId, {
                parentId: node.parentId || undefined,
                force: true
              });
              importedNodes++;
            } catch (error) {
              errors.push(`Failed to import node ${node.id}: ${error}`);
            }
          }
          
          importedSessions++;
        } catch (error) {
          errors.push(`Failed to import session ${sessionData.id}: ${error}`);
        }
      }
      
      // 导入关联
      for (const association of data.associations || []) {
        try {
          await this.noteAssociationSystem.createAssociation(
            association.noteId,
            association.nodeId,
            association.relationType,
            association.context
          );
          importedAssociations++;
        } catch (error) {
          errors.push(`Failed to import association: ${error}`);
        }
      }
      
      return {
        success: errors.length === 0,
        imported: {
          sessions: importedSessions,
          nodes: importedNodes,
          associations: importedAssociations
        },
        errors
      };
      
    } catch (error) {
      return {
        success: false,
        imported: { sessions: 0, nodes: 0, associations: 0 },
        errors: [`Import failed: ${error}`]
      };
    }
  }
  
  /**
   * 验证导入数据
   */
  private validateImportData(data: any): data is ExportData {
    return (
      data &&
      typeof data.version === 'string' &&
      Array.isArray(data.sessions) &&
      Array.isArray(data.nodes) &&
      data.metadata &&
      typeof data.metadata.totalNodes === 'number'
    );
  }
  
  /**
   * 转义 XML 特殊字符
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  /**
   * 下载文件
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = this.window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * 生成导出文件名
   */
  generateFilename(format: ExportFormat): string {
    const date = new Date().toISOString().split('T')[0];
    return `research-navigator-export-${date}.${format}`;
  }
  
  /**
   * 获取格式的 MIME 类型
   */
  getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      json: 'application/json',
      csv: 'text/csv',
      html: 'text/html',
      markdown: 'text/markdown',
      opml: 'text/xml'
    };
    return mimeTypes[format] || 'text/plain';
  }
}