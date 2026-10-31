/* ===================================================================
   دروستکەری بانگهێشتنامەی مستەر کافێ  —  app.js
   -------------------------------------------------------------------
   ئەم فایلە ناوێکی میوان لەسەر وێنەی بانگهێشتنامەکە دەنووسێت و
   دەقی واتساپیش ئامادە دەکات. هیچ پێویستی بە سێرڤەر یان build نییە —
   تەنها فایلەکان بکەرەوە (index.html) و کارەکە دەست پێدەکات.

   وێنە: ./new_invite_bg.jpg  (١٥٣٦ × ٢٧٥٢)
   خاڵەکانی بەردەم «بەڕێز» لەم شوێنەدان (بە پیکسڵ لەسەر وێنەی
   ١٥٣٦ × ٢٧٥٢):  x = ٢٩١ … ١٠٧٧ ،  y ≈ ١٦٣٤
   بۆیە ناو لەسەر ئەو هێڵە دادەنرێت:
       centerX   = 684 / 1536 ≈ 0.445
       baselineY = 1624 / 2752 ≈ 0.590   (بنەڕەتی نووسین لە سەرووی خاڵەکان)
   =================================================================== */

(function () {
  "use strict";

  /* ================= ١) ڕێکخستنی بنەڕەت (لێرە بگۆڕە) ================= */

  const CFG = {
    imageSrc: "new_invite_bg.jpg", // وێنەی باکگراوند لە تەنیشت index.html

    // شوێنی ناو (ڕێژە بۆ قەبارەی وێنە — ٠ … ١)
    centerX: 0.445,     // ناوەندی ئاسۆیی (ناوەندی خاڵەکان)
    baselineY: 0.585,   // بەرزی بنەڕەتی نووسین (سەر خاڵەکان)
    fontRatio: 0.055,   // قەبارەی فۆنت = 0.055 × پانی وێنە ≈ ٨٤px
    maxWidthRatio: 0.49, // زۆرترین پانیی ناو (خاڵەکان ≈ ٠.٥١٢) — ئەگەر زیاتر بوو فۆنت بچووک دەکرێت
    minFontPx: 26,

    color: "#2b1a12",   // ڕەنگی ناو (قاوەیییەکی تاریک، وەک نووسینی وێنەکە)
    fontFamily: '"Noto Naskh Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif',
    jpegQuality: 0.92,
    bulkDelayMs: 550,   // مۆڵەت لە نێوان داگرتنی چەند وێنە
  };

  const STORAGE_KEY = "mrcafe-invite:v1";

  /* دەقەکان — وەک لە کۆدی پێشوودا هەبوو، تەنها ڕێکخراوتر */
  const TEMPLATES = {
    "1": {
      // وێنەیەک کە دەقی یەکەم لەسەر چاپکراوە
      image: "new_invite_bg.jpg",
      body:
        "خۆشحاڵ دەبین بە ئامادەبوونی بەڕێزتان لە مەراسیمی کردنەوەی لقی (دوو)ی مستەر کافێ.\n" +
        "هاتنتان مایەی خۆشحاڵیمانە.",
    },
    "2": {
      // وێنەیەک کە دەقی دووەم لەسەر چاپکراوە
      image: "new_invite_bg_2.jpg",
      body:
        "بەڕێزتان بانگێشت کراون بۆ مەراسیمی کردنەوەی لقی (دوو)ی مستەر کافێ،\n" +
        "ئامادەبوونتان مایەی خۆشحاڵیمانە.",
    },
  };

  const LOCATION_LINE = "شوێن: قوتابخانەی لەیلان قاسم — کەلار، تەنیشت بۆکۆپیی کردن";

  /* ================= ٢) ئەلیمێنتەکان ================= */

  const el = (id) => document.getElementById(id);

  const canvas = el("inviteCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    name: el("guestName"),
    template: el("template"),
    fontSize: el("fontSize"),
    fontSizeOut: el("fontSizeOut"),
    baseline: el("baseline"),
    baselineOut: el("baselineOut"),
    centerX: el("centerX"),
    centerXOut: el("centerXOut"),
    color: el("nameColor"),
    reset: el("resetBtn"),
    message: el("messageOutput"),
    copy: el("copyBtn"),
    download: el("downloadBtn"),
    namesList: el("namesList"),
    downloadAll: el("downloadAllBtn"),
    copyAll: el("copyAllBtn"),
    bulkStatus: el("bulkStatus"),
    pdfPaper: el("pdfPaper"),
    pdfPerPage: el("pdfPerPage"),
    pdfCutLines: el("pdfCutLines"),
    pdfBtn: el("pdfBtn"),
    toast: el("toast"),
  };

  /* ================= ٣) حاڵەت ================= */

  const state = {
    fontPx: Math.round(CFG.fontRatio * 1536),
    baselineY: CFG.baselineY,
    centerX: CFG.centerX,
    color: CFG.color,
    template: "1",
    pdfPaper: "a4",
    pdfPerPage: 1,
    pdfCutLines: false,
  };

  let bgImage = null;
  let ready = false;
  let pendingFrame = 0;

  /* ================= ٤) یارمەتیدەرەکان ================= */

  let toastTimer = 0;
  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2600);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function safeFileName(name) {
    const cleaned = name
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60);
    return cleaned || "Guest";
  }

  function buildMessage(name, templateId) {
    const t = TEMPLATES[templateId] || TEMPLATES["1"];
    const clean = (name || "").trim();
    const greeting = clean
      ? `بەڕێز ${clean}،`
      : "بەڕێز،";

    return [
      "بانگهێشتنامە",
      greeting,
      "",
      t.body,
      "",
      LOCATION_LINE,
    ].join("\n");
  }

  /* ================= ٥) وێنەکێشان ================= */

  /*
   * پێوانەی مەرەکەبی ڕاستەقینەی نووسین (getImageData لەسەر کانواسێکی کاتیک).
   * ئەمە وای دەکات ناو بە ڕاستی لە ناوەندی خاڵەکاندا دابنرێت — بۆ نووسینی
   * کوردی/عەرەبی (RTL) و ئینگلیزیش هەمان ئەنجام دەدات، بێ گوێدانە
   * جیاوازیی actualBoundingBox لە وێبگەڕەکاندا.
   */
  const probeCanvas = document.createElement("canvas");
  const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });

  function measureInk(text, px) {
    const font = `bold ${px}px ${CFG.fontFamily}`;
    const pad = Math.ceil(px * 0.75);
    const h = Math.ceil(px * 2.6);

    probeCtx.font = font;
    probeCtx.direction = "rtl";
    const advance = probeCtx.measureText(text).width;
    const w = Math.max(8, Math.ceil(advance + pad * 2));

    // گۆڕینی قەبارە stateـی کۆنتێکستەکە دەسڕێتەوە — دووبارە دایدەنێین
    probeCanvas.width = w;
    probeCanvas.height = h;
    probeCtx.font = font;
    probeCtx.direction = "rtl";
    probeCtx.textAlign = "center";
    probeCtx.textBaseline = "alphabetic";
    probeCtx.fillStyle = "#000";
    const baseY = h * 0.72; // بنەڕەتی نووسین لە کانواسی پێوانە
    probeCtx.fillText(text, w / 2, baseY);

    const data = probeCtx.getImageData(0, 0, w, h).data;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4 + 3] > 32) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX) {
      // هیچ مەرەکەبێک نەدۆزرایەوە
      return { width: advance, dx: 0, top: -px * 0.8, bottom: px * 0.2 };
    }

    return {
      width: maxX - minX + 1,
      // چەند پیکسڵ ناوەکە بجووڵێنین بۆ ئەوەی مەرەکەب ڕاستەوخۆ لە ناوەنددا بێت
      dx: w / 2 - (minX + maxX + 1) / 2,
      // مەودای ستوونی مەرەکەب بە ڕێژە بۆ بنەڕەتی نووسین (سالب = لە سەرەوە)
      top: minY - baseY,
      bottom: maxY + 1 - baseY,
    };
  }

  /* قەبارەی فۆنت بچووک دەکات هەتا ناوەکە لە نێوان خاڵەکاندا جێ ببێتەوە */
  function fitFont(size, text) {
    const maxWidth = canvas.width * CFG.maxWidthRatio;
    let px = size;
    let ink = measureInk(text, px);
    while (px > CFG.minFontPx && ink.width > maxWidth) {
      px -= 2;
      ink = measureInk(text, px);
    }
    return { px, ink };
  }

  /* شوێن و قەبارەی ناو لەسەر کارتەکە (پیکسڵ لەسەر کانواسی ١٥٣٦ × ٢٧٥٢) */
  function computeNameLayout(name) {
    const { px, ink } = fitFont(state.fontPx, name);
    return {
      name,
      px,
      ink,
      font: `bold ${px}px ${CFG.fontFamily}`,
      anchorX: canvas.width * state.centerX + ink.dx,
      baselineY: canvas.height * state.baselineY,
      color: state.color,
    };
  }

  function draw() {
    if (!ready) return;

    // ١. باکگراوند — وێنەکە بە قەبارەی سەرەکی خۆی
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // ٢. ناوی میوان لەسەر خاڵەکان
    const name = ui.name.value.trim();
    if (!name) return;

    const L = computeNameLayout(name);

    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = L.color;
    ctx.font = L.font;
    ctx.fillText(name, L.anchorX, L.baselineY);
    ctx.restore();

    // ئاگادارکردنەوە کاتێک فۆنت خۆکارانە بچووک کراوە بۆ ئەوەی لە خاڵەکان تێپەڕ نەکات
    ui.fontSizeOut.textContent =
      L.px < state.fontPx ? `${state.fontPx}px → ${L.px}px` : `${state.fontPx}px`;
  }

  function render() {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      draw();
      ui.message.value = buildMessage(ui.name.value, ui.template.value);
      saveState();
    });
  }

  /* ================= ٦) پاشەکەوتکردنی ڕێکخستن ================= */

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          name: ui.name.value,
          template: ui.template.value,
          fontPx: state.fontPx,
          baselineY: state.baselineY,
          centerX: state.centerX,
          color: state.color,
          pdfPaper: state.pdfPaper,
          pdfPerPage: state.pdfPerPage,
          pdfCutLines: state.pdfCutLines,
        })
      );
    } catch (e) {
      /* file:// لە هەندێک وێبگەڕدا ڕێگە بە localStorage نادات — گرنگ نییە */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.name === "string") ui.name.value = saved.name;
      if (TEMPLATES[saved.template]) {
        ui.template.value = saved.template;
        state.template = saved.template;
      }
      if (Number.isFinite(saved.fontPx)) state.fontPx = saved.fontPx;
      if (Number.isFinite(saved.baselineY)) state.baselineY = saved.baselineY;
      if (Number.isFinite(saved.centerX)) state.centerX = saved.centerX;
      if (typeof saved.color === "string") state.color = saved.color;
      if (PAPERS[saved.pdfPaper]) state.pdfPaper = saved.pdfPaper;
      if (Number.isFinite(saved.pdfPerPage)) state.pdfPerPage = saved.pdfPerPage;
      if (typeof saved.pdfCutLines === "boolean") state.pdfCutLines = saved.pdfCutLines;
    } catch (e) {
      /* هیچ */
    }
  }

  function applyUrlParams() {
    const p = new URLSearchParams(location.search);
    if (p.has("name")) ui.name.value = p.get("name");
    if (TEMPLATES[p.get("t")]) {
      ui.template.value = p.get("t");
      state.template = p.get("t");
    }
    if (p.has("y")) {
      const v = parseFloat(p.get("y"));
      if (Number.isFinite(v)) state.baselineY = v;
    }
    if (p.has("x")) {
      const v = parseFloat(p.get("x"));
      if (Number.isFinite(v)) state.centerX = v;
    }
    if (p.has("size")) {
      const v = parseInt(p.get("size"), 10);
      if (Number.isFinite(v)) state.fontPx = v;
    }
  }

  /* ================= ٧) هاوکێشکردنی کۆنترۆڵەکان ================= */

  function syncControls() {
    ui.template.value = state.template;
    ui.fontSize.value = String(state.fontPx);
    ui.baseline.value = String(state.baselineY);
    ui.centerX.value = String(state.centerX);
    ui.color.value = state.color;

    ui.fontSizeOut.textContent = `${state.fontPx}px`;
    ui.baselineOut.textContent = state.baselineY.toFixed(3);
    ui.centerXOut.textContent = state.centerX.toFixed(3);

    ui.pdfPaper.value = state.pdfPaper;
    ui.pdfPerPage.value = String(state.pdfPerPage);
    ui.pdfCutLines.checked = state.pdfCutLines;
  }

  function wireEvents() {
    ui.name.addEventListener("input", render);
    ui.template.addEventListener("change", () => {
      state.template = ui.template.value;
      // هەر دەقێک وێنەی خۆی هەیە — پێش کێشان وێنەکە دەگۆڕدرێت
      applyTemplateImage(state.template).then(render);
    });

    ui.fontSize.addEventListener("input", () => {
      state.fontPx = parseInt(ui.fontSize.value, 10);
      syncControls();
      render();
    });
    ui.baseline.addEventListener("input", () => {
      state.baselineY = parseFloat(ui.baseline.value);
      syncControls();
      render();
    });
    ui.centerX.addEventListener("input", () => {
      state.centerX = parseFloat(ui.centerX.value);
      syncControls();
      render();
    });
    ui.color.addEventListener("input", () => {
      state.color = ui.color.value;
      render();
    });

    ui.pdfPaper.addEventListener("change", () => {
      state.pdfPaper = ui.pdfPaper.value;
      saveState();
    });
    ui.pdfPerPage.addEventListener("change", () => {
      state.pdfPerPage = parseInt(ui.pdfPerPage.value, 10) || 1;
      saveState();
    });
    ui.pdfCutLines.addEventListener("change", () => {
      state.pdfCutLines = ui.pdfCutLines.checked;
      saveState();
    });
    ui.pdfBtn.addEventListener("click", downloadPdf);

    ui.reset.addEventListener("click", () => {
      state.fontPx = Math.round(CFG.fontRatio * canvas.width);
      state.baselineY = CFG.baselineY;
      state.centerX = CFG.centerX;
      state.color = CFG.color;
      state.template = "1";
      syncControls();
      render();
      toast("ڕێکخستنەکان گەڕانەوە بۆ شێوەی بنەڕەت");
    });

    ui.copy.addEventListener("click", copyMessage);
    ui.download.addEventListener("click", downloadOne);
    ui.downloadAll.addEventListener("click", downloadAll);
    ui.copyAll.addEventListener("click", copyAllMessages);

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        downloadOne();
      }
      if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        const active = document.activeElement;
        const typing =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT");
        if (!typing && window.getSelection().toString() === "") {
          e.preventDefault();
          copyMessage();
        }
      }
    });
  }

  /* ================= ٨) کۆپیکردن ================= */

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      /* دەکەوێتە سەر ڕێگای یەدەگ */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.insetInlineStart = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function copyMessage() {
    const msg = ui.message.value || buildMessage(ui.name.value, ui.template.value);
    if (!ui.name.value.trim()) {
      toast("سەرەتا ناوی میوان بنووسە");
      return;
    }
    const ok = await copyText(msg);
    toast(ok ? "دەقەکە کۆپیکرا — لە واتساپ پەیست بکە" : "کۆپیکردن سەرکەوتوو نەبوو");
  }

  async function copyAllMessages() {
    const names = readNames();
    if (!names.length) {
      toast("لانیکەم یەک ناو بنووسە لە لیستی ناوان");
      return;
    }
    const all = names.map((n) => buildMessage(n, ui.template.value)).join("\n\n————————\n\n");
    const ok = await copyText(all);
    toast(ok ? `دەقی ${names.length} ناو کۆپیکرا` : "کۆپیکردن سەرکەوتوو نەبوو");
  }

  /* ================= ٩) داگرتن ================= */

  let exportBlocked = false;

  function canvasToBlob() {
    return new Promise((resolve) => {
      if (!canvas.toBlob) {
        resolve(null);
        return;
      }
      try {
        canvas.toBlob(resolve, "image/jpeg", CFG.jpegQuality);
      } catch (err) {
        // ئەگەر پەڕەکە بە file:// کرابێتەوە، وێبگەڕ کانواسەکە «پیس» دەکات و
        // ڕێگە بە دەرکردنی وێنە نادات. لەم حاڵەتەدا ڕێنمایی پیشان دەدەین.
        exportBlocked = true;
        showFileBanner();
        resolve(null);
      }
    });
  }

  function showFileBanner() {
    const banner = document.getElementById("fileBanner");
    if (banner) banner.hidden = false;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadOne() {
    const name = ui.name.value.trim();
    if (!name) {
      toast("سەرەتا ناوی میوان بنووسە");
      ui.name.focus();
      return;
    }
    draw();
    const blob = await canvasToBlob();
    if (!blob) {
      toast(
        exportBlocked
          ? "پەڕەکە بە file:// کراوەتەوە — بۆ داگرتن ./start.sh بەکاربهێنە"
          : "دروستکردنی وێنە سەرکەوتوو نەبوو"
      );
      return;
    }
    triggerDownload(blob, `MrCafe_Invitation_${safeFileName(name)}.jpg`);
    toast("وێنەکە داگیرا ✓");
  }

  function readNames() {
    return (ui.namesList.value || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function downloadAll() {
    const names = readNames();
    if (!names.length) {
      toast("لانیکەم یەک ناو بنووسە لە لیستی ناوان");
      ui.namesList.focus();
      return;
    }

    ui.downloadAll.disabled = true;
    ui.bulkStatus.textContent = `٠ / ${names.length}`;

    for (let i = 0; i < names.length; i++) {
      ui.name.value = names[i];
      draw();
      const blob = await canvasToBlob();
      if (blob) {
        triggerDownload(blob, `MrCafe_Invitation_${safeFileName(names[i])}.jpg`);
      } else if (exportBlocked) {
        ui.bulkStatus.textContent =
          "ناکرێت وێنە دەربکرێت لە file:// — بە ./start.sh پەڕەکە بکەرەوە";
        break;
      }
      ui.bulkStatus.textContent = `${i + 1} / ${names.length} — ${names[i]}`;
      await sleep(CFG.bulkDelayMs);
    }

    // پێشبینین بگەڕێنەوە سەر ناوی یەکەم
    ui.name.value = names[0];
    draw();
    ui.message.value = buildMessage(names[0], ui.template.value);
    ui.downloadAll.disabled = false;
    ui.bulkStatus.textContent = `تەواو بوو — ${names.length} وێنە داگیرا ✓`;
    toast(`${names.length} وێنە داگیرا ✓`);
  }

  /* ================= ٩.٥) دروستکردنی PDF (A4 / A3) =================
   *
   * بێ هیچ کتێبخانەیەک: PDF ـێکی ساکار خۆمان دروست دەکەین.
   *   • باکگراوندی کارت تەنها **یەک جار** وەک JPEG لە PDF دا دانرێت
   *     (DCTDecode) و لە هەموو پەڕەکان دووبارە بەکارهێنرێت.
   *   • ناوی هەر میوانێک وەک وێنەیەکی بچووکی شەفاف دانرێت:
   *     RGB ـێکی یەکڕەنگ + SMask (alpha) کە بە FlateDecode چڕ دەکرێتەوە.
   *   بەم شێوەیە ١٠٠ ناو لە چەند سەد کیلۆبایتێکدا دەمێنێتەوە، نەک ١٠٠ مێگابایت.
   * ================================================================ */

  const PAPERS = {
    a4: { label: "A4", w: 595.276, h: 841.89 }, // 210 × 297 mm
    a3: { label: "A3", w: 841.89, h: 1190.551 }, // 297 × 420 mm
  };

  const CARD_ASPECT = 2752 / 1536; // بەرزی / پانی کارت

  /* باشترین ڕیزبەندیی کارتەکان لەسەر لاپەڕە (خۆکار: وێنەیی یان ئەستوونی) */
  function planLayout(count, paperKey, perPage) {
    const paper = PAPERS[paperKey] || PAPERS.a4;
    const margin = 16; // پۆینت (~٥.٦ ملم)
    const gap = 10;

    let best = null;
    for (const orient of [
      { w: paper.w, h: paper.h, name: "portrait" },
      { w: paper.h, h: paper.w, name: "landscape" },
    ]) {
      for (let cols = 1; cols <= perPage; cols++) {
        const rows = Math.ceil(perPage / cols);
        if (cols * rows < perPage) continue;

        const availW = orient.w - margin * 2 - gap * (cols - 1);
        const availH = orient.h - margin * 2 - gap * (rows - 1);
        if (availW <= 0 || availH <= 0) continue;

        const cardW = Math.min(availW / cols, availH / rows / CARD_ASPECT);
        if (cardW <= 0) continue;
        if (!best || cardW > best.cardW) {
          best = {
            pageW: orient.w,
            pageH: orient.h,
            orientation: orient.name,
            cols,
            rows,
            cardW,
            cardH: cardW * CARD_ASPECT,
            gap,
          };
        }
      }
    }

    const gridW = best.cols * best.cardW + best.gap * (best.cols - 1);
    const gridH = best.rows * best.cardH + best.gap * (best.rows - 1);
    const startX = (best.pageW - gridW) / 2;
    const startY = (best.pageH - gridH) / 2;

    best.cells = [];
    for (let i = 0; i < perPage; i++) {
      const row = Math.floor(i / best.cols);
      const col = i % best.cols;
      best.cells.push({
        // ڕیزکردن لە ڕاستەوە بۆ چەپ (RTL)
        x: startX + (best.cols - 1 - col) * (best.cardW + best.gap),
        y: best.pageH - startY - best.cardH - row * (best.cardH + best.gap),
        w: best.cardW,
        h: best.cardH,
      });
    }

    best.pageCount = Math.ceil(count / perPage);
    best.perPage = perPage;
    return best;
  }

  /* چڕکردنەوە بە zlib (هەمان شتێک کە PDF بۆ /FlateDecode پێویستی پێیەتی) */
  async function deflateBytes(bytes) {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  /* ناوی میوان وەک کانواسێکی شەفاف + شوێنی لەسەر کارتەکە */
  function renderNameOverlay(L) {
    const pad = 2;
    const w = Math.max(2, Math.ceil(L.ink.width) + pad * 2);
    const h = Math.max(2, Math.ceil(L.ink.bottom - L.ink.top) + pad * 2);

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.direction = "rtl";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = L.font;
    g.fillStyle = L.color;
    g.fillText(L.name, w / 2 + L.ink.dx, pad - L.ink.top);

    return {
      canvas: c,
      w,
      h,
      ox: Math.round(L.anchorX - w / 2), // شوێن لەسەر کارت (پیکسڵ، سەرەوە-چەپ)
      oy: Math.round(L.baselineY + L.ink.top - pad),
      color: L.color,
    };
  }

  function hexToRgb(hex) {
    const h = (hex || "#000000").replace("#", "");
    const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* وێنەی شەفافی ناو → {rgb, alpha} ی خاو */
  function overlayToRgba(overlay) {
    const { w, h } = overlay;
    const src = overlay.canvas.getContext("2d").getImageData(0, 0, w, h).data;
    const [r, g, b] = hexToRgb(overlay.color);
    const alpha = new Uint8Array(w * h);
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      alpha[i] = src[p + 3];
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    return { rgb, alpha };
  }

  /* ===================== نووسەری PDF ===================== */

  const fmtPt = (n) => (Math.round(n * 1000) / 1000).toString();

  /*
   * pages:  [{ w, h, content }]        — content = زنجیرەی ئۆپەرەیشنەکان
   * images: [{ key, w, h, cs, filter, data, mask? }]
   */
  function assemblePdf(pages, images) {
    const chunks = [];
    let size = 0;
    const enc = new TextEncoder();

    const push = (data) => {
      const u8 = typeof data === "string" ? enc.encode(data) : data;
      chunks.push(u8);
      size += u8.length;
    };

    // ژمارەدان بە ئۆبژێکتەکان
    let next = 3;
    const imgNum = {};
    for (const im of images) {
      imgNum[im.key] = { img: next++, mask: im.mask ? next++ : 0 };
    }
    const pageNum = [];
    const contentNum = [];
    for (let i = 0; i < pages.length; i++) {
      pageNum.push(next++);
      contentNum.push(next++);
    }
    const offsets = [];

    push("%PDF-1.7\n");
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // بایتە باینەرییەکان

    const begin = (num) => {
      offsets[num] = size;
      push(`${num} 0 obj\n`);
    };
    const end = () => push("endobj\n");

    // ١) کاتالۆگ
    begin(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\n");
    end();

    // ٢) لیستی پەڕەکان
    begin(2);
    push(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pageNum
        .map((p) => `${p} 0 R`)
        .join(" ")}] >>\n`
    );
    end();

    // ٣) وێنەکان
    for (const im of images) {
      const nums = imgNum[im.key];
      const filterClause = im.filter ? ` /Filter /${im.filter}` : "";

      begin(nums.img);
      push(
        `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} ` +
          `/ColorSpace /${im.cs} /BitsPerComponent 8${filterClause} ` +
          `/Length ${im.data.length}` +
          (im.mask ? ` /SMask ${nums.mask} 0 R` : "") +
          " >>\nstream\n"
      );
      push(im.data);
      push("\nendstream\n");
      end();

      if (im.mask) {
        const mf = im.mask.filter ? ` /Filter /${im.mask.filter}` : "";
        begin(nums.mask);
        push(
          `<< /Type /XObject /Subtype /Image /Width ${im.mask.w} /Height ${im.mask.h} ` +
            `/ColorSpace /DeviceGray /BitsPerComponent 8${mf} /Length ${im.mask.data.length} >>\nstream\n`
        );
        push(im.mask.data);
        push("\nendstream\n");
        end();
      }
    }

    // ٤) پەڕەکان + ناوەڕۆک
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const refs = [];
      for (const key of new Set(page.xobjects)) {
        refs.push(`/${key} ${imgNum[key].img} 0 R`);
      }

      begin(pageNum[i]);
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmtPt(page.w)} ${fmtPt(page.h)}] ` +
          `/Resources << /XObject << ${refs.join(" ")} >> /ProcSet [/PDF /ImageC] >> ` +
          `/Contents ${contentNum[i]} 0 R >>\n`
      );
      end();

      const stream = enc.encode(page.content);
      begin(contentNum[i]);
      push(`<< /Length ${stream.length} >>\nstream\n`);
      push(stream);
      push("\nendstream\n");
      end();
    }

    // ٥) xref + ترەیلەر
    const xrefOffset = size;
    const total = next; // ژمارەی ئۆبژێکتەکان + ١
    push(`xref\n0 ${total}\n`);
    push("0000000000 65535 f \n");
    for (let i = 1; i < total; i++) {
      push(`${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`);
    }
    push(
      `trailer\n<< /Size ${total} /Root 1 0 R /Producer (MrCafe Invitation Maker) >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`
    );

    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }

  /* باکگراوندی کارت وەک JPEG */
  function backgroundJpeg() {
    return new Promise((resolve) => {
      const c = document.createElement("canvas");
      c.width = canvas.width;
      c.height = canvas.height;
      c.getContext("2d").drawImage(bgImage, 0, 0, c.width, c.height);
      c.toBlob(
        async (blob) => resolve(blob ? new Uint8Array(await blob.arrayBuffer()) : null),
        "image/jpeg",
        CFG.jpegQuality
      );
    });
  }

  /* ===================== داگرتنی PDF ===================== */

  async function downloadPdf() {
    const names = readNames();
    if (!names.length) {
      toast("لانیکەم یەک ناو بنووسە لە لیستی ناوان");
      ui.namesList.focus();
      return;
    }

    const paperKey = ui.pdfPaper.value;
    const cutLines = ui.pdfCutLines.checked;
    // ئەگەر ناوەکان کەمتر بن لە ژمارەی دیاریکراو، خانەکان بەتاڵ ناهێڵرێن
    const perPage = Math.max(
      1,
      Math.min(parseInt(ui.pdfPerPage.value, 10) || 1, names.length)
    );

    ui.pdfBtn.disabled = true;
    const setStatus = (t) => {
      ui.bulkStatus.textContent = t;
    };
    const tick = () => new Promise((r) => setTimeout(r, 16));

    try {
      setStatus("ئامادەکردنی باکگراوند…");
      await tick();

      const bgJpeg = await backgroundJpeg();
      if (!bgJpeg) throw new Error("باکگراوند نەدەرکرا");

      const images = [
        {
          key: "Bg",
          w: canvas.width,
          h: canvas.height,
          cs: "DeviceRGB",
          filter: "DCTDecode",
          data: bgJpeg,
        },
      ];

      // ناوی هەر میوانێک → وێنەیەکی شەفاف
      const overlays = [];
      for (let i = 0; i < names.length; i++) {
        setStatus(`ئامادەکردنی ناو ${i + 1} / ${names.length}`);
        await tick();

        const L = computeNameLayout(names[i]);
        const overlay = renderNameOverlay(L);
        const { rgb, alpha } = overlayToRgba(overlay);

        const defRgb = await deflateBytes(rgb);
        const defAlpha = await deflateBytes(alpha);

        images.push({
          key: `N${i}`,
          w: overlay.w,
          h: overlay.h,
          cs: "DeviceRGB",
          filter: defRgb ? "FlateDecode" : null,
          data: defRgb || rgb,
          mask: {
            w: overlay.w,
            h: overlay.h,
            filter: defAlpha ? "FlateDecode" : null,
            data: defAlpha || alpha,
          },
        });

        overlays.push({ ox: overlay.ox, oy: overlay.oy, w: overlay.w, h: overlay.h });
        // کانواسەکە ئازاد بکە
        overlay.canvas.width = overlay.canvas.height = 0;
      }

      setStatus("ڕیزکردنی لاپەڕەکان…");
      await tick();

      const plan = planLayout(names.length, paperKey, perPage);
      const pages = [];

      for (let p = 0; p < plan.pageCount; p++) {
        let ops = "";
        const used = [];

        for (let c = 0; c < perPage; c++) {
          const idx = p * perPage + c;
          if (idx >= names.length) break;

          const cell = plan.cells[c];
          const ov = overlays[idx];

          // باکگراوند کارت
          ops +=
            `q\n${fmtPt(cell.w)} 0 0 ${fmtPt(cell.h)} ${fmtPt(cell.x)} ${fmtPt(cell.y)} cm\n` +
            "/Bg Do\nQ\n";

          // ناو — بە پۆینت لەسەر لاپەڕە (وردیی ٠.٠٠١ پۆینت)
          const scale = cell.w / canvas.width;
          const nx = cell.x + ov.ox * scale;
          const ny = cell.y + (canvas.height - ov.oy - ov.h) * scale;
          ops +=
            `q\n${fmtPt(ov.w * scale)} 0 0 ${fmtPt(ov.h * scale)} ` +
            `${fmtPt(nx)} ${fmtPt(ny)} cm\n/N${idx} Do\nQ\n`;

          // خەتی بڕین
          if (cutLines) {
            ops +=
              `q 0.4 w 0.5 G ${fmtPt(cell.x)} ${fmtPt(cell.y)} ` +
              `${fmtPt(cell.w)} ${fmtPt(cell.h)} re S Q\n`;
          }

          used.push(`Bg`, `N${idx}`);
        }

        pages.push({
          w: plan.pageW,
          h: plan.pageH,
          content: ops,
          xobjects: used,
        });
      }

      setStatus("نووسینی فایل…");
      await tick();

      const bytes = assemblePdf(pages, images);
      const blob = new Blob([bytes], { type: "application/pdf" });
      triggerDownload(
        blob,
        `MrCafe_Invitations_${PAPERS[paperKey].label}_${names.length}names.pdf`
      );

      const grid = `${plan.cols}×${plan.rows}`;
      const orientation = plan.orientation === "landscape" ? "پانی" : "بەرزی";
      ui.bulkStatus.textContent =
        `${names.length} ناو · ${PAPERS[paperKey].label} (${orientation}) · ` +
        `${perPage} لە پەڕەیەک (${grid}) · ${plan.pageCount} پەڕە · ` +
        `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
      toast("PDF ئامادە بوو ✓");
    } catch (err) {
      console.error("[pdf]", err);
      ui.bulkStatus.textContent = "دروستکردنی PDF سەرکەوتوو نەبوو: " + (err && err.message);
      toast("دروستکردنی PDF سەرکەوتوو نەبوو");
    } finally {
      ui.pdfBtn.disabled = false;
    }
  }

  /* ================= ١٠) دەستپێکردن ================= */


  async function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`نەتوانرا وێنە باربکرێت: ${src}`));
      img.src = src;
    });
  }

  /* وێنەکانی باکگراوند — هەر دەقێک وێنەی خۆی هەیە (لە بیرگە دەمێننەوە) */
  const bgCache = new Map();

  function templateUrl(templateId) {
    const t = TEMPLATES[templateId];
    return (t && t.image) || CFG.imageSrc;
  }

  async function getBackground(src) {
    if (bgCache.has(src)) return bgCache.get(src);
    const img = await loadImage(src);
    bgCache.set(src, img);
    return img;
  }

  /* گۆڕینی وێنەی باکگراوند بەپێی دەقە هەڵبژێردراوەکە */
  async function applyTemplateImage(templateId) {
    const src = templateUrl(templateId);
    let img;
    try {
      img = await getBackground(src);
    } catch (err) {
      // ئەگەر وێنەی دەقی دووەم نەبوو، بە وێنەی یەکەم بەردەوام بە
      console.error("[bg]", err);
      toast(`${src} نەدۆزرایەوە — وێنەی بنەڕەت بەکاردێت`);
      img = await getBackground(CFG.imageSrc);
    }
    bgImage = img;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ready = true;
    draw();
  }

  async function waitForFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load(`bold 64px "Noto Naskh Arabic"`, "بەڕێز ئەحمەد"),
        document.fonts.load(`400 20px "Noto Naskh Arabic"`, "بەڕێز"),
      ]);
      await document.fonts.ready;
    } catch (e) {
      /* فۆنتی سیستەم بەکاردێت */
    }
  }

  async function init() {
    loadState();
    applyUrlParams();

    // بە file:// وێبگەڕ ڕێگە بە دەرکردنی وێنە لە کانواس نادات — پێشوەخت ئاگاداری بکە
    if (location.protocol === "file:") showFileBanner();

    const src = templateUrl(state.template);

    try {
      bgImage = await getBackground(src);
    } catch (err) {
      canvas.width = 1536;
      canvas.height = 2752;
      ctx.fillStyle = "#f0e6d8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#6b543c";
      ctx.font = `bold 48px ${CFG.fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText("وێنەی باکگراوند نەدۆزرایەوە:", canvas.width / 2, canvas.height / 2 - 60);
      ctx.font = `bold 40px ${CFG.fontFamily}`;
      ctx.fillText(src, canvas.width / 2, canvas.height / 2 + 20);
      ctx.font = `400 32px ${CFG.fontFamily}`;
      ctx.fillText("فایلەکە لە تەنیشت index.html دابنێ", canvas.width / 2, canvas.height / 2 + 90);
      toast(`${src} نەدۆزرایەوە`);
      return;
    }

    canvas.width = bgImage.naturalWidth || bgImage.width;
    canvas.height = bgImage.naturalHeight || bgImage.height;

    await waitForFonts();

    ready = true;
    syncControls();
    wireEvents();
    render();

    // وێنەی دەقی دووەم پێشوەخت لە پاشبنەمدا باربکە (بۆ گۆڕینی خێرا)
    getBackground(templateUrl("2")).catch(() => {});
  }

  init();
})();
