# Week 04：RAG 的第一步——文档加载与切分

本阶段只准备可检索的资料片段：读取 Markdown → 按标题和长度切分 → 保留来源 → 在命令行查看 JSON。尚未实现嵌入、相似度检索、模型问答或 Agent 集成，无需 API Key 和 .env，不消耗模型额度。

## 运行

沿用 Node.js 24.x、pnpm 11.x。在 week04 目录执行：

```bash
pnpm install
pnpm start
pnpm start docs 100
pnpm typecheck
pnpm test
pnpm build
node dist/src/index.js
```

默认读取 docs 下的两份示例笔记，每块最多 500 个 Unicode 码点。也可使用 `pnpm start ../week03 500` 读取上一周的 Markdown。自定义路径相对于当前工作目录；只指定可信、大小可控的资料目录。程序只读取文件，向终端打印 JSON，不修改原文或写入索引。安装依赖需要联网，运行阶段不联网。

加载器跳过隐藏文件、隐藏目录、node_modules、dist、coverage 和目录内的符号链接；仅收集非空 .md 文件。读取出错会停止并报错，不静默跳过损坏路径。这里不是生产级文件访问沙箱，未来上传到模型前还需审核资料是否包含敏感信息。

## VS Code 断点调试

在 VS Code 中打开整个 ai-agent-study 根目录，确保 week04 已执行 pnpm install。按 Ctrl+Shift+D，选择“Week04：文档加载与切分（无需 Key）”，按 F5。资料目录默认 docs，长度默认 50，方便观察长度切分；改成 500 可比较差异。无需 build，也不会请求模型。

建议断点顺序：

1. src/index.ts 的 `const documents = await loadDocuments(directory)`：查看 directory 和 maxChars，F10 执行后查看 documents。
2. src/load-documents.ts 的 readFile 所在行：查看当前文件 path，执行后查看 text。
3. src/chunk-document.ts 的 `if (title)` 和 flush 中的 `chunks.push(...)`：查看 heading、text、startLine、endLine，理解何时形成一个片段。
4. src/index.ts 的 console.log：查看最终 chunks。

注意 index.ts 会先用空文档调用 chunkDocument 校验长度参数；若首先在切分函数中暂停，看到空文档是正常的，可以继续到真正资料的调用。断点应放在可执行代码行，而非 interface 类型声明上。

F10 单步跳过，F11 进入函数，Shift+F11 跳出，F5 继续，Shift+F5 停止。Windows 沿用本机的 `${env:APPDATA}/nvm/v24.19.0/node.exe`；换电脑或 Node 安装位置后需修改根目录 .vscode/launch.json 的 windows.runtimeExecutable。其他系统使用 PATH 中的 Node.js 24。

## 输出字段

- documentCount、chunkCount：非空文档数和片段数。
- id：由来源、标题、位置、片段序号和内容计算的 SHA-256 标识；相同输入与切分规则下稳定，编辑文档可能改变 ID，不是业务幂等键。
- source：相对于资料目录的文件路径。
- heading：最近的 Markdown 标题，没有则为 null。
- startLine、endLine：原文行号，从 1 开始且包含两端；超长行的多个片段可能拥有相同行号。
- text：该片段的文本，统一为 LF 换行。

## 阅读顺序

1. src/types.ts：先理解文档与片段的数据结构。
2. src/load-documents.ts：学习 Node.js 异步文件读取、递归遍历和来源路径。
3. src/chunk-document.ts：观察标题边界、长度限制、flush 和行号如何配合。
4. src/index.ts：将加载与切分串起来。
5. tests：通过小例子验证边界情况。

## 切分规则与当前限制

遇到 ATX 标题（如 `## 工具`）开始新章节；代码围栏中的井号不作为标题。章节内尽量保留整行，超过长度限制时开启新片段；超长单行按 Unicode 码点分段，避免拆开 emoji 的代理对，但不保证完整保留组合字符或整个 emoji 序列。空白片段会被丢弃，文本行号仍指向原文。

本阶段不是完整 Markdown 解析器：不处理 Setext 标题、复杂列表和引用嵌套等语法；不保证代码块、表格或段落不会被长度上限切开。只保存最近标题，不维护完整标题层级。没有 overlap（重叠片段），字符数也不等于 token 数。文件当前整体读入内存，不适合直接处理海量或不可信超大文档。

练习：分别使用 100 和 500 的长度观察片段数及上下文完整性；检查 source 和行号能否定位到原文。下一步再比较切分策略，并加入检索与嵌入。
