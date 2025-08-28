/**
 * 获取本地化字符串
 */
export function getString(key: string, options?: { args?: any }): string {
  // 在实际运行时，这个函数会被 bootstrap.js 中的实现替换
  // 这里只是为了 TypeScript 编译通过
  if (typeof Zotero !== 'undefined' && Zotero.getString) {
    return Zotero.getString(key, options?.args);
  }
  
  // 开发时的后备方案
  return key;
}