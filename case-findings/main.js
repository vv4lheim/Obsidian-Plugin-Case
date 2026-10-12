"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CaseFindingsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/parser.ts
var ENTRY_RE = /^\s*(?:[-*+]\s+)?([A-Za-z0-9_][\w\-.]*)::\s*(.*?)\s*$/;
var WIKI_IMG_RE = /^!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/;
var MD_IMG_RE = /^!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;
var IMG_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i;
var FENCE_RE = /^\s*(```|~~~)/;
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildCalloutRegex(names) {
  const alt = names.map((n) => n.trim()).filter(Boolean).map(escapeRe).join("|");
  return new RegExp(`^\\s*>\\s*\\[!(?:${alt || "finding"})\\][+-]?\\s*(.*)$`, "i");
}
function stripQuote(line) {
  const m = /^\s*>\s?(.*)$/.exec(line);
  return m ? m[1] : null;
}
function cleanValue(v) {
  let s = v.trim();
  const bt = /^(`+)([\s\S]*?)\1$/.exec(s);
  if (bt) s = bt[2].trim();
  return s;
}
function detectImage(value) {
  const w = WIKI_IMG_RE.exec(value);
  if (w) return w[1].trim();
  const m = MD_IMG_RE.exec(value);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return void 0;
}
function parseEntry(text) {
  const m = ENTRY_RE.exec(text);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const rest = m[2];
  if (!rest) return null;
  let valuePart = rest;
  let comment = "";
  const sep = findSeparator(rest);
  if (sep >= 0) {
    valuePart = rest.slice(0, sep);
    comment = rest.slice(sep + 3).trim();
  }
  if (!comment) valuePart = valuePart.replace(/\s*\|\s*$/, "");
  const value = cleanValue(valuePart);
  if (!value) return null;
  const image = detectImage(value) ?? (type === "screen" && IMG_EXT_RE.test(value) ? value : void 0);
  return { type, value, comment, image };
}
function findSeparator(s) {
  let inCode = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "`") inCode = !inCode;
    else if (!inCode && c === "[" && s[i + 1] === "[") {
      depth++;
      i++;
    } else if (!inCode && c === "]" && s[i + 1] === "]" && depth > 0) {
      depth--;
      i++;
    } else if (!inCode && depth === 0 && c === " " && s[i + 1] === "|" && s[i + 2] === " ") {
      return i;
    }
  }
  return -1;
}
function splitTopLevel(s, sep) {
  const parts = [];
  let inCode = false;
  let depth = 0;
  let last = 0;
  for (let i = 0; i <= s.length - sep.length; i++) {
    const c = s[i];
    if (c === "`") inCode = !inCode;
    else if (!inCode && c === "[" && s[i + 1] === "[") {
      depth++;
      i++;
    } else if (!inCode && c === "]" && s[i + 1] === "]" && depth > 0) {
      depth--;
      i++;
    } else if (!inCode && depth === 0 && s.substr(i, sep.length) === sep) {
      parts.push(s.slice(last, i));
      i += sep.length - 1;
      last = i + 1;
    }
  }
  parts.push(s.slice(last));
  return parts;
}
function expandWith(inner) {
  if (!/\swith\s/i.test(inner)) return [inner];
  const segs = splitTopLevel(inner, " with ");
  if (segs.length < 2) return [inner];
  if (!segs.every((seg) => /[A-Za-z0-9_][\w\-.]*::/.test(seg))) return [inner];
  return segs.map((x) => x.trim());
}
function parseFindings(content, calloutNames = ["finding", "findings"]) {
  const out = [];
  const startRe = buildCalloutRegex(calloutNames);
  const lines = content.split(/\r?\n/);
  let inFenceOutside = false;
  let inCallout = false;
  let inFenceInside = false;
  let title = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inCallout) {
      if (FENCE_RE.test(line)) {
        inFenceOutside = !inFenceOutside;
        continue;
      }
      if (inFenceOutside) continue;
      const sm2 = startRe.exec(line);
      if (sm2) {
        inCallout = true;
        inFenceInside = false;
        title = sm2[1].trim();
        const e = parseEntry(title);
        if (e) {
          out.push({ ...e, line: i, calloutTitle: "" });
          title = "";
        }
      }
      continue;
    }
    const inner = stripQuote(line);
    if (inner === null) {
      inCallout = false;
      inFenceInside = false;
      i--;
      continue;
    }
    const sm = startRe.exec(line);
    if (sm && !inFenceInside) {
      title = sm[1].trim();
      const e = parseEntry(title);
      if (e) {
        out.push({ ...e, line: i, calloutTitle: "" });
        title = "";
      }
      continue;
    }
    if (FENCE_RE.test(inner)) {
      inFenceInside = !inFenceInside;
      continue;
    }
    if (inFenceInside) continue;
    if (/^\s*>/.test(inner)) continue;
    const segs = expandWith(inner);
    if (segs.length > 1) {
      for (const seg of segs) {
        const e = parseEntry(seg);
        if (e) out.push({ ...e, line: i, calloutTitle: title, tuple: true });
      }
    } else {
      const e = parseEntry(inner);
      if (e) out.push({ ...e, line: i, calloutTitle: title });
    }
  }
  return out;
}
function normalizeCases(raw) {
  if (raw === void 0 || raw === null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((v) => v === null || v === void 0 ? "" : String(v).trim()).map((v) => v.replace(/^\[\[|\]\]$/g, "")).filter((v) => v.length > 0);
}
var PIVOT_TYPES = /* @__PURE__ */ new Set(["pivot", "pivots", "pivote", "pivotto", "next"]);
var ID_TYPES = /* @__PURE__ */ new Set(["id", "node", "nodeid"]);
function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function parseGraph(content, fileKey, calloutNames = ["finding", "findings"]) {
  const nodes = [];
  const edges = [];
  const startRe = buildCalloutRegex(calloutNames);
  const lines = content.split(/\r?\n/);
  let inFenceOutside = false;
  let cur = null;
  let curExplicitId = null;
  let inFenceInside = false;
  const flush = () => {
    if (cur) {
      cur.id = curExplicitId || (cur.label ? `${fileKey}/${slug(cur.label)}` : `${fileKey}#${cur.line}`);
      nodes.push(cur);
    }
    cur = null;
    curExplicitId = null;
    inFenceInside = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!cur) {
      if (FENCE_RE.test(line)) {
        inFenceOutside = !inFenceOutside;
        continue;
      }
      if (inFenceOutside) continue;
      const sm = startRe.exec(line);
      if (sm) {
        cur = { id: "", label: sm[1].trim(), line: i, findings: [] };
      }
      continue;
    }
    const inner = stripQuote(line);
    if (inner === null) {
      flush();
      i--;
      continue;
    }
    if (startRe.test(line) && !inFenceInside) {
      const sm = startRe.exec(line);
      flush();
      cur = { id: "", label: sm[1].trim(), line: i, findings: [] };
      continue;
    }
    if (FENCE_RE.test(inner)) {
      inFenceInside = !inFenceInside;
      continue;
    }
    if (inFenceInside || /^\s*>/.test(inner)) continue;
    for (const seg of expandWith(inner)) {
      const e = parseEntry(seg);
      if (!e) continue;
      if (ID_TYPES.has(e.type)) {
        curExplicitId = e.value.trim();
      } else if (PIVOT_TYPES.has(e.type)) {
        edges.push({ to: e.value.trim(), label: e.comment, line: i, fromLine: cur.line });
      } else {
        cur.findings.push({ ...e, line: i, calloutTitle: cur.label, tuple: seg !== inner });
      }
    }
  }
  flush();
  const idByLine = /* @__PURE__ */ new Map();
  for (const n of nodes) idByLine.set(n.line, n.id);
  const resolved = edges.map((e) => ({
    from: idByLine.get(e.fromLine) ?? `${fileKey}#${e.fromLine}`,
    to: e.to,
    label: e.label,
    line: e.line
  }));
  return { nodes, edges: resolved };
}
function mergeGraphs(graphs) {
  const nodes = /* @__PURE__ */ new Map();
  const edges = [];
  for (const g of graphs) {
    for (const n of g.nodes) {
      const prev = nodes.get(n.id);
      if (prev) prev.findings.push(...n.findings);
      else nodes.set(n.id, { ...n, findings: [...n.findings] });
    }
    edges.push(...g.edges);
  }
  for (const e of edges) {
    for (const id of [e.from, e.to]) {
      if (!nodes.has(id)) nodes.set(id, { id, label: id, line: -1, findings: [] });
    }
  }
  return { nodes: [...nodes.values()], edges };
}
function layoutGraph(graph) {
  const idset = new Set(graph.nodes.map((n) => n.id));
  const out = /* @__PURE__ */ new Map();
  const indeg = /* @__PURE__ */ new Map();
  for (const n of graph.nodes) {
    out.set(n.id, []);
    indeg.set(n.id, 0);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const e of graph.edges) {
    if (!idset.has(e.from) || !idset.has(e.to)) continue;
    const key = e.from + "\0" + e.to;
    if (seen.has(key)) continue;
    seen.add(key);
    out.get(e.from).push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const layer = /* @__PURE__ */ new Map();
  const queue = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  for (const id of queue) layer.set(id, 0);
  const deg = new Map(indeg);
  const q = [...queue];
  let processed = 0;
  while (q.length) {
    const id = q.shift();
    processed++;
    for (const t of out.get(id) ?? []) {
      layer.set(t, Math.max(layer.get(t) ?? 0, (layer.get(id) ?? 0) + 1));
      deg.set(t, (deg.get(t) ?? 0) - 1);
      if ((deg.get(t) ?? 0) === 0) q.push(t);
    }
  }
  if (processed < graph.nodes.length) {
    for (const n of graph.nodes) if (!layer.has(n.id)) layer.set(n.id, 0);
    for (let pass = 0; pass < graph.nodes.length; pass++) {
      for (const e of graph.edges) {
        if (!idset.has(e.from) || !idset.has(e.to)) continue;
        const want = (layer.get(e.from) ?? 0) + 1;
        if ((layer.get(e.to) ?? 0) < want) layer.set(e.to, want);
      }
    }
  }
  const byCol = /* @__PURE__ */ new Map();
  const laid = graph.nodes.map((n) => {
    const col = layer.get(n.id) ?? 0;
    const arr = byCol.get(col) ?? [];
    const node = { ...n, col, row: arr.length };
    arr.push(node);
    byCol.set(col, arr);
    return node;
  });
  const cols = Math.max(0, ...laid.map((n) => n.col)) + 1;
  const rows = Math.max(1, ...[...byCol.values()].map((a) => a.length));
  return { nodes: laid, edges: graph.edges, cols, rows };
}

// src/main.ts
var VIEW_TYPE = "case-findings-view";
var ALL = "__all__";
var NONE = "__none__";
var DEFAULT_SETTINGS = {
  calloutNames: "finding, findings",
  followActiveNote: true,
  showThumbnails: true,
  caseField: "case",
  nodePositions: {}
};
var DEFAULT_TYPES = [
  "hash",
  "password",
  "user",
  "ip",
  "domain",
  "url",
  "email",
  "path",
  "file",
  "process",
  "port",
  "registry",
  "cmd",
  "flag",
  "screen",
  "note"
];
var TYPE_ICONS = {
  hash: "hash",
  password: "key",
  pass: "key",
  pwd: "key",
  mdp: "key",
  creds: "key",
  user: "user",
  username: "user",
  pseudo: "user",
  account: "user",
  ip: "network",
  domain: "globe",
  url: "link",
  link: "link",
  email: "mail",
  mail: "mail",
  path: "folder",
  file: "file",
  process: "cpu",
  port: "plug",
  registry: "database",
  cmd: "terminal",
  command: "terminal",
  flag: "flag",
  screen: "image",
  img: "image",
  image: "image",
  date: "calendar",
  time: "clock",
  note: "sticky-note"
};
function valueKey(v) {
  return v.trim().toLowerCase();
}
function hueOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) >>> 0;
  return h % 360;
}
var CaseFindingsPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.index = /* @__PURE__ */ new Map();
    this.fullyIndexed = false;
    this.refreshViews = (0, import_obsidian.debounce)(
      () => {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const v = leaf.view;
          if (v instanceof FindingsView) v.render();
        }
      },
      250,
      true
    );
    this.persistPositions = (0, import_obsidian.debounce)(() => void this.saveData(this.settings), 500, true);
  }
  async onload() {
    await this.loadSettings();
    new import_obsidian.Notice(`Case Findings ${this.manifest.version} charg\xE9`, 2500);
    this.registerView(VIEW_TYPE, (leaf) => new FindingsView(leaf, this));
    this.addRibbonIcon("crosshair", "Findings de l'enqu\xEAte", () => this.activateView("right"));
    this.addCommand({
      id: "open-findings-panel",
      name: "Afficher les findings (panneau lat\xE9ral)",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "f" }],
      callback: () => this.activateView("right")
    });
    this.addCommand({
      id: "open-findings-tab",
      name: "Afficher les findings dans un onglet (grand tableau)",
      callback: () => this.activateView("tab")
    });
    this.addCommand({
      id: "insert-finding-callout",
      name: "Ins\xE9rer un callout finding",
      editorCallback: (editor) => {
        const cur = editor.getCursor();
        const prefix = cur.ch === 0 ? "" : "\n";
        const text = `${prefix}> [!finding]
> type:: valeur | commentaire
`;
        editor.replaceRange(text, cur);
        const line = cur.line + (prefix ? 2 : 1);
        editor.setSelection({ line, ch: 2 }, { line, ch: 6 });
      }
    });
    this.addCommand({
      id: "selection-as-finding",
      name: "Ajouter la s\xE9lection comme finding",
      editorCheckCallback: (checking, editor) => {
        const sel = editor.getSelection().trim();
        if (!sel) return false;
        if (!checking) {
          new ChoiceModal(this.app, this.knownTypes(), "Type du finding (hash, password, user, ip\u2026)", (type) => {
            this.insertFindingAfterSelection(editor, type, sel);
          }).open();
        }
        return true;
      }
    });
    this.addCommand({
      id: "set-note-case",
      name: "Rattacher la note \xE0 une enqu\xEAte (case:)",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) {
          new ChoiceModal(this.app, this.allCases(), "Nom de l'enqu\xEAte (existante ou nouvelle)", async (c) => {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
              fm[this.settings.caseField] = c;
            });
            new import_obsidian.Notice(`Note rattach\xE9e \xE0 l'enqu\xEAte \xAB ${c} \xBB`);
          }).open();
        }
        return true;
      }
    });
    this.addSettingTab(new CaseFindingsSettingTab(this.app, this));
    this.registerMarkdownPostProcessor((el, ctx) => this.decorateCallouts(el, ctx));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file, data) => {
        void this.indexFile(file, data).then(() => this.refreshViews());
      })
    );
    const reindexOnModify = (0, import_obsidian.debounce)((file) => {
      void this.indexFile(file).then(() => this.refreshViews());
    }, 400, true);
    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (f instanceof import_obsidian.TFile && f.extension === "md") reindexOnModify(f);
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        if (!this.fullyIndexed) void this.reindexAll();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (f) => {
        if (this.index.delete(f.path)) this.refreshViews();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        const entry = this.index.get(oldPath);
        if (entry) {
          this.index.delete(oldPath);
          if (f instanceof import_obsidian.TFile) this.index.set(f.path, { ...entry, file: f });
          this.refreshViews();
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const v = leaf.view;
          if (v instanceof FindingsView) v.onActiveFileChanged();
        }
      })
    );
    this.app.workspace.onLayoutReady(() => void this.reindexAll());
  }
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.reindexAll();
  }
  setNodePosition(key, x, y) {
    this.settings.nodePositions[key] = { x, y };
    this.persistPositions();
  }
  clearNodePositions(prefix) {
    for (const k of Object.keys(this.settings.nodePositions)) if (k.startsWith(prefix)) delete this.settings.nodePositions[k];
    void this.saveData(this.settings);
  }
  calloutNames() {
    return this.settings.calloutNames.split(",").map((s) => s.trim()).filter(Boolean);
  }
  async reindexAll() {
    const files = this.app.vault.getMarkdownFiles();
    this.index.clear();
    await Promise.all(files.map((f) => this.indexFile(f)));
    this.fullyIndexed = true;
    this.refreshViews();
  }
  async indexFile(file, data) {
    if (file.extension !== "md") return;
    const cache = this.app.metadataCache.getFileCache(file);
    const cases = normalizeCases(cache?.frontmatter?.[this.settings.caseField]);
    let findings = [];
    let graph = { nodes: [], edges: [] };
    try {
      const content = data ?? await this.app.vault.cachedRead(file);
      if (content.includes("[!")) {
        const names = this.calloutNames();
        findings = parseFindings(content, names);
        graph = parseGraph(content, file.basename, names);
      }
    } catch (e) {
      console.error("[case-findings] lecture impossible", file.path, e);
    }
    if (findings.length || cases.length || graph.nodes.length) this.index.set(file.path, { file, cases, findings, graph });
    else this.index.delete(file.path);
  }
  allCases() {
    const s = /* @__PURE__ */ new Set();
    for (const n of this.index.values()) n.cases.forEach((c) => s.add(c));
    return [...s].sort((a, b) => a.localeCompare(b));
  }
  knownTypes() {
    const s = new Set(DEFAULT_TYPES);
    for (const n of this.index.values()) n.findings.forEach((f) => s.add(f.type));
    return [...s];
  }
  casesOf(file) {
    if (!file) return [];
    const cache = this.app.metadataCache.getFileCache(file);
    return normalizeCases(cache?.frontmatter?.[this.settings.caseField]);
  }
  graphForScope(scope) {
    const graphs = [];
    for (const n of this.index.values()) if (scope(n) && n.graph.nodes.length) graphs.push(n.graph);
    return mergeGraphs(graphs);
  }
  nodeFile(id) {
    for (const n of this.index.values()) if (n.graph.nodes.some((g) => g.id === id)) return n.file;
    return null;
  }
  rows() {
    const out = [];
    for (const n of this.index.values()) {
      for (const f of n.findings) out.push({ ...f, file: n.file, cases: n.cases, key: valueKey(f.value) });
    }
    return out;
  }
  decorateCallouts(el, ctx) {
    const names = this.calloutNames().map((n) => n.toLowerCase());
    const callouts = Array.from(el.querySelectorAll(".callout")).filter(
      (c) => names.includes((c.dataset.callout ?? "").toLowerCase())
    );
    if (!callouts.length) return;
    const info = ctx.getSectionInfo(el);
    if (!info || callouts.length !== 1) return;
    const callout = callouts[0];
    const content = callout.querySelector(":scope > .callout-content");
    if (!content) return;
    const src = info.text.split(/\r?\n/).slice(info.lineStart, info.lineEnd + 1);
    const body = [];
    const entries = [];
    src.slice(1).forEach((raw, i) => {
      const inner = raw.replace(/^\s*>\s?/, "");
      const e = /^\s*>/.test(inner) ? null : parseEntry(inner);
      if (e) entries.push({ line: info.lineStart + 1 + i, e });
      else body.push(inner);
    });
    if (!entries.length) return;
    content.empty();
    content.addClass("cf-callout-content");
    const list = content.createDiv({ cls: "cf-callout-list" });
    const child = new import_obsidian.MarkdownRenderChild(content);
    ctx.addChild(child);
    for (const { e } of entries) {
      const row = list.createDiv({ cls: "cf-callout-row" });
      const badge = row.createSpan({ cls: "cf-badge" });
      badge.style.setProperty("--cf-hue", String(hueOf(e.type)));
      (0, import_obsidian.setIcon)(badge.createSpan({ cls: "cf-badge-icon" }), TYPE_ICONS[e.type] ?? "tag");
      badge.createSpan({ text: e.type });
      const val = row.createDiv({ cls: "cf-callout-value" });
      if (e.image) {
        void import_obsidian.MarkdownRenderer.render(this.app, `![[${e.image}]]`, val, ctx.sourcePath, child);
      } else {
        const code = val.createEl("code", { cls: "cf-value", text: e.value, attr: { "aria-label": "Cliquer pour copier" } });
        code.addEventListener("click", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          navigator.clipboard.writeText(e.value).then(() => new import_obsidian.Notice(`Copi\xE9 : ${truncate(e.value, 40)}`));
        });
      }
      row.createDiv({ cls: "cf-callout-comment", text: e.comment });
    }
    const rest = body.join("\n").trim();
    if (rest) {
      const extra = content.createDiv({ cls: "cf-callout-extra" });
      void import_obsidian.MarkdownRenderer.render(this.app, rest, extra, ctx.sourcePath, child);
    }
  }
  insertFindingAfterSelection(editor, type, value) {
    const clean = value.replace(/\s*\n\s*/g, " ");
    const to = editor.getCursor("to");
    const lineText = editor.getLine(to.line);
    const prevIsFinding = /^\s*>/.test(lineText) && this.lineIsInFindingCallout(editor, to.line);
    const block = prevIsFinding ? `
> ${type}:: ${clean}` : `

> [!finding]
> ${type}:: ${clean}
`;
    editor.replaceRange(block, { line: to.line, ch: lineText.length });
    new import_obsidian.Notice(`Finding ajout\xE9 : ${type}`);
  }
  /** Vrai si la ligne fait partie d'un callout finding (on remonte jusqu'à son en-tête). */
  lineIsInFindingCallout(editor, line) {
    const names = this.calloutNames().map((n) => n.toLowerCase());
    for (let l = line; l >= 0; l--) {
      const t = editor.getLine(l);
      if (!/^\s*>/.test(t)) return false;
      const m = /^\s*>\s*\[!([^\]]+)\]/.exec(t);
      if (m) return names.includes(m[1].toLowerCase());
    }
    return false;
  }
  async activateView(where) {
    const { workspace } = this.app;
    let leaf = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (where === "right") {
      leaf = existing.find((l) => l.getRoot() === workspace.rightSplit) ?? null;
      if (!leaf) {
        leaf = workspace.getRightLeaf(false);
        if (!leaf) return;
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }
    } else {
      leaf = existing.find((l) => l.getRoot() === workspace.rootSplit) ?? null;
      if (!leaf) {
        leaf = workspace.getLeaf("tab");
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }
    }
    await workspace.revealLeaf(leaf);
    const v = leaf.view;
    if (v instanceof FindingsView) v.focusSearch();
  }
};
var FindingsView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.currentCase = ALL;
    this.search = "";
    this.typeFilter = "";
    this.sortKey = "source";
    this.sortAsc = true;
    this.mode = "table";
    this.gz = { scale: 1, x: 0, y: 0 };
    this.searchInput = null;
    this.plugin = plugin;
    this.follow = plugin.settings.followActiveNote;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return this.currentCase === ALL || this.currentCase === NONE ? "Findings" : `Findings \xB7 ${this.currentCase}`;
  }
  getIcon() {
    return "crosshair";
  }
  async onOpen() {
    this.pickCaseFromActive();
    this.render();
  }
  async onClose() {
    this.contentEl.empty();
  }
  focusSearch() {
    window.setTimeout(() => this.searchInput?.focus(), 50);
  }
  onActiveFileChanged() {
    if (!this.follow) return;
    if (this.pickCaseFromActive()) this.render();
  }
  /** Si la note active a un case:, on bascule dessus. Renvoie vrai si ça a changé. */
  pickCaseFromActive() {
    const cases = this.plugin.casesOf(this.app.workspace.getActiveFile());
    if (cases.length && !cases.includes(this.currentCase)) {
      this.currentCase = cases[0];
      this.typeFilter = "";
      return true;
    }
    return false;
  }
  scopePredicate() {
    if (this.currentCase === ALL) return () => true;
    if (this.currentCase === NONE) return (n) => n.cases.length === 0;
    return (n) => n.cases.includes(this.currentCase);
  }
  scopedRows(all) {
    const p = this.scopePredicate();
    return all.filter((r) => p(r));
  }
  matches(r) {
    if (this.typeFilter && r.type !== this.typeFilter) return false;
    if (!this.search) return true;
    const q = this.search.toLowerCase();
    return r.value.toLowerCase().includes(q) || r.comment.toLowerCase().includes(q) || r.type.includes(q) || r.file.basename.toLowerCase().includes(q) || r.calloutTitle.toLowerCase().includes(q);
  }
  sorted(rows) {
    const dir = this.sortAsc ? 1 : -1;
    const cmpSource = (a, b) => a.file.path.localeCompare(b.file.path) || a.line - b.line;
    return [...rows].sort((a, b) => {
      let c = 0;
      if (this.sortKey === "type") c = a.type.localeCompare(b.type) || cmpSource(a, b);
      else if (this.sortKey === "value") c = a.value.localeCompare(b.value) || cmpSource(a, b);
      else c = cmpSource(a, b);
      return c * dir;
    });
  }
  render() {
    const el = this.contentEl;
    const prevSearchFocused = document.activeElement === this.searchInput;
    const caret = this.searchInput?.selectionStart ?? null;
    el.empty();
    el.addClass("cf-view");
    const all = this.plugin.rows();
    const cases = this.plugin.allCases();
    if (this.currentCase !== ALL && this.currentCase !== NONE && !cases.includes(this.currentCase)) {
      this.currentCase = ALL;
    }
    const scoped = this.scopedRows(all);
    const visible = this.sorted(scoped.filter((r) => this.matches(r)));
    const notesByKey = /* @__PURE__ */ new Map();
    for (const r of scoped) {
      if (!notesByKey.has(r.key)) notesByKey.set(r.key, /* @__PURE__ */ new Set());
      notesByKey.get(r.key).add(r.file.path);
    }
    const casesByKey = /* @__PURE__ */ new Map();
    for (const r of all) {
      if (!casesByKey.has(r.key)) casesByKey.set(r.key, /* @__PURE__ */ new Set());
      r.cases.forEach((c) => casesByKey.get(r.key).add(c));
    }
    const header = el.createDiv({ cls: "cf-header" });
    const select = header.createEl("select", { cls: "dropdown cf-case-select" });
    const addOpt = (value, label) => {
      const o = select.createEl("option", { text: label, value });
      if (value === this.currentCase) o.selected = true;
    };
    addOpt(ALL, `Toutes les enqu\xEAtes`);
    for (const c of cases) addOpt(c, `\u{1F5C2} ${c}`);
    addOpt(NONE, "(notes sans case:)");
    select.addEventListener("change", () => {
      this.currentCase = select.value;
      this.typeFilter = "";
      this.render();
    });
    const followBtn = header.createEl("button", {
      cls: "clickable-icon cf-icon-btn" + (this.follow ? " is-active" : ""),
      attr: { "aria-label": this.follow ? "Suit la note active (cliquer pour figer)" : "Enqu\xEAte fig\xE9e (cliquer pour suivre la note active)" }
    });
    (0, import_obsidian.setIcon)(followBtn, this.follow ? "pin" : "pin-off");
    followBtn.addEventListener("click", () => {
      this.follow = !this.follow;
      if (this.follow) this.pickCaseFromActive();
      this.render();
    });
    const exportBtn = header.createEl("button", { cls: "clickable-icon cf-icon-btn", attr: { "aria-label": "Exporter" } });
    (0, import_obsidian.setIcon)(exportBtn, "download");
    exportBtn.addEventListener("click", (evt) => {
      const m = new import_obsidian.Menu();
      m.addItem(
        (i) => i.setTitle("Copier en tableau Markdown").setIcon("table").onClick(() => this.copy(toMarkdown(visible), "Tableau copi\xE9"))
      );
      m.addItem((i) => i.setTitle("Copier en CSV").setIcon("file-spreadsheet").onClick(() => this.copy(toCsv(visible), "CSV copi\xE9")));
      m.addItem(
        (i) => i.setTitle("Copier les valeurs uniquement").setIcon("list").onClick(() => this.copy([...new Set(visible.map((r) => r.value))].join("\n"), "Valeurs copi\xE9es"))
      );
      m.addSeparator();
      const txtLabel = this.typeFilter ? `T\xE9l\xE9charger les \xAB ${this.typeFilter} \xBB en .txt (1/ligne)` : "T\xE9l\xE9charger les valeurs en .txt (1/ligne)";
      m.addItem(
        (i) => i.setTitle(txtLabel).setIcon("file-down").onClick(() => {
          const values = [...new Set(visible.map((r) => r.value))];
          const scope = this.currentCase === ALL ? "all" : this.currentCase === NONE ? "sans-case" : this.currentCase;
          const name = `${scope}_${this.typeFilter || "findings"}.txt`.replace(/[^\w.-]+/g, "-");
          this.download(name, values.join("\n") + "\n");
        })
      );
      m.addSeparator();
      m.addItem(
        (i) => i.setTitle("Copier le graphe en Mermaid").setIcon("git-fork").onClick(() => this.copy(toMermaid(this.plugin.graphForScope(this.scopePredicate())), "Graphe Mermaid copi\xE9"))
      );
      m.showAtMouseEvent(evt);
    });
    const refreshBtn = header.createEl("button", { cls: "clickable-icon cf-icon-btn", attr: { "aria-label": "R\xE9indexer le vault" } });
    (0, import_obsidian.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => void this.plugin.reindexAll());
    const modeBtn = header.createEl("button", {
      cls: "clickable-icon cf-icon-btn",
      attr: { "aria-label": this.mode === "table" ? "Vue graphe (chemin d'attaque)" : "Vue tableau" }
    });
    (0, import_obsidian.setIcon)(modeBtn, this.mode === "table" ? "git-fork" : "table");
    modeBtn.addEventListener("click", () => {
      this.mode = this.mode === "table" ? "graph" : "table";
      this.render();
    });
    if (this.mode === "graph") {
      this.renderGraph(el);
      return;
    }
    const searchWrap = el.createDiv({ cls: "cf-search" });
    const input = searchWrap.createEl("input", {
      type: "search",
      placeholder: "Chercher une valeur, un commentaire, une note\u2026",
      value: this.search
    });
    this.searchInput = input;
    input.addEventListener("input", () => {
      this.search = input.value;
      this.render();
    });
    if (prevSearchFocused) {
      input.focus();
      if (caret !== null) input.setSelectionRange(caret, caret);
    }
    const sortSel = searchWrap.createEl("select", { cls: "dropdown cf-sort-select" });
    const sortOpts = [
      ["source", true, "Ordre du fichier"],
      ["type", true, "Par type"],
      ["value", true, "Valeur A\u2192Z"],
      ["value", false, "Valeur Z\u2192A"]
    ];
    for (const [k, asc, label] of sortOpts) {
      const o = sortSel.createEl("option", { text: label, value: `${k}:${asc}` });
      if (this.sortKey === k && this.sortAsc === asc) o.selected = true;
    }
    sortSel.addEventListener("change", () => {
      const [k, asc] = sortSel.value.split(":");
      this.sortKey = k;
      this.sortAsc = asc === "true";
      this.render();
    });
    const counts = /* @__PURE__ */ new Map();
    for (const r of scoped) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    const chips = el.createDiv({ cls: "cf-chips" });
    const mkChip = (type, label, n) => {
      const c = chips.createEl("button", { cls: "cf-chip" + (this.typeFilter === type ? " is-active" : "") });
      if (type) {
        c.style.setProperty("--cf-hue", String(hueOf(type)));
        const ic = c.createSpan({ cls: "cf-chip-icon" });
        (0, import_obsidian.setIcon)(ic, TYPE_ICONS[type] ?? "tag");
      }
      c.createSpan({ text: label });
      c.createSpan({ cls: "cf-chip-count", text: String(n) });
      c.addEventListener("click", () => {
        this.typeFilter = this.typeFilter === type ? "" : type;
        this.render();
      });
    };
    mkChip("", "Tout", scoped.length);
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).forEach(([t, n]) => mkChip(t, t, n));
    if (scoped.length === 0) {
      this.renderEmpty(el);
      return;
    }
    const table = el.createEl("table", { cls: "cf-table" });
    const thead = table.createEl("thead").createEl("tr");
    const th = (label, key, cls) => {
      const h = thead.createEl("th", { cls });
      h.createSpan({ text: label });
      if (key) {
        h.addClass("cf-sortable");
        if (this.sortKey === key) h.createSpan({ cls: "cf-sort", text: this.sortAsc ? " \u25B2" : " \u25BC" });
        h.addEventListener("click", () => {
          if (this.sortKey === key) this.sortAsc = !this.sortAsc;
          else {
            this.sortKey = key;
            this.sortAsc = true;
          }
          this.render();
        });
      }
    };
    th("Type", "type", "cf-col-type");
    th("Valeur", "value", "cf-col-value");
    th("Commentaire", null, "cf-col-comment");
    th("Source", "source", "cf-col-source");
    th("", null, "cf-col-actions");
    const tbody = table.createEl("tbody");
    const units = [];
    const unitIdx = /* @__PURE__ */ new Map();
    for (const r of visible) {
      if (r.tuple) {
        const k = r.file.path + ":" + r.line;
        const existing = unitIdx.get(k);
        if (existing !== void 0) {
          units[existing].push(r);
          continue;
        }
        unitIdx.set(k, units.length);
      }
      units.push([r]);
    }
    for (const u of units) {
      if (u.length === 1) this.renderRow(tbody, u[0], notesByKey, casesByKey);
      else this.renderTupleRow(tbody, u);
    }
    const footer = el.createDiv({ cls: "cf-footer" });
    footer.setText(`${visible.length} / ${scoped.length} findings \xB7 ${new Set(scoped.map((r) => r.file.path)).size} note(s)`);
  }
  renderRow(tbody, r, notesByKey, casesByKey) {
    const tr = tbody.createEl("tr");
    const tdType = tr.createEl("td", { cls: "cf-col-type" });
    const badge = tdType.createSpan({ cls: "cf-badge" });
    badge.style.setProperty("--cf-hue", String(hueOf(r.type)));
    (0, import_obsidian.setIcon)(badge.createSpan({ cls: "cf-badge-icon" }), TYPE_ICONS[r.type] ?? "tag");
    badge.createSpan({ text: r.type });
    const tdVal = tr.createEl("td", { cls: "cf-col-value" });
    const imgSrc = r.image && this.plugin.settings.showThumbnails ? this.resolveImage(r.image, r.file) : null;
    if (imgSrc) {
      const img = tdVal.createEl("img", { cls: "cf-thumb", attr: { src: imgSrc.src, alt: r.image ?? "", loading: "lazy" } });
      img.addEventListener("click", () => {
        if (imgSrc.file) void this.app.workspace.getLeaf("tab").openFile(imgSrc.file);
        else window.open(imgSrc.src);
      });
      tdVal.createDiv({ cls: "cf-thumb-name", text: r.image ?? "" });
    } else {
      const code = tdVal.createEl("code", { cls: "cf-value", text: r.value, attr: { "aria-label": "Cliquer pour copier" } });
      code.addEventListener("click", () => this.copy(r.value, `Copi\xE9 : ${truncate(r.value, 40)}`));
    }
    const nNotes = notesByKey.get(r.key)?.size ?? 1;
    const otherCases = [...casesByKey.get(r.key) ?? []].filter((c) => !r.cases.includes(c));
    if (nNotes > 1 || otherCases.length) {
      const links = tdVal.createDiv({ cls: "cf-links" });
      if (nNotes > 1) {
        const s = links.createSpan({ cls: "cf-dup", text: `\xD7${nNotes} notes` });
        s.setAttr("aria-label", "Cette valeur appara\xEEt dans plusieurs notes : clique pour filtrer");
        s.addEventListener("click", () => {
          this.search = r.value;
          this.typeFilter = "";
          this.render();
        });
      }
      if (otherCases.length) {
        const s = links.createSpan({ cls: "cf-cross", text: `\u2194 ${otherCases.join(", ")}` });
        s.setAttr("aria-label", "Valeur aussi pr\xE9sente dans une autre enqu\xEAte");
        s.addEventListener("click", () => {
          this.currentCase = otherCases[0];
          this.follow = false;
          this.search = r.value;
          this.typeFilter = "";
          this.render();
        });
      }
    }
    tr.createEl("td", { cls: "cf-col-comment", text: r.comment });
    const tdSrc = tr.createEl("td", { cls: "cf-col-source" });
    const a = tdSrc.createEl("a", { cls: "cf-source-link", text: `${r.file.basename}:${r.line + 1}`, href: "#" });
    a.setAttr("aria-label", r.file.path);
    a.addEventListener("click", (evt) => {
      evt.preventDefault();
      void this.openAt(r.file, r.line, import_obsidian.Keymap.isModEvent(evt));
    });
    if (r.calloutTitle) tdSrc.createDiv({ cls: "cf-callout-title", text: r.calloutTitle });
    const tdAct = tr.createEl("td", { cls: "cf-col-actions" });
    const copyBtn = tdAct.createEl("button", { cls: "clickable-icon cf-icon-btn", attr: { "aria-label": "Copier la valeur" } });
    (0, import_obsidian.setIcon)(copyBtn, "copy");
    copyBtn.addEventListener("click", () => this.copy(r.value, `Copi\xE9 : ${truncate(r.value, 40)}`));
  }
  renderGraph(el) {
    const graph = this.plugin.graphForScope(this.scopePredicate());
    const host = el.createDiv({ cls: "cf-graph-host" });
    if (!graph.nodes.length) {
      const box = host.createDiv({ cls: "cf-empty" });
      box.createEl("p", { text: "Aucune \xE9tape \xE0 afficher dans ce graphe." });
      box.createEl("p", { text: "Donne un id \xE0 une \xE9tape et relie-la \xE0 la suivante :" });
      box.createEl("pre").createEl("code", {
        text: "> [!finding] WordPress\n> id:: wordpress\n> url:: http://.../wp-admin | admin:admin\n> pivot:: webserver | upload plugin PHP (RCE)\n\n> [!finding] Serveur web\n> id:: webserver\n> cmd:: sudo -l | NOPASSWD vim"
      });
      return;
    }
    const lay = layoutGraph(graph);
    const NODE_W = 210;
    const NODE_H = 148;
    const COL = 290;
    const ROWH = 184;
    const PAD = 36;
    const posKey = (id) => `${this.currentCase}|${id}`;
    const pos = /* @__PURE__ */ new Map();
    for (const n of lay.nodes) {
      const saved = this.plugin.settings.nodePositions[posKey(n.id)];
      pos.set(n.id, {
        x: saved ? saved.x : PAD + n.col * COL,
        y: saved ? saved.y : PAD + n.row * ROWH,
        n
      });
    }
    const extent = () => {
      let w = 400;
      let h = 300;
      for (const p of pos.values()) {
        w = Math.max(w, p.x + NODE_W + PAD);
        h = Math.max(h, p.y + NODE_H + PAD);
      }
      return { w, h };
    };
    const bar = host.createDiv({ cls: "cf-graph-bar" });
    const mk = (icon, label, fn) => {
      const b = bar.createEl("button", { cls: "clickable-icon cf-icon-btn", attr: { "aria-label": label } });
      (0, import_obsidian.setIcon)(b, icon);
      b.addEventListener("click", fn);
    };
    const canvas = host.createDiv({ cls: "cf-graph-canvas" });
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cf-graph-svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    canvas.appendChild(svg);
    const defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML = '<marker id="cf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-accent)"></path></marker>';
    svg.appendChild(defs);
    const root = document.createElementNS(svgNS, "g");
    svg.appendChild(root);
    const edgeLayer = document.createElementNS(svgNS, "g");
    const nodeLayer = document.createElementNS(svgNS, "g");
    root.appendChild(edgeLayer);
    root.appendChild(nodeLayer);
    const apply = () => root.setAttribute("transform", `translate(${this.gz.x},${this.gz.y}) scale(${this.gz.scale})`);
    const fit = () => {
      const { w, h } = extent();
      const rect = canvas.getBoundingClientRect();
      const sc = Math.min((rect.width - 20) / w, (rect.height - 20) / h, 1.2);
      this.gz.scale = sc > 0 && isFinite(sc) ? sc : 1;
      this.gz.x = Math.max(10, (rect.width - w * this.gz.scale) / 2);
      this.gz.y = 16;
      apply();
    };
    const edgeEls = [];
    const redrawEdge = (ee) => {
      const a = pos.get(ee.e.from);
      const b = pos.get(ee.e.to);
      if (!a || !b) return;
      const x1 = a.x + NODE_W;
      const y1 = a.y + NODE_H / 2;
      const x2 = b.x;
      const y2 = b.y + NODE_H / 2;
      const dx = Math.max(40, Math.abs(x2 - x1) / 2);
      ee.path.setAttribute("d", `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      if (ee.label && ee.bg) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 6;
        ee.label.setAttribute("x", String(mx));
        ee.label.setAttribute("y", String(my));
        const bb = safeBBox(ee.label);
        ee.bg.setAttribute("x", String(bb.x - 4));
        ee.bg.setAttribute("y", String(bb.y - 2));
        ee.bg.setAttribute("width", String(bb.width + 8));
        ee.bg.setAttribute("height", String(bb.height + 4));
      }
    };
    for (const e of lay.edges) {
      if (!pos.has(e.from) || !pos.has(e.to)) continue;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("class", "cf-edge");
      path.setAttribute("marker-end", "url(#cf-arrow)");
      edgeLayer.appendChild(path);
      const ee = { e, path };
      if (e.label) {
        const bg = document.createElementNS(svgNS, "rect");
        bg.setAttribute("class", "cf-edge-label-bg");
        bg.setAttribute("rx", "3");
        const t = document.createElementNS(svgNS, "text");
        t.setAttribute("class", "cf-edge-label");
        t.setAttribute("text-anchor", "middle");
        t.textContent = e.label.length > 32 ? e.label.slice(0, 31) + "\u2026" : e.label;
        edgeLayer.appendChild(bg);
        edgeLayer.appendChild(t);
        ee.label = t;
        ee.bg = bg;
      }
      edgeEls.push(ee);
    }
    const foById = /* @__PURE__ */ new Map();
    for (const entry of pos.values()) {
      const { n } = entry;
      const fo = document.createElementNS(svgNS, "foreignObject");
      fo.setAttribute("x", String(entry.x));
      fo.setAttribute("y", String(entry.y));
      fo.setAttribute("width", String(NODE_W));
      fo.setAttribute("height", String(NODE_H));
      foById.set(n.id, fo);
      const card = document.createElement("div");
      card.className = "cf-gnode" + (n.line < 0 ? " cf-gnode-ghost" : "");
      card.style.setProperty("--cf-hue", String(hueOf(n.id)));
      const title = card.createDiv({ cls: "cf-gnode-title", text: n.label });
      if (n.line >= 0) {
        title.addClass("cf-clickable");
        title.setAttr("aria-label", "Ouvrir la note");
        title.addEventListener("click", (evt) => {
          evt.stopPropagation();
          const nf = this.plugin.nodeFile(n.id);
          if (nf) void this.openAt(nf, n.line, import_obsidian.Keymap.isModEvent(evt));
        });
      } else {
        card.createDiv({ cls: "cf-gnode-ghost-tag", text: "\xE0 documenter" });
      }
      const list = card.createDiv({ cls: "cf-gnode-findings" });
      for (const f of n.findings.slice(0, 5)) {
        const row = list.createDiv({ cls: "cf-gnode-finding" });
        const b = row.createSpan({ cls: "cf-gnode-ftype" });
        b.style.setProperty("--cf-hue", String(hueOf(f.type)));
        (0, import_obsidian.setIcon)(b.createSpan(), TYPE_ICONS[f.type] ?? "tag");
        const code = row.createEl("code", { cls: "cf-gnode-fval", text: truncate(f.value, 22), attr: { "aria-label": f.value + " (cliquer pour copier)" } });
        code.addEventListener("click", (evt) => {
          evt.stopPropagation();
          this.copy(f.value, `Copi\xE9 : ${truncate(f.value, 40)}`);
        });
      }
      if (n.findings.length > 5) list.createDiv({ cls: "cf-gnode-more", text: `+${n.findings.length - 5}` });
      fo.appendChild(card);
      nodeLayer.appendChild(fo);
      let moved = false;
      let startX = 0;
      let startY = 0;
      let origX = 0;
      let origY = 0;
      card.addEventListener("pointerdown", (ev) => {
        if (ev.target.closest("code")) return;
        ev.stopPropagation();
        moved = false;
        startX = ev.clientX;
        startY = ev.clientY;
        const cur = pos.get(n.id);
        origX = cur.x;
        origY = cur.y;
        card.setPointerCapture(ev.pointerId);
        card.addClass("cf-dragging");
      });
      card.addEventListener("pointermove", (ev) => {
        if (!card.hasPointerCapture(ev.pointerId)) return;
        const dx = (ev.clientX - startX) / this.gz.scale;
        const dy = (ev.clientY - startY) / this.gz.scale;
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 3) moved = true;
        const cur = pos.get(n.id);
        cur.x = origX + dx;
        cur.y = origY + dy;
        fo.setAttribute("x", String(cur.x));
        fo.setAttribute("y", String(cur.y));
        for (const ee of edgeEls) if (ee.e.from === n.id || ee.e.to === n.id) redrawEdge(ee);
      });
      const endDrag = (ev) => {
        if (!card.hasPointerCapture(ev.pointerId)) return;
        card.releasePointerCapture(ev.pointerId);
        card.removeClass("cf-dragging");
        if (moved) {
          const cur = pos.get(n.id);
          this.plugin.setNodePosition(posKey(n.id), Math.round(cur.x), Math.round(cur.y));
        }
      };
      card.addEventListener("pointerup", endDrag);
      card.addEventListener("pointercancel", endDrag);
    }
    for (const ee of edgeEls) redrawEdge(ee);
    mk("maximize", "Ajuster \xE0 la fen\xEAtre", fit);
    mk("zoom-in", "Zoom +", () => {
      this.gz.scale = Math.min(2.5, this.gz.scale * 1.2);
      apply();
    });
    mk("zoom-out", "Zoom \u2212", () => {
      this.gz.scale = Math.max(0.2, this.gz.scale / 1.2);
      apply();
    });
    mk("layout-grid", "R\xE9initialiser les positions", () => {
      this.plugin.clearNodePositions(`${this.currentCase}|`);
      this.render();
    });
    bar.createSpan({ cls: "cf-graph-hint", text: `${lay.nodes.length} \xE9tapes \xB7 glisse un n\u0153ud pour le d\xE9placer, le fond pour la vue, molette pour zoomer` });
    let panning = false;
    let sx = 0;
    let sy = 0;
    canvas.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest(".cf-gnode")) return;
      panning = true;
      sx = ev.clientX - this.gz.x;
      sy = ev.clientY - this.gz.y;
      canvas.setPointerCapture(ev.pointerId);
      canvas.addClass("is-dragging");
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!panning) return;
      this.gz.x = ev.clientX - sx;
      this.gz.y = ev.clientY - sy;
      apply();
    });
    const stop = () => {
      panning = false;
      canvas.removeClass("is-dragging");
    };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointerleave", stop);
    canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        const ns = Math.min(2.5, Math.max(0.2, this.gz.scale * factor));
        this.gz.x = mx - (mx - this.gz.x) * (ns / this.gz.scale);
        this.gz.y = my - (my - this.gz.y) * (ns / this.gz.scale);
        this.gz.scale = ns;
        apply();
      },
      { passive: false }
    );
    window.setTimeout(fit, 30);
  }
  renderTupleRow(tbody, members) {
    const first = members[0];
    const tr = tbody.createEl("tr", { cls: "cf-tuple-row" });
    const tdType = tr.createEl("td", { cls: "cf-col-type" });
    const badge = tdType.createSpan({ cls: "cf-badge cf-badge-tuple" });
    (0, import_obsidian.setIcon)(badge.createSpan({ cls: "cf-badge-icon" }), "link");
    badge.createSpan({ text: "tuple" });
    const tdVal = tr.createEl("td", { cls: "cf-col-value" });
    const grid = tdVal.createDiv({ cls: "cf-tuple-grid" });
    for (const m of members) {
      const field = grid.createDiv({ cls: "cf-tuple-field" });
      const b = field.createSpan({ cls: "cf-badge" });
      b.style.setProperty("--cf-hue", String(hueOf(m.type)));
      (0, import_obsidian.setIcon)(b.createSpan({ cls: "cf-badge-icon" }), TYPE_ICONS[m.type] ?? "tag");
      b.createSpan({ text: m.type });
      const code = field.createEl("code", { cls: "cf-value", text: m.value, attr: { "aria-label": "Cliquer pour copier" } });
      code.addEventListener("click", () => this.copy(m.value, `Copi\xE9 : ${truncate(m.value, 40)}`));
    }
    const comments = members.map((m) => m.comment).filter(Boolean).join(" \xB7 ");
    tr.createEl("td", { cls: "cf-col-comment", text: comments });
    const tdSrc = tr.createEl("td", { cls: "cf-col-source" });
    const a = tdSrc.createEl("a", { cls: "cf-source-link", text: `${first.file.basename}:${first.line + 1}`, href: "#" });
    a.addEventListener("click", (evt) => {
      evt.preventDefault();
      void this.openAt(first.file, first.line, import_obsidian.Keymap.isModEvent(evt));
    });
    const tdAct = tr.createEl("td", { cls: "cf-col-actions" });
    const copyBtn = tdAct.createEl("button", { cls: "clickable-icon cf-icon-btn", attr: { "aria-label": "Copier le tuple (k=v)" } });
    (0, import_obsidian.setIcon)(copyBtn, "copy");
    copyBtn.addEventListener("click", () => this.copy(members.map((m) => `${m.type}=${m.value}`).join(" | "), "Tuple copi\xE9"));
  }
  renderEmpty(el) {
    const box = el.createDiv({ cls: "cf-empty" });
    const label = this.currentCase === ALL ? "le vault" : this.currentCase === NONE ? "les notes sans case:" : `l'enqu\xEAte \xAB ${this.currentCase} \xBB`;
    box.createEl("p", { text: `Aucun finding dans ${label}.` });
    box.createEl("p", { text: "1. Rattache tes notes \xE0 une enqu\xEAte dans le frontmatter :" });
    box.createEl("pre").createEl("code", { text: "---\ncase: findme\n---" });
    box.createEl("p", { text: "2. Note tes trouvailles dans un callout :" });
    box.createEl("pre").createEl("code", {
      text: "> [!finding]\n> hash:: 47bf8039a8506cd67c524a03ff84ba4e | NT hash admin\n> password:: R3sqdl3F... | conteneur\n> screen:: ![[capture.png]]"
    });
    box.createEl("p", {
      cls: "cf-muted",
      text: "Astuce : s\xE9lectionne du texte puis lance \xAB Ajouter la s\xE9lection comme finding \xBB depuis la palette de commandes."
    });
  }
  resolveImage(link, from) {
    if (/^https?:\/\//i.test(link)) return { src: link, file: null };
    const f = this.app.metadataCache.getFirstLinkpathDest(link, from.path);
    if (!f) return null;
    return { src: this.app.vault.getResourcePath(f), file: f };
  }
  async openAt(file, line, where) {
    const leaf = this.app.workspace.getLeaf(where);
    await leaf.openFile(file, { active: true, eState: { line } });
    const view = leaf.view;
    if (view instanceof import_obsidian.MarkdownView && view.getMode() === "source") {
      const pos = { line, ch: 0 };
      view.editor.setCursor(pos);
      view.editor.scrollIntoView({ from: pos, to: pos }, true);
    }
  }
  copy(text, msg) {
    navigator.clipboard.writeText(text).then(
      () => new import_obsidian.Notice(msg),
      () => new import_obsidian.Notice("Impossible de copier dans le presse-papiers")
    );
  }
  download(filename, text) {
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1e3);
      new import_obsidian.Notice(`Fichier ${filename} t\xE9l\xE9charg\xE9`);
    } catch (e) {
      console.error("[case-findings] download", e);
      new import_obsidian.Notice("\xC9chec du t\xE9l\xE9chargement");
    }
  }
};
var ChoiceModal = class extends import_obsidian.SuggestModal {
  constructor(app, items, placeholder, onChoose) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder(placeholder);
  }
  getSuggestions(query) {
    const q = query.trim().toLowerCase();
    const res = this.items.filter((i) => i.toLowerCase().includes(q));
    if (q && !this.items.some((i) => i.toLowerCase() === q)) res.unshift(query.trim());
    return res;
  }
  renderSuggestion(value, el) {
    el.createSpan({ text: value });
    if (!this.items.includes(value)) el.createSpan({ cls: "cf-muted", text: "  (nouveau)" });
  }
  onChooseSuggestion(value) {
    this.onChoose(value);
  }
};
function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}
function mdCell(s) {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function toMarkdown(rows) {
  const lines = ["| Type | Valeur | Commentaire | Source |", "|---|---|---|---|"];
  for (const r of rows) {
    const val = r.image ? `![[${r.image}]]` : "`" + r.value.replace(/`/g, "'") + "`";
    lines.push(`| ${r.type} | ${mdCell(val)} | ${mdCell(r.comment)} | [[${r.file.basename}]] |`);
  }
  return lines.join("\n");
}
function csvCell(s) {
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function safeBBox(t) {
  try {
    return t.getBBox();
  } catch {
    return { x: 0, y: 0, width: 40, height: 14 };
  }
}
function mId(id) {
  return "n_" + id.replace(/[^a-zA-Z0-9]/g, "_");
}
function toMermaid(graph) {
  const lines = ["```mermaid", "flowchart LR"];
  for (const n of graph.nodes) {
    const label = (n.label || n.id).replace(/"/g, "'");
    lines.push(`    ${mId(n.id)}["${label}"]`);
  }
  for (const e of graph.edges) {
    const l = e.label ? `|"${e.label.replace(/"/g, "'")}"|` : "";
    lines.push(`    ${mId(e.from)} -->${l} ${mId(e.to)}`);
  }
  lines.push("```");
  return lines.join("\n");
}
function toCsv(rows) {
  const lines = ["type,value,comment,note,line,case"];
  for (const r of rows) {
    lines.push([r.type, r.value, r.comment, r.file.path, String(r.line + 1), r.cases.join("|")].map(csvCell).join(","));
  }
  return lines.join("\n");
}
var CaseFindingsSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Noms de callout reconnus").setDesc("S\xE9par\xE9s par des virgules. Ex : finding, findings, ioc").addText(
      (t) => t.setValue(this.plugin.settings.calloutNames).onChange(async (v) => {
        this.plugin.settings.calloutNames = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Champ du frontmatter pour l'enqu\xEAte").setDesc("Par d\xE9faut \xAB case \xBB. Accepte une valeur ou une liste (une note peut appartenir \xE0 plusieurs enqu\xEAtes).").addText(
      (t) => t.setValue(this.plugin.settings.caseField).onChange(async (v) => {
        this.plugin.settings.caseField = v.trim() || "case";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Suivre la note active").setDesc("Le panneau bascule automatiquement sur l'enqu\xEAte de la note ouverte.").addToggle(
      (t) => t.setValue(this.plugin.settings.followActiveNote).onChange(async (v) => {
        this.plugin.settings.followActiveNote = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Miniatures des captures").setDesc("Affiche les images (screen:: ![[...]]) directement dans le tableau.").addToggle(
      (t) => t.setValue(this.plugin.settings.showThumbnails).onChange(async (v) => {
        this.plugin.settings.showThumbnails = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
