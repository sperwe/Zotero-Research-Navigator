/**
 * Debug script to check potential UI issues
 */

const fs = require('fs');
const path = require('path');

console.log('=== UI Debug Analysis ===\n');

// 1. Check if icon file exists
const iconPath = path.join(__dirname, '../addon/content/icons/icon.svg');
if (fs.existsSync(iconPath)) {
  console.log('✓ Icon file exists:', iconPath);
  const iconContent = fs.readFileSync(iconPath, 'utf8');
  console.log(`  Size: ${iconContent.length} bytes`);
  console.log(`  First 100 chars: ${iconContent.substring(0, 100)}...`);
} else {
  console.log('✗ Icon file NOT FOUND at:', iconPath);
}

// 2. Check chrome.manifest
const manifestPath = path.join(__dirname, '../addon/chrome.manifest');
if (fs.existsSync(manifestPath)) {
  console.log('\n✓ chrome.manifest exists');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  console.log('Content:');
  console.log(manifestContent);
} else {
  console.log('\n✗ chrome.manifest NOT FOUND');
}

// 3. Check build output
console.log('\n=== Checking Built Files ===\n');

const buildIconPath = path.join(__dirname, '../build/addon/content/icons/icon.svg');
if (fs.existsSync(buildIconPath)) {
  console.log('✓ Icon in build directory:', buildIconPath);
} else {
  console.log('✗ Icon NOT in build directory');
}

// 4. Check toolbar IDs in Zotero 7
console.log('\n=== Expected Toolbar IDs for Zotero 7 ===\n');
const toolbarIds = [
  'zotero-tb-advanced-search - Advanced search toolbar',
  'zotero-items-toolbar - Items pane toolbar',
  'zotero-toolbar - Main toolbar (might not exist in Z7)',
  'zotero-tb-actions - Actions toolbar',
  'nav-bar - Navigation bar'
];

toolbarIds.forEach(id => console.log(`- ${id}`));

// 5. Check for common issues
console.log('\n=== Common Issues ===\n');

console.log('1. Toolbar not found:');
console.log('   - Zotero 7 has different toolbar structure');
console.log('   - May need to wait longer for UI to be ready');
console.log('   - Check if toolbar IDs have changed');

console.log('\n2. Icon not showing:');
console.log('   - Chrome URL might not be registered properly');
console.log('   - Icon file might not be in the right location');
console.log('   - CSS styles might be overridden');

console.log('\n3. Menu items not appearing:');
console.log('   - Menu IDs might have changed in Zotero 7');
console.log('   - Registration timing might be too early');

// 6. Suggest debug steps
console.log('\n=== Debug Steps ===\n');
console.log('1. In Zotero, open Tools → Developer → Run JavaScript');
console.log('2. Run this code to check toolbars:');
console.log(`
// Check available toolbars
const toolbars = [
  'zotero-tb-advanced-search',
  'zotero-items-toolbar', 
  'zotero-toolbar',
  'zotero-tb-actions',
  'nav-bar'
];

toolbars.forEach(id => {
  const tb = document.getElementById(id);
  console.log(\`Toolbar \${id}: \${tb ? 'EXISTS' : 'NOT FOUND'}\`);
});

// Check if addon is loaded
console.log('ResearchNavigator addon:', typeof Zotero.ResearchNavigator);
`);

console.log('\n3. Check Error Console for any addon errors');
console.log('4. Try manually creating a button:');
console.log(`
// Test button creation
const doc = window.document;
const toolbar = doc.getElementById('zotero-items-toolbar');
if (toolbar) {
  const button = doc.createXULElement('toolbarbutton');
  button.id = 'test-button';
  button.label = 'Test';
  button.tooltipText = 'Test Button';
  button.style.listStyleImage = 'url(chrome://zotero/skin/16/universal/add.svg)';
  toolbar.appendChild(button);
  console.log('Button added');
} else {
  console.log('Toolbar not found');
}
`);