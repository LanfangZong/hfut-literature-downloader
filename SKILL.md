---
name: hfut-literature-downloader
description: Use this skill when the user wants to search, open, and download academic PDFs through their own logged-in Hefei University of Technology Library, HFUT WebVPN, CAS SSO, library discovery portal, database navigation page, EBSCOhost/EBSCO Discovery Service, publisher pages, or Chrome session. Trigger on requests such as "用合工大图书馆下载文献", "走合肥工业大学 WebVPN", "从 EBSCO 下载 PDF", "EBSCO 查不到就去数据库", "Chrome 已经登录/已经打开 PDF", "不能从学校图书馆下载吗", or "下载到指定文件夹".
---

# HFUT Literature Downloader

Use the user's legitimate Hefei University of Technology Library / WebVPN / database portal / EBSCO / publisher access to find and save PDFs. Prefer the already-authenticated Chrome session over unauthenticated shell downloads.

## Safety Boundaries

- Use only the user's own institutional access.
- Do not bypass paywalls, DRM, CAPTCHA, Cloudflare, publisher bot checks, QR login, SMS/OTP, two-factor authentication, or account warnings.
- Do not ask the user to paste passwords, OTP codes, cookies, localStorage, session files, or browser profile data.
- Do not inspect or export cookies, passwords, localStorage, browser profiles, or session files.
- If a page asks for CAPTCHA, QR login, SMS/OTP, Cloudflare, "Are you a robot?", or other security verification, stop and ask the user to finish it in Chrome.
- Work in small batches. Do not download whole journal issues, volumes, large result sets, or broad keyword-search batches.

If the user only asks to download files, save the PDFs and report the paths. Do not create extra reading notes, extracted text, or manifest files unless the user asks, the batch is large, or failures need tracking.

## Preconditions

Before downloading, confirm or discover:

1. Chrome is open on the user's machine.
2. The user has logged in to HFUT Library / WebVPN / CAS / EBSCO in Chrome.
3. Chrome remote debugging is available.
   - User-facing route: `chrome://inspect/#remote-debugging`, then enable `Allow remote debugging for this browser instance`.
   - Direct DevTools endpoint may be `http://127.0.0.1:922`, `http://127.0.0.1:9222`, or `http://127.0.0.1:9333`.
4. The target output folder is approved by the user.
5. Node.js 22+ is available. In Codex Desktop, prefer the bundled Node runtime if normal `node` is unavailable.

Never treat missing direct shell access as final failure if the PDF opens in Chrome.

## Preferred Route

Prefer the library/discovery route before direct publisher pages:

1. Start from an already-authenticated HFUT page:
   - `https://lib.hfut.edu.cn/portal/`
   - `https://webvpn.hfut.edu.cn/`
   - HFUT database navigation/resource page: `https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881`
   - EBSCO Discovery Service: `https://research.ebsco.com/c/s6ejb3/search`
   - EBSCOhost Research Databases: `https://research.ebsco.com/c/jgm366/search`
2. Search by exact title or DOI.
3. Open result links in this order:
   - `PDF`
   - `立即获取 (PDF)`
   - `访问选项` -> `PDF`
   - `在线全文`
   - publisher `View PDF` / `Download PDF`
4. Once the PDF viewer is open in Chrome, save from the authenticated browser context.
5. Verify only the minimum needed for the user's request:
   - Always ensure the saved file exists and starts with `%PDF`.
   - Extract page count/text only if the user asks for reading/verification, if the PDF looks suspicious, or if doing a manifest batch.

If EBSCO cannot find the paper, do not stop at `no authorized PDF found`. Open the HFUT database navigation/resource page in the logged-in Chrome session, choose an appropriate database, search there, and continue from the database or publisher full-text route.

## EBSCOhost Workflow

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

Use the helper for both EBSCO PDF variants:

```powershell
$node = "node"
& $node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\ebsco_pdf_downloader.mjs" `
  --debug "http://127.0.0.1:9333" `
  --record-id "<recordId>" `
  --profile "jgm366" `
  --out "F:\target\paper.pdf"
```

