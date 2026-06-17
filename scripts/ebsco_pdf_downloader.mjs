#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(`Usage:
  node ebsco_pdf_downloader.mjs --record-id <viewerRecordId> --out <file.pdf> [options]

Options:
  --source-record-id <id>       Defaults to --record-id; usually the viewer record id.
  --profile <profile>           EBSCO profile, default jgm366.
  --full-text-record-id <id>    Internal record id used by v2-pdf-full-text when different.
  --debug <url>                 Chrome DevTools endpoint, default http://127.0.0.1:9333.
  --target <targetId>           Existing Chrome tab id. Otherwise the script finds an EBSCO viewer tab.
  --viewer-url <url-part>       URL substring for selecting the viewer tab.
  --lang <value>                Language query value, default zh-CN;q=0.9, zh;q=0.8.

Downloads from an already-open EBSCO viewer tab in the user's authenticated Chrome session.
It does not read cookies, passwords, local storage, or browser profile files.`);
}

function parseArgs(argv) {
  const args = {
    debug: "http://127.0.0.1:9333",
    profile: "jgm366",
    lang: "zh-CN;q=0.9, zh;q=0.8",
    chunkSize: 524288,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--record-id") args.recordId = argv[++i];
    else if (a === "--source-record-id") args.sourceRecordId = argv[++i];
    else if (a === "--full-text-record-id") args.fullTextRecordId = argv[++i];
    else if (a === "--profile") args.profile = argv[++i];
    else if (a === "--debug") args.debug = argv[++i].replace(/\/$/, "");
    else if (a === "--target") args.target = argv[++i];
    else if (a === "--viewer-url") args.viewerUrl = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--lang") args.lang = argv[++i];
    else if (a === "--chunk-size") args.chunkSize = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${a}`);
  }
  args.sourceRecordId ||= args.recordId;
  return args;
}

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 60000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close() {
        ws.close();
      },
    });
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
    };
    ws.onerror = reject;
  });
}

async function evaluate(cdp, expression, timeoutMs = 120000) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: timeoutMs,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

function pdfMeta(bytes, extra = {}) {
  return {
    ...extra,
    size: bytes.length,
    head: Array.from(bytes.slice(0, 12)),
    signature: Buffer.from(bytes.slice(0, 4)).toString("ascii"),
  };
}

async function fetchPdfInPage(cdp, url) {
  const init = await evaluate(cdp, `(
    async () => {
      const r = await fetch(${JSON.stringify(url)}, { credentials: "include" });
      const ab = await r.arrayBuffer();
      const bytes = new Uint8Array(ab);
      window.__hfutEbscoPdfBytes = bytes;
      return {
        ok: r.ok,
        status: r.status,
        statusText: r.statusText,
        contentType: r.headers.get("content-type") || "",
        url: r.url,
        size: bytes.length,
        head: Array.from(bytes.slice(0, 12)),
        text: new TextDecoder().decode(bytes.slice(0, 120))
      };
    }
  )()`);
  const signature = Buffer.from(init.head || []).subarray(0, 4).toString("ascii");
  if (!init.ok || signature !== "%PDF") return null;
  return init;
}

async function readPageBytes(cdp, size, chunkSize) {
  const chunks = [];
  for (let start = 0; start < size; start += chunkSize) {
    const end = Math.min(start + chunkSize, size);
    const b64 = await evaluate(cdp, `(
      () => {
        const bytes = window.__hfutEbscoPdfBytes.slice(${start}, ${end});
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
      }
    )()`);
    chunks.push(Buffer.from(b64, "base64"));
  }
  return Buffer.concat(chunks);
}

async function findTab(args) {
  const tabs = await json(`${args.debug}/json/list`, { timeoutMs: 10000 });
  if (args.target) {
    const tab = tabs.find((t) => t.id === args.target);
    if (!tab) throw new Error(`Target not found: ${args.target}`);
    return tab;
  }
  const needle = args.viewerUrl || `/viewer/pdf/${args.sourceRecordId}`;
  const tab = tabs.find((t) => t.url?.includes(needle)) ||
    tabs.find((t) => t.url?.includes("research.ebsco.com") && t.url?.includes("/viewer/pdf/"));
  if (!tab) throw new Error(`No EBSCO viewer tab found. Open the EBSCO PDF viewer first; looked for ${needle}`);
  return tab;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return usage();
  if (!args.recordId) throw new Error("--record-id is required");
  if (!args.out) throw new Error("--out is required");

  const tab = await findTab(args);
  const cdp = await connect(tab.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");

  const q = new URLSearchParams({
    recordId: args.recordId,
    sourceRecordId: args.sourceRecordId,
    profileIdentifier: args.profile,
    intent: "download",
    lang: args.lang,
  });
  const directUrl = `https://research.ebsco.com/linkprocessor/v2-pdf?${q}`;
  let meta = await fetchPdfInPage(cdp, directUrl);
  let bytes = null;

  if (meta) {
    bytes = await readPageBytes(cdp, meta.size, args.chunkSize);
  } else {
    let fullTextUrl = null;
    if (args.fullTextRecordId) {
      const q2 = new URLSearchParams({
        recordId: args.fullTextRecordId,
        sourceRecordId: args.sourceRecordId,
        restriction: "",
        profileIdentifier: args.profile,
        intent: "view",
        type: "pdfLink",
        lang: args.lang,
      });
      fullTextUrl = `https://research.ebsco.com/linkprocessor/v2-pdf-full-text?${q2}`;
    } else {
      const urls = await evaluate(cdp, `JSON.stringify(
        performance.getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.includes("linkprocessor/v2-pdf-full-text"))
          .slice(-10)
      )`);
      fullTextUrl = JSON.parse(urls).at(-1);
    }
    if (!fullTextUrl) throw new Error("Direct EBSCO PDF failed and no v2-pdf-full-text URL was found in the viewer tab.");
    const linkInfo = await evaluate(cdp, `(
      async () => {
        const r = await fetch(${JSON.stringify(fullTextUrl)}, { credentials: "include" });
        const text = await r.text();
        return { ok: r.ok, status: r.status, contentType: r.headers.get("content-type") || "", text };
      }
    )()`);
    if (!linkInfo.ok) throw new Error(`v2-pdf-full-text failed: ${JSON.stringify(linkInfo)}`);
    const contentUrl = JSON.parse(linkInfo.text).url;
    const response = await fetch(contentUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/pdf,application/octet-stream,*/*",
        "Referer": "https://research.ebsco.com/",
      },
      signal: AbortSignal.timeout(120000),
    });
    bytes = Buffer.from(await response.arrayBuffer());
    meta = pdfMeta(bytes, {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      url: response.url,
      sourceUrl: fullTextUrl,
    });
    if (!response.ok || meta.signature !== "%PDF") {
      throw new Error(`EBSCO content URL did not return a PDF: ${JSON.stringify(meta)}`);
    }
  }

  cdp.close();
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, bytes);
  const saved = fs.readFileSync(args.out);
  const result = {
    out: path.resolve(args.out),
    bytes: saved.length,
    sourceUrl: meta.url,
    contentType: meta.contentType,
    signature: saved.subarray(0, 4).toString("ascii"),
    pdf: saved.subarray(0, 4).toString("ascii") === "%PDF",
    viewerUrl: tab.url,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
