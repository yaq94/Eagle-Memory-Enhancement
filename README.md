# Eagle FSRS Memory Plugin 🧠

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FSRS Algorithm](https://img.shields.io/badge/FSRS-v4.5-blue)](https://github.com/open-spaced-repetition/ts-fsrs)
[![Eagle Plugin](https://img.shields.io/badge/Eagle-Plugin-green)](https://eagle.cool)

**Eagle FSRS Memory** 是一款为 [Eagle 素材管理工具](https://eagle.cool) 设计的强大插件，它将先进的 **FSRS (Free Spaced Repetition Scheduler)** 算法带入 Eagle，让你能像使用 Anki 一样高效复习和记忆你的素材（图片、截图、设计稿等）。

---

## ✨ 核心特性 (Features)

*   **⚡️ FSRS v4.5 算法集成**: 内置最新版 `ts-fsrs` 引擎，支持完整的调度逻辑（Stability, Difficulty, Retrievability）。
*   **📊 可视化仪表盘 (Dashboard)**: 清晰展示所有卡组的状态（待复习、学习中、新卡片），支持每日复习上限设置。
*   **⚙️ Anki 风格设置**: 
    *   支持自定义**目标保留率 (Request Retention)** (0.7 ~ 0.99)。
    *   自定义 FSRS 参数权重 (Weights)。
    *   支持 **Reschedule (重排程)**：修改参数后，可基于历史日志一键重新计算所有卡片的最佳复习时间。
*   **📝 沉浸式复习**:
    *   **Anki 风格评分**: Again (忘记), Hard (困难), Good (一般), Easy (简单)。
    *   **无缝编辑**: 在复习界面直接双击编辑图片的标题、注释和标签。
    *   **快捷键支持**: 键盘 `1`, `2`, `3`, `4` 快速评分，`Space` 显示答案。
*   **🌙 深色模式适配**: 自动跟随 Eagle 主题切换深色/浅色界面。
*   **💾 数据安全**: 所有复习数据（Log）本地存储，不仅记录进度，还记录每一次复习的历史详情。

---

## 🚀 安装指南 (Installation)

1.  克隆本项目：
    ```bash
    git clone https://github.com/your-username/eagle-fsrs-memory.git
    cd eagle-fsrs-memory
    ```
2.  安装依赖：
    ```bash
    npm install
    ```
3.  构建插件：
    ```bash
    npm run build
    ```
4.  将插件导入 Eagle：
    *   打开 Eagle -> 插件 -> 管理插件 -> 开发者模式 -> 加载解压后的插件 (选择项目根目录)。

---

## 📖 使用说明 (Usage)

1.  **创建卡组**: 点击仪表盘右上角的 `+ 新建卡组`，选择一个或多个 Eagle 文件夹作为复习源。
2.  **开始复习**: 点击卡组名称进入复习会话。
3.  **评分**: 
    *   图片会展示在中央。
    *   思考后查看下方的时间预估。
    *   点击 `Again/Hard/Good/Easy` 进行评分。
4.  **管理卡组**: 点击卡组右侧的 `⚙` 图标，可以调整每日上限、学习阶段 (Learning Steps) 和 FSRS 参数。

---

## 🛠 技术栈 (Tech Stack)

*   **TypeScript**: 强类型语言保证代码健壮性。
*   **[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)**: 核心调度算法库。
*   **Esbuild**: 极速构建工具。
*   **Eagle Plugin API**: 与宿主应用交互。

## 🤝 贡献 (Contributing)

全程由Gemini 3 Pro(High)独立完成！如果你发现了 Bug 或有新功能建议，请使用哈基米自行完成。

📨 致继任者 (To Successor)
当前项目: Eagle FSRS Memory Plugin (v2.0 Stable)
项目路径: e:/项目/memory

1. 项目状态
已完成:
核心算法: FSRS v4.5 集成 (ts-fsrs), 包括评分 (Rate)、重排程 (Reschedule)、复习日志 (Review Logs)。
UI/UX: Anki 风格仪表盘、侧边栏无缝编辑 (Seamless Editing)、深色模式适配。
工程化: 构建修复完成 (npm run build), TypeScript 类型安全。
文档: README.md (发布用), Code_Review_Report.md, walkthrough.md 均已更新。
持久化:
核心数据存储在 localStorage (eagle-fsrs-db, eagle-fsrs-decks, eagle-fsrs-logs)。
2. 关键文件索引
src/main.ts: 单文件控制器，包含所有业务逻辑（非常长，约 1100 行）。
核心函数: startSession, rate, rescheduleDeck, saveDeckFromEditor.
注意: loadData 和 saveDeckFromEditor 刚刚修复过语法错误。
index.html: 包含所有 CSS (Variables) 和 HTML 结构。
dist/bundle.js: 构建产物。
3. 用户偏好 (Critical)
交互工具: 必须使用 mcp_cunzhi 进行沟通。
禁忌:
❌ 绝对禁止自动生成总结性 Markdown 文件 (除非用户明确要求)。
❌ 禁止编写测试脚本。
❌ 禁止自动运行/编译代码 (只给指令，可以自动修改代码)。
风格: 喜欢 Anki 风格的布局，重视算法的严谨性。
4. 接下来的任务 (Roadmap)
如果用户继续本项目，可能的开发方向是：

复习热力图 (Heatmap): 类似 GitHub 的贡献图。
遗忘曲线图表: 使用 Chart.js 或类似库。
数据导出/同步: JSON 导出功能。
最后操作: 已执行 npm run build 并成功。已生成打包指南。

祝你好运！🚀

## 📄用于 (License)

本项目采用 **MIT 协议** 开源。
