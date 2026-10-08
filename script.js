// ========== 作品数据：每 3 张一组 ==========
const GROUPS = [
  {
    name: 'APPLE',
    works: [
      {
        img: 'image/01.png', title: 'AI INTERPRETATION', sub: 'Midjourney',
        info: ['AI TOOL : MIDJOURNEY', 'PROMPT (EXCERPT):', '“a red apple, natural light, still life, minimalist...”', 'ITERATIONS : 12', 'SELECTED : VERSION 08']
      },
      {
        img: 'image/02.png', title: 'HUMAN A', sub: 'Pencil Drawing',
        info: ['ARTIST : PARTICIPANT A', 'MEDIUM : PENCIL', 'TIME : 40 MIN', 'NOTE:', '“I focused on the form and light, kept it simple.”']
      },
      {
        img: 'image/03.png', title: 'HUMAN B', sub: 'Charcoal Drawing',
        info: ['ARTIST : PARTICIPANT B', 'MEDIUM : CHARCOAL', 'TIME : 45 MIN', 'NOTE:', '“I liked the texture and imperfections.”']
      }
    ]
  },
  {
    name: 'CLOUD',
    works: [
      {
        img: 'image/04.png', title: 'AI INTERPRETATION', sub: 'OpenAI Image Generation',
        info: ['AI TOOL : OPENAI IMAGE GENERATION', 'PROMPT (EXCERPT):', '“a single cloud, soft pink light, blue sky, dreamy...”', 'ITERATIONS : 10', 'SELECTED : VERSION 07']
      },
      {
        img: 'image/trim/05.jpg', title: 'HUMAN A', sub: 'Observational Oil Study',
        info: ['ARTIST : JOHN CONSTABLE', 'WORK : CLOUD STUDY, C. 1822', 'MEDIUM : OIL STUDY', 'COPYRIGHT : PUBLIC DOMAIN']
      },
      {
        img: 'image/trim/06.jpg', title: 'HUMAN B', sub: 'Expressive Oil Study',
        info: ['ARTIST : JOHN CONSTABLE', 'WORK : CLOUD STUDY — STORMY SUNSET, 1821–1822', 'MEDIUM : OIL ON PAPER', 'COPYRIGHT : PUBLIC DOMAIN']
      }
    ]
  },
  {
    name: 'BACK VIEW OF A PERSON',
    works: [
      {
        img: 'image/07.png', title: 'AI INTERPRETATION', sub: 'OpenAI Image Generation',
        info: ['AI TOOL : OPENAI IMAGE GENERATION', 'PROMPT (EXCERPT):', '“a solitary figure, viewed from behind, sunset, warm light...”', 'ITERATIONS : 9', 'SELECTED : VERSION 08']
      },
      {
        img: 'image/trim/08.jpg', title: 'HUMAN A', sub: 'Romantic Oil Painting',
        info: ['ARTIST : CASPAR DAVID FRIEDRICH', 'WORK : WANDERER ABOVE THE SEA OF FOG, C. 1818', 'MEDIUM : OIL ON CANVAS', 'COPYRIGHT : PUBLIC DOMAIN']
      },
      {
        img: 'image/trim/09.jpg', title: 'HUMAN B', sub: 'Intimate Interior Painting',
        info: ['ARTIST : CASPAR DAVID FRIEDRICH', 'WORK : WOMAN AT A WINDOW, 1822', 'MEDIUM : OIL ON CANVAS', 'COPYRIGHT : PUBLIC DOMAIN']
      }
    ]
  }
];

// ========== 立体场景参数（摄影机沿 Z 轴推进 + 多层景深） ==========
// 一件展品不再是一张平面图，而是一叠景深不同的平面：远墙 → 画框 → 展签牌 → 前景遮挡。
// 摄影机沿世界 Z 轴推进，各层因为景深不同自然产生视差——这是「立体感」真正的来源。
// 构图尺寸不等于卡片尺寸：画框在 z = 0，展签牌在 z = +150，
// 后者被透视放得更大，所以整幅构图要比卡片本身宽出一截。
const COMPOSE_W = 880;   // 构图的有效宽度（卡框 + 展签牌）
const COMPOSE_H = 400;
const FIT_W = 0.76;      // 对焦的展品最多占展区宽度的比例
const FIT_H = 0.78;      // 最多占展区高度的比例
// 构图重心比卡片中心略偏右（展签牌在右边），整体左移一点才是视觉居中
const CARD_SHIFT = 'calc(-50% - 40px)';

