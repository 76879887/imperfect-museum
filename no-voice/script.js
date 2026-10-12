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
        img: 'image/05.jpg', title: 'HUMAN A', sub: 'Observational Oil Study',
        info: ['ARTIST : JOHN CONSTABLE', 'WORK : CLOUD STUDY, C. 1822', 'MEDIUM : OIL STUDY', 'COPYRIGHT : PUBLIC DOMAIN']
      },
      {
        img: 'image/06.jpg', title: 'HUMAN B', sub: 'Expressive Oil Study',
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
        img: 'image/08.jpg', title: 'HUMAN A', sub: 'Romantic Oil Painting',
        info: ['ARTIST : CASPAR DAVID FRIEDRICH', 'WORK : WANDERER ABOVE THE SEA OF FOG, C. 1818', 'MEDIUM : OIL ON CANVAS', 'COPYRIGHT : PUBLIC DOMAIN']
      },
      {
        img: 'image/09.jpg', title: 'HUMAN B', sub: 'Intimate Interior Painting',
        info: ['ARTIST : CASPAR DAVID FRIEDRICH', 'WORK : WOMAN AT A WINDOW, 1822', 'MEDIUM : OIL ON CANVAS', 'COPYRIGHT : PUBLIC DOMAIN']
      }
    ]
  }
];

// ========== 弧形画廊参数 ==========
const CARD_W = 180;
const CARD_H = 340;
const GAP = 40;              // 组内卡片间距
const GROUP_GAP = 140;       // 组间间距（中间放分隔线）
const STEP = CARD_W + GAP;   // 相邻卡片的间隔
const CENTER_SCALE = 1.5;    // 居中卡片的放大倍数
const PUSH = CARD_W * (CENTER_SCALE - 1) / 2; // 居中卡片放大后两侧需让出的距离
const LABEL_Y = -(CARD_H * CENTER_SCALE / 2 + 25); // 组名在卡片上方的高度
const RADIUS = 1100;         // 弧形半径，越小弯曲越明显
const MAX_ANGLE = 1.35;      // 超出该角度（弧度）的元素隐藏

const carousel = document.getElementById('carousel');
let galleryScale = 1;

