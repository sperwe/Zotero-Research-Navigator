#!/usr/bin/env python3
"""
创建 Research Navigator 的图标
生成一个时钟/历史主题的图标，容易识别
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """创建一个研究历史导航图标"""
    # 创建带透明背景的图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 定义颜色
    primary_color = (41, 128, 185)  # 蓝色
    secondary_color = (52, 152, 219)  # 浅蓝色
    accent_color = (231, 76, 60)  # 红色（指针）
    white = (255, 255, 255)
    shadow = (0, 0, 0, 50)
    
    # 计算尺寸
    margin = size * 0.1
    clock_radius = (size - 2 * margin) / 2
    center = size / 2
    
    # 绘制阴影
    shadow_offset = size * 0.02
    draw.ellipse([
        margin + shadow_offset, 
        margin + shadow_offset, 
        size - margin + shadow_offset, 
        size - margin + shadow_offset
    ], fill=shadow)
    
    # 绘制时钟外圈（渐变效果）
    draw.ellipse([margin, margin, size - margin, size - margin], 
                 fill=primary_color)
    
    # 绘制内圈
    inner_margin = margin + clock_radius * 0.1
    draw.ellipse([inner_margin, inner_margin, size - inner_margin, size - inner_margin], 
                 fill=white)
    
    # 绘制时钟刻度
    for i in range(12):
        angle = i * 30 - 90  # 从12点开始
        import math
        rad = math.radians(angle)
        
        # 外点
        x1 = center + clock_radius * 0.85 * math.cos(rad)
        y1 = center + clock_radius * 0.85 * math.sin(rad)
        
        # 内点
        if i % 3 == 0:  # 3, 6, 9, 12点位置
            x2 = center + clock_radius * 0.7 * math.cos(rad)
            y2 = center + clock_radius * 0.7 * math.sin(rad)
            width = max(2, int(size * 0.03))
        else:
            x2 = center + clock_radius * 0.75 * math.cos(rad)
            y2 = center + clock_radius * 0.75 * math.sin(rad)
            width = max(1, int(size * 0.02))
        
        draw.line([(x1, y1), (x2, y2)], fill=primary_color, width=width)
    
    # 绘制时针（指向10点）
    hour_angle = math.radians(300 - 90)  # 10点位置
    hour_length = clock_radius * 0.5
    hour_x = center + hour_length * math.cos(hour_angle)
    hour_y = center + hour_length * math.sin(hour_angle)
    draw.line([(center, center), (hour_x, hour_y)], 
              fill=primary_color, width=max(3, int(size * 0.04)))
    
    # 绘制分针（指向2点）
    min_angle = math.radians(60 - 90)  # 2点位置
    min_length = clock_radius * 0.7
    min_x = center + min_length * math.cos(min_angle)
    min_y = center + min_length * math.sin(min_angle)
    draw.line([(center, center), (min_x, min_y)], 
              fill=primary_color, width=max(2, int(size * 0.03)))
    
    # 绘制中心点
    center_radius = clock_radius * 0.08
    draw.ellipse([
        center - center_radius, 
        center - center_radius,
        center + center_radius, 
        center + center_radius
    ], fill=accent_color)
    
    # 添加逆时针箭头（表示历史）
    arrow_start = math.radians(180 - 90)
    arrow_end = math.radians(270 - 90)
    arrow_radius = clock_radius * 0.85
    
    # 绘制弧形箭头
    for i in range(20):
        angle = arrow_start + (arrow_end - arrow_start) * i / 19
        x = center + arrow_radius * math.cos(angle)
        y = center + arrow_radius * math.sin(angle)
        next_angle = arrow_start + (arrow_end - arrow_start) * (i + 1) / 19
        next_x = center + arrow_radius * math.cos(next_angle)
        next_y = center + arrow_radius * math.sin(next_angle)
        
        if i < 19:
            draw.line([(x, y), (next_x, next_y)], fill=accent_color, width=max(2, int(size * 0.025)))
    
    # 绘制箭头头部
    arrow_tip_angle = arrow_end
    tip_x = center + arrow_radius * math.cos(arrow_tip_angle)
    tip_y = center + arrow_radius * math.sin(arrow_tip_angle)
    
    # 箭头的两个边
    arrow_size = clock_radius * 0.15
    angle1 = arrow_tip_angle + math.radians(150)
    angle2 = arrow_tip_angle + math.radians(210)
    
    x1 = tip_x + arrow_size * math.cos(angle1)
    y1 = tip_y + arrow_size * math.sin(angle1)
    x2 = tip_x + arrow_size * math.cos(angle2)
    y2 = tip_y + arrow_size * math.sin(angle2)
    
    draw.polygon([(tip_x, tip_y), (x1, y1), (x2, y2)], fill=accent_color)
    
    # 保存图标
    img.save(filename, 'PNG')
    print(f"Created: {filename}")

# 创建不同尺寸的图标
sizes = {
    'favicon.png': 96,
    'favicon@0.5x.png': 48,
    'icon-16.png': 16,
    'icon-32.png': 32,
    'icon-48.png': 48,
    'icon-96.png': 96,
    'icon-128.png': 128
}

# 确保目录存在
icon_dir = '/workspace/Zotero-Research-Navigator/addon/content/icons/'
os.makedirs(icon_dir, exist_ok=True)

# 生成所有图标
for filename, size in sizes.items():
    create_icon(size, os.path.join(icon_dir, filename))

print("\n✅ All icons created successfully!")
print("The icon features:")
print("- Clock face (representing history/time)")
print("- Counter-clockwise arrow (going back in history)")
print("- Blue theme (professional look)")
print("- Red accent (easy to spot)")