window.Views = window.Views || {};
/* 数据看板与询盘归因 —— 三层指标体系 */
(function () {
  const { esc, badge, fmtTime, ago } = UI;
  const C = window.CONST;

  Views.dashboard = {
    title: "数据看板",
    desc: "健康度 · 效果 · 商业三层核心指标",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在汇总全链路数据…</div>';
      const [kws, contents, channels, monitors, naps, inqs, dists] = await Promise.all([
        DAL.db.listAll("geo_keywords", "id"),
        DAL.db.listAll("geo_contents", "id"),
        DAL.db.listAll("channels", "sort_order"),
        DAL.db.listAll("monitor_records", "monitored_at"),
        DAL.db.listAll("nap_branches", "id"),
        DAL.db.listAll("inquiries", "id"),
        DAL.db.listAll("distributions", "id")
      ]);

      /* ---- 效果指标 ---- */
      const total = monitors.length;
      const mentioned = monitors.filter(m => m.mentioned);
      const mentionRate = total ? Math.round(mentioned.length / total * 100) : 0;
      const top3 = mentioned.filter(m => m.position != null && m.position <= 3);
      const top3Rate = mentioned.length ? Math.round(top3.length / mentioned.length * 100) : 0;
      const accPool = mentioned.filter(m => m.description_accurate != null);
      const accRate = accPool.length ? Math.round(accPool.filter(m => m.description_accurate).length / accPool.length * 100) : 0;

      /* ---- 健康度 ---- */
      const weekAgo = Date.now() - 7 * 864e5;
      const weekOutput = contents.filter(c => new Date(c.created_at).getTime() > weekAgo).length;
      const ready = channels.filter(c => c.status === "已铺设").length;
      const coverage = channels.length ? Math.round(ready / channels.length * 100) : 0;
      const napAvg = naps.length ? Math.round(naps.reduce((s, n) => s + n.consistency_score, 0) / naps.length * 10) / 10 : 0;

      /* ---- 商业指标 ---- */
      const monthAgo = Date.now() - 30 * 864e5;
      const monthInq = inqs.filter(i => new Date(i.created_at).getTime() > monthAgo).length;
      const converted = inqs.filter(i => i.status === "已转化").length;
      const convRate = inqs.length ? Math.round(converted / inqs.length * 100) : 0;

      /* ---- 趋势（按周桶） ---- */
      const buckets = [];
      for (let w = 3; w >= 0; w--) {
        const end = Date.now() - w * 7 * 864e5 + 12 * 3600e3;
        const start = end - 7 * 864e5;
        const set = monitors.filter(m => { const t = new Date(m.monitored_at).getTime(); return t > start && t <= end; });
        buckets.push({
          label: w === 0 ? "本周" : w + "周前",
          value: set.length ? Math.round(set.filter(m => m.mentioned).length / set.length * 100) : 0,
          _n: set.length
        });
      }

      /* ---- 平台对比 ---- */
      const platColors = { "豆包": "#7C3AED", "DeepSeek": "#2563EB", "文心一言": "#0891B2", "通义千问": "#F59E0B" };
      const platRows = C.AI_PLATFORMS.map(p => {
        const set = monitors.filter(m => m.platform === p);
        const men = set.filter(m => m.mentioned).length;
        return { label: p, value: set.length ? Math.round(men / set.length * 100) : 0, color: platColors[p], _raw: men + "/" + set.length };
      });

      /* ---- 词库漏斗 ---- */
      const funnelStages = C.KW_STATUS.map(s => ({
        label: s, value: kws.filter(k => k.status === s).length,
        color: { "待生产": "#94A3B8", "已生产": "#2563EB", "已分发": "#7C3AED", "已监测": "#0891B2", "待优化": "#F59E0B" }[s]
      }));

      /* ---- 询盘来源 ---- */
      const inqColors = { "豆包": "#7C3AED", "DeepSeek": "#2563EB", "文心一言": "#0891B2", "通义千问": "#F59E0B", "官网表单": "#64748B" };
      const inqSrc = [...new Set(inqs.map(i => i.platform))].map(p => ({ label: p, value: inqs.filter(i => i.platform === p).length, color: inqColors[p] || "#94A3B8" }));

      /* ---- 告警 ---- */
      const alerts = monitors.filter(m => m.alert_type).sort((a, b) => new Date(b.monitored_at) - new Date(a.monitored_at));

      /* ---- 待办 ---- */
      const pendingReview = contents.filter(c => c.status === "待律师审核");
      const pendingDist = dists.filter(d => d.status === "待分发");

      const roleTip = {
        optimizer: "作为 <b>GEO优化师</b>：优先处理 <b>待生产词条</b>，跟进 <b>待优化</b> 词的内容迭代。",
        director: "作为 <b>市场部主管</b>：关注品牌提及率（目标 ≥35%）与月度询盘达成（目标 ≥50 条）。",
        lawyer: "作为 <b>资深律师</b>：有 <b>" + pendingReview.length + " 条内容</b> 等待您审核法律准确性，可在「内容工厂」处理。",
        webops: "作为 <b>官网运营</b>：有 <b>" + pendingDist.length + " 条分发任务</b> 待同步官网与 Schema 部署。"
      }[App.role] || "";

      root.innerHTML = `
        <div class="role-tip">⟡ ${roleTip}</div>
        <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <div>指标口径：<b>品牌提及率</b>=AI回答提及本所的监测次数占比；<b>位次率</b>=提及中排前3的比例；数据来自 AI 引用监测中心真实监测记录，每周自动跑一轮。</div></div>

        <div class="grid grid-4 mb16">
          ${kpiCard("品牌提及率", mentionRate + "%", "目标 ≥35%", mentionRate >= 35, "监测 " + total + " 次 · 提及 " + mentioned.length + " 次", true)}
          ${kpiCard("推荐位次率", top3Rate + "%", "前3占比", top3Rate >= 70, "提及中排前3 " + top3.length + " 次")}
          ${kpiCard("实体描述准确率", accRate + "%", "NAP 对齐效果", accRate >= 80, "可评估样本 " + accPool.length + " 条")}
          ${kpiCard("周词条产出", weekOutput + " 条", "近7天入库内容", true, "累计内容 " + contents.length + " 条")}
        </div>
        <div class="grid grid-4 mb16">
          ${kpiCard("NAP一致性均分", napAvg, "总部+分所实体健康度", napAvg >= 90, naps.length + " 个实体档案")}
          ${kpiCard("信源覆盖率", coverage + "%", ready + "/" + channels.length + " 个渠道已铺设", coverage >= 70, "覆盖自有+垂直+地图+媒体")}
          ${kpiCard("月AI渠道询盘", monthInq + " 条", "目标 ≥50 条/月", monthInq >= 50, "累计询盘 " + inqs.length + " 条")}
          ${kpiCard("询盘转化率", convRate + "%", "咨询→委托", true, "已转化委托 " + converted + " 条")}
        </div>

        <div class="grid grid-21 mb16">
          <div class="card"><div class="card-title">品牌提及率趋势 <span class="tag">每周监测</span></div><div class="card-sub">近4周按监测轮次聚合，橙色虚线为 35% 目标线</div><div id="ch-trend"></div></div>
          <div class="card"><div class="card-title">各AI平台提及对比</div><div class="card-sub">本期豆包/DeepSeek/文心一言/通义千问表现</div><div id="ch-plat"></div></div>
        </div>

        <div class="grid grid-3 mb16">
          <div class="card"><div class="card-title">词库生产漏斗</div><div class="card-sub">待生产 → 已生产 → 已分发 → 已监测 → 待优化</div><div id="ch-funnel"></div></div>
          <div class="card"><div class="card-title">询盘来源分布</div><div class="card-sub">按引荐平台归因（共 ${inqs.length} 条）</div><div id="ch-inq"></div></div>
          <div class="card"><div class="card-title">异常告警 <span class="tag" style="background:#FEF2F2;color:#DC2626">${alerts.length} 条</span></div>
            <div class="card-sub">名称错误 / 描述偏差 / 负面信息，需运营师跟进</div>
            ${alerts.length ? alerts.slice(0, 5).map(a => `
              <div class="alert-row"><div><b>【${esc(a.alert_type)}】</b>${esc(a.platform)} · 「${esc(a.keyword_text)}」<div style="color:var(--text2);margin-top:2px;">${esc((a.ai_answer || "").slice(0, 52))}…</div></div><span class="t">${ago(a.monitored_at)}</span></div>`).join("")
              : '<div class="empty">暂无告警</div>'}
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card"><div class="card-title">内容审核队列 <span class="tag" style="background:#FFFBEB;color:#B45309">${pendingReview.length} 条待审</span></div>
            <div class="card-sub">资深律师复核法律准确性与专业口径后进入发布池</div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>标题</th><th>模板</th><th>合规校验</th><th>提交时间</th></tr></thead><tbody>
            ${pendingReview.length ? pendingReview.map(c => `<tr><td><div class="cell-main truncate">${esc(c.title)}</div><div class="cell-sub">${esc(c.keyword_text)}</div></td><td>${esc(c.template_name || "—")}</td><td>${(c.compliance_json || {}).passed ? '<span class="pill">通过</span>' : '<span class="pill" style="background:#FEF2F2;color:#DC2626">未通过</span>'}</td><td class="num">${fmtTime(c.created_at)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty">队列为空，内容已全部处理</td></tr>'}
            </tbody></table></div></div>
          <div class="card"><div class="card-title">分发执行看板 <span class="tag blue">${pendingDist.length} 条待分发</span></div>
            <div class="card-sub">内容 × 信源的分发状态追踪</div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>内容</th><th>信源渠道</th><th>状态</th></tr></thead><tbody>
            ${dists.slice(0, 6).map(d => `<tr><td><div class="cell-main truncate">${esc(d.content_title)}</div></td><td>${esc(d.channel_name)}</td><td>${badge(d.status)}</td></tr>`).join("")}
            </tbody></table></div></div>
        </div>`;

      Charts.line(document.getElementById("ch-trend"), buckets, { target: 35, targetUnit: "%", height: 230 });
      Charts.barH(document.getElementById("ch-plat"), platRows, { unit: "%", labelW: 78 });
      Charts.funnel(document.getElementById("ch-funnel"), funnelStages);
      Charts.donut(document.getElementById("ch-inq"), inqSrc, { centerLabel: inqs.length, centerSub: "累计询盘" });
    }
  };

  function kpiCard(label, value, target, ok, foot, accent) {
    return `<div class="kpi ${accent ? "accent" : ""}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-foot"><span class="${ok ? "up" : "down"}">${ok ? "●" : "○"} ${target}</span><span>${foot || ""}</span></div>
    </div>`;
  }
})();
