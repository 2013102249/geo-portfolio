window.Views = window.Views || {};
/* GEO词库管理 —— 三级标签 / 状态流转 / 优先级评分 */
(function () {
  const { esc, badge, fmtTime, toast, modal, confirmBox } = UI;
  const C = window.CONST;
  let state = { rows: [], filters: { q: "", region: "", caseType: "", wordType: "", status: "" } };

  Views.keywords = {
    title: "GEO词库管理",
    desc: "地域 × 案由 × 词型 三级标签 · 五段状态流转",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载词库…</div>';
      state.rows = await DAL.db.listAll("geo_keywords", "priority");
      state.rows.reverse(); // 优先级高的在前
      draw(root);
    }
  };

  function draw(root) {
    const f = state.filters;
    const rows = state.rows.filter(r =>
      (!f.q || r.keyword.includes(f.q)) &&
      (!f.region || r.region === f.region) &&
      (!f.caseType || r.case_type === f.caseType) &&
      (!f.wordType || r.word_type === f.wordType) &&
      (!f.status || r.status === f.status)
    );
    const cnt = s => state.rows.filter(r => r.status === s).length;

    root.innerHTML = `
      <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
        <div>词库是 GEO 运营的<b>弹药库</b>：优先级评分 = 意向强度×50% + 转化预估×35% + 竞争度反向×15%。状态流转：<b>待生产 → 已生产 → 已分发 → 已监测 → 待优化</b>，点击状态徽章可直接流转。</div></div>

      <div class="toolbar">
        <div class="seg">
          ${["全部", ...C.KW_STATUS].map(s => `<button data-st="${s}" class="${f.status === (s === "全部" ? "" : s) ? "on" : ""}">${s}${s !== "全部" ? " " + cnt(s) : ""}</button>`).join("")}
        </div>
        <div class="spacer"></div>
        <input class="filter search" id="f-q" placeholder="搜索问题关键词…" value="${esc(f.q)}">
        <select class="filter" id="f-region"><option value="">全部地域</option>${C.REGIONS.map(r => `<option ${f.region === r ? "selected" : ""}>${r}</option>`).join("")}</select>
        <select class="filter" id="f-case"><option value="">全部案由</option>${C.CASE_TYPES.map(r => `<option ${f.caseType === r ? "selected" : ""}>${r}</option>`).join("")}</select>
        <select class="filter" id="f-type"><option value="">全部词型</option>${C.WORD_TYPES.map(r => `<option ${f.wordType === r ? "selected" : ""}>${r}</option>`).join("")}</select>
        <button class="btn" id="btn-suggest">AI抓词建议</button>
        <button class="btn btn-primary" id="btn-add">＋ 新增词条</button>
      </div>

      <div class="card">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th style="width:30%">目标问题</th><th>三级标签</th><th>优先级</th><th>状态</th><th>来源</th><th>更新时间</th><th style="width:130px">操作</th></tr></thead>
          <tbody>${rows.length ? rows.map(rowHtml).join("") : '<tr><td colspan="7" class="empty">没有符合条件的词条</td></tr>'}</tbody>
        </table></div>
        <div style="margin-top:10px;font-size:12px;color:var(--text3)">共 ${rows.length} 条（词库总量 ${state.rows.length}，一期目标 500+）</div>
      </div>`;

    bind(root);
  }

  function rowHtml(r) {
    const p = r.priority || 0;
    const cls = p >= 80 ? "high" : p >= 60 ? "mid" : "low";
    const color = p >= 80 ? "linear-gradient(90deg,#F59E0B,#EF4444)" : p >= 60 ? "linear-gradient(90deg,#7C3AED,#2563EB)" : "#94A3B8";
    return `<tr data-id="${r.id}">
      <td><div class="cell-main truncate" title="${esc(r.keyword)}">${esc(r.keyword)}</div><div class="cell-sub">${esc(r.note || "")}</div></td>
      <td><span class="pill gray">${esc(r.region)}</span> <span class="pill">${esc(r.case_type)}</span><div class="cell-sub" style="margin-top:3px">${esc(r.word_type)}</div></td>
      <td><div class="prio"><b style="color:${p >= 80 ? "#EF4444" : "var(--text)"}">${p}</b><div class="prio-bar"><i class="${cls}" style="width:${p}%;background:${color}"></i></div></div></td>
      <td><span class="badge status-badge" style="cursor:pointer" title="点击流转到下一状态">${badge(r.status)}</span></td>
      <td style="font-size:12px;color:var(--text2)">${esc(r.source)}</td>
      <td class="num" style="font-size:12px">${fmtTime(r.updated_at || r.created_at)}</td>
      <td>
        <button class="btn btn-sm" data-act="gen" title="跳转内容工厂生成词条">生成</button>
        <button class="btn btn-sm" data-act="edit">编辑</button>
        <button class="btn btn-sm btn-ghost" data-act="del" style="color:var(--danger)">删除</button>
      </td></tr>`;
  }

  function bind(root) {
    const f = state.filters;
    root.querySelector("#f-q").oninput = e => { f.q = e.target.value.trim(); draw(root); };
    root.querySelector("#f-region").onchange = e => { f.region = e.target.value; draw(root); };
    root.querySelector("#f-case").onchange = e => { f.caseType = e.target.value; draw(root); };
    root.querySelector("#f-type").onchange = e => { f.wordType = e.target.value; draw(root); };
    root.querySelectorAll(".seg button").forEach(b => b.onclick = () => { f.status = b.dataset.st === "全部" ? "" : b.dataset.st; draw(root); });

    root.querySelector("#btn-add").onclick = () => editModal(root, null);
    root.querySelector("#btn-suggest").onclick = () => suggestModal(root);

    root.querySelectorAll("tr[data-id]").forEach(tr => {
      const id = Number(tr.dataset.id);
      const row = state.rows.find(r => r.id === id);
      tr.querySelector("[data-act=gen]").onclick = () => { location.hash = "#contents?kw=" + id; };
      tr.querySelector("[data-act=edit]").onclick = () => editModal(root, row);
      tr.querySelector("[data-act=del]").onclick = () => confirmBox("删除词条", "确认删除词条「<b>" + esc(row.keyword) + "</b>」？该操作不可恢复。", async () => {
        try { await DAL.db.remove("geo_keywords", id); toast("词条已删除", "success"); Views.keywords.render(root); }
        catch (e) { toast("删除失败：" + e.message, "error"); }
      });
      tr.querySelector(".status-badge").onclick = async () => {
        const i = C.KW_STATUS.indexOf(row.status);
        const next = C.KW_STATUS[(i + 1) % C.KW_STATUS.length];
        try {
          await DAL.db.update("geo_keywords", id, { status: next, updated_at: new Date().toISOString() });
          row.status = next; toast("「" + esc(row.keyword) + "」→ " + next, "success"); draw(root);
        } catch (e) { toast("状态流转失败：" + e.message, "error"); }
      };
    });
  }

  function editModal(root, row) {
    const isEdit = !!row;
    const r = row || { keyword: "", region: "郑州", case_type: "劳动争议", word_type: "疑问长尾词", status: "待生产", intention: 70, competition: 50, conversion_est: 60, source: "手动录入", note: "" };
    const m = modal({
      title: isEdit ? "编辑词条" : "新增词条", size: "wide", foot: false,
      body: `
        <div class="form-row"><div class="form-item" style="flex:3"><label>目标问题 *</label><input id="m-kw" value="${esc(r.keyword)}" placeholder="例：郑州劳动纠纷律师哪家好"></div>
          <div class="form-item"><label>来源</label><select id="m-src">${["手动录入", "咨询记录导入", "AI提问抓取"].map(s => `<option ${r.source === s ? "selected" : ""}>${s}</option>`).join("")}</select></div></div>
        <div class="form-row">
          <div class="form-item"><label>地域</label><select id="m-region">${C.REGIONS.map(s => `<option ${r.region === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div class="form-item"><label>案由</label><select id="m-case">${C.CASE_TYPES.map(s => `<option ${r.case_type === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div class="form-item"><label>词型</label><select id="m-type">${C.WORD_TYPES.map(s => `<option ${r.word_type === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div class="form-item"><label>状态</label><select id="m-status">${C.KW_STATUS.map(s => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        </div>
        <div class="form-row">
          ${slider("意向强度", "m-itn", r.intention)}${slider("竞争度", "m-comp", r.competition)}${slider("转化预估", "m-conv", r.conversion_est)}
        </div>
        <div class="form-item"><label>备注</label><input id="m-note" value="${esc(r.note || "")}" placeholder="采集背景、搜索意图说明等（可选）"></div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--primary-soft);border-radius:10px;font-size:13px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--text2)">优先级评分（意向50% + 转化35% + 竞争反向15%）</span>
          <b id="m-prio" style="font-size:20px;color:var(--primary)">${r.priority || Compliance.priorityScore(r.intention, r.competition, r.conversion_est)}</b>
        </div>
        <div class="modal-foot" style="border:none;padding:14px 0 0">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-primary" data-act="save">${isEdit ? "保存修改" : "加入词库"}</button>
        </div>`
    });
    const upd = () => { m.querySelector("#m-prio").textContent = Compliance.priorityScore(+m.querySelector("#m-itn").value, +m.querySelector("#m-comp").value, +m.querySelector("#m-conv").value); };
    m.querySelectorAll("input[type=range]").forEach(i => i.oninput = upd);
    m.querySelector("[data-act=cancel]").onclick = () => m.close();
    m.querySelector("[data-act=save]").onclick = async () => {
      const kw = m.querySelector("#m-kw").value.trim();
      if (!kw) return toast("请填写目标问题", "warn");
      const payload = {
        keyword: kw, region: m.querySelector("#m-region").value, case_type: m.querySelector("#m-case").value,
        word_type: m.querySelector("#m-type").value, status: m.querySelector("#m-status").value, source: m.querySelector("#m-src").value,
        note: m.querySelector("#m-note").value.trim(),
        intention: +m.querySelector("#m-itn").value, competition: +m.querySelector("#m-comp").value, conversion_est: +m.querySelector("#m-conv").value,
        priority: Compliance.priorityScore(+m.querySelector("#m-itn").value, +m.querySelector("#m-comp").value, +m.querySelector("#m-conv").value),
        updated_at: new Date().toISOString()
      };
      try {
        if (isEdit) { await DAL.db.update("geo_keywords", r.id, payload); toast("词条已更新", "success"); }
        else { await DAL.db.insert("geo_keywords", payload); toast("词条已加入词库", "success"); }
        m.close(); Views.keywords.render(root);
      } catch (e) { toast("保存失败：" + e.message, "error"); }
    };
    setTimeout(() => m.querySelector("#m-kw").focus(), 50);
  }

  function slider(label, id, val) {
    return `<div class="form-item"><label>${label}</label><div class="range-wrap"><input type="range" id="${id}" min="1" max="100" value="${val}"><span class="range-val" id="${id}-v">${val}</span></div></div>`;
  }

  /* AI 抓词建议：调用 LLM 基于案由生成真实用户问法 */
  function suggestModal(root) {
    const m = modal({
      title: "AI 搜索真实提问抓取", size: "wide", foot: false,
      body: `
        <div class="form-row">
          <div class="form-item"><label>案由方向</label><select id="s-case">${C.CASE_TYPES.map(s => `<option>${s}</option>`).join("")}</select></div>
          <div class="form-item"><label>地域</label><select id="s-region">${C.REGIONS.map(s => `<option>郑州</option>`).join("")}</select></div>
          <div class="form-item" style="display:flex;align-items:flex-end"><button class="btn btn-primary" id="s-go" style="width:100%">生成抓词建议</button></div>
        </div>
        <div id="s-out" class="gen-output" style="min-height:90px">选择案由后点击生成，AI 将模拟本地用户真实搜索问法，供词库补充采集。</div>
        <div class="modal-foot" style="border:none;padding:14px 0 0"><button class="btn" data-act="close">关闭</button></div>`
    });
    m.querySelector("[data-act=close]").onclick = () => m.close();
    m.querySelector("#s-go").onclick = async () => {
      const btn = m.querySelector("#s-go");
      btn.disabled = true;
      const out = m.querySelector("#s-out");
      out.innerHTML = '<span class="spin"></span>AI 正在分析本地用户搜索习惯…';
      const caseType = m.querySelector("#s-case").value, region = m.querySelector("#s-region").value;
      try {
        const text = await DAL.llm.generate({
          system: "你是律所GEO运营专家，熟悉中文AI搜索（豆包/DeepSeek/文心一言）中普通用户的真实提问方式。只输出纯文本列表，不要Markdown。",
          user: `围绕「${region}+${caseType}」法律咨询场景，模拟10条用户在AI搜索中会真实输入的问题（口语化长尾为主），每行一条，不要编号符号，直接文字。`,
          temperature: 0.85
        });
        out.textContent = "";
        out.innerHTML = text.split("\n").filter(l => l.trim()).map(l =>
          `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dashed #EEECF7">
             <span>${esc(l.replace(/^[-\d.、\s]+/, ""))}</span>
             <button class="btn btn-sm" data-kw="${esc(l.replace(/^[-\d.、\s]+/, ""))}" data-case="${esc(caseType)}" data-region="${esc(region)}">＋入词库</button></div>`).join("");
        out.querySelectorAll("[data-kw]").forEach(b => b.onclick = async () => {
          const itn = 60 + Math.floor(Math.random() * 30), comp = 40 + Math.floor(Math.random() * 30), conv = 55 + Math.floor(Math.random() * 30);
          await DAL.db.insert("geo_keywords", {
            keyword: b.dataset.kw, region: b.dataset.region, case_type: b.dataset.case, word_type: "疑问长尾词",
            status: "待生产", source: "AI提问抓取", intention: itn, competition: comp, conversion_est: conv,
            priority: Compliance.priorityScore(itn, comp, conv), updated_at: new Date().toISOString()
          });
          b.textContent = "✓ 已入库"; b.disabled = true;
          toast("已加入词库", "success");
        });
      } catch (e) {
        out.innerHTML = '<span style="color:var(--danger)">生成失败：' + esc(e.message || "模型暂不可用") + '</span>';
      } finally { btn.disabled = false; }
    };
  }

  /* sliders 双向显示 */
  document.addEventListener("input", e => {
    const id = e.target.id || "";
    if (id.endsWith("-itn") || id.endsWith("-comp") || id.endsWith("-conv")) {
      const v = document.getElementById(id + "-v"); if (v) v.textContent = e.target.value;
    }
  });
})();
