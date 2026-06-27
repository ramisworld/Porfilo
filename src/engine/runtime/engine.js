/* PortHub Engine — core runtime (plain browser JS, no imports).
   Reads window.SPEC (DesignSpec) + window.DATA (ProfileData), builds the page,
   and wires the interactive systems. Registries live on window.PH (backgrounds,
   gimmicks, skins, archetypes). This file boots last. */
(function () {
  "use strict";
  var PH = (window.PH = window.PH || {});

  // ---- helpers ----
  PH.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  var FONT_STACKS = {
    mono: "'SF Mono',ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace",
    grotesk: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
    serif: "ui-serif,Georgia,'Times New Roman',serif",
    geometric: "'Avenir Next','Century Gothic',ui-rounded,system-ui,sans-serif",
    condensed: "'Arial Narrow','Roboto Condensed','Helvetica Neue',ui-sans-serif,sans-serif",
    rounded: "'SF Pro Rounded',Nunito,ui-rounded,'Segoe UI',system-ui,sans-serif",
  };
  PH.font = function (n) { return FONT_STACKS[n] || FONT_STACKS.grotesk; };

  function clamp01(n) { return Math.max(0, Math.min(1, Number(n) || 0)); }
  function hexToRgb(h) {
    h = (h || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h || "000000", 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  PH.rgba = function (hex, a) { var c = hexToRgb(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
  // WCAG relative luminance + contrast ratio — the taste/safety net.
  function relLum(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var la = relLum(a), lb = relLum(b), hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); }
  PH.relLum = relLum; PH.contrast = contrast; PH.hexToRgb = hexToRgb;

  // ---- theme ----
  function applyTheme(spec) {
    var t = spec.theme, r = document.documentElement.style;
    r.setProperty("--bg", t.bg); r.setProperty("--fg", t.fg);
    r.setProperty("--muted", t.muted); r.setProperty("--border", t.border);
    r.setProperty("--accent", t.accent); r.setProperty("--accent2", t.accent2);
    r.setProperty("--glow", t.glow);
    // Contrast guarantees (no roll is ever unreadable):
    //  --on-accent: text/icon color that sits ON an accent fill (buttons, active nav).
    //  --accent-ink: accent used AS text on the page bg; if it fails large-text
    //                contrast (3:1) we fall back to --fg so it always reads.
    var aRgb = hexToRgb(t.accent), bgRgb = hexToRgb(t.bg);
    r.setProperty("--on-accent", relLum(aRgb) > 0.42 ? "#0a0a0a" : "#ffffff");
    r.setProperty("--accent-ink", contrast(aRgb, bgRgb) >= 3 ? t.accent : t.fg);
    r.setProperty("--radius", { sharp: "2px", soft: "14px", round: "26px" }[t.radius] || "14px");
    var glass = clamp01(t.glass);
    r.setProperty("--card-bg", glass > 0.05 ? PH.rgba(t.surface, 0.35 + glass * 0.4) : t.surface);
    r.setProperty("--card-blur", glass > 0.05 ? Math.round(6 + glass * 16) + "px" : "0px");
    r.setProperty("--font-display", PH.font(spec.typography.display));
    r.setProperty("--font-body", PH.font(spec.typography.body));
    r.setProperty("--fs", { compact: "15px", normal: "16px", large: "17px" }[spec.typography.scale] || "16px");
    document.body.setAttribute("data-archetype", spec.archetype);
    document.body.setAttribute("data-experience", spec.experience || "classic");
    document.body.setAttribute("data-motion", spec.motion);
  }

  // ---- scroll progress hub (backgrounds subscribe) ----
  PH.scroll = { y: 0, progress: 0, vel: 0, subs: [] };
  PH.onScroll = function (fn) { PH.scroll.subs.push(fn); };
  function initScroll() {
    var nav = document.getElementById("ph-nav");
    var cue = document.getElementById("ph-cue");
    var last = 0, ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || 0;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      PH.scroll.vel = y - last; last = y;
      PH.scroll.y = y; PH.scroll.progress = clamp01(y / max);
      if (nav) nav.classList.toggle("scrolled", y > 8);
      if (cue) cue.classList.toggle("hide", y > 40);
      for (var i = 0; i < PH.scroll.subs.length; i++) PH.scroll.subs[i](PH.scroll);
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ---- reveal on scroll ----
  // On phone-width viewports (and the nested srcDoc iframe inside the
  // dashboard preview), scroll events on mobile are unreliable, so
  // IntersectionObserver-driven reveals never fire and everything below
  // the initial viewport stays at opacity: 0 — the page looks blank below
  // the hero. Short-circuit there and just reveal everything.
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    var narrow = typeof window !== "undefined" && window.innerWidth <= 720;
    if (!("IntersectionObserver" in window) || narrow) {
      els.forEach(function (e) { e.classList.add("in"); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }

  // ---- nav active section ----
  function initNavActive(ids) {
    var links = {};
    document.querySelectorAll("#ph-nav .links a").forEach(function (a) {
      var id = a.getAttribute("href").slice(1); links[id] = a;
      a.addEventListener("click", function (ev) {
        var el = document.getElementById(id);
        if (el) { ev.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].classList.toggle("active", k === en.target.id); });
        }
      });
    }, { threshold: 0.4 });
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // ---- section building ----
  function sectionTitle(type) {
    return { stats: "Status", languages: "Languages", projects: "Projects", about: "About", contact: "Contact" }[type] || type;
  }
  function shead(index, title, spec) {
    var n = ("0" + index).slice(-2);
    return '<header class="ph-shead reveal"><span class="n">' + n + "</span><h2>" + PH.esc(title) + '</h2><span class="rule"></span></header>';
  }
  function renderSection(def, index, spec, data) {
    if (def.type === "hero") return PH.archetypes.hero(data, spec);
    var title = def.title || sectionTitle(def.type), inner = "";
    if (def.type === "stats") {
      inner = '<div class="ph-grid cols-3">' + (data.stats || []).map(function (s) { return '<div class="reveal">' + PH.skins.statCard(s, spec.skins.statCard) + "</div>"; }).join("") + "</div>";
    } else if (def.type === "languages") {
      inner = '<div class="reveal">' + PH.skins.langbar(data.languages || [], spec.skins.langBar) + "</div>";
    } else if (def.type === "projects") {
      var cols = (data.projects || []).length > 4 ? "cols-3" : "cols-2";
      inner = '<div class="ph-grid ' + cols + '">' + (data.projects || []).map(function (p) { return '<div class="reveal">' + PH.skins.projectCard(p, spec.skins.projectCard, spec.skins.button) + "</div>"; }).join("") + "</div>";
    } else if (def.type === "about") {
      inner = '<div class="ph-about reveal"><p>' + PH.esc(data.identity.headline || "") + "</p></div>";
    } else if (def.type === "contact") {
      inner = '<div class="ph-contact reveal">' + linkButtons(data.identity.links, spec.skins.button) + "</div>";
    }
    return '<section id="' + def.type + '" data-section="' + def.type + '"><div class="ph-wrap">' + shead(index, title, spec) + inner + "</div></section>";
  }
  function linkButtons(links, skin) {
    links = links || {}; var out = [];
    if (links.github) out.push(btn("GitHub", links.github, skin));
    if (links.site) out.push(btn("Website", links.site, skin));
    if (links.x) out.push(btn("X", links.x, skin));
    if (links.linkedin) out.push(btn("LinkedIn", links.linkedin, skin));
    if (links.email) out.push(btn("Email", "mailto:" + links.email, skin));
    return out.join("");
  }
  function btn(label, href, skin) {
    var mail = href.indexOf("mailto:") === 0;
    return '<a class="ph-btn" data-skin="' + skin + '" href="' + PH.esc(href) + '"' + (mail ? "" : ' target="_blank" rel="noreferrer"') + ">" + PH.esc(label) + "</a>";
  }
  PH.btn = btn; PH.linkButtons = linkButtons;

  function buildNav(spec, data, sectionDefs) {
    var brand = spec.archetype === "terminal" ? "~/" + (data.identity.name || "") : (data.identity.name || "");
    var links = sectionDefs.filter(function (d) { return d.type !== "hero"; })
      .map(function (d) { return '<a href="#' + d.type + '">' + PH.esc(d.title || sectionTitle(d.type)) + "</a>"; }).join("");
    var gh = data.identity.links && data.identity.links.github;
    if (gh) links += '<a href="' + PH.esc(gh) + '" target="_blank" rel="noreferrer">github</a>';
    return '<header id="ph-nav" data-skin="' + spec.skins.nav + '"><div class="bar"><a class="brand" href="#hero">' + PH.esc(brand) + '</a><nav class="links">' + links + "</nav></div></header>";
  }

  // ---- boot ----
  function boot() {
    var spec = window.SPEC, data = window.DATA;
    if (!spec || !data) return;
    applyTheme(spec);

    var defs = (spec.sections && spec.sections.length ? spec.sections : [{ type: "hero" }]);
    var exp = spec.experience && spec.experience !== "classic" && PH.experiences && PH.experiences[spec.experience];
    var html = "";
    html += '<canvas id="ph-bg"></canvas><div id="ph-aurora" style="display:none"></div>';
    if (exp && typeof exp.render === "function") {
      html += exp.render(data, spec, defs);
    } else {
      html += buildNav(spec, data, defs);
      html += "<main>";
      defs.forEach(function (d, i) { html += renderSection(d, i, spec, data); });
      html += "</main>";
      html += '<div id="ph-cue"><span>scroll</span><span class="chev"></span></div>';
      html += '<footer><div class="ph-wrap">// ' + PH.esc(data.identity.name || "") + " — built with PortHub" + (data.identity.links && data.identity.links.github ? ' · <a href="' + PH.esc(data.identity.links.github) + '" target="_blank" rel="noreferrer">' + PH.esc(data.identity.links.github.replace(/^https?:\/\//, "")) + "</a>" : "") + "</div></footer>";
    }

    // Build into #ph-app (not body) so the premium layer's boot overlay, custom
    // cursor and WebGL canvas — added to <body> before this runs — survive.
    var premium = !!window.__PHP;
    var app = document.getElementById("ph-app");
    if (!app) { app = document.createElement("div"); app.id = "ph-app"; document.body.appendChild(app); }
    app.innerHTML = html;
    if (exp && typeof exp.mount === "function") {
      try { exp.mount(data, spec); } catch (e) {}
    }

    initScroll();
    // Premium owns reveals (GSAP) + the WebGL background. Run the 2D systems only
    // when premium is absent, or when it explicitly asked for the 2D fallback.
    if (!premium) initReveal();
    initNavActive(defs.filter(function (d) { return d.type !== "hero"; }).map(function (d) { return d.type; }).concat(["hero"]));
    if (!premium || window.__PHP_FALLBACK_BG) {
      try { if (PH.backgrounds && PH.backgrounds[spec.background.mode]) PH.backgrounds[spec.background.mode](spec); } catch (e) {}
    }
    try { if (spec.heroGimmick && PH.gimmicks && PH.gimmicks[spec.heroGimmick.type]) PH.gimmicks[spec.heroGimmick.type](spec, data); } catch (e) {}

    if (premium && typeof window.__PHP_domReady === "function") window.__PHP_domReady();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 0);
})();
