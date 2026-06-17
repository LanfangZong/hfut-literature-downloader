# hfut-literature-downloader

A Codex/Claude skill for legally downloading, retrying, and reading academic PDFs through the user's own logged-in Hefei University of Technology Library / WebVPN / database navigation / EBSCO / publisher browser session.

中文简介：这是一个面向合肥工业大学图书馆/WebVPN 场景的文献下载、失败重试与全文读取 skill。它使用用户自己已经登录的 Chrome 会话，在授权范围内检索并保存 PDF。适合“网页里能打开 PDF，但命令行下载 403/401/登录页”“EBSCO 查不到，需要从学校数据库导航选择数据库”“CAS SSO 中断下载”“ScienceDirect/出版商人机验证后继续同一页下载”“只需要下载到指定文件夹”的情况。

中文快速使用教程：

1. 先在自己的 Chrome 里打开合工大图书馆或 WebVPN，并用自己的账号登录。
   - 图书馆门户：`https://lib.hfut.edu.cn/portal/`
   - WebVPN：`https://webvpn.hfut.edu.cn/`
   - 数据库导航：`https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881`
   - EBSCOhost：`https://research.ebsco.com/c/jgm366/search`
   - EBSCO Discovery：`https://research.ebsco.com/c/s6ejb3/search`
2. 确认这个 Chrome 里能正常访问目标文献页面，最好能手动打开一次 PDF 或“在线全文”。
3. 在 Chrome 地址栏打开 `chrome://inspect/#remote-debugging`，勾选 `Allow remote debugging for this browser instance`。
4. 告诉 Codex/Claude 你的文献清单，例如 DOI、题目或 PMID，并说明输出文件夹。
5. agent 会优先通过合工大 EBSCO 检索、打开 PDF、保存主文。
6. 如果 EBSCO 查不到，agent 会进入合工大数据库导航页，按期刊、出版社、学科选择合适数据库，再检索并下载。
7. 如果网页要求验证码、Cloudflare、人机验证、扫码、短信/OTP 或二次认证，需要你本人在 Chrome 里完成；agent 不绕过这些验证，也不自动点击出版商的人机验证。
8. 推荐小批量使用：一次 5-10 篇比较稳，最多 15-20 篇，并在批量任务中保留 manifest 记录。不要用它批量扫关键词结果、整期杂志或大量连续下载。
9. 如果遇到合工大统一身份认证 / CAS SSO，不要把账号密码发给 agent。若 Chrome 已经自动填好账号密码，你可以明确授权 agent 只点一次“登录/确认登录”；若出现扫码、短信/OTP、验证码、人机验证或安全提示，则需要你自己在 Chrome 里完成。

可以这样对 agent 说：

```text
请使用 hfut-literature-downloader，通过我已经登录的合工大图书馆/WebVPN Chrome 会话，下载下面这些 DOI 的 PDF 到指定文件夹。EBSCO 查不到的论文，请进入合工大数据库导航页选择合适数据库后继续检索。
```

## What It Solves

- HFUT Library / WebVPN can open a paper, but direct `curl` or `Invoke-WebRequest` returns 403.
- EBSCO can open a PDF, but the actual file is behind `linkprocessor/v2-pdf` or `v2-pdf-full-text`.
- EBSCO cannot find a paper, so the workflow needs to use the HFUT database navigation page to choose a publisher or subject database.
- A DOI/title list needs small-batch PDF collection through authenticated Chrome.
- CAS SSO interrupts a batch and the failed papers need to be retried after the user manually authenticates in Chrome.
- ScienceDirect or publisher verification interrupts a batch and needs manual browser handoff before retrying the same tab.
- PDFs need a minimum validity check before being reported as downloaded.
- Zotero can import metadata, but the user still wants local project-folder PDFs.

## Boundaries

This skill only uses user-authorized institutional access.

It does not bypass paywalls, CAPTCHA, Cloudflare, two-factor authentication, publisher bot checks, DRM, or account restrictions. If a page asks for CAPTCHA, QR login, SMS/OTP, Cloudflare, "Are you a robot?", or publisher bot verification, the user must complete it in Chrome.

Do not paste school account passwords, CAS passwords, SMS codes, OTP codes, QR login results, cookies, local storage, or session tokens into chat. The intended workflow is browser handoff: the agent opens the page, the user completes authentication in Chrome, and the agent resumes after the user confirms. If the HFUT CAS page is already filled by Chrome's password manager and you explicitly authorize it, the agent may click the visible login/confirm button once without reading or typing credentials.

