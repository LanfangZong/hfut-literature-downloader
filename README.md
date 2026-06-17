# HFUT Literature Downloader

用你已经登录的合肥工业大学图书馆 / WebVPN / 数据库资源 / EBSCO / 出版社 Chrome 会话，合法检索并下载学术论文 PDF。

## 什么时候用

- 用合工大图书馆下载 DOI、题名或论文清单。
- EBSCO 能打开 PDF，但命令行下载返回 403/401/登录页。
- EBSCO 查不到，需要进入合工大数据库导航页选择合适数据库。
- ScienceDirect、Science Online、Wiley、Taylor & Francis、Springer、Nature、IEEE、ACM 等平台需要从学校资源入口进入。
- Chrome 已经打开 PDF，只需要保存到指定文件夹。

## 推荐流程

1. 用户先在 Chrome 中登录合工大图书馆 / WebVPN / CAS。
2. 开启 Chrome 远程调试：`chrome://inspect/#remote-debugging`，勾选 `Allow remote debugging for this browser instance`。
3. 优先检索 EBSCO：

```text
https://research.ebsco.com/c/jgm366/search
https://research.ebsco.com/c/s6ejb3/search
```

4. 如果 EBSCO 查不到，进入合工大数据库导航页：

```text
https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881
```

在该页面按期刊、出版社、学科选择数据库，再到数据库内检索题名或 DOI。

5. 如果只是“下载完就行”，保存 PDF 并检查文件头是 `%PDF`，不用额外写清单或抽全文。

## 重要入口

| 用途 | 入口 |
| --- | --- |
| 合工大图书馆门户 | `https://lib.hfut.edu.cn/portal/` |
| 合工大 WebVPN | `https://webvpn.hfut.edu.cn/` |
| 数据库导航 | `https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881` |
| EBSCOhost | `https://research.ebsco.com/c/jgm366/search` |
| EBSCO Discovery | `https://research.ebsco.com/c/s6ejb3/search` |

数据库导航页中已确认存在 `Science Online（《科学》周刊）数据库`，入口形式类似：

```text
https://libresource.hfut.edu.cn/go?url=http://www.sciencemag.org/
```

应从该合工大资源入口进入 Science/AAAS，而不是直接裸开 `science.org` 后声称来自学校图书馆。

## EBSCO 下载助手

普通 EBSCO PDF：

```powershell
node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\ebsco_pdf_downloader.mjs" `
  --debug "http://127.0.0.1:9333" `
  --record-id "<viewerRecordId>" `
  --profile "jgm366" `
  --out "F:\目标文件夹\paper.pdf"
```

EBSCO full-text PDF 使用 `v2-pdf-full-text` 时：

```powershell
node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\ebsco_pdf_downloader.mjs" `
  --debug "http://127.0.0.1:9333" `
  --record-id "<viewerRecordId>" `
  --full-text-record-id "<fullTextRecordId>" `
  --profile "jgm366" `
  --out "F:\目标文件夹\paper.pdf"
```

脚本只使用已打开 Chrome 页面的授权上下文和页面暴露的 PDF URL；不读取 cookies、密码、localStorage 或浏览器配置文件。

## 非 EBSCO PDF

如果出版社 PDF 已在 Chrome 中打开，但 shell 下载失败，使用：

```powershell
node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\browser_pdf_downloader.mjs" `
  --url "https://publisher.example/doi/pdf/..." `
  --out "F:\目标文件夹\paper.pdf"
```

如果需要严格证明来自学校图书馆入口，应先从 `libresource.hfut.edu.cn/go?...` 或 WebVPN/数据库导航入口进入出版社，再下载。

## 安全边界

- 不绕过付费墙、DRM、验证码、Cloudflare、人机验证、二维码、短信/OTP 或二次认证。
- 不要求用户在聊天中提供密码、验证码、cookie、token 或会话文件。
- 遇到 CAS、验证码、人机验证或安全提示时，停下来让用户在 Chrome 中完成。
- 小批量处理，不下载整期、整卷或大量搜索结果。

## 已验证案例

- EBSCO 普通 PDF：`Predicting Collaboration Technology Use: Integrating Technology Adoption and Collaboration Research`
  - 路径：EBSCOhost `jgm366` -> `立即获取 (PDF)` -> `linkprocessor/v2-pdf`
  - 结果：成功保存 `%PDF-1.6`

- EBSCO full-text PDF：`How Information Technology Strategy and Investments Influence Firm Performance`
  - 路径：EBSCOhost `jgm366` -> `访问选项` -> `PDF` -> `v2-pdf-full-text` -> `content.ebscohost.com/cds/retrieve`
  - 结果：成功保存 `%PDF-1.6`

- Science/AAAS 学校入口验证：
  - 路径：合工大数据库导航 -> `Science Online（《科学》周刊）数据库` -> `libresource.hfut.edu.cn/.../org/science/www/...`
  - 用途：确认 Science 文章应从学校资源入口进入，而不是直接裸开 `science.org`。

## 文件结构

```text
hfut-literature-downloader/
├── SKILL.md
├── README.md
├── agents/openai.yaml
├── examples/
│   ├── manifest-template.tsv
│   ├── cas-retry-template.tsv
│   └── publisher-verification-template.tsv
└── scripts/
    ├── browser_pdf_downloader.mjs
    ├── cdp_open_url.mjs
    ├── ebsco_pdf_downloader.mjs
    └── extract_pdf_text.py
```
