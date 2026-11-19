/* GitHub Pages 静态模式数据层：localStorage 持久化 + 内置快照；业务代码无需改动 */
(function () {
  const TABLES = {
    geo_keywords: "keywords", prompt_templates: "templates", geo_contents: "contents",
    channels: "channels", distributions: "distributions", monitor_records: "monitor",
    nap_branches: "nap", inquiries: "inquiries"
  };
  const KEY = "geo_demo_static_v1";
  let store = null;

  function load() {
    if (store) return store;
    try {
      const raw = localStorage.getItem(KEY);
      store = raw ? JSON.parse(raw) : null;
    } catch (e) { store = null; }
    if (!store) {
      store = {};
      Object.entries(TABLES).forEach(([dbT, snapT]) => {
        store[dbT] = JSON.parse(JSON.stringify(window.SNAPSHOT[snapT] || []));
      });
      save();
    }
    return store;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { /* 存储容量不足时仅内存运行 */ }
  }
  function rows(t) { return load()[t] || []; }

  const db = {
    async list(table, opts) {
      opts = opts || {};
      let out = rows(table).slice();
      if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) out = out.filter(r => r[k] === v);
      if (opts.in) for (const [k, v] of Object.entries(opts.in)) out = out.filter(r => v.includes(r[k]));
      if (opts.order) {
        const c = opts.order.col;
        out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (opts.order.asc === false ? -1 : 1));
      }
      if (opts.limit) out = out.slice(0, opts.limit);
      return out;
    },
    async listAll(table, order) {
      let out = rows(table).slice();
      if (order) out.sort((a, b) => (a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0));
      return out;
    },
    async count(table) { return rows(table).length; },
    async insert(table, row) {
      const arr = rows(table);
      const id = arr.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
      const rec = Object.assign({ id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, row);
      arr.push(rec); save(); return rec;
    },
    async insertMany(table, list) { return Promise.all(list.map(r => db.insert(table, r))); },
    async update(table, id, patch) {
      const arr = rows(table); const i = arr.findIndex(r => r.id === Number(id));
      if (i < 0) throw new Error("记录不存在");
      arr[i] = Object.assign({}, arr[i], patch, { updated_at: new Date().toISOString() });
      save(); return arr[i];
    },
    async remove(table, id) {
      const arr = rows(table); const i = arr.findIndex(r => r.id === Number(id));
      if (i < 0) return [];
      const removed = arr.splice(i, 1); save(); return removed;
    }
  };

  /* 静态演示：模板拼装示例输出，保留流式体验，不调用真实模型 */
  const llm = {
    models: { list: async () => [{ id: "static-demo", name: "静态演示模式" }] },
    async generate({ system, user, onDelta }) {
      const kw = (user.match(/目标问题：「([^」]+)」/) || [])[1] || "该法律问题";
      const region = (user.match(/地域：([^，。]+)/) || [])[1] || "郑州";
      const text = "结论：" + kw + "应结合具体证据与本地实务判断，建议咨询执业律师评估。\n"
        + "依据：以现行法律法规及司法解释为准，各地裁判尺度存在差异。\n"
        + "在" + region + "办理时，建议先确认管辖机关与时效要求，整理合同、转账记录、聊天记录等证据材料。\n"
        + "行动建议：携带完整材料到正规律所当面咨询，由执业律师评估可行路径。\n"
        + "本文仅为普法参考，不构成法律意见，具体案件建议咨询执业律师。";
      if (onDelta) {
        let i = 0;
        const timer = setInterval(() => {
          if (i >= text.length) { clearInterval(timer); return; }
          onDelta(text.slice(i, i + 6), text.slice(0, i + 6)); i += 6;
        }, 12);
        await new Promise(r => setTimeout(r, text.length / 6 * 12 + 60));
      }
      return text;
    }
  };

  window.DAL = {
    init() { load(); return { static: true }; },
    getCloud() { return { database: db, llm }; },
    db, llm,
    staticMode: true,
    reset() { localStorage.removeItem(KEY); store = null; load(); }
  };
})();
