[English](README.md) | 中文

# Markdown Viewer / 浏览器扩展

**安装：[Chrome]** / **[Firefox]** / **[Edge]** / **[Opera]** / **[Brave]** / **[Chromium]** / **[Vivaldi]**

# 功能特性

- 安全设计
- 渲染本地和远程文件 URL
- 细粒度的远程来源访问
- 多种 Markdown 解析器
- 完整的编译器选项控制（[markdown-it]、[marked]、[remark]）
- 30+ 主题（[cleanrmd]、[GitHub][github-theme]）
- 自定义主题支持
- GitHub Flavored Markdown (GFM)
- 文件变化自动重载
- 代码块语法高亮（[prism][prism]）
- 目录（ToC）
- MathJax 公式（[mathjax]）
- Mermaid 图表（[mermaid]）
- Emoji 短名转换（图标由 [EmojiOne][emojione] 免费提供）
- 记住滚动位置
- Markdown Content-Type 检测
- 可配置的 Markdown 文件路径检测
- 设置同步
- 原始和渲染 Markdown 视图
- 整页阅读器
- 免费开源

### 本仓库新增

> 以下功能是对[原版 Markdown Viewer](https://github.com/simov/markdown-viewer) 的扩展，原版并不包含。

- 侧边栏目录浏览器（基于工作空间）
- 文件树一键展开/折叠 + 大纲
- 每个工作空间的文件列表状态持久化
- 快速聚焦到当前打开的文件
- 独立文件的临时工作空间
- 命令面板（Ctrl/Cmd+P）跨工作空间打开文件
- 右键复制文件/目录路径
- 跨工作空间全文搜索
- 当前文件查找（Ctrl/Cmd+F）
- 代码块复制按钮和行号
- 表格滚动 + 表头吸附
- 图片灯箱（缩放、旋转）
- 文件树键盘导航
- 阅读统计（字数、阅读时长、进度）
- 每个文件单独记住阅读位置

# 目录

- **[安装后](#安装后)**
- **[主题](#主题)**
- **[编译器选项](#编译器选项)**
- **[内容选项](#内容选项)**
- **[侧边栏目录浏览器](#侧边栏目录浏览器)**
- **[整页阅读器](#整页阅读器)**
- **[管理来源](#管理来源)**
- **[语法示例](#语法示例)**

> 更多针对 [Firefox][firefox-docs] 的文档说明

# 安装后

## 本地文件

1. 打开 `chrome://extensions`
2. 找到 Markdown Viewer 扩展，点击 `详细信息` 按钮

![img-extensions]

3. 确保打开 `允许访问文件网址` 开关

![img-file-access]

## 远程文件

1. 点击 Markdown Viewer 图标，选择 [高级选项](#管理来源)
2. 添加你想要启用的来源

---

# 主题

所有主题都支持以下宽度选项：

- `auto` - 根据屏幕尺寸自动调整内容宽度
- `full` - 100% 屏幕宽度
- `wide` - 固定 1400px
- `large` - 固定 1200px
- `medium` - 固定 992px
- `small` - 固定 768px
- `tiny` - 固定 576px

`github` 和 `github-dark` 主题的 `auto` 选项具有固定宽度和环绕边框，与托管在 github.com 上的 `README.md` 文件渲染效果一致。

## 自定义主题

1. 进入高级选项，点击设置
2. 内容主题选择 `CUSTOM`
3. 在下方上传你的自定义主题
4. 指定主题的配色方案

> 自定义主题上传后会自动压缩，大小上限为 8KB。

> 你可以在 Markdown 文档中添加 `<link rel="stylesheet" type="text/css" href="file:///home/me/custom-theme.css">` 以便在开发主题时加速调试。自定义主题[示例][custom-theme]。

---

# 编译器选项

完整的 **CommonMark** 支持，包括 **GFM** 表格和删除线 **+**

| 选项 | 默认值 | 说明 |
| :- | :-: | :- |
| **abbr** | `false` | 使用 `*[词]: 文字` `<abbr>` 实现缩写 |
| **attr** | `false` | 使用 `{}` 花括号实现自定义属性 |
| **breaks** | `false` | 将段落中的换行 `\n` 转换为换行符 `<br>` |
| **cjk** | `false` | 抑制东亚字符之间的换行 |
| **deflist** | `false` | 定义列表 `<dl>` |
| **footnote** | `false` | 脚注 `[^1]` `[^1]: a` |
| **html** | **`true`** | 允许源码中的 HTML 标签 |
| **ins** | `false` | 插入文本 `++a++` `<ins>` |
| **linkify** | **`true`** | 自动将 URL 文本转换为链接 |
| **mark** | `false` | 高亮文本 `==a==` `<mark>` |
| **sub** | `false` | 下标 `~a~` `<sub>` |
| **sup** | `false` | 上标 `^a^` `<sup>` |
| **tasklists** | `false` | 任务列表 `- [x]` |
| **typographer** | `false` | 启用一些语言无关的替换 + 引号美化 |
| **xhtmlOut** | `false` | 使用 `/` 闭合单标签（`<br />`） |

---

# 内容选项

| 选项 | 默认值 | 说明 |
| :- | :-: | :- |
| **autoreload** | `false` | 文件变化时自动重载 |
| **emoji** | `false` | 将 `:shortnames:` 转换为 EmojiOne 图片 |
| **mathjax** | `false` | 渲染 MathJax 公式 |
| **mermaid** | `false` | 渲染 Mermaid 图表 |
| **syntax** | **`true`** | 围栏代码块语法高亮 |
| **toc** | `false` | 生成目录 |

## Autoreload

启用后，扩展每秒会对以下来源的 Markdown 文件发起一次 GET 请求：

- `file:///` URL
- 任何解析为 localhost IPv4 `127.0.0.1` 或 IPv6 `::1` 的主机

## Emoji

将 `:shortnames:` 形式的 Emoji 短名转换为 EmojiOne 图片：

- 像 `:smile:` 这样的短名会使用 EmojiOne 图片转换为 :smile:。
- 目前不支持 `😄` 这类 Unicode 符号和 `:D` 这类 ASCII 表情。

## MathJax

支持以下 MathJax 分隔符：

- 行内公式：`\(math\)` 和 `$math$`
- 块级公式：`\[math\]` 和 `$$math$$`

启用 MathJax 后，你的 Markdown 内容需遵守以下规则：

- 文本中不属于公式的美元符号 `$` 需要转义：`\$`
- 不支持对括号 `\(` `\)` 和方括号 `\[` `\]` 进行常规 Markdown 转义。MathJax 会把这些分隔符之间的内容都转换为公式，除非它们被包裹在反引号 `` `\(` `` 或围栏代码块中。

## Mermaid

渲染包裹在 `mmd` 或 `mermaid` 围栏代码块中的 Mermaid 图表：

    ```mmd
    sequenceDiagram
    ```

或者包裹在 HTML 标签中：

```html
<pre><code class="mermaid">
  sequenceDiagram
</code></pre>
```

- 拖动代码块右下角可上下调整图表容器高度
- 按住 Shift 键 + 鼠标滚轮可缩放
- 按住鼠标左键可拖拽平移

## Syntax

围栏代码块语法高亮：

    ```js
    var hello = 'hi'
    ```

或者包裹在 HTML 标签中：

```html
<pre class="language-js"><code class="language-js">var hello = 'hi'</code></pre>
```

> 支持的语言及其对应[别名][prism-lang]的完整列表。

## ToC

根据 Markdown 文档中的标题生成目录（ToC）。

---

# 侧边栏目录浏览器

渲染后的 Markdown 页面会注入一个左侧边栏，包含 **文件** 和 **大纲** 两个标签页。

## 工作空间

- 点击 **打开工作空间** 选择文件夹——每个文件夹就是一个工作空间。
- 可同时打开多个工作空间：点击某个切换，点 `×` 关闭。
- 再次选择同一个文件夹会复用已有工作空间（不产生重复项）。
- 工作空间列表（包括最后激活的那个）会跨会话持久化。
- 临时工作空间始终置顶；其余工作空间按名称排序。

## 文件

- 只列出工作空间下的 Markdown 文件；跳过 `node_modules`、`.git`、`vendor`、`dist` 等目录。
- 会显示 `.` 开头的文件和目录；黑名单中的条目仍会被忽略。
- 目录可展开/折叠；右上角的「展开/折叠」按钮可一键展开或折叠全部目录。
- 点击文件会在页面内原地替换内容，并保留当前主题。
- 文件中相对引用的图片、视频和音频会基于工作空间根目录解析。

## 状态持久化

- 每个工作空间都会记住已展开的目录和上次打开的文件。
- 切换工作空间——或刷新页面——都会还原文件树并重新打开该文件。

## 快速聚焦

- 在新窗口直接打开一个 Markdown 文件时，侧边栏会自动切换到包含它的工作空间、展开所在路径并滚动定位到该文件。

## 大纲

- 显示当前打开的 Markdown 文件的标题大纲。

## 临时工作空间

- **打开文件** 可不进入目录，直接选择一个或多个 Markdown 文件。
- 属于某个已有工作空间的文件会聚焦到该空间；其余文件则归入置顶的「临时工作空间」。
- 打开一个匹配不到任何工作空间的 `file://` 地址时，会作为 URL 条目加入临时工作空间。
- 临时工作空间里的条目可单独移除。

## 导航

- 当工作空间根路径已知时，打开文件会跳转到其 `file://` 地址（地址栏随之更新）；否则原地替换内容。

## 命令面板

- 按 `Ctrl/Cmd+P` 跨所有工作空间模糊搜索文件名，直接跳转到某个文件。

## 复制路径

- 右键文件或目录即可复制其路径——已知根路径时复制绝对路径，否则复制相对路径。

## 阅读统计

- 滚动时大纲会高亮当前光标所在的标题（scrollspy）。
- 底部状态栏显示字数、预计阅读时长和阅读进度。
- 每个文件单独记住自己的滚动位置，切回时自动恢复。

## 全文搜索

- **搜索** 标签页对所有工作空间的全部文件做全文检索，并跳转到命中位置。

## 当前文件查找

- 按 `Ctrl/Cmd+F` 在当前文件中查找，高亮命中项并支持 `1/N` 切换。

## 代码块

- 代码块带复制按钮和行号。

## 表格与图片

- 过宽或过高的表格会在独立容器内滚动，表头吸附在顶部。
- 点击图片可全屏放大——滚轮缩放，按钮旋转/重置，`Esc` 关闭。

## 键盘导航

- 用 `↑`/`↓` 上下移动、`→`/`←` 展开/折叠、`Enter` 打开。
- 按 `/` 按文件名过滤。

---

# 整页阅读器

扩展还附带一个独立的整页阅读器（`/reader/index.html`），具备相同的文件树和大纲，可在没有外围页面的情况下全屏浏览文件夹。

---

# 管理来源

点击 Markdown Viewer 图标，选择 `高级选项`。

Markdown Viewer 默认对任何内容都没有访问权限：

![img-no-access]

## 启用文件访问

要启用对文件 URL 的访问，请按[这些步骤](#本地文件)操作。

如果未启用本地文件访问，`File Access` 标题旁会显示一个额外的 `Allow Access` 按钮：

![img-file-access-allow]

点击它会跳转到浏览器内置的管理页面，在那里可以打开 `允许访问文件网址` 开关。

## 启用站点访问

将 URL 地址粘贴到 `Site Access` 文本框中，然后点击旁边的 `Add` 按钮，即可启用对单个站点的访问：

![img-site-access-add]

> 使用通配符 `*://raw.githubusercontent.com` 可同时启用对 `http` 和 `https` 协议的访问

> 使用通配符 `https://*.githubusercontent.com` 可启用对某主机名所有子域的访问

> 添加 `http://localhost` 可启用对 localhost 所有端口的访问。
> 添加 `http://localhost:3000` 可启用对特定端口的访问。

## 允许所有站点

点击 `Site Access` 标题旁的 `Allow All` 按钮，即可启用对所有站点的访问：

![img-site-allow-all]

> 这等同于在文本框中添加 `*://*` 模式。

## 内容检测

每个已启用的来源都有一个内容类型头检测和路径匹配正则表达式的选项：

![img-site-access-enabled]

### 头检测

启用此选项后，扩展会检查是否存在值为 `text/markdown`、`text/x-markdown` 或 `text/plain` 的 `content-type` 响应头。

### 路径匹配

启用此选项后，扩展会检查页面 URL 是否匹配路径匹配正则表达式。

默认正则表达式为：`\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)(?:#.*|\?.*)?$`

这是一个简单的正则表达式，匹配以以下内容结尾的 URL：

- markdown 文件扩展名：`\.(?:markdown|mdown|mkdn|md|mkd|mdwn|mdtxt|mdtext|text)`
- 以及其后的可选哈希或查询字符串：`(?:#.*|\?.*)?`

> `(?:match)` 中的 `?:` 表示*非捕获组*，使用它是出于性能考虑。

你可以为每个已启用的来源修改路径匹配正则表达式。设置会随输入实时更新。

### 路径匹配优先级

已启用的来源按从最具体到最不具体的顺序匹配：

1. `https://raw.githubusercontent.com`
2. `https://*.githubusercontent.com`
3. `*://raw.githubusercontent.com`
4. `*://*.githubusercontent.com`
5. `*://*`

优先级最高的匹配来源会被选中，并使用它的头检测和路径匹配设置来决定是否渲染内容。

> 建议只显式允许你希望扩展访问的来源。

## 移除来源

点击要移除的来源对应的 `Remove` 按钮。这会移除权限本身，使扩展无法再访问该来源。

## 刷新来源

如果你登录浏览器并启用了同步功能，扩展会跨设备同步你的偏好设置。你允许的来源列表也会被同步。但是，通过同意弹窗授予的实际权限无法同步。

如果你在某些设备上启用了新来源，则需要在其他设备上显式允许它。在这种情况下，该来源会被高亮，并显示一个额外的 `Refresh` 按钮：

![img-site-refresh]

只有需要刷新的来源会被高亮。除非点击 `Refresh` 按钮，否则扩展无法访问被高亮的来源。

> 在某些情况下，之前允许的来源访问权限可能会被禁用。请务必回看高级选项页面或重新加载它，查找需要刷新的被高亮来源。

---

# 语法示例

有关 Markdown 语法及 Markdown Viewer 所有功能的示例，请见 [GitHub][syntax-github]、[GitLab][syntax-gitlab] 和 [BitBucket][syntax-bitbucket]：

- **elements.md** - Markdown 语法快速概览和 Markdown Viewer 功能总结
- **syntax.md** - 大量 Markdown 语法示例及各种组合和边界情况
- **prism.md** - 语法高亮示例
- **mermaid.md** - 各种类型的 Mermaid 图表
- **mathjax.md** - MathJax 示例和支持文档

允许相应的远程来源，或拉取上述任意仓库并在本地以 `file:///` 来源访问。

---

# 手动安装

以下说明适用于：Chrome、Edge、Opera、Brave、Chromium 和 Vivaldi。

注意，以下任一情况都不会自动接收未来更新！

## 加载打包好的 .crx

1. 前往 [releases] 选择要安装的版本
2. 下载 `markdown-viewer.crx` 文件
3. 打开 `chrome://extensions`
4. 将 `markdown-viewer.crx` 文件拖拽到 `chrome://extensions` 页面

## 加载解压的 .zip

1. 前往 [releases] 选择要安装的版本
2. 下载 `markdown-viewer.zip` 文件并解压
3. 打开 `chrome://extensions`
4. 确保开启 `开发者模式` 开关
5. 点击 `加载已解压的扩展程序` 按钮，选择解压后的目录

## 构建

1. 克隆此仓库
2. 执行 `sh build/package.sh chrome`（构建 Firefox 用 `firefox`）
3. 打开 `chrome://extensions`
4. 确保开启 `开发者模式` 开关
5. 点击 `加载已解压的扩展程序` 按钮，选择克隆的目录

## Manifest v2

1. 克隆 [mv2] 或 [compilers-mv2] 分支（Markdown Viewer v4.0）
2. 打开 `chrome://extensions`
3. 确保开启 `开发者模式` 开关
4. 点击 `加载已解压的扩展程序` 按钮，选择克隆的目录

---

# 许可证

The MIT License (MIT)

Copyright (c) 2013-present, Simeon Velichkov <simeonvelichkov@gmail.com> (https://github.com/simov/markdown-viewer)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


  [chrome]: https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk
  [firefox]: https://addons.mozilla.org/en-US/firefox/addon/markdown-viewer-chrome/
  [edge]: https://microsoftedge.microsoft.com/addons/detail/markdown-viewer/cgfmehpekedojlmjepoimbfcafopimdg
  [opera]: https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk
  [brave]: https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk
  [chromium]: https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk
  [vivaldi]: https://chromewebstore.google.com/detail/markdown-viewer/ckkdlimhmcjmikdlpkmbgfkaikojcbjk

  [marked]: https://github.com/markedjs/marked
  [remark]: https://github.com/remarkjs/remark
  [markdown-it]: https://github.com/markdown-it/markdown-it
  [commonmark]: https://github.com/commonmark/commonmark.js
  [showdown]: https://github.com/showdownjs/showdown
  [remarkable]: https://github.com/jonschlinkert/remarkable

  [emojione]: https://emojione.com
  [mathjax]: https://www.mathjax.org
  [mermaid]: https://mermaid.js.org
  [prism]: https://prismjs.com
  [github-theme]: https://github.com/sindresorhus/github-markdown-css
  [cleanrmd]: https://pkg.garrickadenbuie.com/cleanrmd/#themes

  [gfm]: https://github.github.com/gfm/
  [prism-lang]: https://prismjs.com/#supported-languages
  [compilers]: https://github.com/simov/markdown-viewer/tree/compilers
  [releases]: https://github.com/simov/markdown-viewer/releases
  [mv2]: https://github.com/simov/markdown-viewer/tree/mv2
  [compilers-mv2]: https://github.com/simov/markdown-viewer/tree/compilers-mv2
  [firefox-docs]: https://github.com/simov/markdown-viewer/blob/main/firefox.md
  [custom-theme]: https://gist.github.com/simov/2a074a1c0123e6ba4bc2bfa6a67d3203

  [syntax-github]: https://github.com/simov/markdown-syntax
  [syntax-gitlab]: https://gitlab.com/simovelichkov/markdown-syntax
  [syntax-bitbucket]: https://bitbucket.org/simovelichkov/markdown-syntax

  [img-extensions]: https://i.imgur.com/kzullaI.png
  [img-file-access]: https://i.imgur.com/VVcPv0T.png
  [img-no-access]: https://i.imgur.com/U6mjgX0.png
  [img-file-access-allow]: https://i.imgur.com/2bStHeb.png
  [img-site-access-add]: https://i.imgur.com/CFg9JBt.png
  [img-site-allow-all]: https://i.imgur.com/MXZqFOB.png
  [img-site-access-enabled]: https://i.imgur.com/tFMzJ3l.png
  [img-site-refresh]: https://i.imgur.com/j0gATxT.png