Small batches are supported when the user provides a definite DOI/title/PMID list. Avoid broad keyword-result scraping, whole-issue downloads, large automated runs, repeated challenge retries, or parallel ScienceDirect tab bursts.

## Preconditions

Before using the skill:

1. Chrome is open.
2. The user has personally logged in to Hefei University of Technology Library / WebVPN / database portal / EBSCO in Chrome.
3. Chrome remote debugging is enabled at `chrome://inspect/#remote-debugging`.
4. The user has checked `Allow remote debugging for this browser instance`.
5. Node.js 22+ is available, or the Codex bundled Node runtime is available.
6. The user has approved the target output folder.

## Installation

With the Skills CLI:

```powershell
npx skills add LanfangZong/hfut-literature-downloader -g
```

Manual Codex installation:

```powershell
git clone https://github.com/LanfangZong/hfut-literature-downloader.git "$env:USERPROFILE\.codex\skills\hfut-literature-downloader"
```

Manual Claude Code installation:

```powershell
git clone https://github.com/LanfangZong/hfut-literature-downloader.git "$env:USERPROFILE\.claude\skills\hfut-literature-downloader"
```

Manual Agents-style installation:

```powershell
git clone https://github.com/LanfangZong/hfut-literature-downloader.git "$env:USERPROFILE\.agents\skills\hfut-literature-downloader"
```

If the repository is already installed in `.codex\skills`, copy it into Claude's default skill directory:

```powershell
Copy-Item -Recurse -Force `
  "$env:USERPROFILE\.codex\skills\hfut-literature-downloader" `
  "$env:USERPROFILE\.claude\skills\hfut-literature-downloader"
```

Optional Python helpers:

```powershell
pip install -r "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\requirements.txt"
```

## Usage

Tell Codex/Claude something like:

```text
Use hfut-literature-downloader to download these papers through my logged-in HFUT WebVPN session. Save the PDFs to F:\000 文献阅读\数据分析方法. If EBSCO cannot find a paper, use the HFUT database navigation page to choose the right database.
```

The skill instructs the agent to:

1. verify Chrome/WebVPN/remote-debugging prerequisites;
2. search HFUT EBSCOhost or EBSCO Discovery by DOI or exact title;
3. if EBSCO fails, open the HFUT database navigation page and choose the relevant database;
4. open the authorized PDF link in Chrome;
5. download bytes from the authenticated browser page context;
6. check only the minimum PDF validity when the user only wants downloads;
7. create a manifest only for larger batches, retry queues, or user-requested audit trails.

For ScienceDirect or other sensitive publisher platforms, keep the workflow slower and more manual:

- Start from HFUT Library / WebVPN / database navigation / library `在线全文` links when possible.
- Process one publisher article at a time.
- Do not open many ScienceDirect tabs in parallel.
- Do not repeatedly refresh or retry a bot-check page.
- If verification appears, pause and ask the user to handle it in Chrome, then continue from the same tab.

## HFUT Database Navigation Workflow

Use the database navigation page when EBSCO cannot find a paper or does not expose a usable PDF:

```text
https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881
```

Recommended workflow:

1. Identify the paper's likely venue, publisher, discipline, and DOI prefix.
2. Search or filter the database navigation page for the most relevant platform.
3. Prefer specialized full-text databases over broad discovery search when the venue points clearly to one source.
4. Open the chosen database through the HFUT portal or WebVPN link, not by guessing an unauthenticated external URL.
5. Search inside that database by exact title first, then DOI.
6. Use the database's own `PDF`, `Full Text`, `在线全文`, `Download PDF`, or publisher handoff link.
7. If all likely databases fail to expose authorized full text, report `no_authorized_pdf_found` with the databases tried.

Useful examples from the HFUT database page:

- `Science Online（《科学》周刊）数据库` -> Science / AAAS
- `Elsevier ScienceDirect数据库（简称SD)` -> Elsevier / ScienceDirect
- `Nature(《自然》）电子期刊` and `Nature子刊` -> Nature Portfolio
- `Wiley电子期刊` -> Wiley Online Library
- `Taylor & Francis 科技期刊专辑库` -> Taylor & Francis / Routledge
- `IEEE（美国电气电子工程师学会）数据库（简称IEL）` -> IEEE Xplore
- `ACM（美国计算机协会）数据库` -> ACM Digital Library

For Science/AAAS, use the HFUT resource gateway before opening the paper:

```text
https://libresource.hfut.edu.cn/go?url=http://www.sciencemag.org/
```

