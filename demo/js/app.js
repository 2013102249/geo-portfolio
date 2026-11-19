/* 主控：导航 / 路由 / 角色 / 连接状态 */
(function () {
  const { esc, toast } = UI;
  window.Views = window.Views || {};
  window.App = { role: "optimizer", current: "dashboard" };

  const NAV = [
    { key: "dashboard", label: "数据看板", group: "总览", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
    { key: "keywords", label: "GEO词库", group: "生产链路", icon: "M12 3c-5 0-9 1.34-9 3v12c0 1.66 4 3 9 3s9-1.34 9-3V6c0-1.66-4-3-9-3z M3 9c0 1.66 4 3 9 3s9-1.34 9-3 M3 15c0 1.66 4 3 9 3s9-1.34 9-3" },
    { key: "prompts", label: "Prompt工程中心", group: "生产链路", icon: "M4 17l6-6-6-6 M12 19h8" },
    { key: "contents", label: "内容工厂", group: "生产链路", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8" },
    { key: "channels", label: "信源分发", group: "分发与监测", icon: "M18 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M6 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M18 22a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4" },
    { key: "monitor", label: "AI引用监测", group: "分发与监测", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
    { key: "nap", label: "NAP一致性", group: "分发与监测", icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
    { key: "inquiries", label: "询盘归因", group: "分发与监测", icon: "M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }
  ];

  function icon(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
  }

  function drawNav() {
    const nav = document.getElementById("nav");
    let html = "", lastGroup = "";
    NAV.forEach(n => {
      if (n.group !== lastGroup) { html += '<div class="nav-group">' + n.group + "</div>"; lastGroup = n.group; }
      html += '<div class="nav-item" data-view="' + n.key + '">' + icon(n.icon) + "<span>" + n.label + '</span><span class="nav-count" data-count="' + n.key + '"></span></div>';
    });
    nav.innerHTML = html;
    nav.querySelectorAll(".nav-item").forEach(el => el.onclick = () => { location.hash = "#" + el.dataset.view; });
    loadCounts();
  }

  async function loadCounts() {
    const map = { keywords: "geo_keywords", contents: "geo_contents", monitor: "monitor_records", inquiries: "inquiries" };
    for (const [key, table] of Object.entries(map)) {
      DAL.db.count(table).then(c => {
        const el = document.querySelector('[data-count="' + key + '"]');
        if (el) el.textContent = c;
      }).catch(() => {});
    }
  }

  function setActive(key) {
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === key));
    const n = NAV.find(x => x.key === key);
    document.getElementById("page-title").textContent = n ? n.label : key;
    document.getElementById("page-desc").textContent = n && Views[key] ? Views[key].desc || "" : "";
  }

  async function navigate() {
    const key = (location.hash.replace(/^#\//, "").replace(/^#/, "").split("?")[0]) || "dashboard";
    const view = Views[key];
    if (!view) { location.hash = "#dashboard"; return; }
    App.current = key;
    setActive(key);
    const root = document.getElementById("view");
    root.innerHTML = '<div class="loading-block"><span class="spin"></span>加载中…</div>';
    try {
      await view.render(root);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      root.innerHTML = '<div class="card" style="border-color:#FECACA"><div class="card-title" style="color:var(--danger)">模块加载失败</div><div style="font-size:13px;color:var(--text2);margin:6px 0 14px">' + esc(e.message || String(e)) + '</div><button class="btn btn-primary" onclick="location.reload()">刷新重试</button></div>';
    }
  }

  function bindMobileNav() {
    const btn = document.getElementById("menu-btn");
    const mask = document.getElementById("sidebar-mask");
    if (btn) btn.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
    if (mask) mask.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    document.getElementById("nav").addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) document.body.classList.remove("sidebar-open");
    });
  }

  function bindTopbar() {
    document.getElementById("role-select").onchange = e => {
      App.role = e.target.value;
      const names = { optimizer: "GEO优化师", director: "市场部主管", lawyer: "资深律师 / 合伙人", webops: "官网运营" };
      toast("已切换视角：" + names[App.role], "success");
      navigate();
    };
  }

  async function boot() {
    const conn = document.getElementById("conn-status");
    try {
      DAL.init();
      await DAL.db.count("geo_keywords");
      conn.className = "conn-status ok";
      conn.innerHTML = '<span class="dot"></span>演示数据已就绪';
      drawNav();
      bindMobileNav();
      window.addEventListener("hashchange", navigate);
      navigate();
    } catch (e) {
      console.error(e);
      conn.className = "conn-status err";
      conn.innerHTML = '<span class="dot"></span>连接失败';
      document.getElementById("view").innerHTML = '<div class="card" style="border-color:#FECACA"><div class="card-title" style="color:var(--danger)">云端连接失败</div><div style="font-size:13px;color:var(--text2);margin:6px 0 14px">无法连接数据服务：' + esc(e.message || String(e)) + '<br>请检查网络后刷新重试。</div><button class="btn btn-primary" onclick="location.reload()">刷新重试</button></div>';
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
