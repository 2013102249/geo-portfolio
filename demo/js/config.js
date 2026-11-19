/* WorkBuddy Cloud publicConfig —— 仅含可公开的前端配置 */
window.PUBLIC_CONFIG = {
  endpoint: "https://law-firm-geo.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey: "wbpk_v4fbMRDPhanragEh1zmIJD_AvSjQ0g5uOuJeLcHU1V0a28FgLoEV5iY"
};

/* 业务常量 */
window.CONST = {
  ORG_NAME: "河南良承律师事务所",
  DECLARATION: "本文仅为普法参考，不构成法律意见，具体案件建议咨询执业律师。",
  REGIONS: ["郑州", "金水区", "郑东新区", "高新区", "中原区", "二七区", "管城区", "洛阳"],
  CASE_TYPES: ["劳动争议", "婚姻家事", "债权债务", "刑事辩护", "合同纠纷", "交通事故", "房产纠纷", "公司事务"],
  WORD_TYPES: ["核心词", "地标词", "疑问长尾词"],
  KW_STATUS: ["待生产", "已生产", "已分发", "已监测", "待优化"],
  CONTENT_STATUS: ["AI初稿", "待律师审核", "审核通过", "已发布", "校验未通过"],
  INQ_STATUS: ["新咨询", "已接待", "已转化"],
  AI_PLATFORMS: ["豆包", "DeepSeek", "文心一言", "通义千问"],
  CHANNEL_TYPES: ["自有阵地", "法律垂直平台", "本地地图目录", "权威媒体"],
  ALERT_TYPES: ["名称错误", "描述偏差", "负面信息"],
  TARGET: { mentionRate: 35, monthlyInquiries: 50 }
};
