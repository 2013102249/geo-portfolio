/* 法律行业合规校验引擎 —— 对应 PRD 第六章合规红线 */
(function () {
  const C = window.CONST;

  /* 违规规则库：pattern / label / type(violation=红线 | warning=提醒) */
  const RULES = [
    { re: /包赢|必胜|稳赢|必赢|稳操胜券|稳胜/g, label: "承诺性表述（包赢/必胜类）" },
    { re: /100%胜诉|胜诉率\s*100|百分百胜诉|百分之百胜诉/g, label: "绝对化承诺（100%胜诉）" },
    { re: /保证(你?|当事人)?(胜诉|赢|判离|拿到|成功|结果)/g, label: "承诺性表述（保证结果）" },
    { re: /不胜诉?不收费|不赢不收费|胜诉才收费/g, label: "风险代理违规承诺" },
    { re: /(全国|全城|全市|全省|郑州)?第一/g, label: "违反广告法绝对化用语" },
    { re: /最强|最好|最专业|最厉害|顶级|金牌律所|第一品牌|领军律所/g, label: "违反广告法绝对化用语" },
    { re: /胜诉率\s*\d{2,}%/g, label: "展示胜诉率数据（涉嫌保证结果）" },
    { re: /\b[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g, label: "涉嫌未脱敏身份证号" },
    { re: /\b1[3-9]\d{9}\b/g, label: "涉嫌未脱敏手机号" },
    { re: /（\d{4}）[^（）]{0,8}(民|刑|执|商)[初终]{0,2}\d{1,5}号/g, label: "未脱敏真实判决书案号" },
    { re: /当事人[张王李赵刘陈]某?[（(]?(身份证|电话|手机)/g, label: "涉嫌未脱敏当事人信息" }
  ];

  function check(text) {
    text = (text || "").trim();
    const violations = [];
    const warnings = [];
    const seen = new Set();

    RULES.forEach(r => {
      const m = text.match(r.re);
      if (m) {
        const uniq = [...new Set(m.map(s => s.trim()))].slice(0, 3);
        uniq.forEach(s => {
          const key = r.label + s;
          if (!seen.has(key)) { seen.add(key); violations.push(r.label + "：「" + s + "」"); }
        });
      }
    });

    /* 风险提示必备 */
    const tail = text.slice(-80);
    if (!text.includes("本文仅为普法参考") || !tail.includes("咨询执业律师")) {
      violations.push("末尾缺少标准风险提示声明");
    } else {
      warnings.push("风险提示已标注");
    }

    /* 首段结论句检查（首段应直接给结论，便于 AI 抓取） */
    const firstPara = text.split(/\n/)[0] || "";
    const hasConclusion = /(结论|可以|不能|一般|应当|不予|有权|无权|上限|标准|区别|不存在)/.test(firstPara);
    if (firstPara.length > 0 && !hasConclusion) {
      warnings.push("首段建议直接给结论句（提升AI引用命中率）");
    }
    if (firstPara.length === 0) warnings.push("正文为空");

    const passed = violations.length === 0;
    let summary;
    if (!passed) summary = "触发 " + violations.length + " 项红线，已拦截，禁止进入审核流程";
    else if (warnings.filter(w => !w.includes("已标注")).length) summary = "自动校验通过，含 " + warnings.filter(w => !w.includes("已标注")).length + " 条人工复核建议";
    else summary = "自动校验通过，未发现违规表述";

    return { passed, violations, warnings, summary, checkedAt: new Date().toISOString() };
  }

  /* 优先级评分：意向强度50% + 转化预估35% + 竞争度反向15% */
  function priorityScore(intention, competition, conversion) {
    return Math.round(intention * 0.5 + conversion * 0.35 + (100 - competition) * 0.15);
  }

  /* Prompt 模板变量填充 */
  function fillTemplate(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== "") ? vars[k] : m);
  }

  window.Compliance = { check, priorityScore, fillTemplate, RULES, DECLARATION: C.DECLARATION };
})();
