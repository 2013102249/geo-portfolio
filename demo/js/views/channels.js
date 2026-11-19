window.Views = window.Views || {};
/* 多源分发与信源管理 */
(function () {
  const { esc, badge, toast, confirmBox, fmtDate } = UI;
  const C = window.CONST;

  Views.channels = {
    title: "多源分发与信源管理",
    desc: "把内容铺到 AI 大模型会采信的权威信源，形成多源交叉佐证",
    async render(root) {
      root.innerHTML = '<div class="loading-block"><span class="spin"></span>正在加载信源矩阵…</div>';
      const [channels, dists, contents] = await Promise.all([
        DAL.db.listAll("channels", "sort_order"),
        DAL.db.listAll("distributions", "id"),
        DAL.db.listAll("geo_contents", "id")
      ]);
      const published = contents.filter(c => c.status === "已发布" || c.status === "审核通过");
      const pending = dists.filter(d => d.status === "待分发");
      const done = dists.filter(d => d.status === "已分发").length;
      const ready = channels.filter(c => c.status === "已铺设").length;

      const typeIcon = { "自有阵地": "🏠", "法律垂直平台": "⚖️", "本地地图目录": "📍", "权威媒体": "📰" };
      const typeColor = { "自有阵地": "#7C3AED", "法律垂直平台": "#2563EB", "本地地图目录": "#0891B2", "权威媒体": "#F59E0B" };

      root.innerHTML = `
        <div class="page-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 11l10-4M7 13l10 4"/></svg>
          <div>分发逻辑：<b>自有阵地首发 + Schema 结构化标记</b> → 法律垂直平台同步 → 地图与媒体佐证。已发布内容会自动生成官网/公众号分发任务，此处一键执行。</div></div>

        <div class="grid grid-4 mb16">
          ${kpi("信源覆盖率", Math.round(ready / channels.length * 100) + "%", ready + "/" + channels.length + " 渠道已铺设")}
          ${kpi("分发完成率", dists.length ? Math.round(done / dists.length * 100) + "%" : "—", done + "/" + dists.length + " 条任务已执行")}
          ${kpi("待分发任务", pending.length + " 条", "含官网首发与垂直平台同步")}
          ${kpi("可分发内容", published.length + " 条", "审核通过 + 已发布内容")}
        </div>

        <div class="card mb16">
          <div class="card-title">信源矩阵 <span class="tag">${channels.length} 个渠道</span></div>
          <div class="card-sub">四类信源：自有阵地（首发+Schema）/ 法律垂直平台（档案+词条）/ 本地地图目录（POI）/ 权威媒体（报道+外链）</div>
          <div class="grid grid-4" style="gap:12px">
            ${channels.map(ch => `
              <div style="border:1px solid var(--border);border-radius:11px;padding:13px 15px;background:#FCFBFE">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <b style="font-size:13px">${typeIcon[ch.channel_type] || ""} ${esc(ch.name)}</b>${badge(ch.status)}
                </div>
                <div style="font-size:11px;color:${typeColor[ch.channel_type]};margin:3px 0 6px">${esc(ch.channel_type)}</div>
                <div style="font-size:11.5px;color:var(--text3);line-height:1.5;min-height:34px">${esc(ch.coverage_note || "—")}</div>
                ${ch.schema_deployed ? '<span class="pill" style="margin-top:6px">Schema 已部署</span>' : ""}
              </div>`).join("")}
          </div>
        </div>

        <div class="card">
          <div class="card-title">分发任务队列 <span class="tag blue">${pending.length} 待执行</span></div>
          <div class="card-sub">点击「执行分发」将内容同步至对应信源平台</div>
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>内容</th><th>目标信源</th><th>状态</th><th>分发时间</th><th style="width:120px">操作</th></tr></thead>
            <tbody>${dists.length ? dists.map(d => `
              <tr>
                <td><div class="cell-main truncate">${esc(d.content_title)}</div></td>
                <td>${esc(d.channel_name)}</td>
                <td>${badge(d.status)}</td>
                <td class="num" style="font-size:12px">${fmtDate(d.distributed_at)}</td>
                <td>${d.status === "待分发"
                  ? `<button class="btn btn-sm btn-primary" data-dist="${d.id}">执行分发</button>`
                  : '<span style="font-size:11.5px;color:var(--text3)">✓ 已完成</span>'}</td>
              </tr>`).join("") : '<tr><td colspan="5" class="empty">暂无分发任务，发布内容后自动生成</td></tr>'}</tbody>
          </table></div>
        </div>`;

      root.querySelectorAll("[data-dist]").forEach(b => b.onclick = () => {
        const d = dists.find(x => x.id === Number(b.dataset.dist));
        confirmBox("执行分发", "确认将「<b>" + esc(d.content_title) + "</b>」分发至 <b>" + esc(d.channel_name) + "</b>？执行后状态记录为已分发。", async () => {
          try {
            await DAL.db.update("distributions", d.id, { status: "已分发", distributed_at: new Date().toISOString() });
            toast("分发完成：" + d.channel_name, "success");
            Views.channels.render(root);
          } catch (e) { toast("分发失败：" + e.message, "error"); }
        });
      });
    }
  };

  function kpi(label, value, foot) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-foot"><span>${foot}</span></div></div>`;
  }
})();
