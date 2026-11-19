/* 轻量自绘 SVG 图表库（零外部依赖） */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => Number(n) >= 10000 ? (Number(n) / 10000).toFixed(1) + "w" : String(Math.round(Number(n) * 10) / 10);

  /* 横向条形图 */
  function barH(container, data, opts) {
    opts = opts || {};
    const max = Math.max(...data.map(d => d.value), 1);
    const rowH = 30, pad = { l: opts.labelW || 92, r: 44, t: 6, b: 6 };
    const W = container.clientWidth || 560, H = data.length * rowH + pad.t + pad.b;
    const colors = opts.colors || [];
    let rows = "";
    data.forEach((d, i) => {
      const y = pad.t + i * rowH + rowH / 2;
      const bw = Math.max(4, (W - pad.l - pad.r) * d.value / max);
      const color = d.color || colors[i % colors.length] || "#7C3AED";
      rows += '<text x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="cg-label">' + esc(d.label) + '</text>'
        + '<rect x="' + pad.l + '" y="' + (y - 9) + '" width="' + (W - pad.l - pad.r) + '" height="18" rx="9" fill="#EFEDF9"/>'
        + '<rect x="' + pad.l + '" y="' + (y - 9) + '" width="' + bw + '" height="18" rx="9" fill="' + color + '">'
        + (d.value / max > 0.92 ? "" : "") + '</rect>'
        + '<text x="' + (pad.l + bw + 8) + '" y="' + (y + 4) + '" class="cg-val">' + fmt(d.value) + (opts.unit || "") + "</text>";
    });
    container.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:' + H + 'px">' + rows + "</svg>";
  }

  /* 环形占比图 */
  function donut(container, data, opts) {
    opts = opts || {};
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const size = opts.size || 190, r = size / 2 - 16, cx = size / 2, cy = size / 2, sw = 26;
    let acc = 0, arcs = "";
    data.forEach(d => {
      if (d.value <= 0) return;
      const a0 = acc / total * Math.PI * 2 - Math.PI / 2, a1 = (acc + d.value) / total * Math.PI * 2 - Math.PI / 2;
      acc += d.value;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1 - 0.0001), y1 = cy + r * Math.sin(a1 - 0.0001);
      arcs += '<path d="M' + x0 + " " + y0 + " A" + r + " " + r + " 0 " + large + " 1 " + x1 + " " + y1 + '" fill="none" stroke="' + d.color + '" stroke-width="' + sw + '" stroke-linecap="butt"/>';
    });
    const legend = data.map(d => '<span class="lg-item"><i style="background:' + d.color + '"></i>' + esc(d.label) + " <b>" + d.value + "</b>（" + Math.round(d.value / total * 100) + "%）</span>").join("");
    const center = opts.centerLabel != null
      ? '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="dg-big">' + esc(opts.centerLabel) + '</text><text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="dg-sub">' + esc(opts.centerSub || "") + "</text>" : "";
    container.innerHTML = '<div class="donut-wrap"><svg viewBox="0 0 ' + size + " " + size + '" style="width:' + size + 'px;height:' + size + 'px">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EFEDF9" stroke-width="' + sw + '"/>' + arcs + center + "</svg>"
      + '<div class="donut-legend">' + legend + "</div></div>";
  }

  /* 折线趋势图 */
  function line(container, data, opts) {
    opts = opts || {};
    const W = container.clientWidth || 620, H = opts.height || 220;
    const pad = { l: 46, r: 16, t: 18, b: 34 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const vals = data.map(d => d.value);
    const max = opts.max || Math.max(...vals, 1) * 1.15;
    let grid = "", pts = "", labels = "";
    for (let g = 0; g <= 4; g++) {
      const y = pad.t + ih - ih * g / 4;
      grid += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" stroke="#ECEAF6" stroke-dasharray="' + (g === 0 ? "0" : "3 4") + '"/>'
        + '<text x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="cg-label">' + Math.round(max * g / 4) + "</text>";
    }
    data.forEach((d, i) => {
      const x = pad.l + (data.length === 1 ? iw / 2 : iw * i / (data.length - 1));
      const y = pad.t + ih - ih * d.value / max;
      pts.push ? 0 : 0;
      d._x = x; d._y = y;
      labels += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle" class="cg-label">' + esc(d.label) + "</text>";
    });
    const path = data.map((d, i) => (i === 0 ? "M" : "L") + d._x + " " + d._y).join(" ");
    const area = path + " L" + data[data.length - 1]._x + " " + (pad.t + ih) + " L" + data[0]._x + " " + (pad.t + ih) + " Z";
    const dots = data.map((d, i) => '<circle cx="' + d._x + '" cy="' + d._y + '" r="4.5" fill="#fff" stroke="#7C3AED" stroke-width="2.5"/><text x="' + d._x + '" y="' + (d._y - 12) + '" text-anchor="middle" class="cg-val">' + fmt(d.value) + "</text>").join("");
    let target = "";
    if (opts.target != null) {
      const ty = pad.t + ih - ih * opts.target / max;
      target = '<line x1="' + pad.l + '" y1="' + ty + '" x2="' + (W - pad.r) + '" y2="' + ty + '" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (W - pad.r) + '" y="' + (ty - 6) + '" text-anchor="end" class="cg-target">目标 ' + opts.target + (opts.targetUnit || "") + "</text>";
    }
    container.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:' + H + 'px">' + grid
      + '<defs><linearGradient id="lgArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7C3AED" stop-opacity="0.22"/><stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/></linearGradient></defs>'
      + '<path d="' + area + '" fill="url(#lgArea)"/>'
      + '<path d="' + path + '" fill="none" stroke="#7C3AED" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
      + dots + labels + target + "</svg>";
  }

  /* 漏斗（状态流转） */
  function funnel(container, stages, opts) {
    opts = opts || {};
    const max = Math.max(...stages.map(s => s.value), 1);
    const W = container.clientWidth || 560, rowH = 42, H = stages.length * rowH + 8;
    let rows = "";
    stages.forEach((s, i) => {
      const w = Math.max(60, (W - 150) * s.value / max);
      const y = 4 + i * rowH;
      rows += '<text x="108" y="' + (y + rowH / 2 - 6) + '" text-anchor="end" class="cg-label">' + esc(s.label) + "</text>"
        + '<text x="108" y="' + (y + rowH / 2 + 10) + '" text-anchor="end" class="cg-sub">' + s.value + "</text>"
        + '<rect x="120" y="' + y + '" width="' + w + '" height="' + (rowH - 10) + '" rx="8" fill="' + (s.color || "#7C3AED") + '" opacity="' + (0.45 + 0.55 * s.value / max) + '"/>'
        + '<text x="' + (128 + w) + '" y="' + (y + rowH / 2 + 4) + '" class="cg-val">' + s.value + "</text>";
      if (i < stages.length - 1) rows += '<text x="120" y="' + (y + rowH - 3) + '" class="cg-arrow">↓</text>';
    });
    container.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:' + H + 'px">' + rows + "</svg>";
  }

  /* 进度环 */
  function ring(container, value, opts) {
    opts = opts || {};
    const size = opts.size || 120, sw = 11, r = size / 2 - sw, cx = size / 2, cy = size / 2;
    const pct = Math.max(0, Math.min(100, value));
    const circumference = 2 * Math.PI * r;
    const color = opts.color || (pct >= 100 ? "#10B981" : pct >= 70 ? "#7C3AED" : "#F59E0B");
    container.innerHTML = '<svg viewBox="0 0 ' + size + " " + size + '" style="width:' + size + 'px;height:' + size + 'px">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EFEDF9" stroke-width="' + sw + '"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + (circumference * pct / 100) + " " + circumference + '" transform="rotate(-90 ' + cx + " " + cy + ')"/>'
      + '<text x="' + cx + '" y="' + (cy + 1) + '" text-anchor="middle" class="dg-big" style="font-size:22px">' + pct + '%</text>'
      + '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" class="dg-sub">' + esc(opts.sub || "") + "</text></svg>";
  }

  window.Charts = { barH, donut, line, funnel, ring };
})();
