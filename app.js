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
      body:
        "خۆشحاڵ دەبین بە ئامادەبوونی بەڕێزتان لە مەراسیمی کردنەوەی لقی (دوو)ی مستەر کافێ.\n" +
        "هاتنتان مایەی خۆشحاڵیمانە.",
    },
    "2": {
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
    toast: el("toast"),
  };

  /* ================= ٣) حاڵەت ================= */

  const state = {
    fontPx: Math.round(CFG.fontRatio * 1536),
    baselineY: CFG.baselineY,
    centerX: CFG.centerX,
    color: CFG.color,
    template: "1",
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
    probeCtx.textBaseline = "middle";
    probeCtx.fillStyle = "#000";
    probeCtx.fillText(text, w / 2, h / 2);

    const data = probeCtx.getImageData(0, 0, w, h).data;
    let minX = w;
    let maxX = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4 + 3] > 32) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }

    if (maxX < minX) return { width: advance, dx: 0 }; // هیچ مەرەکەبێک نەدۆزرایەوە

    return {
      width: maxX - minX + 1,
      // چەند پیکسڵ ناوەکە بجووڵێنین بۆ ئەوەی مەرەکەب ڕاستەوخۆ لە ناوەنددا بێت
      dx: w / 2 - (minX + maxX + 1) / 2,
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

  function draw() {
    if (!ready) return;

    // ١. باکگراوند — وێنەکە بە قەبارەی سەرەکی خۆی
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // ٢. ناوی میوان لەسەر خاڵەکان
    const name = ui.name.value.trim();
    if (!name) return;

    ctx.save();
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = state.color;

    const { px, ink } = fitFont(state.fontPx, name);
    ctx.font = `bold ${px}px ${CFG.fontFamily}`;

    const x = canvas.width * state.centerX + ink.dx;
    const y = canvas.height * state.baselineY;
    ctx.fillText(name, x, y);

    ctx.restore();

    // ئاگادارکردنەوە کاتێک فۆنت خۆکارانە بچووک کراوە بۆ ئەوەی لە خاڵەکان تێپەڕ نەکات
    ui.fontSizeOut.textContent =
      px < state.fontPx ? `${state.fontPx}px → ${px}px` : `${state.fontPx}px`;
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
  }

  function wireEvents() {
    ui.name.addEventListener("input", render);
    ui.template.addEventListener("change", () => {
      state.template = ui.template.value;
      render();
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

  /* ================= ١٠) دەستپێکردن ================= */

  async function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`نەتوانرا وێنە باربکرێت: ${src}`));
      img.src = src;
    });
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

    try {
      bgImage = await loadImage(CFG.imageSrc);
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
      ctx.fillText(CFG.imageSrc, canvas.width / 2, canvas.height / 2 + 20);
      ctx.font = `400 32px ${CFG.fontFamily}`;
      ctx.fillText("فایلەکە لە تەنیشت index.html دابنێ", canvas.width / 2, canvas.height / 2 + 90);
      toast("new_invite_bg.jpg نەدۆزرایەوە");
      return;
    }

    canvas.width = bgImage.naturalWidth || bgImage.width;
    canvas.height = bgImage.naturalHeight || bgImage.height;

    await waitForFonts();

    ready = true;
    syncControls();
    wireEvents();
    render();
  }

  init();
})();
