#!/usr/bin/env python3
"""
TRAE 论坛发帖脚本 - 完整版
用法: python3 scripts/post-forum.py

需要先安装依赖:
  pip3 install playwright
  playwright install chromium
  playwright install-deps chromium

发帖步骤:
1. 自动打开论坛，让你手动登录（只需做一次）
2. 保存登录状态
3. 后续自动填写帖子内容并发布
"""

import asyncio
import os
import sys

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌ 未找到 playwright，请先运行：")
    print("  pip3 install playwright && playwright install chromium && playwright install-deps chromium")
    sys.exit(1)

FORUM_URL = "https://forum.trae.cn"
POST_URL = f"{FORUM_URL}/c/38-category/40-category/40"  # 初赛专区
POST_TITLE = "【学习工作】财富管理智能体——AI驱动的个人资产管家"
POST_FILE = os.path.join(os.path.dirname(__file__), "..", "docs", "competition-post-complete.md")
STATE_FILE = os.path.join(os.path.dirname(__file__), "..", ".forum-state.json")

async def check_logged_in(page) -> bool:
    """检查是否已登录"""
    await page.goto(FORUM_URL, wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(1)
    body_text = await page.inner_text("body")
    # 未登录会显示"登录"按钮
    return not ("登录" in body_text and "注册" in body_text and "验证码" in body_text)

async def login_and_save_state(page, context):
    """让用户手动登录，然后保存状态"""
    login_url = f"{FORUM_URL}/login"
    print(f"🌐 打开登录页面：{login_url}")
    await page.goto(login_url, wait_until="load", timeout=30000)
    await asyncio.sleep(3)
    await page.screenshot(path="forum-login-step.png")
    print("📸 已截图保存到 forum-login-step.png")
    print("\n请在浏览器中完成登录：")
    print("  1. 输入手机号")
    print("  2. 获取验证码")
    print("  3. 输入验证码完成登录")
    print("  4. 完成后等待 10 秒，让我继续...\n")

    # 等待用户手动登录（最多60秒）
    for i in range(60):
        await asyncio.sleep(1)
        if await check_logged_in(page):
            print("✅ 检测到登录成功！")
            # 保存状态
            await context.storage_state(path=STATE_FILE)
            print(f"✅ 登录状态已保存到 {STATE_FILE}")
            return True
        if i % 10 == 9:
            print(f"   等待中... ({i+1}/60秒)")

    print("❌ 登录超时，未检测到登录状态")
    return False

async def post_content(page):
    """发帖"""
    # 读取帖子内容
    if not os.path.exists(POST_FILE):
        print(f"❌ 未找到帖子内容文件：{POST_FILE}")
        sys.exit(1)

    with open(POST_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    print(f"📖 已读取帖子内容（{len(content)} 字符）")

    # 打开初赛专区
    print(f"🌐 打开初赛专区：{POST_URL}")
    await page.goto(POST_URL, wait_until="load", timeout=30000)
    await asyncio.sleep(3)
    await page.screenshot(path="forum-category-page.png")

    # 找发帖按钮
    print("🔍 查找发帖按钮...")
    try:
        # Discourse 通常有多种发帖按钮
        selectors = [
            "button:has-text('创建主题')",
            "button:has-text('New Topic')",
            "a:has-text('创建主题')",
            "a:has-text('New Topic')",
            "#create-topic",
            "[data-test='create-topic']",
        ]
        btn = None
        for sel in selectors:
            try:
                btn = page.locator(sel).first
                await btn.wait_for(timeout=3000)
                print(f"✅ 找到发帖按钮：{sel}")
                break
            except:
                continue

        if btn:
            await btn.click()
            await asyncio.sleep(2)
        else:
            print("⚠️  未找到发帖按钮，尝试直接访问新建话题页面")
            await page.goto(f"{FORUM_URL}/new-topic?category=40", wait_until="load", timeout=30000)
            await asyncio.sleep(3)

    except Exception as e:
        print(f"⚠️  找按钮时出错：{e}")
        await page.goto(f"{FORUM_URL}/new-topic?category=40", wait_until="load", timeout=30000)

    await page.screenshot(path="forum-new-topic-page.png")

    # 填写标题
    print("✏️  填写标题...")
    try:
        title_selectors = [
            "#reply-title",
            "input[placeholder*='标题']",
            "input.title-input",
            "input[id*='title']",
        ]
        for sel in title_selectors:
            try:
                inp = page.locator(sel).first
                await inp.wait_for(timeout=3000)
                await inp.fill(POST_TITLE)
                print(f"✅ 标题已填写：{sel}")
                break
            except:
                continue
    except Exception as e:
        print(f"⚠️  填写标题失败：{e}")

    # 填写正文
    print("✏️  填写正文...")
    try:
        editor_selectors = [
            ".ProseMirror",
            "#tinymce_ifr",
            "textarea.post-textarea",
            ".d-editor-input",
            "div.d-editor-textarea",
            "textarea[id*='post']",
        ]
        for sel in editor_selectors:
            try:
                inp = page.locator(sel).first
                await inp.wait_for(timeout=3000)
                await inp.click()
                await asyncio.sleep(0.5)
                # 清空并填写
                await inp.fill(content)
                print(f"✅ 正文已填写：{sel}")
                break
            except:
                continue
    except Exception as e:
        print(f"⚠️  填写正文失败：{e}")
        # 尝试用粘贴
        try:
            inp = page.locator("textarea, .ProseMirror").first
            await inp.click()
            await asyncio.sleep(0.3)
            # 粘贴内容
            await page.keyboard.type(content[:2000])
            print("⚠️  使用键盘输入（内容可能不完整，建议手动补充）")
        except:
            pass

    await asyncio.sleep(1)
    await page.screenshot(path="forum-filled-content.png", full_page=False)

    # 选择标签
    print("🏷️  选择标签...")
    try:
        tag_selectors = [
            "button:has-text('标签')",
            ".tag-chooser button",
            ".category-chooser button",
        ]
        for sel in tag_selectors:
            try:
                btn = page.locator(sel).first
                await btn.wait_for(timeout=3000)
                await btn.click()
                await asyncio.sleep(0.5)

                # 选择"学习工作"
                tag_opt = page.locator("span:has-text('学习工作'), li:has-text('学习工作'), .tag:has-text('学习工作')").first
                await tag_opt.click(timeout=5000)
                print("✅ 标签「学习工作」已选择")
                break
            except:
                continue
    except Exception as e:
        print(f"⚠️  选择标签失败：{e}")

    await page.wait_for_timeout(1000)
    await page.screenshot(path="forum-before-submit.png", full_page=False)

    print("\n" + "="*60)
    print("✅ 帖子内容已填入编辑器！")
    print("📸 已保存截图：forum-before-submit.png")
    print("\n请检查截图确认内容正确后，点击「发布」按钮提交帖子。")
    print("="*60 + "\n")

    # 尝试自动发布
    try:
        submit_selectors = [
            "button:has-text('发布')",
            "button:has-text('Create Post')",
            "button:has-text('提交')",
            "button[type='submit']",
        ]
        for sel in submit_selectors:
            try:
                btn = page.locator(sel).first
                await btn.wait_for(timeout=3000)
                # 不自动点，让用户确认
                print(f"提示：找到提交按钮 [{sel}]，如需自动提交请取消注释下一行")
                # await btn.click()
                # await asyncio.sleep(3)
                # await page.screenshot(path="forum-posted.png")
                # print("✅ 帖子已发布！截图：forum-posted.png")
                break
            except:
                continue
    except:
        pass

async def main():
    print("="*60)
    print("TRAE AI 创造力大赛 - 帖子发布脚本")
    print("="*60)

    async with async_playwright() as p:
        # 创建上下文
        if os.path.exists(STATE_FILE):
            print("📂 发现已保存的登录状态，尝试复用...")
            context = await p.chromium.launch_persistent_context(
                "",
                headless=True,
                storage_state=STATE_FILE
            )
            page = context.pages[0] if context.pages else await context.new_page()
            logged_in = await check_logged_in(page)
            if not logged_in:
                print("⚠️  登录状态已过期，需要重新登录")
                await context.close()
                os.remove(STATE_FILE)
                context = await p.chromium.launch_persistent_context("", headless=True)
                page = context.pages[0] if context.pages else await context.new_page()
        else:
            context = await p.chromium.launch_persistent_context("", headless=True)
            page = context.pages[0] if context.pages else await context.new_page()

        # 检查登录状态
        logged_in = await check_logged_in(page)
        if not logged_in:
            print("\n🔐 你还没有登录论坛，需要先登录")
            success = await login_and_save_state(page, context)
            if not success:
                print("❌ 登录失败，脚本退出")
                await context.close()
                return

        # 发帖
        await post_content(page)
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