const PERSP = 900;       // 必须与 style.css 里 .stage 的 perspective 一致
const SPACING = 1000;    // 相邻两件展品在世界坐标里的 Z 间距
const NEAR_CULL = 620;   // 越过镜头到这个距离就彻底不画（PERSP = 900，留足安全边）
const NEAR_FADE = 0.95;  // 推近时淡到全透明的位置（占 NEAR_CULL 的比例）
const SWEEP = 430;       // 每前进一件，整件展品同时横向推移多少（换场靠「让开」而不是虚化）

// 换场**不用模糊**：立体感全部由「硬边分层 + 投影 + 视差」来交代。
// 各层横向视差的系数（负数 = 与镜头反向移动），差得越大，层次越分明：
// 组名挂在最远的一层，跟着远墙走；展签牌是前景，反向甩开。
const PARALLAX = {
  back:  190,
  plate: -330
};

const carousel = document.getElementById('carousel');
const galleryEl = document.getElementById('page-gallery');
const fgLayer = document.querySelector('.fg-layer');
const fxFlash = document.getElementById('fxFlash');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let FOCUS_Z = 0;   // 对焦平面相对透视原点的 z，由展区尺寸反解（见 resizeGallery）

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// ---------- 造一件展品：一叠平面 ----------
// 每层的视觉都放在 .plane-inner 上，于是 CSS 动画动 scale / translate / opacity 时，
// 不会跟每帧由 JS 写入的景深 transform 抢属性。
function createCard(work, groupName) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="plane plane-back" data-plane="back">
      <div class="plane-inner">${groupName ? `<span class="plane-group">${groupName}</span>` : ''}</div>
    </div>
    <div class="plane plane-mount" data-plane="mount">
      <div class="plane-inner"></div>
    </div>
    <div class="plane plane-frame" data-plane="frame">
      <div class="plane-inner">
        <div class="card-frame"><img src="${work.img}" alt="${work.sub}" draggable="false"></div>
        <span class="frame-tape"></span>
      </div>
    </div>
    <div class="plane plane-plate" data-plane="plate">
      <div class="plane-inner">
        <h3>${work.title}</h3>
        <p class="plate-sub">${work.sub}</p>
        <div class="plate-info">
          ${work.info.map((line, i) => i === 0 ? `<strong>${line}</strong>` : `<p>${line}</p>`).join('')}
        </div>
      </div>
    </div>`;
  return card;
}

// ---------- 展品与轨道 ----------
// 每件展品在世界坐标里占一个 SPACING 的位置，摄影机停在 offset 处（单位：件）
const items = [];
const cards = [];

GROUPS.forEach(group => {
  group.works.forEach((work, wi) => {
    const el = createCard(work, wi === 0 ? group.name : '');
    carousel.appendChild(el);
    const item = {
      el,
      i: cards.length,
      isCard: true,
      planes: [...el.querySelectorAll('.plane')],
      visible: null,
      centered: null,
      key: ''
    };
    items.push(item);
    cards.push(item);
  });
});

cards.forEach((c, i) => { c.el.dataset.index = i; });

// 投稿按钮接在最后一件展品之后，作为整场展览的出口
const addBtnItem = {
  el: document.getElementById('addBtn'),
  i: cards.length,
  isCard: false,
  visible: null,
  centered: null,
  key: ''
};
items.push(addBtnItem);

const minOffset = 0;
const maxOffset = addBtnItem.i;

// 镜头初始停在第一件展品上
let offset = 0;

// 进度条：描边虚线显示已走过的部分，小手停在当前进度点
const progressTrack = document.getElementById('progressTrack');
const progressFill = document.getElementById('progressFill');
const progressHand = document.getElementById('progressHand');
const trackLen = progressTrack.getTotalLength();
progressFill.style.strokeDasharray = trackLen;

function renderProgress() {
  const p = (offset - minOffset) / (maxOffset - minOffset);
  progressFill.style.strokeDashoffset = trackLen * (1 - p);
  const pt = progressTrack.getPointAtLength(trackLen * p);
  progressHand.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
}

// ---------- 每帧：把摄影机的位置翻译成各层的景深 ----------
// 核心就一句 z = FOCUS_Z - away * SPACING：
//   away = 0  → 正对镜头（对焦平面），最大最清晰
//   away > 0  → 还沉在景深里，小、远、虚
//   away < 0  → 已经推过镜头，急速放大、虚化、淡出
// 放大倍率完全交给浏览器的透视除法（m = P / (P - z)），不再手写 scale；
// 于是同一件展品内部的前后两层会以不同速率掠过——这才是立体感的来源。
function render() {
  const cam = offset;

  items.forEach(item => {
    const away = item.i - cam;
    const z = FOCUS_Z - away * SPACING;
    const step = Math.abs(away);   // 离对焦平面多远（单位：步）

    // 焦点强调交给 CSS，只在跨越边界时切一次 class，不每帧写样式。
    // 必须放在隐藏判断之前——否则被隐藏的展品会一直留着 is-center
    //
    // 触发点取 0.5 步，也就是换场走到一半的地方：那时候撕纸正好把画面盖住，
    // 于是「入场分镜」（墙板→画框→展签牌→前景纸片依次落位）整段都发生在纸背后，
    // 纸一让开，新的一件已经站好了。取 0.28 的话动画会拖到推镜结束之后才演，
    // 看起来就像「到位了又抖一下」。
    const centered = item.isCard && step < 0.5;
    if (item.centered !== centered) {
      item.centered = centered;
      item.el.classList.toggle('is-center', centered);
    }

    // 已经被镜头推过去的那一件：各层散开（离场分镜）。与 is-center 互斥。
    const past = item.isCard && away < -0.5;
    if (item.past !== past) {
      item.past = past;
      item.el.classList.toggle('is-past', past);
    }

    // 推近的那件一直放大到贴着镜头才淡出，从景深里来的那件后段才显影 ——
    // 于是读起来是「镜头穿过去、下一件从景深里拉出来」，而不是两张图交叉溶解。
    //
    // 推近那件的曲线刻意压得很晚才掉：换场前半程它还几乎是全不透明的，
    // 一直放大到贴脸，然后由横掠过去的撕纸把它整块盖掉。
    // 早早就淡掉的话，读起来就还是「一张图淡出、另一张淡入」。
    const opacity = z > FOCUS_Z
      ? clamp01(1 - Math.pow((z - FOCUS_Z) / (NEAR_CULL * 1.6), 2.2))
      : clamp01((0.56 - step) / 0.3);

    // 穿到镜头后面、或者已经淡到看不见，就彻底不画
    if (z > NEAR_CULL || opacity <= 0.002) {
      if (item.visible !== false) {
        item.visible = false;
        item.el.style.visibility = 'hidden';
      }
      return;
    }
    if (item.visible !== true) {
      item.visible = true;
      item.el.style.visibility = 'visible';
    }

    // 位移三件套：横向让开（换场靠它）+ 轻微升降 + 景深推进
    const shift = item.isCard ? CARD_SHIFT : '-50%';
    item.el.style.transform =
      `translate(${shift}, -50%) translate3d(${(away * SWEEP).toFixed(1)}px, ${(away * -16).toFixed(1)}px, ${z.toFixed(1)}px)`;

    // 横向视差：远墙 / 展签牌 / 前景各用不同系数，喂给 CSS 的自定义属性。
    // 同一件展品内部各层以不同速度横移，才读得出「一层叠一层」
    item.el.style.setProperty('--bgx', (away * PARALLAX.back).toFixed(1));
    item.el.style.setProperty('--plx', (away * PARALLAX.plate).toFixed(1));

    if (item.isCard) {
      // 透明度做在每一层上，不能做在 .card 上——给 .card 设 opacity 会让
      // preserve-3d 被压平，纵深当场消失。
      const key = opacity.toFixed(3);
      if (item.key !== key) {
        item.key = key;
        item.planes.forEach(plane => { plane.style.opacity = key; });
      }
    } else {
      item.el.style.opacity = opacity.toFixed(3);
    }
  });

  // 前景剪影层：跟着镜头左右摆（正弦首尾连续，停位时正好归零，不会跳）。
  // 摆幅按「谁离镜头近谁摆得多」分配：门柱 80~104px、左下角那枝 168px。
  // 于是镜头一动，房间的边框就在展品前面错开 —— 这一下就把平面切换变成了「穿过空间」。
  if (fgLayer) {
    fgLayer.style.setProperty('--fgs', Math.sin(cam * Math.PI).toFixed(4));
  }

  renderProgress();
}

// ========== 分步推进 ==========
// 一步 = 一件展品；最后一步是投稿按钮，走完正好是出口
const stepTargets = cards.map(c => c.i).concat(addBtnItem.i);
let stepIndex = 0;

const stepNow = document.getElementById('stepNow');
const stepTotal = document.getElementById('stepTotal');
const prevStepBtn = document.getElementById('prevStep');
const nextStepBtn = document.getElementById('nextStep');
stepTotal.textContent = String(stepTargets.length).padStart(2, '0');

function updateSteps() {
  const next = String(stepIndex + 1).padStart(2, '0');
  if (stepNow.textContent !== next) {
    stepNow.textContent = next;
    stepNow.classList.remove('is-flip');
    void stepNow.offsetWidth;   // 强制重排，让动画能重播
    stepNow.classList.add('is-flip');
  }
  prevStepBtn.disabled = stepIndex === 0;
  nextStepBtn.disabled = stepIndex === stepTargets.length - 1;
}

// 换场的一记「快门」：只闪一下，别把画面糊住
let flashTimer;
function flash() {
  if (reduceMotion || !fxFlash) return;
  fxFlash.classList.remove('is-on');
  void fxFlash.offsetWidth;   // 强制重排，让动画能重播
  fxFlash.classList.add('is-on');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => fxFlash.classList.remove('is-on'), 520);
}

// 电影感的推镜：缓入缓出，走得越远摇得越久。
// 不用指数衰减——那种「一冲就到」的手感像拖拽，不像镜头。
let tweenFrame = null;
const cancelTween = () => {
  cancelAnimationFrame(tweenFrame);
  tweenFrame = null;
  galleryEl.classList.remove('is-moving');
  if (fgLayer) fgLayer.classList.remove('is-wiping');
};

function animateTo(target) {
  cancelTween();
  const from = offset;
  const delta = target - from;
  if (Math.abs(delta) < 0.004 || reduceMotion) { offset = target; render(); return; }
  const duration = Math.min(1600, 760 + Math.abs(delta) * 150);
  const t0 = performance.now();
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  galleryEl.classList.add('is-moving');
  // 换场靠前景剪影横掠过去把交接盖住——是「遮挡」，不是虚化。
  // 用 CSS 动画而不是每帧写样式，动画时长与这次的推镜时长对齐。
  if (fgLayer) {
    fgLayer.style.setProperty('--wipe-dur', (duration / 1000).toFixed(2) + 's');
    // 往前走纸从左往右扫，往回走纸从右往左扫 —— 方向本身就是导航反馈
    fgLayer.classList.toggle('is-back', delta < 0);
    fgLayer.classList.remove('is-wiping');
    void fgLayer.offsetWidth;   // 强制重排，让动画能重播
    fgLayer.classList.add('is-wiping');
  }
  const frame = now => {
    // now 来自 rAF 的时间戳，t0 来自 performance.now()，是两个时钟。
    // 后台标签页唤醒、无头浏览器 / 虚拟时钟下，now 有可能小于 t0，
    // 进度就成了负数，而缓动函数在负数区会朝反方向剧烈发散 ——
    // 镜头直接飞出展墙，所有展品都被判成不可见（整屏空白）。
    // 夹住下界，最坏也只是这一帧原地不动。
    const p = Math.min(1, Math.max(0, now - t0) / duration);
    offset = from + delta * ease(p);
    render();
    if (p < 1) tweenFrame = requestAnimationFrame(frame);
    else {
      tweenFrame = null;   // 收尾必须置空
      galleryEl.classList.remove('is-moving');
      if (fgLayer) fgLayer.classList.remove('is-wiping');
    }
  };
  tweenFrame = requestAnimationFrame(frame);
}

// immediate=true 时直接落位，用于拖小手这种需要跟手的场景
function goToStep(i, immediate) {
  const prev = stepIndex;
  stepIndex = Math.max(0, Math.min(stepTargets.length - 1, i));
  // 换了一件才放金尘爆发 + 快门闪光；拖小手时同一件会反复触发，用 prev 挡掉
  if (stepIndex !== prev) {
    const r = carousel.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('museum:focus', {
      detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }));
    flash();
  }
  const target = stepTargets[stepIndex];
  if (immediate) { cancelTween(); offset = target; render(); }
  else animateTo(target);
  updateSteps();
}
const stepBy = d => goToStep(stepIndex + d);
// ========== 点击与分步导航 ==========
// 点侧面的卡片，它移到正中间
carousel.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) goToStep(Number(card.dataset.index));
});

prevStepBtn.addEventListener('click', () => stepBy(-1));
nextStepBtn.addEventListener('click', () => stepBy(1));

// 方向键 / PageUp / PageDown / Home / End 都是一步一步走
document.addEventListener('keydown', e => {
  if (!document.getElementById('page-gallery').classList.contains('is-active')) return;
  // e.target 可能是 document 本身（页面没有焦点元素时），document 没有 matches()，
  // 直接调会抛 TypeError 把整个处理器打断。先确认它是元素再判断。
  const t = e.target;
  if (t instanceof Element && t.matches('input, textarea, [contenteditable="true"]')) return;
  if (document.getElementById('page-detail').classList.contains('is-active')) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); stepBy(1); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); stepBy(-1); }
  else if (k === 'Home') { e.preventDefault(); goToStep(0); }
  else if (k === 'End') { e.preventDefault(); goToStep(stepTargets.length - 1); }
});

// 触屏左右滑一下 = 走一步（不是自由拖拽，滑动距离不决定走多远）
let swipeX = 0;
let swipeY = 0;
carousel.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  swipeX = e.clientX;
  swipeY = e.clientY;
});
carousel.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse') return;
  const dx = e.clientX - swipeX;
  const dy = e.clientY - swipeY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) stepBy(dx < 0 ? 1 : -1);
});

// ========== 拖动进度条上的小手 ==========
// 曲线在 x 方向单调，预先采样，拖动时按指针 x 找最近的采样点得到进度
const SAMPLE_COUNT = 200;
const trackSamples = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) =>
  progressTrack.getPointAtLength(trackLen * i / SAMPLE_COUNT).x);
const progressSvg = progressTrack.ownerSVGElement;
let handDragging = false;

progressHand.addEventListener('pointerdown', e => {
  handDragging = true;
  cancelTween();
  progressHand.setPointerCapture(e.pointerId);
});

progressHand.addEventListener('pointermove', e => {
  if (!handDragging) return;
  // 屏幕坐标转成 SVG 坐标
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(progressSvg.getScreenCTM().inverse());
  let best = 0;
  trackSamples.forEach((x, i) => {
    if (Math.abs(x - pt.x) < Math.abs(trackSamples[best] - pt.x)) best = i;
  });
  // 拖小手也按步走：落在哪一步就跳到哪一步，不做连续擦洗
  const p = Math.max(0, Math.min(1, best / SAMPLE_COUNT));
  goToStep(Math.round(p * (stepTargets.length - 1)), true);
});

progressHand.addEventListener('pointerup', () => {
  handDragging = false;
});

// ========== 鼠标滚轮：一次完整滚动 = 走一步 ==========
// 触控板会连续吐出很小的 delta，按事件个数计数会「滚一下跳好几件」。
// 改成累加位移：攒够一次完整滚动的量才走一步，杂散的小抖动不会误触。
let wheelLock = 0;
let wheelAcc = 0;
let wheelSign = 0;
const WHEEL_STEP = 90;

document.getElementById('page-gallery').addEventListener('wheel', e => {
  e.preventDefault();
  const now = performance.now();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const sign = d > 0 ? 1 : -1;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;

  // 上一次滚动已经结束，或者方向反了，就重新攒
  if (now > wheelLock + 160 || sign !== wheelSign) wheelAcc = 0;
  wheelSign = sign;
  wheelAcc += Math.abs(d) * unit;

  if (now < wheelLock) return;         // 冷却中，只攒不走
  if (wheelAcc < WHEEL_STEP) return;   // 还没攒够一次完整滚动
  wheelLock = now + 520;
  wheelAcc = 0;
  stepBy(sign);
}, { passive: false });

// ========== 点击进度条右侧图标，播放转场动画，结束后进入页面二 ==========
const pageGallery = document.getElementById('page-gallery');
const pageDetail = document.getElementById('page-detail');
const transitionVideo = document.getElementById('transitionVideo');

document.getElementById('progressIcon').addEventListener('click', () => {
  pageGallery.classList.add('is-leaving');
  transitionVideo.classList.add('is-playing');
  transitionVideo.currentTime = 0;
  transitionVideo.play();
});

transitionVideo.addEventListener('ended', () => {
  pageGallery.classList.remove('is-active', 'is-leaving');
  pageDetail.classList.add('is-active');
  // 视频不硬切：先淡出，让画布页的进场动画从底下透出来
  transitionVideo.classList.add('is-fading');
  setTimeout(() => transitionVideo.classList.remove('is-playing', 'is-fading'), 620);
});

// 画布页左上角返回展厅
document.getElementById('backBtn').addEventListener('click', () => {
  pageDetail.classList.remove('is-active');
  pageGallery.classList.add('is-active');
});

// 对焦的展品要「占满画面」：由透视公式 m = P / (P - z) 反解出对焦平面该站在哪。
// 于是放大倍率随窗口变化，而各层之间的视差比例保持不变——换个窗口还是同一套镜头。
function resizeGallery() {
  const w = carousel.clientWidth;
  const h = carousel.clientHeight;
  if (!w || !h) return;
  const m = Math.min((w * FIT_W) / COMPOSE_W, (h * FIT_H) / COMPOSE_H);
  FOCUS_Z = PERSP * (m - 1) / m;
  render();
}

new ResizeObserver(resizeGallery).observe(carousel);
resizeGallery();
updateSteps();

// ========== 页面二：画布 ==========
const baseCanvas = document.getElementById('baseCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const baseCtx = baseCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');

// 底层：白纸 + 碎片底图，按高度 80% 居中绘制
const baseImg = new Image();
baseImg.onload = () => {
  const h = baseCanvas.height * 0.8;
  const w = h * baseImg.width / baseImg.height;
  baseCtx.fillStyle = '#fff';
  baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
  baseCtx.drawImage(baseImg, (baseCanvas.width - w) / 2, (baseCanvas.height - h) / 2, w, h);
};
baseImg.src = SHARD_SRC;

// 工具配置：铅笔画墨色线，橡皮用 destination-out 擦除上层笔迹
const TOOLS = {
  pencil: { width: 3, mode: 'source-over' },
  eraser: { width: 28, mode: 'destination-out' }
};
let tool = 'pencil';
let drawing = false;

drawCtx.lineCap = 'round';
drawCtx.lineJoin = 'round';
drawCtx.strokeStyle = '#2b2222';

// 屏幕坐标转成画布内部像素坐标
function canvasPoint(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * drawCanvas.width / rect.width,
    (e.clientY - rect.top) * drawCanvas.height / rect.height
  ];
}

drawCanvas.addEventListener('pointerdown', e => {
  drawing = true;
  drawCanvas.setPointerCapture(e.pointerId);
  drawCtx.lineWidth = TOOLS[tool].width;
  drawCtx.globalCompositeOperation = TOOLS[tool].mode;
  drawCtx.beginPath();
  drawCtx.moveTo(...canvasPoint(e));
  // 单击也留下一个点
  drawCtx.lineTo(...canvasPoint(e));
  drawCtx.stroke();
});

drawCanvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  drawCtx.lineTo(...canvasPoint(e));
  drawCtx.stroke();
});

drawCanvas.addEventListener('pointerup', () => { drawing = false; });

// 切换铅笔 / 橡皮
const toolBtns = document.querySelectorAll('.tool-btn');
toolBtns.forEach(btn => btn.addEventListener('click', () => {
  tool = btn.dataset.tool;
  toolBtns.forEach(b => {
    b.classList.toggle('is-active', b === btn);
    b.setAttribute('aria-pressed', String(b === btn));
  });
  drawCanvas.classList.toggle('is-eraser', tool === 'eraser');
}));

// 底图与笔迹合成一张 PNG，返回 dataURL
function exportCanvas() {
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(drawCanvas, 0, 0);
  return out.toDataURL('image/png');
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = exportCanvas();
  a.download = 'my-design.png';
  a.click();
});

// ========== 上传弹窗 ==========
const REFLECT_OPTIONS = ['Personal memory', 'Emotion', 'Cultural background', 'Visual appearance', 'Random experimentation'];

// 生成云朵轮廓：沿矩形顺时针走一圈，每段都用向外鼓的圆弧
function cloudPath() {
  const arc = (r, x, y) => `A${r} ${r} 0 0 1 ${x} ${y}`;
  const bumps = 10;
  const step = 440 / bumps;
  let d = 'M30 22';
  for (let i = 1; i <= bumps; i++) d += arc(26, 30 + step * i, 22);        // 上边
  d += arc(22, 488, 55) + arc(22, 470, 88);                                 // 右端
  for (let i = 1; i <= bumps; i++) d += arc(26, 470 - step * i, 88);       // 下边
  d += arc(22, 12, 55) + arc(22, 30, 22);                                   // 左端
  return d + 'Z';
}

const cloudD = cloudPath();
document.getElementById('cloudOptions').innerHTML = REFLECT_OPTIONS.map((name, i) => `
  <label class="cloud-option" style="animation-delay:${i * 45}ms">
    <input type="checkbox" name="influence" value="${name}">
    <svg class="cloud" viewBox="0 0 500 110" preserveAspectRatio="none"><path d="${cloudD}" vector-effect="non-scaling-stroke"/></svg>
    <span class="check-box"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>
    <span>${name}</span>
  </label>`).join('');

const reflectModal = document.getElementById('reflectModal');
const reflectForm = document.getElementById('reflectForm');
const storyInput = document.getElementById('storyInput');
const storyCount = document.getElementById('storyCount');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const thumbs = document.getElementById('thumbs');
const toast = document.getElementById('toast');

let reflectSource = 'studio';
const openModal = source => {
  reflectSource = source;
  reflectModal.classList.add('is-open');
};
const closeModal = () => reflectModal.classList.remove('is-open');

// 记录弹窗入口：展厅直接感谢，画布继续进入作品对比
document.getElementById('uploadBtn').addEventListener('click', () => openModal('studio'));
document.getElementById('addBtn').addEventListener('click', () => openModal('gallery'));
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('skipBtn').addEventListener('click', closeModal);

storyInput.addEventListener('input', () => {
  storyCount.textContent = `${storyInput.value.length} / 300`;
});

// 参考图：只收 JPG/PNG 且不超过 10MB，选中后显示缩略图
// uploadedImage 记住用户上传的第一张本地图片，提交时对比弹窗左栏优先用它
let uploadedImage = null;
function addFiles(files) {
  const valid = [...files].filter(f => /image\/(png|jpeg)/.test(f.type) && f.size <= 10 * 1024 * 1024);
  valid.forEach(f => {
    const url = URL.createObjectURL(f);
    if (!uploadedImage) uploadedImage = url;
    const img = document.createElement('img');
    img.src = url;
    thumbs.appendChild(img);
  });
}

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('is-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('is-over');
  addFiles(e.dataTransfer.files);
});

let toastTimer;
function showToast(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('is-show');
  toastTimer = setTimeout(() => toast.classList.remove('is-show'), 2500);
}

// ========== 对比弹窗 ==========
// 这三个节点下面的提交回调就要用，先声明再挂事件，不依赖执行顺序
const compareModal = document.getElementById('compareModal');
const humanNote = document.getElementById('humanNote');
const humanImg = document.getElementById('humanImg');
const closeCompare = () => compareModal.classList.remove('is-open');

// 提交：选项可不选，根据入口显示感谢提示或对比弹窗
// 左栏优先展示用户上传的本地图片；没上传时回退到本次画布上的创作
reflectForm.addEventListener('submit', e => {
  e.preventDefault();
  const story = storyInput.value.trim();
  humanNote.textContent = story ? `"${story}"` : '';
  // 先取出上传的图片，下面清空缩略图后还要用它
  const picked = uploadedImage;
  uploadedImage = null;
  closeModal();
  reflectForm.reset();
  storyCount.textContent = '0 / 300';
  thumbs.innerHTML = '';
  if (reflectSource === 'gallery') {
    showToast('Thank you for your reflection!');
  } else {
    // 有上传就用上传的第一张；没有则现场合成底图与笔迹
    humanImg.src = picked || exportCanvas();
    compareModal.classList.add('is-open');
  }
});

document.getElementById('compareClose').addEventListener('click', closeCompare);
document.getElementById('compareSkip').addEventListener('click', closeCompare);
document.getElementById('compareUpload').addEventListener('click', () => {
  closeCompare();
  showToast('Thank you for your reflection!');
});
