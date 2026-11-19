window.Views = window.Views || {};
/* 询盘归因 —— AI渠道 → 咨询 → 委托 转化追踪 */
(function () {
  const { esc, toast, modal, confirmBox, fmtTime } = UI;
  const C = window.CONST;
  const platColors = { "豆包": "#7C3AED", "DeepSeek": "#2563EB", "文心一言": "#0891B2", "通义千问": "#F59E0B", "官网表单": "#64748B" };

  Views.inquiries = {
    title: "询盘归因",
    desc: "AI 推荐入口 → 法律咨询 → 委托代理，量化商业结果",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载询盘数据…</div>';
      const [rows, kws] = await Promise.all([
        DAL.db.listAll("inquiries", "id"),
        DAL.db.listAll("geo_keywords", "priority")
      ]);
      state.rows = rows.reverse();
      state.kws = kws;
      draw(root);
    }
  };
  let state = { rows: [], kws: [] };

  function draw(root) {
    const rows = state.rows;
    const st = C.INQ_STATUS.map(s => rows.filter(r => r.status === s).length);
    const convRate = rows.length ? Math.round(st[2] / rows.length * 100) : 0;
    const monthAgo = Date.now() - 30 * 864e5;
    const monthInq = rows.filter(r => new Date(r.created_at).getTime() > monthAgo).length;

    const byPlat = [...new Set(rows.map(r => r.platform))].map(p => ({ label: p, value: rows.filter(r => r.platform === p).length, color: platColors[p] || "#94A3B8" }));
    const byCase = C.CASE_TYPES.map(ct => ({ label: ct, value: rows.filter(r => r.case_type === ct).length }))
      .filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);

    root.innerHTML = `
      <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        <div>每条 AI 渠道咨询按<b>引荐平台 + 案由 + 触达词条</b>归因，转化漏斗：<b>新咨询 → 已接待 → 已转化（委托代理）</b>。转化率与内容-业务匹配度正相关。</div></div>

      <div class="grid grid-4 mb16">
        ${kpi("月询盘量", monthInq + " 条", "目标 ≥50 条/月", monthInq >= 50)}
        ${kpi("累计询盘", rows.length + " 条", "全部AI渠道 + 官网表单")}
        ${kpi("已转化委托", st[2] + " 条", "咨询→委托")}
        ${kpi("询盘转化率", convRate + "%", "行业参考 15-25%", convRate >= 15)}
      </div>

      <div class="card mb16">
        <div class="card-title">转化漏斗</div>
        <div class="funnel-num">
          <div class="fn-step"><div class="n">${st[0]}</div><div class="l">新咨询</div><div class="fn-rate">100%</div></div>
          <div class="fn-step"><div class="n">${st[1]}</div><div class="l">已接待</div><div class="fn-rate">接待率 ${rows.length ? Math.round(st[1] / rows.length * 100) : 0}%</div></div>
          <div class="fn-step"><div class="n">${st[2]}</div><div class="l">已转化委托</div><div class="fn-rate">转化率 ${convRate}%</div></div>
        </div>
      </div>

      <div class="grid grid-2 mb16">
        <div class="card"><div class="card-title">来源平台分布</div><div class="card-sub">哪个 AI 平台带来的咨询最多 —— 决定下一阶段优化重点</div><div id="inq-plat"></div></div>
        <div class="card"><div class="card-title">案由分布 TOP8</div><div class="card-sub">高转化案由优先加大内容投入</div><div id="inq-case"></div></div>
      </div>

      <div class="card">
        <div class="toolbar" style="margin-bottom:10px">
          <div class="card-title" style="margin:0">询盘明细</div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="btn-add">＋ 录入询盘</button>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>时间</th><th>来源平台</th><th>案由</th><th>触达词条</th><th>客户</th><th>状态</th><th>负责律师</th><th style="width:110px">操作</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td class="num" style="font-size:12px">${fmtTime(r.created_at)}</td>
              <td><span class="pill" style="background:${(platColors[r.platform] || "#64748B")}16;color:${platColors[r.platform] || "#64748B"}">${esc(r.platform)}</span></td>
              <td>${esc(r.case_type)}</td>
              <td class="truncate" style="font-size:12px;max-width:180px" title="${esc(r.keyword_text || "")}">${esc(r.keyword_text || "—")}</td>
              <td>${esc(r.client_name)}<div class="cell-sub">${esc(r.client_phone || "")}</div></td>
              <td>${badge(r.status)}</td>
              <td style="font-size:12.5px">${r.owner_lawyer ? esc(r.owner_lawyer) : '<span style="color:var(--text3)">待分配</span>'}</td>
              <td>
                ${r.status !== "已转化" ? `<button class="btn btn-sm btn-primary" data-adv="${r.id}">${r.status === "新咨询" ? "标记接待" : "标记转化"}</button>` : '<span style="font-size:11.5px;color:var(--success)">✓ 已委托</span>'}
              </td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>`;

    Charts.donut(document.getElementById("inq-plat"), byPlat, { centerLabel: rows.length, centerSub: "累计询盘" });
    Charts.barH(document.getElementById("inq-case"), byCase);

    root.querySelector("#btn-add").onclick = () => addModal(root);
    root.querySelectorAll("[data-adv]").forEach(b => b.onclick = async () => {
      const r = state.rows.find(x => x.id === Number(b.dataset.adv));
      const next = r.status === "新咨询" ? "已接待" : "已转化";
      try {
        await DAL.db.update("inquiries", r.id, { status: next });
        toast("询盘状态 → " + next, "success");
        Views.inquiries.render(root);
      } catch (e) { toast("更新失败：" + e.message, "error"); }
    });
  }

  function badge(s) {
    const map = { "新咨询": "#64748B", "已接待": "#2563EB", "已转化": "#10B981" };
    const c = map[s] || "#64748B";
    return `<span class="badge" style="color:${c};background:${c}14;border-color:${c}55">${esc(s)}</span>`;
  }
  function kpi(label, value, foot, ok) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-foot"><span class="${ok ? "up" : ok === false ? "down" : ""}">${foot}</span></div></div>`;
  }

  function addModal(root) {
    const m = modal({
      title: "录入询盘", foot: false,
      body: `
        <div class="form-row">
          <div class="form-item"><label>客户称呼 *</label><input id="i-name" placeholder="例：李先生"></div>
          <div class="form-item"><label>联系电话（脱敏）</label><input id="i-phone" placeholder="138****1234"></div>
        </div>
        <div class="form-row">
          <div class="form-item"><label>来源平台</label><select id="i-plat">${[...C.AI_PLATFORMS, "官网表单"].map(p => `<option>${p}</option>`).join("")}</select></div>
          <div class="form-item"><label>案由</label><select id="i-case">${C.CASE_TYPES.map(c => `<option>${c}</option>`).join("")}</select></div>
          <div class="form-item"><label>状态</label><select id="i-status">${C.INQ_STATUS.map(s => `<option>${s}</option>`).join("")}</select></div>
        </div>
        <div class="form-item" style="margin-bottom:12px"><label>触达词条</label><select id="i-kw"><option value="">未关联</option>${state.kws.map(k => `<option>${esc(k.keyword)}</option>`).join("")}</select></div>
        <div class="form-item"><label>负责律师</label><input id="i-lawyer" placeholder="例：王建伟"></div>
        <div class="modal-foot" style="border:none;padding:14px 0 0">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-primary" data-act="save">保存</button>
        </div>`
    });
    m.querySelector("[data-act=cancel]").onclick = () => m.close();
    m.querySelector("[data-act=save]").onclick = async () => {
      const name = m.querySelector("#i-name").value.trim();
      if (!name) return toast("请填写客户称呼", "warn");
      try {
        await DAL.db.insert("inquiries", {
          client_name: name,
          client_phone: m.querySelector("#i-phone").value.trim(),
          platform: m.querySelector("#i-plat").value,
          case_type: m.querySelector("#i-case").value,
          status: m.querySelector("#i-status").value,
          keyword_text: m.querySelector("#i-kw").value || null,
          owner_lawyer: m.querySelector("#i-lawyer").value.trim() || null
        });
        toast("询盘已录入", "success");
        m.close(); Views.inquiries.render(root);
      } catch (e) { toast("保存失败：" + e.message, "error"); }
    };
  }
})();
