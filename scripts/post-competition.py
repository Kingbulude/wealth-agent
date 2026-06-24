#!/usr/bin/env python3
"""
TRAE 论坛发帖脚本
用法: python3 scripts/post-competition.py

需要先安装依赖:
  pip3 install playwright
  playwright install chromium

发帖前请先确认：
1. competition-post-complete.md 已包含真实内容（Session ID + 截图路径已填好）
2. 你的 TRAE 论坛账号已登录
"""

import asyncio
import sys
import os

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌ 未找到 playwright，请先运行：pip3 install playwright && playwright install chromium")
    sys.exit(1)

# ============ 配置区 ============
FORUM_URL = "https://forum.trae.cn"
POST_URL = "https://forum.trae.cn/c/38-category/40-category/40"  # 初赛专区
POST_TITLE = "【学习工作】财富管理智能体——AI驱动的个人资产管家"
POST_FILE = os.path.join(os.path.dirname(__file__), "..", "docs", "competition-post-complete.md")
# ================================

async def main():
    # 读取帖子内容
    if not os.path.exists(POST_FILE):
        print(f"❌ 未找到帖子内容文件：{POST_FILE}")
        print("请先运行 prepare-post.py 生成完整帖子内容")
        sys.exit(1)

    with open(POST_FILE, "r", encoding="utf-8") as f:
        post_content = f.read()

    print("📖 已读取帖子内容，长度：", len(post_content), "字符")

    async with async_playwright() as p:
        # 启动浏览器（headless）
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()

        print("🌐 打开论坛发帖页面...")
        await page.goto(POST_URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # 检查是否已登录
        page_text = await page.inner_text("body")
        if "登录" in page_text and "注册" in page_text:
            print("⚠️  你还没有登录论坛！")
            print("请在浏览器中手动完成登录，然后重新运行本脚本")
            print("登录地址：https://forum.trae.cn/login")
            # 截图看看当前页面
            await page.screenshot(path="forum-login-required.png")
            print("📸 已截图保存到 forum-login-required.png")
            await browser.close()
            sys.exit(1)

        print("✅ 已登录，开始填写帖子...")

        # 滚动到页面顶部找发帖按钮
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(500)

        # 尝试找发帖按钮
        try:
            # Discourse 通常有 "New Topic" 或类似按钮
            new_topic_btn = page.locator("button:has-text('New Topic'), a:has-text('新主题'), button:has-text('创建主题')").first
            await new_topic_btn.click(timeout=5000)
            print("✅ 找到并点击了发帖按钮")
        except Exception as e:
            print(f"⚠️  自动找发帖按钮失败：{e}")
            print("请手动点击发帖按钮，然后重新运行脚本")
            await page.screenshot(path="forum-page.png")
            await browser.close()
            sys.exit(1)

        await page.wait_for_timeout(2000)

        # 填写标题
        try:
            title_input = page.locator("#reply-title, input[placeholder*='标题'], input.title-input").first
            await title_input.fill(POST_TITLE)
            print("✅ 标题已填写")
        except Exception as e:
            print(f"⚠️  填写标题失败：{e}")

        # 填写正文（切换到富文本编辑器）
        try:
            # 尝试 TinyMCE 编辑器
            editor = page.locator(".ProseMirror, #tinymce, textarea.post-textarea, .d-editor-input").first
            await editor.click()
            await asyncio.sleep(0.5)
            await editor.fill(post_content)
            print("✅ 正文已填写")
        except Exception as e:
            print(f"⚠️  填写正文失败：{e}")
            # 尝试粘贴方式
            try:
                textarea = page.locator("textarea").first
                await textarea.click()
                await asyncio.sleep(0.3)
                await page.keyboard.type(post_content[:500])
                print("⚠️  使用键盘输入方式（内容可能不完整）")
            except:
                pass

        await page.wait_for_timeout(1000)

        # 选择标签
        try:
            tag_btn = page.locator("button:has-text('标签'), .tag-chooser").first
            await tag_btn.click()
            await page.wait_for_timeout(500)
            # 选择"学习工作"标签
            tag_option = page.locator("span:has-text('学习工作'), .tag:has-text('学习工作')").first
            await tag_option.click()
            print("✅ 标签已选择（学习工作）")
        except Exception as e:
            print(f"⚠️  选择标签失败：{e}")

        # 截图确认
        await page.screenshot(path="forum-post-preview.png", full_page=False)
        print("📸 已截图保存到 forum-post-preview.png，请检查内容是否正确")

        print("\n✅ 帖子内容已填入编辑器")
        print("请检查截图 forum-post-preview.png 确认内容正确后，手动点击「发布」按钮")
        print("或者如果内容正确，直接运行自动发布：")
        print("  # await page.locator('button:has-text(\"发布\")').click()")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