If the viewer uses `v2-pdf-full-text`, the visible viewer id may differ from the internal full-text record id. Inspect the viewer's performance resources for:

```text
https://research.ebsco.com/linkprocessor/v2-pdf-full-text?recordId=<fullTextRecordId>&sourceRecordId=<viewerRecordId>...
```

Then pass the viewer id plus the internal full-text id:

```powershell
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

It does not read cookies or localStorage. It uses only the already-open, logged-in Chrome tab and the PDF URLs exposed by the page.

## HFUT Database Portal Fallback

Use this fallback when EBSCO Discovery Service (`s6ejb3`) and EBSCOhost Research Databases (`jgm366`) do not find the paper or do not expose a usable PDF.

Open this page in the authenticated Chrome session:

```text
https://lib.hfut.edu.cn/portal/app/resource/1750796722306682881
```

Treat it as the HFUT database/resource navigation page. Because it is a JavaScript portal, inspect it through Chrome/CDP rather than relying on plain command-line HTML fetches.

Selection workflow:

1. Identify the paper's likely venue, publisher, discipline, and DOI prefix.
2. Search or filter the resource page for the most relevant database or publisher platform.
3. Prefer specialized full-text databases over broad discovery search when the venue points clearly to one source.
4. Open the chosen database through the HFUT portal or WebVPN link, not by guessing an unauthenticated external URL.
5. Search inside that database by exact title first, then DOI.
6. Use the database's own `PDF`, `Full Text`, `在线全文`, `Download PDF`, or publisher handoff link.
7. If the database lands on a publisher PDF that opens in Chrome but fails from shell, use `browser_pdf_downloader.mjs`.

Database selection hints:

- MIS / management / business / information systems: try EBSCO first, then databases likely covering business and management journals.
- Elsevier journals: look for ScienceDirect or Elsevier full-text resources.
- Springer / Nature journals: look for SpringerLink, Springer Nature, or Nature resources.
- Wiley journals: look for Wiley Online Library.
- Taylor & Francis / Routledge / M.E. Sharpe journals: look for Taylor & Francis or relevant business full-text databases.
- IEEE / ACM / engineering and computer science venues: look for IEEE Xplore, ACM Digital Library, or engineering databases.
- If the venue is unclear, use Crossref/OpenAlex metadata only to identify publisher/venue; still download only through HFUT-authorized pages or legitimate OA sources.

If several candidate databases exist, open one at a time and keep the browser state simple. If all likely databases fail to expose authorized full text, report `no_authorized_pdf_found` with the databases tried.

## Direct Chrome DevTools Fallback

When the web-access CDP proxy is unavailable but Chrome exposes DevTools directly:

1. Test the endpoint:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9333/json/version"
Invoke-RestMethod -Uri "http://127.0.0.1:9333/json/list"
```

2. Find the EBSCO or PDF viewer tab in `/json/list`.
3. Use `scripts/ebsco_pdf_downloader.mjs --debug http://127.0.0.1:<port>` for EBSCO.
4. For non-EBSCO PDF URLs, use `scripts/browser_pdf_downloader.mjs` when the web-access proxy is available, or a short CDP script that runs `fetch(location.href, { credentials: "include" })` inside the PDF tab and writes chunks to disk.

Do not fetch Chrome profile files or cookies from disk.

## Browser PDF Downloader

Use this for publisher PDF URLs that are already open in Chrome and fail from shell with `403`, `401`, login HTML, or bot-protection HTML.

```powershell
$node = "node"
& $node "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\browser_pdf_downloader.mjs" `
  --url "https://publisher.example/doi/pdf/..." `
  --out "F:\target\paper.pdf" `
  --close
