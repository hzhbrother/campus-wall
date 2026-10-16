// 校园墙产品介绍页 - 图表脚本
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // ---- 图1: 连续签到积分梯度 ----
  var el1 = document.getElementById('chart-checkin');
  if (el1) {
    var c1 = echarts.init(el1, null, { renderer: 'svg' });
    c1.setOption({
      animation: false,
      grid: { left: 48, right: 24, top: 30, bottom: 44 },
      tooltip: { trigger: 'axis', appendToBody: true, valueFormatter: function (v) { return v + ' 积分'; } },
      xAxis: {
        type: 'category',
        name: '连续签到天数',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: muted, fontSize: 12 },
        data: ['1-2 天', '3-6 天', '7-14 天', '15-29 天', '30-99 天', '≥100 天'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted, fontSize: 12 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '每日获得积分',
        nameTextStyle: { color: muted, fontSize: 12 },
        axisLine: { show: false },
        axisLabel: { color: muted, fontSize: 12 },
        splitLine: { lineStyle: { color: rule } },
      },
      series: [{
        type: 'line',
        step: 'end',
        smooth: false,
        data: [1, 2, 3, 5, 8, 12],
        symbol: 'circle',
        symbolSize: 9,
        lineStyle: { color: accent, width: 3 },
        itemStyle: { color: accent, borderColor: bg2, borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: accent + '55' },
            { offset: 1, color: accent + '05' },
          ]),
        },
        label: { show: true, position: 'top', color: ink, fontWeight: 700, fontSize: 12 },
      }],
    });
    window.addEventListener('resize', function () { c1.resize(); });
  }

  // ---- 图2: 后台权限模块分布 ----
  var el2 = document.getElementById('chart-perms');
  if (el2) {
    var c2 = echarts.init(el2, null, { renderer: 'svg' });
    c2.setOption({
      animation: false,
      grid: { left: 80, right: 40, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true, valueFormatter: function (v) { return v + ' 项权限'; } },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: muted, fontSize: 12 },
        splitLine: { lineStyle: { color: rule } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: ['用户管理', '帖子管理', '运营管理', '系统设置', '评论管理', '认证审核', '基础数据', '申诉管理', '勋章管理', '模板管理', '通知管理', '角色管理'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 12 },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: [8, 5, 4, 3, 2, 2, 2, 2, 1, 1, 1, 1],
        barWidth: '58%',
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: accent2 },
            { offset: 1, color: accent },
          ]),
        },
        label: { show: true, position: 'right', color: muted, fontSize: 12 },
      }],
    });
    window.addEventListener('resize', function () { c2.resize(); });
  }

  // ---- Mermaid 初始化 ----
  if (window.mermaid) {
    window.mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose', themeVariables: {
      primaryColor: '#e8effe',
      primaryTextColor: '#1a2233',
      primaryBorderColor: '#3b6ef6',
      lineColor: '#9aa7c2',
      secondaryColor: '#efeafe',
      tertiaryColor: '#ffffff',
      fontFamily: 'Outfit, "PingFang SC", "Microsoft YaHei", sans-serif',
    } });
  }
})();
