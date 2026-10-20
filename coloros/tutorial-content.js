/* tutorial-content.js — AIDoge 全套教程内容（rich_notes 结构，标题由容器承载）
   被 aidoge-tutorial.html（预览+分享）与 index.html（首屏种子）共用 */
(function (global) {
'use strict';
global.AIDOGE_TUTORIAL = {
  title: 'AIDoge 项目＋助手 · 全套玩法教程',
  html: [
/* ===== 一、项目是什么 ===== */
'<h2>一、AIDoge 是什么</h2>',
'<p>AIDoge（<a href="https://aidoge.app" target="_blank" rel="noopener noreferrer">aidoge.app</a>）是一个以 DOGE 为核心的多资产智能交易平台。平台有完整的<b>新人任务体系</b>：每日签到、浏览行为奖励、邀请返佣，以及 DOGE 挖矿（把闲置余额投入矿池赚收益）。</p>',
'<p><strong>助手</strong>是把这套日常操作全自动化的工具，目前有三个版本：</p>',
'<ul>',
'<li><strong>PC 版</strong>（Python，AIDogeAssistant.exe）：功能最全，五页签界面</li>',
'<li><strong>Auto.js Node 版</strong>（手机，对话框菜单）：协议层与 PC 版逐字一致</li>',
'<li><strong>Auto.js Rhino 版</strong>（手机，卡片界面 + 悬浮窗）：界面最好用，v1.17 起支持挖矿/交易/额度</li>',
'</ul>',

/* ===== 二、准备工作 ===== */
'<h2>二、开始前的两样准备</h2>',
'<h3>1. 邀请码</h3>',
'<p>注册必须有邀请码（<strong>DE 开头</strong>）。获取方式：打开 aidoge.app → 我的 → 合作伙伴，复制自己的邀请码。（没有的话需要先找一个已有用户要）</p>',
'<h3>2. Temporam 邮箱 API Key</h3>',
'<p>批量注册需要临时邮箱收验证码。到 <a href="https://temporam.com/zh/api-keys" target="_blank" rel="noopener noreferrer">temporam.com/zh/api-keys</a> 注册并创建一个 API Key（Hobby 免费额度 3 个邮箱，工具会自动回收最旧的复用）。</p>',
'<blockquote>两个 Key 都填进助手「设置」里保存一次，之后所有功能共用。</blockquote>',

/* ===== 三、快速上手 ===== */
'<h2>三、三分钟上手（Rhino 版为例）</h2>',
'<ol>',
'<li><strong>填配置</strong>：切到「账号/数据」页 → 填邀请码 + API Key → 点「保存配置」</li>',
'<li><strong>开始运行</strong>：回「运行/日志」页点「开始运行」。没有账号时自动批量注册；已有账号时自动执行养号</li>',
'<li><strong>看结果</strong>：控制台实时输出每一步；「账号/数据」页可看每个账号的余额和签到状态</li>',
'<li><strong>停止</strong>：随时点「结束运行」</li>',
'</ol>',

/* ===== 四、核心玩法 ===== */
'<h2>四、核心玩法详解</h2>',
'<h3>① 批量注册</h3>',
'<p>输入数量（1-50），工具自动完成全流程：</p>',
'<p>建临时邮箱 → 用邀请码签注册票据 → 提交注册 → 轮询收验证码 → 验证换登录态 → 立即做一轮任务 → 间隔 20 秒下一个</p>',
'<p>注册完自动导出 <code>邮箱----密码----token</code> 备份文件。<strong>务必备份</strong>：密码是工具随机生成的，丢了无法找回。</p>',
'<h3>② 一键养号（每天必做）</h3>',
'<p>对全部账号依次执行：</p>',
'<ul>',
'<li><strong>签到</strong>：每日登录奖励（未签才调用，重复调用服务端会拒绝）</li>',
'<li><strong>6 项行为上报</strong>：daily_login / 浏览行情 / 浏览策略 / 进入 DOGE / 查看挖矿 / 分享邀请——每项都可能有奖励，已发的自动跳过</li>',
'<li><strong>领取奖励</strong>：遍历所有可领（reward 存在且未 paid），最多 3 轮</li>',
'</ul>',
'<h3>③ 挖矿（v1.17+，Rhino 版）</h3>',
'<p>把可用余额投入矿池产生收益。「满额挖矿」策略：读取服务端上限 → 优先追加到已有订单 → 没有订单才新建 → 保留你设置的最低余额不动。</p>',
'<blockquote>挖矿订单随时可停（stop），本金立即回可用余额。批量养号时可选「先停矿」再「卖出」。</blockquote>',
'<h3>④ 卖出释放额度</h3>',
'<p>每日有卖出额度限制。最常见失败原因是 quota.remaining = 0（今日额度用完）——但报价接口会误导性地提示「余额不足」。<strong>助手会自动区分这两种情况</strong>：额度不够时提示买额度（花 USDT），余额真不够时才报错。卖出按当日剩余额度分笔成交，返回每笔成交额。</p>',

/* ===== 五、版本怎么选 ===== */
'<h2>五、三个版本怎么选</h2>',
'<table>',
'<tr><th></th><th>PC 版</th><th>Node 版</th><th>Rhino 版</th></tr>',
'<tr><td>界面</td><td>五页签窗口</td><td>对话框菜单</td><td>卡片+页签+悬浮窗</td></tr>',
'<tr><td>挖矿/交易/额度</td><td>—</td><td>—</td><td>✓ v1.17</td></tr>',
'<tr><td>多域名容灾</td><td>—</td><td>—</td><td>✓ 6 个域名自动探测</td></tr>',
'<tr><td>运行环境</td><td>Windows</td><td>Auto.js Pro 9</td><td>Auto.js Pro（Rhino）</td></tr>',
'<tr><td>数据存储</td><td>SQLite</td><td>JSON</td><td>JSON</td></tr>',
'</table>',
'<p><strong>推荐</strong>：手机上用 Rhino 版（功能最全、界面最好）；电脑挂机用 PC 版。两个版本协议层完全一致，账号可互相导入（<code>邮箱----密码----token</code> 格式）。</p>',

/* ===== 六、常见问题 ===== */
'<h2>六、常见问题</h2>',
'<h3>注册时报「邀请码无效」？</h3>',
'<p>邀请码必须 DE 开头且真实有效。去 aidoge.app「我的 → 合作伙伴」重新复制，注意不要带空格。</p>',
'<h3>收不到验证码？</h3>',
'<p>等码超时默认 60 秒，可在设置调大。Temporam 免费额度 3 个邮箱，满额时工具自动删最旧的非保留邮箱腾位——如果你有想长期保留的邮箱，把它加进保留名单。</p>',
'<h3>签到提示「已签到」？</h3>',
'<p>正常。今天已签过，服务端拒绝重复签到，助手会识别并跳过。</p>',
'<h3>卖出提示「余额不足」但明明有余额？</h3>',
'<p>是今日卖出额度（quota.remaining）用完了，不是余额问题。可以：等明天 / 用「买额度」功能花 USDT 补额度。</p>',
'<h3>域名打不开？</h3>',
'<p>Rhino 版内置 6 个备用域名（aidoge.app / aidoge368 / 556 / 398 / 225 / 330.com），按顺序自动探测可用的那个。主域名被墙时会自动切换。</p>',
'<h3>账号文件在哪？</h3>',
'<p>Rhino 版：<code>/sdcard/AIDoge助手/accounts.json</code>；Node 版：<code>/sdcard/Android/data/org.aidoge.assistant/files/aidoge.json</code>；PC 版在程序目录 data/ 下。都支持 txt/csv 导入导出互通。</p>',

/* ===== 七、注意事项 ===== */
'<h2>七、必须知道的注意事项</h2>',
'<ul>',
'<li><strong>密码明文存储</strong>：账号密码在本地是明文（txt 导出也是），设备不要借人，导出文件妥善保管</li>',
'<li><strong>Auto.js Pro 付费版</strong>：免费版没有 Node/Rhino 打包能力，跑不了</li>',
'<li><strong>批量注册保持亮屏</strong>：长时间运行建议关闭电池优化，防止系统杀进程</li>',
'<li><strong>证书校验是关闭的</strong>：这是原版行为（兼容旧设备），公共 WiFi 下慎用</li>',
'<li><strong>合规使用</strong>：本工具只自动化你自己账号的日常操作，请遵守平台规则，风险自担</li>',
'</ul>',

/* ===== 八、总结 ===== */
'<h2>八、一句话总结</h2>',
'<p>填两个 Key → 点开始 → 每天回来收奖励。挖矿和卖出是进阶玩法，Rhino 版一键全自动。祝挖矿顺利 🐕</p>'
].join('')
};
})(typeof window !== 'undefined' ? window : globalThis);
