window.Views = window.Views || {};
/* AI引用监测中心 —— 半自动监测（PRD风险预案：人工定时提问+结果录入，系统自动分析告警） */
(function () {
  const { esc, toast, modal, fmtTime, ago, badge } = UI;
  const C = window.CONST;
  const ORG_ALIASES = ["良承"];
  const NAME_CONFUSIONS = ["良成", "良丞", "良程", "梁承", "良诚"];

  let state = { rows: [], kws: [], platform: "", onlyAlert: false };

  Views.monitor = {
    title: "AI引用监测中心",
    desc: "豆包 · DeepSeek · 文心一言 · 通义千问 —— 每周自动跑一轮",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载监测数据…</div>';
      const [rows, kws] = await Promise.all([
        DAL.db.listAll("monitor_records", "monitored_at"),
        DAL.db.listAll("geo_keywords", "priority")
      ]);
      state.rows = rows.reverse(); // 最新在前
      state.kws = kws;
      draw(root);
    }
  };

  function analyze(text) {
    const hasOrg = ORG_ALIASES.some(a => text.includes(a));
    const confusion = NAME_CONFUSIONS.find(n => text.includes(n) && !text.includes("良承"));
    return {
      mentioned: hasOrg,
      nameError: !!confusion,
      confusion: confusion || null
    };
  }

  function draw(root) {
    const rows = state.rows.filter(r => (!state.platform || r.platform === state.platform) && (!state.onlyAlert || r.alert_type));
    const total = state.rows.length;
    const men = state.rows.filter(r => r.mentioned);
    const mentionRate = total ? Math.round(men.length / total * 100) : 0;
    const top3 = men.filter(m => m.position != null && m.position <= 3).length;
    const top3Rate = men.length ? Math.round(top3 / men.length * 100) : 0;
    const accPool = men.filter(m => m.description_accurate != null);
    const accRate = accPool.length ? Math.round(accPool.filter(m => m.description_accurate).length / accPool.length * 100) : 0;
    const alerts = state.rows.filter(r => r.alert_type);

    const platColors = { "豆包": "#7C3AED", "DeepSeek": "#2563EB", "文心一言": "#0891B2", "通义千问": "#F59E0B" };

    root.innerHTML = `
      <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <div><b>半自动监测模式</b>（一期落地方式）：运营师在豆包/DeepSeek等平台以用户视角提问，将 AI 回答原文粘贴录入，系统自动分析提及、位次、名称混淆与描述偏差并生成告警。核心词库每周跑一轮，重点词每日监测。</div></div>

      <div class="grid grid-4 mb16">
        ${kpi("累计监测", total + " 次", "覆盖 " + new Set(state.rows.map(r => r.keyword_text)).size + " 个重点词 × 4 平台")}
        ${kpi("品牌提及率", mentionRate + "%", mentionRate >= 35 ? "已达 35% 目标线" : "距 35% 目标差 " + (35 - mentionRate) + "pct", mentionRate >= 35)}
        ${kpi("推荐位次率", top3Rate + "%", "提及中排前3 " + top3 + " 次")}
        ${kpi("异常告警", alerts.length + " 条", "名称错误/描述偏差/负面信息", false)}
      </div>

      <div class="toolbar">
        <div class="seg">
          ${["全部", ...C.AI_PLATFORMS].map(p => `<button data-p="${p}" class="${state.platform === (p === "全部" ? "" : p) ? "on" : ""}">${p}</button>`).join("")}
        </div>
        <button class="btn ${state.onlyAlert ? "btn-danger" : ""}" id="btn-alert-only">${state.onlyAlert ? "◉ 只看告警" : "◎ 只看告警"}（${alerts.length}）</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="btn-record">＋ 录入监测结果</button>
      </div>

      <div class="card">
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>监测问题</th><th>平台</th><th>提及</th><th>位次</th><th>描述准确</th><th>引用原文</th><th>AI回答摘要</th><th>时间</th></tr></thead>
          <tbody>${rows.length ? rows.map(r => `
            <tr>
              <td><div class="cell-main truncate" style="max-width:200px" title="${esc(r.keyword_text)}">${esc(r.keyword_text)}</div></td>
              <td><span class="pill" style="background:${platColors[r.platform]}16;color:${platColors[r.platform]}">${esc(r.platform)}</span></td>
              <td>${r.mentioned ? '<span class="pill">提及</span>' : '<span class="pill gray">未提及</span>'}</td>
              <td class="num">${r.position != null ? "<b>P" + r.position + "</b>" : "—"}</td>
              <td>${r.description_accurate == null ? "—" : r.description_accurate ? "✓" : '<b style="color:var(--danger)">✕</b>'}</td>
              <td>${r.cited_content ? '<span class="pill blue">引用</span>' : '<span style="color:var(--text3)">—</span>'}</td>
              <td style="font-size:11.5px;color:var(--text2)">
                ${r.alert_type ? `<div class="alert-row" style="margin:0;padding:6px 9px"><div><b>【${esc(r.alert_type)}】</b>${esc((r.ai_answer || "").slice(0, 60))}…</div></div>`
                  : '<span class="truncate" style="display:inline-block;max-width:220px" title="' + esc(r.ai_answer || "") + '">' + esc((r.ai_answer || "").slice(0, 40)) + "…</span>"}
              </td>
              <td class="num" style="font-size:11.5px">${ago(r.monitored_at)}</td>
            </tr>`).join("") : '<tr><td colspan="8" class="empty">暂无监测记录</td></tr>'}</tbody>
        </table></div>
      </div>`;

    root.querySelectorAll(".seg button").forEach(b => b.onclick = () => { state.platform = b.dataset.p === "全部" ? "" : b.dataset.p; draw(root); });
    root.querySelector("#btn-alert-only").onclick = () => { state.onlyAlert = !state.onlyAlert; draw(root); };
    root.querySelector("#btn-record").onclick = () => recordModal(root);
  }

  function kpi(label, value, foot, ok) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-foot"><span class="${ok ? "up" : ok === false ? "down" : ""}">${foot}</span></div></div>`;
  }

  function recordModal(root) {
    const kws = state.kws.slice(0, 40);
    const m = modal({
      title: "录入 AI 监测结果", size: "wide", foot: false,
      body: `
        <div class="form-row">
          <div class="form-item" style="flex:2"><label>监测问题</label><select id="r-kw">${kws.map(k => `<option value="${k.id}">${esc(k.keyword)}</option>`).join("")}</select></div>
          <div class="form-item"><label>AI平台</label><select id="r-platform">${C.AI_PLATFORMS.map(p => `<option>${p}</option>`).join("")}</select></div>
        </div>
        <div class="form-item"><label>AI 回答原文（粘贴）*</label><textarea id="r-answer" style="min-height:130px" placeholder="把 AI 平台对该问题的完整回答粘贴到此处，系统将自动分析是否提及本所、是否出现名称混淆等"></textarea></div>
        <div class="form-row">
          <div class="form-item"><label>推荐位次（若提及本所，填其在推荐列表中的位置）</label><input id="r-pos" type="number" min="1" max="10" placeholder="例：2"></div>
          <div class="form-item"><label>引用了我方内容原文？</label><select id="r-cited"><option value="no">否</option><option value="yes">是（回答中引用/化用了我们发布的内容）</option></select></div>
        </div>
        <div id="r-analysis"></div>
        <div class="modal-foot" style="border:none;padding:14px 0 0">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-blue" data-act="analyze">🔍 自动分析</button>
          <button class="btn btn-primary" data-act="save">保存监测记录</button>
        </div>`
    });
    let analysis = null;
    m.querySelector("[data-act=cancel]").onclick = () => m.close();
    m.querySelector("[data-act=analyze]").onclick = () => {
      const text = m.querySelector("#r-answer").value.trim();
      if (!text) return toast("请先粘贴 AI 回答原文", "warn");
      const r = analyze(text);
      analysis = r;
      m.querySelector("#r-analysis").innerHTML = `
        <div class="compliance-box ${r.mentioned ? "pass" : "fail"}" style="margin-top:4px">
          <div class="cb-head">${r.mentioned ? "✓ 检测到本所被提及「良承」" : "✕ 未检测到本所提及"}</div>
          ${r.nameError ? `<div style="color:var(--danger)">⚠ 发现名称混淆：AI 将本所写为「<b>${esc(r.confusion)}</b>」，将自动生成【名称错误】告警</div>` : ""}
          ${r.mentioned && !r.nameError ? '<div style="color:#047857">请人工复核描述准确性后保存</div>' : ""}
        </div>`;
    };
    m.querySelector("[data-act=save]").onclick = async () => {
      const text = m.querySelector("#r-answer").value.trim();
      if (!text) return toast("请粘贴 AI 回答原文", "warn");
      if (!analysis) analysis = analyze(text);
      const mentioned = analysis.mentioned;
      const posVal = m.querySelector("#r-pos").value;
      const cited = m.querySelector("#r-cited").value === "yes";
      let alertType = null;
      if (analysis.nameError) alertType = "名称错误";
      const kw = state.kws.find(k => k.id === Number(m.querySelector("#r-kw").value));
      try {
        await DAL.db.insert("monitor_records", {
          keyword_text: kw ? kw.keyword : "未关联词条",
          platform: m.querySelector("#r-platform").value,
          mentioned,
          position: mentioned && posVal ? Number(posVal) : null,
          description_accurate: mentioned && !analysis.nameError ? true : mentioned ? false : null,
          cited_content: cited && mentioned,
          ai_answer: text.slice(0, 500),
          alert_type: alertType,
          monitored_at: new Date().toISOString()
        });
        toast(analysis.nameError ? "记录已保存，并生成名称错误告警" : "监测记录已保存", analysis.nameError ? "warn" : "success");
        m.close(); Views.monitor.render(root);
      } catch (e) { toast("保存失败：" + e.message, "error"); }
    };
  }
})();
