window.Views = window.Views || {};
/* NAP实体一致性管理 —— Name/Address/Phone 全网对齐 */
(function () {
  const { esc, toast, modal, fmtTime, confirmBox } = UI;

  let state = { rows: [] };

  Views.nap = {
    title: "NAP 实体一致性管理",
    desc: "律所名称 · 地址 · 电话全网一致 —— AI 识别实体的基础",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载实体档案…</div>';
      state.rows = await DAL.db.listAll("nap_branches", "consistency_score");
      state.rows.sort((a, b) => (b.is_hq - a.is_hq) || (a.consistency_score - b.consistency_score));
      draw(root);
    }
  };

  function scoreColor(s) { return s >= 95 ? "#10B981" : s >= 85 ? "#F59E0B" : "#EF4444"; }

  function draw(root) {
    const rows = state.rows;
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.consistency_score, 0) / rows.length * 10) / 10 : 0;
    const hq = rows.find(r => r.is_hq);
    const issueCount = rows.reduce((s, r) => s + (r.issues || []).length, 0);
    const worst = rows.filter(r => !r.is_hq).slice(0, 3);

    root.innerHTML = `
      <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <div>NAP（Name / Address / Phone）是 AI 大模型识别「良承律所」实体的<b>基础锚点</b>：主数据一处修改、全网分所同步校准；一致性扫描发现旧地址残留、名称缩写、电话错漏即标记跟进。</div></div>

      <div class="grid grid-4 mb16">
        <div class="kpi accent"><div class="kpi-label">实体档案</div><div class="kpi-value">${rows.length}<small>个</small></div><div class="kpi-foot"><span>郑州总部 + ${rows.filter(r => !r.is_hq).length} 家分所（一期目标 22 家）</span></div></div>
        ${kpi("平均一致性", avg, avg >= 90 ? "整体健康" : "需关注低分实体", avg >= 90)}
        ${kpi("待修复问题", issueCount + " 项", "旧地址/名称缩写/电话错漏", issueCount === 0)}
        ${kpi("最近扫描", rows[0] ? fmtTime(rows[0].last_scan_at).slice(0, 16) : "—", "建议每周自动扫描一轮")}
      </div>

      ${hq ? `<div class="card mb16" style="border-color:#C9B8F5;background:linear-gradient(160deg,#FBFAFF,#F5F2FE)">
        <div class="card-title">主数据 · ${esc(hq.full_name)} <span class="tag">总部</span></div>
        <div class="card-sub">此处为全网 NAP 基准源，修改后各分所与各平台以此为对齐标准</div>
        <div class="grid grid-3" style="font-size:13px">
          <div><span style="color:var(--text3)">全称</span><br><b>${esc(hq.full_name)}</b></div>
          <div><span style="color:var(--text3)">地址</span><br><b>${esc(hq.address)}</b></div>
          <div><span style="color:var(--text3)">电话</span><br><b>${esc(hq.phone)}</b></div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text2)">执业许可证号：${esc(hq.license_no)} · 上次扫描 ${fmtTime(hq.last_scan_at)}</div>
      </div>` : ""}

      <div class="toolbar">
        <b style="font-size:13.5px">分所档案（按一致性评分升序）</b>
        <div class="spacer"></div>
        ${worst.length ? `<span style="font-size:12px;color:var(--text2)">优先跟进：${worst.map(w => "<b style='color:" + scoreColor(w.consistency_score) + "'>" + esc(w.branch) + " " + w.consistency_score + "</b>").join("、")}</span>` : ""}
        <button class="btn btn-primary" id="btn-scan">🔄 全网一致性扫描</button>
      </div>

      <div class="nap-grid">
        ${rows.filter(r => !r.is_hq).map(r => `
          <div class="nap-card">
            <div class="nap-head">
              <div style="flex:1"><div class="nm">${esc(r.branch)} <span style="font-weight:400;color:var(--text3);font-size:11px">${esc(r.city)}</span></div></div>
              <div id="ring-${r.id}"></div>
            </div>
            <div class="nap-field"><span class="k">全称</span><span>${esc(r.full_name)}</span></div>
            <div class="nap-field"><span class="k">地址</span><span>${esc(r.address)}</span></div>
            <div class="nap-field"><span class="k">电话</span><span>${esc(r.phone)}</span></div>
            <div class="nap-field"><span class="k">执业证号</span><span style="font-size:11px">${esc(r.license_no)}</span></div>
            ${(r.issues || []).length ? `<div style="margin-top:8px">${r.issues.map(i => `<div class="alert-row warn" style="margin-bottom:5px;padding:7px 10px"><div><b>!</b> ${esc(i)}</div></div>`).join("")}</div>` : '<div style="margin-top:8px"><span class="pill">✓ 全网一致，无异常</span></div>'}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <span style="font-size:11px;color:var(--text3)">上次扫描 ${fmtTime(r.last_scan_at)}</span>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm" data-act="scan" data-id="${r.id}">重扫</button>
                <button class="btn btn-sm" data-act="edit" data-id="${r.id}">校准</button>
              </div>
            </div>
          </div>`).join("")}
      </div>`;

    rows.filter(r => !r.is_hq).forEach(r => {
      Charts.ring(document.getElementById("ring-" + r.id), r.consistency_score, { size: 62, sub: "", color: scoreColor(r.consistency_score) });
    });

    root.querySelector("#btn-scan").onclick = () => confirmBox("全网一致性扫描",
      "将对 <b>" + rows.length + " 个实体档案</b>重新执行一致性检查：依据问题清单重算评分、更新扫描时间。执行吗？", runScanAll);

    root.querySelectorAll("[data-act=edit]").forEach(b => b.onclick = () => {
      const r = state.rows.find(x => x.id === Number(b.dataset.id));
      editModal(root, r);
    });
    root.querySelectorAll("[data-act=scan]").forEach(b => b.onclick = () => {
      const r = state.rows.find(x => x.id === Number(b.dataset.id));
      scanOne(r, root);
    });
  }

  function scoreOf(r) {
    const n = (r.issues || []).length;
    return Math.max(60, 100 - n * 6);
  }

  async function scanOne(r, root, silent) {
    const score = scoreOf(r);
    await DAL.db.update("nap_branches", r.id, { consistency_score: score, last_scan_at: new Date().toISOString() });
    if (!silent) toast(r.branch + " 扫描完成：" + score + " 分" + ((r.issues || []).length ? "，" + r.issues.length + " 项待修复" : "，全网一致"), score >= 95 ? "success" : "warn");
  }

  async function runScanAll() {
    try {
      for (const r of state.rows) await scanOne(r, null, true);
      toast("全网扫描完成：" + state.rows.length + " 个实体已更新", "success");
      Views.nap.render(document.getElementById("view"));
    } catch (e) { toast("扫描失败：" + e.message, "error"); }
  }

  function editModal(root, r) {
    const m = modal({
      title: "校准 NAP 档案 — " + r.branch, size: "wide", foot: false,
      body: `
        <div class="form-item" style="margin-bottom:12px"><label>律所全称（须与执业许可一致）</label><input id="n-name" value="${esc(r.full_name)}"></div>
        <div class="form-row">
          <div class="form-item" style="flex:2"><label>地址</label><input id="n-addr" value="${esc(r.address)}"></div>
          <div class="form-item"><label>电话</label><input id="n-phone" value="${esc(r.phone)}"></div>
        </div>
        <div class="form-item" style="margin-bottom:12px"><label>问题清单（每行一条，修复后请删除对应行）</label>
          <textarea id="n-issues" style="min-height:100px">${esc((r.issues || []).join("\n"))}</textarea>
          <div class="form-hint">示例：高德地图POI名称为简称「良承律所」，与主数据不一致</div>
        </div>
        <div class="modal-foot" style="border:none;padding:14px 0 0">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-primary" data-act="save">保存并重扫</button>
        </div>`
    });
    m.querySelector("[data-act=cancel]").onclick = () => m.close();
    m.querySelector("[data-act=save]").onclick = async () => {
      const issues = m.querySelector("#n-issues").value.split("\n").map(s => s.trim()).filter(Boolean);
      try {
        await DAL.db.update("nap_branches", r.id, {
          full_name: m.querySelector("#n-name").value.trim(),
          address: m.querySelector("#n-addr").value.trim(),
          phone: m.querySelector("#n-phone").value.trim(),
          issues,
          consistency_score: Math.max(60, 100 - issues.length * 6),
          last_scan_at: new Date().toISOString()
        });
        toast("档案已校准并重扫", "success");
        m.close(); Views.nap.render(root);
      } catch (e) { toast("保存失败：" + e.message, "error"); }
    };
  }

  function kpi(label, value, foot, ok) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-foot"><span class="${ok ? "up" : ok === false ? "down" : ""}">${foot}</span></div></div>`;
  }
})();