function createCard(work) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-head">
      <h3>${work.title}</h3>
      <p>${work.sub}</p>
    </div>
    <div class="card-frame-box">
      <div class="card-frame"><img src="${work.img}" alt="${work.sub}" draggable="false"></div>
    </div>
    <div class="card-info">
      ${work.info.map((line, i) => i === 0 ? `<strong>${line}</strong>` : `<p>${line}</p>`).join('')}
    </div>`;
  return card;
}

function addItem(el, s, extra) {
  carousel.appendChild(el);
  items.push({ el, s, y: 0, ...extra });
}

// 每个元素在弧线上的位置 s（展开后的水平距离）
const items = [];
let s = 0;
GROUPS.forEach((group, g) => {
  if (g > 0) {
    s += CARD_W / 2 + GROUP_GAP / 2;
    const divider = document.createElement('div');
    divider.className = 'divider';
    addItem(divider, s);
    s += GROUP_GAP / 2 + CARD_W / 2;
  }

  // 组名放在中间那张卡片的上方
  const label = document.createElement('div');
  label.className = 'group-label';
  label.textContent = group.name;
  addItem(label, s + STEP, { y: LABEL_Y });

  group.works.forEach((work, w) => {
    if (w > 0) s += STEP;
    addItem(createCard(work), s, { isCard: true });
  });
});

const cards = items.filter(item => item.isCard);
cards.forEach((c, i) => { c.el.dataset.index = i; });
const minOffset = cards[0].s;
const maxOffset = cards[cards.length - 1].s;

// + 按钮放在第 10 张的位置
addItem(document.getElementById('addBtn'), maxOffset + STEP);

// 当前居中位置，初始让第 5 张居中
let offset = cards[4].s;

// 进度条：用描边虚线显示已走过的部分，小手停在当前进度点
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

// 把弧线位置映射到凹面圆柱：两侧向观众靠近并朝向中心；越靠近中间放大越多
function render() {
  items.forEach(item => {
    const rel = item.s - offset;
    // 居中卡片放大后，两侧元素向外让位
    const pushed = rel + Math.max(-1, Math.min(1, rel / STEP)) * PUSH;
    const angle = pushed / RADIUS;
    const x = RADIUS * Math.sin(angle);
    const z = RADIUS * (1 - Math.cos(angle));
    const scale = item.isCard ? 1 + (CENTER_SCALE - 1) * Math.max(0, 1 - Math.abs(rel) / STEP) : 1;
    item.el.style.transform =
      `translate(-50%, -50%) translate3d(${x}px, ${item.y}px, ${z}px) rotateY(${-angle}rad) scale(${scale})`;
    item.el.style.zIndex = Math.round(100 - Math.abs(rel) / 10);
    item.el.style.visibility = Math.abs(angle) > MAX_ANGLE ? 'hidden' : 'visible';
  });
  renderProgress();
}

// 平滑移动到指定位置
let moveFrame = null;
function animateTo(target) {
  cancelAnimationFrame(moveFrame);
  const step = () => {
    offset += (target - offset) * 0.15;
    if (Math.abs(target - offset) < 0.5) offset = target;
    render();
    if (offset !== target) moveFrame = requestAnimationFrame(step);
  };
  step();
}

// ========== 拖动与点击 ==========
let dragging = false;
let startX = 0;
let startOffset = 0;
let moved = false;

const clamp = v => Math.min(maxOffset, Math.max(minOffset, v));

carousel.addEventListener('pointerdown', e => {
  // + 按钮交给自身的点击事件处理，不参与拖动
  if (e.target.closest('.add-btn')) return;
  dragging = true;
  moved = false;
  startX = e.clientX;
  startOffset = offset;
  cancelAnimationFrame(moveFrame);
  carousel.classList.add('is-dragging');
  carousel.setPointerCapture(e.pointerId);
});

carousel.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - startX;
  if (Math.abs(dx) > 5) moved = true;
  offset = clamp(startOffset - dx * 1.2 / galleryScale);
  render();
});

carousel.addEventListener('pointerup', e => {
  dragging = false;
  carousel.classList.remove('is-dragging');

  // 没有拖动视为点击：点中的卡片移到正中间
  if (!moved) {
    const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card');
    if (card) animateTo(cards[card.dataset.index].s);
    return;
  }
  snapToNearest();
});

// 松手后吸附到最近的一张
function snapToNearest() {
  animateTo(cards.reduce((a, b) => Math.abs(b.s - offset) < Math.abs(a.s - offset) ? b : a).s);
}

// ========== 拖动进度条上的小手 ==========
// 曲线在 x 方向单调，预先采样，拖动时按指针 x 找最近的采样点得到进度
const SAMPLE_COUNT = 200;
const trackSamples = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) =>
  progressTrack.getPointAtLength(trackLen * i / SAMPLE_COUNT).x);
const progressSvg = progressTrack.ownerSVGElement;
let handDragging = false;

progressHand.addEventListener('pointerdown', e => {
  handDragging = true;
  cancelAnimationFrame(moveFrame);
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
  offset = minOffset + (maxOffset - minOffset) * best / SAMPLE_COUNT;
  render();
});

progressHand.addEventListener('pointerup', () => {
  handDragging = false;
  snapToNearest();
});

// ========== 鼠标滚轮滚动 ==========
let wheelTimer = null;
document.getElementById('page-gallery').addEventListener('wheel', e => {
  e.preventDefault();
  cancelAnimationFrame(moveFrame);
  offset = clamp(offset + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY));
  render();
  // 停止滚动后吸附到最近的一张
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(snapToNearest, 150);
}, { passive: false });

// ========== 点击进度条右侧图标，播放转场动画，结束后进入页面二 ==========
const pageGallery = document.getElementById('page-gallery');
const pageDetail = document.getElementById('page-detail');
const transitionVideo = document.getElementById('transitionVideo');

document.getElementById('progressIcon').addEventListener('click', () => {
  pageGallery.classList.add('is-leaving');
  transitionVideo.classList.add('is-playing');
  // 无音效版：播放前再显式静音一次，避免个别浏览器忽略 HTML muted 属性
  transitionVideo.muted = true;
  transitionVideo.currentTime = 0;
  transitionVideo.play();
});

transitionVideo.addEventListener('ended', () => {
  pageGallery.classList.remove('is-active', 'is-leaving');
  pageDetail.classList.add('is-active');
  transitionVideo.classList.remove('is-playing');
});

// 画布页左上角返回展厅
document.getElementById('backBtn').addEventListener('click', () => {
  pageDetail.classList.remove('is-active');
  pageGallery.classList.add('is-active');
});

// 按展区可用高度缩放，大屏也放大铺满，避免作品说明挤入标题或底部控件
function resizeGallery() {
  if (!carousel.clientHeight) return;
  galleryScale = carousel.clientHeight / 650;
  carousel.style.scale = galleryScale;
}

new ResizeObserver(resizeGallery).observe(carousel);
resizeGallery();
render();

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
document.getElementById('cloudOptions').innerHTML = REFLECT_OPTIONS.map(name => `
  <label class="cloud-option">
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