## EBSCO Workflow

HFUT commonly exposes PDFs through EBSCO. Use the `jgm366` EBSCOhost profile first when EBSCO Discovery (`s6ejb3`) does not expose the PDF directly.

Known working pattern:

1. Open `https://research.ebsco.com/c/jgm366/search`.
2. Search the exact title.
3. Open the result.
4. Click `PDF`, `立即获取 (PDF)`, or `访问选项` -> `PDF`.
5. Confirm the browser URL looks like:

```text
https://research.ebsco.com/c/jgm366/viewer/pdf/<recordId>
```

6. Save with the EBSCO helper.

Ordinary EBSCO PDF:

```powershell
$node = "node"
& $node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\ebsco_pdf_downloader.mjs" `
  --debug "http://127.0.0.1:9333" `
  --record-id "<viewerRecordId>" `
  --profile "jgm366" `
  --out "F:\target\paper.pdf"
```

EBSCO full-text PDF using `v2-pdf-full-text`:

```powershell
$node = "node"
& $node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\ebsco_pdf_downloader.mjs" `
  --debug "http://127.0.0.1:9333" `
  --record-id "<viewerRecordId>" `
  --full-text-record-id "<fullTextRecordId>" `
  --profile "jgm366" `
  --out "F:\target\paper.pdf"
```

The helper tries:

- `linkprocessor/v2-pdf` for ordinary EBSCO PDFs.
- `linkprocessor/v2-pdf-full-text` followed by the signed `content.ebscohost.com/cds/retrieve` URL for EBSCO full-text PDFs.

It uses only the already-open, logged-in Chrome tab and the PDF URLs exposed by the page. It does not read cookies, passwords, local storage, or browser profile files.

## CAS / SSO Retry Workflow

Some publishers may still ask for Hefei University of Technology CAS / unified identity authentication after WebVPN is open. This is common with Elsevier/ScienceDirect, Springer Nature, Nature Portfolio, Wiley, Taylor & Francis, Cell Press, and other platforms that use institutional sign-in.

Recommended workflow:

1. Ask the agent to collect all CAS-blocked papers into `cas_retry.tsv`.
2. Keep these columns:

```text
id	project	title	doi	year	venue	publisher	failure_stage	status	source_url	current_url	next_action	notes
```

3. Use `cas_waiting_user` for papers currently stopped at CAS/SSO.
4. Let the agent open one or a few failed links in Chrome.
5. When the browser reaches CAS, the agent should pause.
6. If Chrome has already filled the HFUT CAS account/password and the page only needs a login/confirm click, you can explicitly authorize the agent to click that visible button once.
7. If the page asks for QR scan, SMS/OTP, CAPTCHA, Cloudflare, publisher bot verification, or a security warning, complete that step manually in Chrome.
8. Tell the agent to continue from the same tab.
9. The agent retries PDF / Full Text / Download PDF and updates the manifest when a manifest is being used.

A useful prompt:

```text
不要让我提供账号密码。请把 CAS 失败文献整理成 cas_retry.tsv，然后逐篇用已登录 Chrome 打开。遇到合工大 CAS 时，如果 Chrome 已经自动填好账号密码，可以在我授权后只点一次登录/确认登录；遇到验证码、人机验证、扫码、短信/OTP、WebVPN 重新登录或二次认证时暂停，让我手动完成认证；认证完成后继续下载 PDF。
```

Do not process many CAS tabs at once. Work in small groups so the user can clearly see which page needs authentication and so the institutional session does not get confused.

## ScienceDirect / Publisher Verification Workflow

ScienceDirect and some publisher platforms may show `Are you a robot?`, CAPTCHA, Cloudflare, or other bot-verification pages. This skill does not solve or click those challenges automatically.

Recommended workflow:

1. Ask the agent to record interrupted papers in `publisher_verification.tsv`.
2. Keep these columns:

```text
id	project	title	doi	year	venue	publisher	status	source_url	current_url	next_action	notes
```

3. Use `sciencedirect_robot_check` for ScienceDirect `Are you a robot?`.
4. Use `publisher_verification_waiting_user` for other publisher checks.
5. Let the user complete the verification in Chrome.
6. Tell the agent to continue from the same tab.
7. If the challenge immediately appears again, mark `do_not_auto_retry` and move on.

A useful prompt:

```text
请用 hfut-literature-downloader 小批量下载这些 DOI。ScienceDirect 和其它出版商一次只处理一篇，优先从合工大图书馆门户 / WebVPN / 数据库导航 / 在线全文进入。遇到 Are you a robot、Cloudflare、验证码或出版商人机验证时不要自动点击，也不要反复刷新；请记录到 publisher_verification.tsv，停在当前 tab 让我手动完成，然后从同一个页面继续下载。
```

This conservative pattern is meant to reduce unnecessary triggers and keep the user's institutional access auditable. It is not a way to bypass publisher verification.

## Claude Code / Windows Notes

Claude Code on Windows may differ from Codex in a few practical ways:

- Claude Code often discovers skills from `%USERPROFILE%\.claude\skills\`, while Codex uses `%USERPROFILE%\.codex\skills\` and some agent setups use `%USERPROFILE%\.agents\skills\`.
- If `curl` is unavailable or behaves differently, use PowerShell `Invoke-WebRequest` for simple HTTP checks, or the bundled Node.js helper scripts for CDP proxy calls.
- Keep Python output UTF-8. The helper script reconfigures stdout/stderr to UTF-8 internally, but this command is still the safest form:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.claude\skills\hfut-literature-downloader\scripts\extract_pdf_text.py" --pdf "D:\papers\paper.pdf" --pages 3
```

