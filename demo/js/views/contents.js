window.Views = window.Views || {};
/* 内容生产与合规审核 —— AIGC生成 + 自动合规校验 + 律师审核双保险 */
(function () {
  const { esc, badge, toast, modal, confirmBox, fmtTime } = UI;
  const C = window.CONST;
  let state = { rows: [], kws: [], tpls: [], filter: "", pendingHash: null };

  Views.contents = {
    title: "内容工厂 · 生产与合规审核",
    desc: "选词 → 选模板 → AI生成 → 自动合规校验 → 律师复核 → 发布",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载内容池…</div>';
      const [rows, kws, tpls] = await Promise.all([
        DAL.db.listAll("geo_contents", "id"),
        DAL.db.listAll("geo_keywords", "priority"),
        DAL.db.listAll("prompt_templates", "id")
      ]);
      state.rows = rows.reverse();
      state.kws = kws;
      state.tpls = tpls;
      const hash = location.hash;
      if (hash.includes("?kw=")) state.pendingHash = { kw: Number(new URLSearchParams(hash.split("?")[1]).get("kw")) };
      else if (hash.includes("?tpl=")) state.pendingHash = { tpl: Number(new URLSearchParams(hash.split("?")[1]).get("tpl")) };
      draw(root);
      if (state.pendingHash) { const p = state.pendingHash; state.pendingHash = null; genModal(root, p); }
    }
  };

  function draw(root) {
    const f = state.filter;
    const rows = f ? state.rows.filter(r => r.status === f) : state.rows;
    const cnt = s => state.rows.filter(r => r.status === s).length;
    const blocked = cnt("校验未通过");

    root.innerHTML = `
      <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <div><b>双保险机制：</b>AIGC 初稿必须先通过<b>自动合规校验</b>（禁承诺胜诉 / 脱敏检查 / 风险提示 / 首段结论句），触发红线即拦截；通过后进入<b>资深律师复核队列</b>，审核留痕可追溯。</div></div>

      <div class="toolbar">
        <div class="seg">
          ${["全部", ...C.CONTENT_STATUS].map(s => `<button data-st="${s}" class="${f === (s === "全部" ? "" : s) ? "on" : ""}">${s}${s !== "全部" ? " " + cnt(s) : ""}</button>`).join("")}
        </div>
        <div class="spacer"></div>
        ${blocked ? `<span class="pill" style="background:#FEF2F2;color:#DC2626">⚠ ${blocked} 条被合规闸门拦截</span>` : ""}
        <button class="btn btn-primary" id="btn-gen">⚡ 生成新内容</button>
      </div>

      <div class="card">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>内容标题</th><th>目标词条</th><th>模板</th><th>合规校验</th><th>状态</th><th>审核留痕</th><th style="width:190px">操作</th></tr></thead>
          <tbody>${rows.length ? rows.map(rowHtml).join("") : '<tr><td colspan="7" class="empty">暂无内容，点击右上角「生成新内容」开始生产</td></tr>'}</tbody>
        </table></div>
        <div style="margin-top:10px;font-size:12px;color:var(--text3)">共 ${rows.length} 条内容 · 全部生成与审核记录已归档可追溯</div>
      </div>`;

    root.querySelectorAll(".seg button").forEach(b => b.onclick = () => { state.filter = b.dataset.st === "全部" ? "" : b.dataset.st; draw(root); });
    root.querySelector("#btn-gen").onclick = () => genModal(root, {});

    root.querySelectorAll("tr[data-id]").forEach(tr => {
      const id = Number(tr.dataset.id);
      const row = state.rows.find(r => r.id === id);
      tr.querySelector("[data-act=view]").onclick = () => viewModal(root, row);
      const act = tr.querySelector("[data-act=flow]");
      if (act) act.onclick = () => flowAction(root, row);
      const del = tr.querySelector("[data-act=del]");
      if (del) del.onclick = () => confirmBox("删除内容", "确认删除「<b>" + esc(row.title) + "</b>」？生成与审核记录将一并删除。", async () => {
        try { await DAL.db.remove("geo_contents", id); toast("内容已删除", "success"); Views.contents.render(root); }
        catch (e) { toast("删除失败：" + e.message, "error"); }
      });
    });
  }

  function rowHtml(r) {
    const cj = r.compliance_json || {};
    const flow = {
      "AI初稿": { label: "送律师审核", cls: "btn-primary" },
      "待律师审核": { label: App.role === "lawyer" ? "审核（律师）" : "审核处理", cls: "btn-blue" },
      "审核通过": { label: "发布到信源", cls: "btn-primary" },
      "已发布": null,
      "校验未通过": { label: "重新生成", cls: "btn" }
    }[r.status];
    const reviewer = r.reviewer ? esc(r.reviewer) + "：" + esc((r.review_note || "").slice(0, 18)) + (((r.review_note || "").length > 18) ? "…" : "") : (r.status === "待律师审核" ? "排队中" : "—");
    return `<tr data-id="${r.id}">
      <td><div class="cell-main truncate" title="${esc(r.title)}">${esc(r.title)}</div><div class="cell-sub">V${r.version} · ${fmtTime(r.created_at)}</div></td>
      <td style="font-size:12.5px" class="truncate">${esc(r.keyword_text)}</td>
      <td style="font-size:12px;color:var(--text2)" class="truncate">${esc(r.template_name || "—")}</td>
      <td>${cj.passed === false ? '<span class="pill" style="background:#FEF2F2;color:#DC2626">✕ 拦截</span>' : cj.passed ? '<span class="pill">✓ 通过</span>' : '<span class="pill gray">—</span>'}</td>
      <td>${badge(r.status)}</td>
      <td style="font-size:11.5px;color:var(--text2)" class="truncate">${reviewer}</td>
      <td>
        <button class="btn btn-sm" data-act="view">详情</button>
        ${flow ? `<button class="btn btn-sm ${flow.cls}" data-act="flow">${flow.label}</button>` : ""}
        <button class="btn btn-sm btn-ghost" data-act="del" style="color:var(--danger)">删除</button>
      </td></tr>`;
  }

  async function flowAction(root, row) {
    try {
      if (row.status === "AI初稿") {
        await DAL.db.update("geo_contents", row.id, { status: "待律师审核", updated_at: new Date().toISOString() });
        toast("已送入律师审核队列", "success");
      } else if (row.status === "待律师审核") {
        reviewModal(root, row); return;
      } else if (row.status === "审核通过") {
        await DAL.db.update("geo_contents", row.id, { status: "已发布", updated_at: new Date().toISOString() });
        /* 自动创建分发任务：官网首发 + 公众号同步 */
        const chans = await DAL.db.list("channels", { in: { name: ["良承律所官网", "良承律所微信公众号"] } });
        for (const ch of chans) {
          await DAL.db.insert("distributions", { content_id: row.id, content_title: row.title, channel_id: ch.id, channel_name: ch.name, status: "待分发" });
        }
        await DAL.db.update("geo_keywords", row.keyword_id, { status: "已分发", updated_at: new Date().toISOString() }).catch(() => {});
        toast("已发布，并生成 2 条分发任务（官网首发 + 公众号）", "success");
      } else if (row.status === "校验未通过") {
        genModal(root, { kw: row.keyword_id });
        return;
      }
      Views.contents.render(root);
    } catch (e) { toast("操作失败：" + e.message, "error"); }
  }

  function reviewModal(root, row) {
    const m = modal({
      title: "律师复核 — " + row.title, size: "wide", foot: false,
      body: `
        <div style="background:#FAFAFE;border:1px solid var(--border);border-radius:11px;padding:14px 16px;font-size:13px;line-height:1.8;white-space:pre-wrap;max-height:300px;overflow-y:auto">${esc(row.body)}</div>
        ${complianceBoxHtml(row.compliance_json)}
        <div class="form-item" style="margin-top:14px"><label>审核意见（留痕必填）</label>
        <textarea id="rv-note" placeholder="法律准确性、专业口径、合规风险等审核结论"></textarea></div>
        <div class="modal-foot" style="border:none;padding:14px 0 0">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-danger" data-act="reject">驳回修改</button>
          <button class="btn btn-primary" data-act="approve">✓ 审核通过</button>
        </div>`
    });
    m.querySelector("[data-act=cancel]").onclick = () => m.close();
    m.querySelector("[data-act=approve]").onclick = async () => {
      const note = m.querySelector("#rv-note").value.trim();
      if (!note) return toast("请填写审核意见（合规留痕要求）", "warn");
      try {
        await DAL.db.update("geo_contents", row.id, {
          status: "审核通过", reviewer: "王建伟（资深合伙人）", review_note: note, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        toast("审核通过，已进入发布池", "success"); m.close(); Views.contents.render(root);
      } catch (e) { toast("操作失败：" + e.message, "error"); }
    };
    m.querySelector("[data-act=reject]").onclick = async () => {
      const note = m.querySelector("#rv-note").value.trim();
      if (!note) return toast("驳回时请填写修改意见", "warn");
      try {
        await DAL.db.update("geo_contents", row.id, {
          status: "校验未通过", reviewer: "王建伟（资深合伙人）", review_note: note, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        toast("已驳回，运营师可重新生成", "warn"); m.close(); Views.contents.render(root);
      } catch (e) { toast("操作失败：" + e.message, "error"); }
    };
  }

  function viewModal(root, row) {
    const cj = row.compliance_json || {};
    modal({
      title: row.title, size: "wide", foot: false,
      body: `
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">目标词条「${esc(row.keyword_text)}」 · 模板 ${esc(row.template_name || "—")} · ${badge(row.status)} · 提交 ${fmtTime(row.created_at)}</div>
        <div style="background:#FAFAFE;border:1px solid var(--border);border-radius:11px;padding:16px 18px;font-size:13px;line-height:1.85;white-space:pre-wrap;max-height:340px;overflow-y:auto">${esc(row.body)}</div>
        ${complianceBoxHtml(cj)}
        ${row.reviewer ? `<div class="compliance-box pass" style="margin-top:10px"><b>审核留痕</b><div style="margin-top:4px;font-size:12.5px">${esc(row.reviewer)} · ${fmtTime(row.reviewed_at)}<br>${esc(row.review_note || "")}</div></div>` : ""}`
    });
  }

  function complianceBoxHtml(cj) {
    if (!cj || cj.passed === undefined) return "";
    if (cj.passed) {
      const warns = (cj.warnings || []).filter(w => !w.includes("已标注"));
      return `<div class="compliance-box pass"><div class="cb-head">✓ 自动合规校验通过</div>
        <div style="color:#047857">${esc(cj.summary || "")}</div>
        ${warns.length ? "<ul>" + warns.map(w => `<li class="warn-item">建议复核：${esc(w)}</li>`).join("") + "</ul>" : ""}</div>`;
    }
    return `<div class="compliance-box fail"><div class="cb-head">✕ 触发合规红线（${(cj.violations || []).length} 项）</div>
      <ul>${(cj.violations || []).map(v => `<li>${esc(v)}</li>`).join("")}</ul>
      ${(cj.warnings || []).length ? "<ul>" + cj.warnings.map(w => `<li class="warn-item">${esc(w)}</li>`).join("") + "</ul>" : ""}</div>`;
  }

  /* ---------- 生成器 ---------- */
  function genModal(root, preset) {
    if (!state.kws.length || !state.tpls.length) return toast("请先在词库/Prompt中心准备数据", "warn");
    const kwOptions = state.kws.map(k => `<option value="${k.id}" ${preset.kw === k.id ? "selected" : ""}>${esc(k.keyword)}（${esc(k.region)}·${esc(k.case_type)}）</option>`).join("");
    const tplOptions = state.tpls.map(t => `<option value="${t.id}" ${preset.tpl === t.id ? "selected" : ""}>${esc(t.name)} V${t.version}</option>`).join("");

    const m = modal({
      title: "AI 内容生成器（内置合规约束）", size: "wide", foot: false,
      body: `
        <div class="form-row">
          <div class="form-item" style="flex:2"><label>① 目标词条</label><select id="g-kw">${kwOptions}</select></div>
          <div class="form-item"><label>② Prompt模板</label><select id="g-tpl">${tplOptions}</select></div>
        </div>
        <div class="form-row" id="g-vars"></div>
        <div style="display:flex;gap:10px;align-items:center;margin:4px 0 12px">
          <button class="btn btn-primary" id="g-run">⚡ 开始生成</button>
          <span style="font-size:11.5px;color:var(--text3)">生成内容将自动通过合规闸门校验，触发红线直接拦截</span>
        </div>
        <div id="g-out" class="gen-output" style="display:none"></div>
        <div id="g-result"></div>
        <div class="modal-foot" style="border:none;padding:14px 0 0" id="g-foot">
          <button class="btn" data-act="close">关闭</button>
        </div>`
    });
    m.querySelector("[data-act=close]").onclick = () => m.close();

    const kwSel = m.querySelector("#g-kw"), tplSel = m.querySelector("#g-tpl");
    const renderVars = () => {
      const kw = state.kws.find(k => k.id === Number(kwSel.value));
      const vars = ["law_article", "process_node", "service_scope"];
      const labels = { law_article: "核心法条（如：劳动合同法第35条）", process_node: "本地流程节点", service_scope: "服务范围" };
      m.querySelector("#g-vars").innerHTML = vars.map(v => `<div class="form-item"><label>${labels[v]}</label><input id="g-v-${v}" placeholder="留空则由AI结合词条自拟"></div>`).join("");
      m.querySelector("#g-v-law_article").dataset.kwcase = kw ? kw.case_type : "";
    };
    renderVars();
    kwSel.onchange = renderVars;

    m.querySelector("#g-run").onclick = async () => {
      const kw = state.kws.find(k => k.id === Number(kwSel.value));
      const tpl = state.tpls.find(t => t.id === Number(tplSel.value));
      if (!kw || !tpl) return toast("请选择词条与模板", "warn");
      const btn = m.querySelector("#g-run");
      btn.disabled = true; btn.textContent = "生成中…";
      const out = m.querySelector("#g-out"), result = m.querySelector("#g-result");
      out.style.display = "block"; out.innerHTML = '<span class="spin"></span>';
      result.innerHTML = "";

      const vars = {
        region: kw.region, case_type: kw.case_type, question: kw.keyword,
        law_article: m.querySelector("#g-v-law_article").value.trim(),
        process_node: m.querySelector("#g-v-process_node").value.trim(),
        service_scope: m.querySelector("#g-v-service_scope").value.trim()
      };
      const system = Compliance.fillTemplate(tpl.content, vars);
      const user = `请生成内容。目标问题：「${kw.keyword}」，地域：${kw.region}，案由：${kw.case_type}。${vars.law_article ? "指定核心法条：" + vars.law_article + "。" : ""}${vars.process_node ? "本地流程参考：" + vars.process_node + "。" : ""}${vars.service_scope ? "服务范围：" + vars.service_scope + "。" : ""}直接输出正文，不要任何解释。`;

      try {
        const text = await DAL.llm.generate({
          system, user, temperature: 0.7,
          onDelta: (chunk) => {
            if (out.querySelector(".spin")) out.textContent = "";
            out.appendChild(document.createTextNode(chunk));
            out.scrollTop = out.scrollHeight;
          }
        });
        const full = (out.textContent || "").trim() || text;
        /* 自动合规校验 */
        const check = Compliance.check(full);
        const allowed = check.passed;
        result.innerHTML = complianceBoxHtml(check)
          + `<div class="modal-foot" style="border:none;padding:14px 0 0">
              <button class="btn" data-act="close2">关闭</button>
              ${allowed
                ? '<button class="btn btn-primary" data-act="save-ok">保存为合规初稿</button>'
                : '<button class="btn" data-act="regen">↻ 重新生成</button><button class="btn btn-primary" data-act="save-blocked">保存拦截记录（归档）</button>'}
            </div>`;
        const cj = { passed: check.passed, violations: check.violations, warnings: check.warnings, summary: check.summary, checkedAt: check.checkedAt };
        const doSave = async (status) => {
          const body = status === "AI初稿" ? ensureDeclaration(full) : full;
          const saved = await DAL.db.insert("geo_contents", {
            keyword_id: kw.id, keyword_text: kw.keyword, template_id: tpl.id, template_name: tpl.name,
            title: titleFrom(full, kw.keyword), body, status, compliance_json: cj, version: 1
          });
          if (status === "AI初稿") {
            await DAL.db.update("geo_keywords", kw.id, { status: "已生产", updated_at: new Date().toISOString() }).catch(() => {});
            const tplRow = state.tpls.find(t => t.id === tpl.id);
            if (tplRow) DAL.db.update("prompt_templates", tpl.id, { usage_count: (tplRow.usage_count || 0) + 1 }).catch(() => {});
          }
          toast(status === "AI初稿" ? "初稿已保存，词条状态 → 已生产" : "拦截记录已归档（供复盘 Prompt 质量）", status === "AI初稿" ? "success" : "warn");
          m.close(); Views.contents.render(root);
        };
        result.querySelector("[data-act=close2]").onclick = () => m.close();
        const so = result.querySelector("[data-act=save-ok]"); if (so) so.onclick = () => doSave("AI初稿");
        const sb = result.querySelector("[data-act=save-blocked]"); if (sb) sb.onclick = () => doSave("校验未通过");
        const rg = result.querySelector("[data-act=regen]"); if (rg) rg.onclick = () => m.querySelector("#g-run").click();
      } catch (e) {
        const partial = (out.textContent || "").trim();
        if (partial) {
          result.innerHTML = '<div class="compliance-box fail"><div class="cb-head">流式中断</div><div style="color:var(--danger)">' + esc(e.message || "网络异常") + '。已接收 ' + partial.length + ' 字内容（保留显示），可点击「重新生成」重试。</div></div>'
            + '<div class="modal-foot" style="border:none;padding:14px 0 0"><button class="btn" data-act="regen2">↻ 重新生成</button></div>';
          const rg = result.querySelector("[data-act=regen2]");
          if (rg) rg.onclick = () => m.querySelector("#g-run").click();
        } else {
          out.innerHTML = '<span style="color:var(--danger)">生成失败：' + esc(e.message || "模型服务暂不可用，请稍后重试") + "</span>";
        }
      } finally { btn.disabled = false; btn.textContent = "⚡ 开始生成"; }
    };
  }

  function titleFrom(text, fallback) {
    const first = (text.split("\n")[0] || "").replace(/^(结论|先给结论|答)[:：、\s]*/g, "").trim();
    return first.length >= 8 && first.length <= 40 ? first.slice(0, 40) : fallback + " — 律师解读";
  }
  function ensureDeclaration(text) {
    const D = C.DECLARATION;
    return text.includes("本文仅为普法参考") ? text : text + "\n" + D;
  }
})();
