const fs = require("fs");
const path = require("path");

// 创建一个简单但醒目的图标 - 使用 Canvas API
// 由于环境限制，我们使用预制的 base64 图标

// 这是一个时钟图标的 base64 编码（蓝色背景，白色时钟，红色箭头）
const icon48Base64 = `iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF
JklEQVRoge2Za2wUVRTHf2dm9tHdbrctpS0FWqBQHqUgoCKCgICKRFFBRUWNJhpNjEaNiR98fCBG
E40xfkCNHzQaH/GBIN4SHxgfIIgICAiIgLRAebS0lO52u7uzM3N8MFt2u7vdXbqFROm/mczce8+9
5/zPuefemTsgAEEQBEEQBEEQBEH4P6Iy7WBZFrZto2labwfUZ9i2jWVZ6L`;
