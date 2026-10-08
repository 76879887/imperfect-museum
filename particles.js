// ========== 展厅氛围粒子（纯 canvas 手写，零依赖） ==========
// 四层叠加：
//   bokeh  远景光斑：大、极淡、飘得慢，负责纵深
//   motes  浮尘：小、亮、带正弦摆动 + 呼吸闪烁，负责「空气感」
//   glints 星芒：随机出现、闪一下就没，四道十字光芒，负责「高级感」
//   指针斥力：靠近光标的浮尘被轻轻推开，画面跟着人动
// 换场时 script.js 派发 museum:focus，这里放一圈冷尘爆发 + 冲击波环（都很轻）。
//
// 性能要点：
//   1. 光点用预渲染贴图 drawImage，比每帧 createRadialGradient 快一个数量级
//   2. 数量按画布面积算，并设上限
//   3. 标签页切到后台 / 画布页激活时彻底停掉 rAF
(() => {
  const canvas = document.getElementById('fxCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 全局浓度：1 = 最初那版强度。整站转蓝之后，暖金粒子压在蓝水彩上太跳，
  // 这里把色相换成冷色族，同时用这一个系数统一压低整体亮度。
  // 想再调强弱只改这个值：0.5 很含蓄，0.76 是当前默认，1.0 接近旧观感。
  const INTENSITY = 0.76;

  // 与展厅蓝水彩同一族：冰蓝 / 淡青 / 冷白
  const TINTS = [
    [176, 214, 246],
    [206, 232, 250],
    [240, 248, 255]
  ];

  let W = 0, H = 0, dpr = 1;
  let motes = [], bokeh = [], glints = [], sparks = [], rings = [];
  let raf = 0, running = false, last = 0, clock = 0;
  const pointer = { x: -1e5, y: -1e5 };

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  // 柔光圆点：所有光点都靠缩放这张贴图来画
  function makeGlow(rgb) {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
    grd.addColorStop(0.28, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`);
    grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return c;
  }

  // 星芒的一道光芒：细长的横向渐变
  function makeStreak(rgb) {
    const W2 = 128, H2 = 10;
    const c = document.createElement('canvas');
    c.width = W2; c.height = H2;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, W2, 0);
    grd.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    grd.addColorStop(0.5, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`);
    grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W2, H2);
    // 上下方向再收一点，让光条更锐
    const vg = g.createLinearGradient(0, 0, 0, H2);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.5, 'rgba(0,0,0,1)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = vg;
    g.fillRect(0, 0, W2, H2);
    return c;
  }

  const GLOWS = TINTS.map(makeGlow);
  const STREAKS = TINTS.map(makeStreak);

  function makeMote(spread) {
    return {
      x: rand(0, W),
      y: spread ? rand(0, H) : H + rand(0, 80),
      r: rand(4, 13),
      a: rand(0.32, 0.68),
      vy: rand(0.1, 0.36),
      vx: rand(-0.07, 0.07),
      ph: rand(0, Math.PI * 2),
      sw: rand(0.006, 0.018),
      amp: rand(0.15, 0.6),
      tw: rand(0.012, 0.03),        // 闪烁频率
      s: pick(GLOWS)
    };
  }

  function makeBokeh(spread) {
    return {
      x: rand(0, W),
      y: spread ? rand(0, H) : H + rand(0, 160),
      r: rand(55, 180),
      a: rand(0.07, 0.16),
      vy: rand(0.02, 0.11),
      vx: rand(-0.05, 0.05),
      s: pick(GLOWS)
    };
  }

  // 星芒：自己走一套「暗 → 亮 → 暗 → 换个地方」的生命周期
  function makeGlint(spread) {
    return {
      x: rand(0, W),
      y: spread ? rand(0, H) : rand(0, H),
      r: rand(16, 42),
      life: rand(0, 1),
      rate: rand(0.006, 0.018),
      up: Math.random() < 0.5,
      g: pick(GLOWS),
      st: pick(STREAKS)
    };
  }

  function build() {
    // 密度整体下调：原来的 area/7000 在展区里能铺出 120+ 颗浮尘，
    // 叠加起来就是一片会动的噪点。现在按 /11000 并压低上限。
    const nBokeh = Math.round(Math.min(18, (W * H) / 118000));
    const nMote = Math.round(Math.min(185, (W * H) / 9500));
    const nGlint = Math.round(Math.min(13, (W * H) / 140000));
    bokeh = Array.from({ length: nBokeh }, () => makeBokeh(true));
    motes = Array.from({ length: nMote }, () => makeMote(true));
    glints = Array.from({ length: nGlint }, () => makeGlint(true));
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = w; H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  // ---------- 换场特效 ----------
  // 冷尘爆发：从画面中心朝各方向飞散，带阻尼，越飞越淡。
  // 数量、初速、透明度都比早期版本收敛了不少 —— 换场时最容易被这团东西糊一脸。
  function burst(cx, cy, count) {
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const sp = rand(1.5, 6);
      sparks.push({
        x: cx + Math.cos(ang) * rand(0, 40),
        y: cy + Math.sin(ang) * rand(0, 40),
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - rand(0.3, 1.6),
        r: rand(4, 12),
        a: rand(0.3, 0.58),
        life: 1,
        decay: rand(0.012, 0.024),
        s: pick(GLOWS)
      });
    }
    // 一圈冲击波，把画面边界撑开
    rings.push({ x: cx, y: cy, r: 20, max: rand(240, 400), a: 0.3 });
  }

  // ---------- 每帧 ----------
  function step(now) {
    raf = requestAnimationFrame(step);
    // dt 必须是「正的、有限的一小段」。首帧 / 后台唤醒 / 虚拟时钟跳变时
    // rAF 给的 now 有可能小于上次记的 last，那时候 (now-last) 是负数，
    // 冲击波环的 r += (max - r) * 0.05 * dt 会反向发散，半径一路变成
    // 负几万，ctx.arc 直接抛 IndexSizeError（控制台一条红字）。
    let dt = (now - last) / 16.667;
    if (!(dt > 0)) dt = 1;          // 负数 / NaN / 0 一律按一帧算
    dt = Math.min(3, dt);
    last = now;
    clock += dt;

    ctx.clearRect(0, 0, W, H);
    // 用 screen 而不是 lighter：lighter 是纯加法，几颗粒子一重叠就爆成白点，
    // 这正是「突兀」的主要来源。screen 在重叠处是柔和收敛的。
    ctx.globalCompositeOperation = 'screen';

    // 远景光斑：只飘，不管指针
    for (const p of bokeh) {
      p.y -= p.vy * dt;
      p.x += p.vx * dt;
      if (p.y + p.r < 0) { Object.assign(p, makeBokeh(false)); p.y = H + p.r; }
      if (p.x < -p.r) p.x = W + p.r;
      else if (p.x > W + p.r) p.x = -p.r;
      ctx.globalAlpha = p.a * INTENSITY;
      ctx.drawImage(p.s, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }

    // 浮尘：上飘 + 正弦横摆 + 呼吸闪烁 + 指针斥力
    for (const p of motes) {
      p.ph += p.sw * dt;
      p.y -= p.vy * dt;
      p.x += (p.vx + Math.sin(p.ph) * p.amp) * dt;

      const dx = p.x - pointer.x, dy = p.y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 26000 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (1 - d / 161) * 1.9;
        p.x += (dx / d) * push * dt;
        p.y += (dy / d) * push * dt;
      }

      if (p.y + p.r < 0) { Object.assign(p, makeMote(false)); p.y = H + p.r; }
      if (p.x < -p.r) p.x = W + p.r;
      else if (p.x > W + p.r) p.x = -p.r;

      // 呼吸：亮度在基准值上下浮动，整片尘像在缓缓流动
      // 起伏收窄到 ±0.22，原来是 ±0.38，闪起来一下一下的太抢眼
      const breathe = 0.78 + 0.22 * Math.sin(p.ph * 2.4);
      ctx.globalAlpha = p.a * breathe * INTENSITY;
      ctx.drawImage(p.s, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }

    // 星芒：亮起来的时候加四道十字光芒
    for (const g of glints) {
      g.life += (g.up ? g.rate : -g.rate) * dt;
      if (g.life >= 1) { g.life = 1; g.up = false; }
      if (g.life <= 0) { Object.assign(g, makeGlint(false)); continue; }

      const e = Math.sin(g.life * Math.PI);          // 0→1→0 的包络
      const r = g.r * (0.7 + 0.5 * e);
      ctx.globalAlpha = e * 0.7 * INTENSITY;
      ctx.drawImage(g.g, g.x - r * 0.5, g.y - r * 0.5, r, r);

      ctx.globalAlpha = e * 0.5 * INTENSITY;
      ctx.save();
      ctx.translate(g.x, g.y);
      const len = r * 2.3, th = Math.max(1.2, r * 0.12);
      ctx.drawImage(g.st, -len / 2, -th / 2, len, th);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(g.st, -len * 0.33, -th * 0.42, len * 0.66, th * 0.84);
      ctx.restore();
    }

    // 光扫：一条很宽的斜向暖光带缓慢横穿画面，像有人在展厅里推着灯走。
    // 周期 1500 帧，其中前 42% 是扫过，剩下时间留白，不会一直晃眼。
    const SWEEP_PERIOD = 1500;
    const sp = (clock % SWEEP_PERIOD) / SWEEP_PERIOD;
    if (sp < 0.42) {
      const t = sp / 0.42;
      const cx = (-0.4 + t * 1.9) * W;
      const bw = W * 0.42;
      const g = ctx.createLinearGradient(cx - bw, H, cx + bw, 0);
      g.addColorStop(0, 'rgba(214,236,255,0)');
      g.addColorStop(0.5, 'rgba(214,236,255,0.1)');
      g.addColorStop(1, 'rgba(214,236,255,0)');
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.6;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // 爆发金尘
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.975;
      s.vy = s.vy * 0.975 - 0.035 * dt;
      s.life -= s.decay * dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = s.a * s.life * INTENSITY;
      ctx.drawImage(s.s, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }

    // 冲击波环
    ctx.globalCompositeOperation = 'source-over';
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += (r.max - r.r) * 0.05 * dt;
      r.a *= 0.962;
      if (r.a < 0.01) { rings.splice(i, 1); continue; }
      ctx.globalAlpha = r.a;
      ctx.strokeStyle = 'rgba(226, 242, 255, 1)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      // 半径兜一道底：任何情况下都不给 arc 喂负数
      ctx.arc(r.x, r.y, Math.max(0.5, r.r), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(step);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    ctx.clearRect(0, 0, W, H);
  }

  // 只在展厅可见、标签页在前台时才跑
  let welcomed = false;
  function sync() {
    const galleryOn = document.getElementById('page-gallery').classList.contains('is-active');
    const visible = document.visibilityState === 'visible';
    if (galleryOn && visible && !reduceMotion) {
      start();
      // 第一次进馆撒一把冷尘，当作开场
      if (!welcomed) {
        welcomed = true;
        setTimeout(() => { if (running) burst(W / 2, H * 0.52, 22); }, 420);
      }
    } else {
      stop();
    }
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);

  // 展厅切进切出时重启
  const pageGallery = document.getElementById('page-gallery');
  if (pageGallery) {
    new MutationObserver(sync).observe(pageGallery, { attributes: true, attributeFilter: ['class'] });
  }

  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });
  window.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -1e5;
  });

  // script.js 每次换场派发这个事件
  window.addEventListener('museum:focus', e => {
    const d = e.detail || {};
    if (!running) return;
    burst(d.x || W / 2, d.y || H / 2, reduceMotion ? 0 : 18);
  });

  resize();
  sync();
  window.MuseumFX = { burst, resize, sync };
})();