```

This helper opens or reuses a controlled Chrome tab, runs `fetch(..., { credentials: "include" })` inside that page, transfers bytes in chunks, and verifies `%PDF`.

## CAS / SSO Handoff

If the browser reaches HFUT CAS, WebVPN login, Shibboleth, OpenAthens, SAML, or institutional sign-in:

1. Stop automated actions on that tab.
2. Tell the user which paper/tab needs attention.
3. Ask the user to complete login in Chrome.
4. If the user explicitly says Chrome has already filled the HFUT CAS credentials and authorizes one click, click only the visible login/confirm/continue button once.
5. Do not read, type, reveal, copy, or store credentials.
6. If CAPTCHA, QR login, SMS/OTP, Cloudflare, or a security warning appears, let the user complete it manually.
7. After the user says "已经登录" or equivalent, continue from the same tab.

Use `cas_waiting_user` only as an interim status, not a final failure.

## Publisher Verification

If ScienceDirect or another publisher shows `Are you a robot?`, CAPTCHA, Cloudflare, bot verification, or similar:

1. Stop on that tab.
2. Do not click the challenge or try to solve it.
3. Ask the user to complete it in Chrome.
4. Continue once from the same tab after the user confirms.
5. If the challenge immediately returns, mark the paper as `do_not_auto_retry` or `publisher_verification_waiting_user` and move on.

Reduce triggers by using HFUT/EBSCO/discovery links first, processing one sensitive publisher article at a time, and avoiding repeated refresh/open loops.

## Output Rules

Use readable filenames:

```text
FirstAuthor_Year_Journal_short-title.pdf
FirstAuthor_Year_Journal_short-title_SI.pdf
```

For a simple user request like "下载到这个文件夹就行了":

1. Save the PDF to the requested folder.
2. Check that it exists and starts with `%PDF`.
3. Report the final path.
4. Do not add a manifest or extract text unless needed.

For larger batches or retry workflows, create a manifest with:

```text
id	title	doi	year	venue	status	pdf_path	si_status	si_paths	source_url	notes
```

Useful statuses:

```text
downloaded
downloaded_with_si
cas_waiting_user
publisher_verification_waiting_user
sciencedirect_robot_check
do_not_auto_retry
discovery_no_link
publisher_blocked_waiting_user
no_authorized_pdf_found
failed_after_retry
```

## Verification and Reading

Only run full text extraction when useful. For PDFs:

```powershell
$env:PYTHONUTF8='1'
python -X utf8 "$env:USERPROFILE\.codex\skills\hfut-literature-downloader\scripts\extract_pdf_text.py" `
  --pdf "F:\target\paper.pdf" `
  --pages 3
```

If the default Python lacks `pdfplumber` or `pypdf`, use the Codex bundled Python runtime when available.

Minimum PDF check:

```powershell
$bytes = [System.IO.File]::ReadAllBytes("F:\target\paper.pdf")
[System.Text.Encoding]::ASCII.GetString($bytes, 0, 4)
```

Expected output:

```text
%PDF
```

## Failure Handling

- If direct `curl` or `Invoke-WebRequest` returns `403` but Chrome opens the PDF, download from Chrome context.
- If the page is `about:blank`, suspect unencoded URL fragments such as `#!`; reopen the full URL with proper encoding.
- If the HFUT session expires, ask the user to log in again.
- If no authorized PDF is visible from HFUT/EBSCO/publisher/OA routes, report `no_authorized_pdf_found`; do not seek unauthorized mirrors.

## Verified HFUT/EBSCO Cases

This skill was adjusted after a successful HFUT/EBSCO run on June 17, 2026:

- `Predicting Collaboration Technology Use: Integrating Technology Adoption and Collaboration Research`
  - Route: EBSCOhost `jgm366` search -> `立即获取 (PDF)` -> viewer `/viewer/pdf/wr76s4zwlz`
  - Save method: `linkprocessor/v2-pdf`
  - Result: `%PDF-1.6`, 46 pages
- `How Information Technology Strategy and Investments Influence Firm Performance: Conjecture and Empirical Evidence`
  - Route: EBSCOhost `jgm366` search -> `访问选项` -> `PDF` -> viewer `/viewer/pdf/6n2ea6jju5`
  - Save method: `linkprocessor/v2-pdf-full-text` -> signed `content.ebscohost.com/cds/retrieve`
  - Result: `%PDF-1.6`, viewer showed 25 pages
