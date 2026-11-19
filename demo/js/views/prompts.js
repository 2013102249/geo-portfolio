window.Views = window.Views || {};
/* 法律Prompt工程中心 —— 合规约束层 / 结构模板层 / 变量填充 / 版本管理 */
(function () {
  const { esc, toast, modal, fmtTime } = UI;
  let state = { rows: [], current: null };

  Views.prompts = {
    title: "法律Prompt工程中心",
    desc: "选模板 → 填变量 → 生成，合规红线内置于每个模板",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载模板库…</div>';
      state.rows = await DAL.db.listAll("prompt_templates", "id");
      state.current = state.current && state.rows.find(r => r.id === state.current.id) ? state.rows.find(r => r.id === state.current.id) : state.rows[0];
      draw(root);
    }
  };

  function draw(root) {
    const cur = state.current;
    const typeColor = { "FAQ短问答": "#7C3AED", "本地实务解读": "#2563EB", "律师IP观点": "#0891B2", "服务介绍": "#F59E0B" };
    root.innerHTML = `
      <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
        <div>所有模板内置<b>合规约束层</b>（禁承诺胜诉、案例脱敏、风险提示必备），生成时作为 System 指令注入大模型，运营师无法绕过。引用率高的模板版本会被优先推荐。</div></div>
      <div class="grid grid-12">
        <div class="card" style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <b style="font-size:13.5px">模板库（${state.rows.length}）</b>
            <button class="btn btn-sm btn-primary" id="btn-new">＋ 新建</button>
          </div>
          ${state.rows.map(t => `
            <div class="tpl-item ${cur && cur.id === t.id ? "on" : ""}" data-id="${t.id}" style="padding:11px 12px;border-radius:10px;cursor:pointer;border:1px solid ${cur && cur.id === t.id ? "#C9B8F5" : "transparent"};background:${cur && cur.id === t.id ? "var(--primary-soft)" : "transparent"};margin-bottom:6px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <b style="font-size:13px">${esc(t.name)}</b>
                <span class="pill" style="background:${(typeColor[t.tpl_type] || "#64748B")}18;color:${typeColor[t.tpl_type] || "#64748B"}">${esc(t.tpl_type)}</span>
              </div>
              <div style="font-size:11.5px;color:var(--text3);margin-top:4px;display:flex;gap:12px">
                <span>V${t.version}</span><span>已用 ${t.usage_count} 次</span><span>引用率 ${t.citation_rate}%</span>
              </div>
            </div>`).join("")}
        </div>
        <div class="card" id="tpl-detail">${cur ? detailHtml(cur) : '<div class="empty">暂无模板</div>'}</div>
      </div>`;

    root.querySelectorAll(".tpl-item").forEach(el => el.onclick = () => {
      state.current = state.rows.find(r => r.id === Number(el.dataset.id));
      draw(root);
    });
    const nb = root.querySelector("#btn-new"); if (nb) nb.onclick = () => editModal(root, null);
    if (cur) {
      const eb = root.querySelector("#btn-edit"); if (eb) eb.onclick = () => editModal(root, cur);
      const gb = root.querySelector("#btn-use"); if (gb) gb.onclick = () => { location.hash = "#contents?tpl=" + cur.id; };
      const cv = root.querySelector("#btn-copy"); if (cv) cv.onclick = () => {
        navigator.clipboard.writeText(cur.content).then(() => toast("模板正文已复制", "success")).catch(() => toast("复制失败", "error"));
      };
    }
  }

  function detailHtml(t) {
    const vars = Array.isArray(t.variables) ? t.variables : JSON.parse(t.variables || "[]");
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div><div class="card-title" style="margin-bottom:2px">${esc(t.name)} <span class="tag">V${t.version}</span></div>
        <div class="card-sub" style="margin-bottom:10px">${esc(t.tpl_type)} · 已使用 ${t.usage_count} 次 · 产出内容AI引用率 ${t.citation_rate}% ${t.compliance_locked ? "· <b style='color:var(--success)'>合规约束已锁定</b>" : ""}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" id="btn-copy">复制正文</button>
          <button class="btn btn-sm" id="btn-edit">编辑</button>
          <button class="btn btn-sm btn-primary" id="btn-use">用此模板生成 →</button>
        </div>
      </div>
      <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">
        ${vars.map(v => `<span class="pill blue">{{${esc(v)}}}</span>`).join("")}
      </div>
      <pre style="background:#FAFAFE;border:1px solid var(--border);border-radius:11px;padding:16px 18px;font-size:12.5px;line-height:1.85;white-space:pre-wrap;font-family:var(--font);max-height:480px;overflow-y:auto">${esc(t.content)}</pre>`;
  }

  function editModal(root, row) {
    const r = row || { name: "", tpl_type: "FAQ短问答", content: "", version: 1 };
    const m = modal({
      title: row ? "编辑模板（将升级版本）" : "新建Prompt模板", size: "wide", foot: false,
      body: `
        <div class="form-row">
          <div class="form-item" style="flex:2"><label>模板名称 *</label><input id="t-name" value="${esc(r.name)}" placeholder="例：FAQ短问答模板（300字内）"></div>
          <div class="form-item"><label>结构类型</label><select id="t-type">${["FAQ短问答", "本地实务解读", "律师IP观点", "服务介绍"].map(s => `<option ${r.tpl_type === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        </div>
        <div class="form-item"><label>模板正文（System Prompt）*</label>
          <textarea id="t-content" style="min-height:280px" placeholder="包含：合规约束层（必填）+ 角色设定 + 任务描述 + {{变量}}占位符 + 结构要求 + 输出格式">${esc(r.content)}</textarea>
          <div class="form-hint">合规约束层为强制要求：禁承诺胜诉 / 案例脱敏 / 文末风险提示。校验不通过的生成内容将被系统自动拦截。</div>
        </div>
        <div class="modal-foot" style="border:none;padding:14px 0 0">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-primary" data-act="save">${row ? "保存并升级至 V" + (r.version + 1) : "创建模板"}</button>
        </div>`
    });
    m.querySelector("[data-act=cancel]").onclick = () => m.close();
    m.querySelector("[data-act=save]").onclick = async () => {
      const name = m.querySelector("#t-name").value.trim();
      const content = m.querySelector("#t-content").value;
      if (!name || !content) return toast("名称与正文为必填项", "warn");
      if (!content.includes("普法参考")) toast("提示：模板正文未包含风险提示要求，生成内容可能被合规校验拦截", "warn");
      try {
        if (row) {
          await DAL.db.update("prompt_templates", row.id, { name, tpl_type: m.querySelector("#t-type").value, content, version: row.version + 1 });
          toast("模板已升级至 V" + (row.version + 1), "success");
        } else {
          await DAL.db.insert("prompt_templates", { name, tpl_type: m.querySelector("#t-type").value, content, version: 1 });
          toast("模板已创建", "success");
        }
        m.close(); Views.prompts.render(root);
      } catch (e) { toast("保存失败：" + e.message, "error"); }
    };
  }
})();