- Discovery URLs sometimes contain fragments such as `#!`. If that nested URL is passed through another URL without encoding, the fragment can be stripped and Chrome may open `about:blank` or the wrong page. Prefer `scripts/cdp_open_url.mjs` for fragment-heavy URLs.

## Helper Scripts

Open an HFUT WebVPN, database, discovery, or publisher URL through the CDP proxy without losing URL fragments:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.claude\skills\hfut-literature-downloader\scripts\cdp_open_url.mjs" `
  --url "https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881" `
  --wait
```

Download an EBSCO PDF from an already-open viewer:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.claude\skills\hfut-literature-downloader\scripts\ebsco_pdf_downloader.mjs" `
  --debug "http://127.0.0.1:9333" `
  --record-id "<viewerRecordId>" `
  --profile "jgm366" `
  --out "D:\papers\paper.pdf"
```

Download a PDF that opens in Chrome but fails from shell:

```powershell
$node = "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe"
& $node "$env:USERPROFILE\.claude\skills\hfut-literature-downloader\scripts\browser_pdf_downloader.mjs" `
  --url "https://publisher.example/doi/pdf/..." `
  --out "D:\papers\paper.pdf" `
  --close
```

Extract and verify PDF text:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.claude\skills\hfut-literature-downloader\scripts\extract_pdf_text.py" `
  --pdf "D:\papers\paper.pdf" `
  --pages 3
```

## Batch Manifest

For multi-paper work, create a manifest with at least:

```text
id	title	doi	year	venue	status	pdf_path	si_status	si_paths	source_url	notes
```

Keep the batch small and auditable. Stop when login, CAPTCHA, WebVPN expiry, publisher security checks, or suspicious download prompts appear.

For CAS retries, use the richer template in `examples/cas-retry-template.tsv`.

For publisher verification queues, use `examples/publisher-verification-template.tsv`.

## Repository Layout

```text
hfut-literature-downloader/
├── LICENSE
├── README.md
├── requirements.txt
├── SKILL.md
├── agents/
│   └── openai.yaml
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

## Verified Test Cases

The workflow has been verified with:

- Title: `Predicting Collaboration Technology Use: Integrating Technology Adoption and Collaboration Research`
  - DOI: `10.2753/MIS0742-1222270201`
  - Route: EBSCOhost `jgm366` -> `立即获取 (PDF)` -> EBSCO PDF viewer
  - Result: PDF saved through `linkprocessor/v2-pdf`; 46 pages, text-readable

- Title: `How Information Technology Strategy and Investments Influence Firm Performance: Conjecture and Empirical Evidence`
  - DOI: `10.25300/MISQ/2016/40.1.10`
  - Route: EBSCOhost `jgm366` -> `访问选项` -> `PDF` -> EBSCO PDF viewer
  - Result: PDF saved through `v2-pdf-full-text` -> signed `content.ebscohost.com/cds/retrieve`

- Title: `Long-term isolation and archaic introgression shape functional genetic variation in Near Oceania`
  - DOI: `10.1126/science.adr6749`
  - Route used for gateway verification: HFUT database navigation -> `Science Online（《科学》周刊）数据库` -> HFUT resource gateway -> Science/AAAS
  - Result: confirmed Science/AAAS can be entered through `libresource.hfut.edu.cn`, so Science downloads should use the school resource route when provenance matters
