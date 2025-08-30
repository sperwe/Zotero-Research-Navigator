import { QuickNoteWindowV2 } from '../quick-note-window-v2';
import { ZoteroMockEnvironment } from '../../../test/helpers/zotero-mock-environment';
import { DOMTestingUtils } from '../../../test/helpers/dom-testing-utils';

describe('QuickNoteWindowV2', () => {
  let window: QuickNoteWindowV2;
  let mockEnv: ZoteroMockEnvironment;
  let domUtils: DOMTestingUtils;
  let mockNoteAssociationSystem: any;
  let mockHistoryService: any;
  
  beforeEach(() => {
    mockEnv = new ZoteroMockEnvironment();
    domUtils = new DOMTestingUtils();
    
    mockNoteAssociationSystem = {
      createAssociation: jest.fn().mockResolvedValue(undefined)
    };
    
    mockHistoryService = {
      trackNavigation: jest.fn().mockResolvedValue(undefined)
    };
    
    window = new QuickNoteWindowV2(
      mockNoteAssociationSystem,
      mockHistoryService
    );
  });
  
  afterEach(() => {
    window.close();
    domUtils.cleanup();
    mockEnv.clearAll();
  });
  
  describe('Window Creation', () => {
    it('should create window on first show', async () => {
      await window.show();
      
      const container = document.getElementById('quick-note-window-v2');
      expect(container).toBeTruthy();
      expect(container?.style.display).toBe('flex');
    });
    
    it('should reuse existing window on subsequent shows', async () => {
      await window.show();
      const firstContainer = document.getElementById('quick-note-window-v2');
      
      await window.show();
      const secondContainer = document.getElementById('quick-note-window-v2');
      
      expect(firstContainer).toBe(secondContainer);
    });
    
    it('should prevent duplicate window creation', async () => {
      // Simulate multiple rapid calls
      const promises = [
        window.show(),
        window.show(),
        window.show()
      ];
      
      await Promise.all(promises);
      
      const containers = document.querySelectorAll('#quick-note-window-v2');
      expect(containers).toHaveLength(1);
    });
  });
  
  describe('Window Controls', () => {
    beforeEach(async () => {
      await window.show();
    });
    
    it('should close window when clicking close button', async () => {
      const closeBtn = domUtils.query('.quick-note-close');
      expect(closeBtn).toBeTruthy();
      
      domUtils.click(closeBtn!);
      
      const container = document.getElementById('quick-note-window-v2');
      expect(container?.style.display).toBe('none');
    });
    
    it('should update status text', async () => {
      const statusText = domUtils.query('.status-text');
      expect(statusText?.textContent).toBe('Ready');
      
      // Trigger save
      const saveBtn = domUtils.query('.quick-note-save');
      domUtils.click(saveBtn!);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(statusText?.textContent).toBe('Saving...');
    });
  });
  
  describe('Note Creation', () => {
    beforeEach(async () => {
      await window.show();
    });
    
    it('should create new note when clicking New Note button', async () => {
      const newBtn = domUtils.query('.quick-note-new');
      
      // Mock Zotero.Item constructor
      const mockNote = await mockEnv.createItem('note');
      (Zotero.Item as jest.Mock).mockReturnValue(mockNote);
      
      domUtils.click(newBtn!);
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(Zotero.Item).toHaveBeenCalledWith('note');
      expect(mockNote.saveTx).toHaveBeenCalled();
    });
    
    it('should create association when nodeId is provided', async () => {
      const nodeId = 'item-123';
      await window.show(nodeId);
      
      const newBtn = domUtils.query('.quick-note-new');
      const mockNote = await mockEnv.createItem('note', { id: 456 });
      (Zotero.Item as jest.Mock).mockReturnValue(mockNote);
      
      domUtils.click(newBtn!);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockNoteAssociationSystem.createAssociation).toHaveBeenCalledWith(
        456,
        nodeId,
        'quick-note',
        expect.objectContaining({ source: 'quick-note-window-v2' })
      );
    });
  });
  
  describe('Window Dragging', () => {
    beforeEach(async () => {
      await window.show();
    });
    
    it('should make window draggable by header', () => {
      const header = domUtils.query('.quick-note-header');
      const container = document.getElementById('quick-note-window-v2');
      
      expect(header).toBeTruthy();
      expect(header?.style.cursor).toBe('move');
      
      // Simulate drag
      const startEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      });
      header?.dispatchEvent(startEvent);
      
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 120,
        bubbles: true
      });
      document.dispatchEvent(moveEvent);
      
      const endEvent = new MouseEvent('mouseup', { bubbles: true });
      document.dispatchEvent(endEvent);
      
      // Check if position changed
      expect(container?.style.right).toBeTruthy();
      expect(container?.style.top).toBeTruthy();
    });
  });
  
  describe('Editor Initialization', () => {
    it('should create editor iframe', async () => {
      await window.show();
      
      const editorContainer = domUtils.query('#quick-note-editor-container');
      const iframe = editorContainer?.querySelector('iframe');
      
      expect(iframe).toBeTruthy();
      expect(iframe?.style.width).toBe('100%');
      expect(iframe?.style.height).toBe('100%');
    });
    
    it('should set up basic contenteditable', async () => {
      await window.show();
      
      const iframe = domUtils.query('#quick-note-editor-container iframe') as HTMLIFrameElement;
      
      // Wait for iframe to load
      await new Promise(resolve => {
        if (iframe.contentDocument?.readyState === 'complete') {
          resolve(undefined);
        } else {
          iframe.addEventListener('load', () => resolve(undefined));
        }
      });
      
      const body = iframe.contentDocument?.body;
      expect(body?.contentEditable).toBe('true');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle note creation errors', async () => {
      await window.show();
      
      // Mock error
      Zotero.Item = jest.fn().mockImplementation(() => {
        throw new Error('Failed to create note');
      });
      
      const newBtn = domUtils.query('.quick-note-new');
      domUtils.click(newBtn!);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should log error
      expect(Zotero.logError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create note')
      );
      
      // Should update status
      const statusText = domUtils.query('.status-text');
      expect(statusText?.textContent).toBe('Failed to create note');
    });
    
    it('should handle missing main window', async () => {
      Zotero.getMainWindow = jest.fn().mockReturnValue(null);
      
      await window.show();
      
      // Should not create window
      const container = document.getElementById('quick-note-window-v2');
      expect(container).toBeNull();
      
      // Should log error
      expect(Zotero.logError).toHaveBeenCalledWith(
        expect.stringContaining('No main window available')
      );
    });
  });
  
  describe('Window State', () => {
    it('should hide window', async () => {
      await window.show();
      window.hide();
      
      const container = document.getElementById('quick-note-window-v2');
      expect(container?.style.display).toBe('none');
    });
    
    it('should close and remove window', async () => {
      await window.show();
      window.close();
      
      const container = document.getElementById('quick-note-window-v2');
      expect(container).toBeNull();
    });
  });
});