/* 通用 UI：toast / modal / 徽章 / 时间格式化 */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function toast(msg, type) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3200);
  }

  function modal(opts) {
    const root = document.getElementById("modal-root");
    const wrap = document.createElement("div");
    wrap.className = "modal-mask";
    wrap.innerHTML = '<div class="modal ' + (opts.size || "") + '"><div class="modal-head"><h3>' + esc(opts.title || "") + '</h3><button class="modal-x">×</button></div><div class="modal-body">' + (opts.body || "") + '</div>' + (opts.foot !== false ? '<div class="modal-foot">' + (opts.foot || "") + "</div>" : "") + "</div>";
    root.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector(".modal-x").onclick = close;
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    wrap.close = close;
    return wrap;
  }

  function confirmBox(title, html, onOk) {
    const m = modal({
      title, body: html,
      foot: '<button class="btn" data-act="cancel">取消</button><button class="btn btn-danger" data-act="ok">确认执行</button>'
    });
    m.querySelector('[data-act="cancel"]').onclick = () => m.close();
    m.querySelector('[data-act="ok"]').onclick = () => { m.close(); onOk(); };
  }

  /* 状态徽章 */
  const STATUS_COLOR = {
    "待生产": "#64748B", "已生产": "#2563EB", "已分发": "#7C3AED", "已监测": "#0891B2", "待优化": "#F59E0B",
    "AI初稿": "#64748B", "待律师审核": "#F59E0B", "审核通过": "#10B981", "已发布": "#7C3AED", "校验未通过": "#EF4444", "已驳回": "#EF4444",
    "新咨询": "#64748B", "已接待": "#2563EB", "已转化": "#10B981",
    "已铺设": "#10B981", "铺设中": "#F59E0B", "待铺设": "#94A3B8", "已校准": "#10B981", "待认领": "#94A3B8", "已合作": "#10B981", "洽谈中": "#F59E0B"
  };
  function badge(status) {
    const c = STATUS_COLOR[status] || "#64748B";
    return '<span class="badge" style="color:' + c + ';background:' + c + '14;border-color:' + c + '55">' + esc(status) + "</span>";
  }

  function fmtTime(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d)) return "—";
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d)) return "—";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function ago(ts) {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "刚刚";
    if (m < 60) return m + " 分钟前";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " 小时前";
    const d = Math.floor(h / 24);
    return d + " 天前";
  }

  window.UI = { esc, toast, modal, confirmBox, badge, fmtTime, fmtDate, ago };
})();
