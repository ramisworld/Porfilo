/* PortHub Engine - full-page experience packs.
   These are not themes. Each pack owns the composition, navigation, section
   names, and component metaphors while still reading the same ProfileData. */
(function () {
  "use strict";
  var PH = (window.PH = window.PH || {});
  var esc = function (s) {
    return PH.esc(s);
  };

  function arr(x) {
    return Array.isArray(x) ? x : [];
  }
  function identity(data) {
    return data.identity || { links: {} };
  }
  function links(data) {
    return identity(data).links || {};
  }
  function github(data) {
    return links(data).github || "";
  }
  function email(data) {
    return links(data).email || "";
  }
  function role(data) {
    return identity(data).role || "Developer";
  }
  function name(data) {
    return identity(data).name || "Portfolio";
  }
  function headline(data) {
    return identity(data).headline || "Building on the internet.";
  }
  // strip a github URL down to the bare handle (…/ramisworld → ramisworld)
  function ghHandle(data) {
    var g = github(data);
    if (!g) return "";
    return g
      .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
      .replace(/\/.*$/, "");
  }
  // site URL → bare host for the browser address bar (ramisworld.dev)
  function siteHost(data) {
    var s = l_safe(links(data).site);
    if (!s) return "";
    return s.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  }
  function l_safe(v) {
    return v || "";
  }
  // one aligned key/value row for the compact hero `whoami.sh` readout.
  function tnKv(k, v, mod) {
    return (
      '<div class="xp-tn-tkv' +
      (mod ? " " + mod : "") +
      '"><em>' +
      esc(k) +
      "</em><span>" +
      esc(v || "\u2014") +
      "</span></div>"
    );
  }

  function tnStack(data) {
    var seen = {};
    var out = [];
    arr(data.languages).forEach(function (l) {
      var label = l && l.label;
      if (label && !seen[label]) {
        seen[label] = true;
        out.push(label);
      }
    });
    arr(data.projects).forEach(function (p) {
      arr(p.tech).forEach(function (t) {
        if (t && !seen[t]) {
          seen[t] = true;
          out.push(t);
        }
      });
    });
    return out.slice(0, 7).join(", ") || "\u2014";
  }

  function abilities(data) {
    var out = arr(data.abilities);
    if (out.length) return out.slice(0, 14);
    var seen = {};
    arr(data.languages).forEach(function (l) {
      if (!seen[l.label])
        seen[l.label] = { label: l.label, source: "language" };
    });
    arr(data.projects).forEach(function (p) {
      arr(p.tech).forEach(function (t) {
        if (!seen[t]) seen[t] = { label: t, source: "project" };
      });
    });
    return Object.keys(seen)
      .map(function (k) {
        return seen[k];
      })
      .slice(0, 14);
  }

  function statCards(data, kind) {
    return arr(data.stats)
      .map(function (s, i) {
        return (
          '<div class="xp-card xp-stat reveal" data-kind="' +
          kind +
          '" style="--i:' +
          i +
          '">' +
          "<b>" +
          esc(s.value) +
          "</b><span>" +
          esc(s.label) +
          "</span></div>"
        );
      })
      .join("");
  }

  function abilityCloud(data, kind) {
    return (
      '<div class="xp-abilities" data-kind="' +
      kind +
      '">' +
      abilities(data)
        .map(function (a, i) {
          return (
            '<span class="xp-ability reveal" style="--i:' +
            i +
            '">' +
            "<em>" +
            String(i + 1).padStart(2, "0") +
            "</em>" +
            esc(a.label) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function languageList(data, kind) {
    return (
      '<div class="xp-languages" data-kind="' +
      kind +
      '">' +
      arr(data.languages)
        .map(function (l, i) {
          return (
            '<span class="xp-lang reveal" style="--i:' +
            i +
            '">' +
            esc(l.label) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function projectCard(p, i, kind) {
    var tech = arr(p.tech)
      .slice(0, 4)
      .map(function (t) {
        return "<span>" + esc(t) + "</span>";
      })
      .join("");
    var stars = p.stars ? "<small>STARS " + esc(p.stars) + "</small>" : "";
    return (
      '<a class="xp-card xp-project reveal" data-kind="' +
      kind +
      '" style="--i:' +
      i +
      '" href="' +
      esc(p.repoUrl) +
      '" target="_blank" rel="noreferrer">' +
      '<div class="xp-card-glow"></div><header><b>' +
      esc(p.name) +
      "</b>" +
      stars +
      "</header>" +
      "<p>" +
      esc(p.blurb || "Repository signal captured.") +
      '</p><div class="xp-tech">' +
      tech +
      "</div></a>"
    );
  }

  function projects(data, kind, max) {
    return arr(data.projects)
      .slice(0, max || 8)
      .map(function (p, i) {
        return projectCard(p, i, kind);
      })
      .join("");
  }

  function nav(items, className) {
    return (
      '<nav class="xp-nav ' +
      className +
      '" aria-label="Portfolio sections">' +
      items
        .map(function (it, i) {
          return (
            '<a href="#' +
            it.id +
            '" class="' +
            (i === 0 ? "active" : "") +
            '"><span>' +
            esc(it.k) +
            "</span>" +
            esc(it.label) +
            "</a>"
          );
        })
        .join("") +
      "</nav>"
    );
  }

  function contactBlock(data, kind) {
    var l = links(data);
    return (
      '<div class="xp-contact-actions">' +
      (email(data)
        ? '<button class="xp-action xp-copy" data-copy="' +
          esc(email(data)) +
          '">' +
          esc(email(data)) +
          "</button>"
        : "") +
      (l.github
        ? '<a class="xp-action" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GitHub</a>'
        : "") +
      (l.site
        ? '<a class="xp-action" href="' +
          esc(l.site) +
          '" target="_blank" rel="noreferrer">Website</a>'
        : "") +
      "</div>"
    );
  }

  function tnHead(num, a, b) {
    return (
      '<div class="xp-tn-head reveal">' +
      '<h2 class="xp-tn-h2">' +
      a +
      " <i>//</i> " +
      b +
      "</h2>" +
      '<span class="xp-tn-rule"></span><span class="xp-tn-idx">0:' +
      num +
      "</span></div>"
    );
  }

  // Render a string as a real `hexdump -C` block (offset, hex pairs, ASCII
  // column) — a hacker detail built from the user's actual tech stack.
  function tnHexdump(s) {
    s = String(s).slice(0, 96);
    var out = "";
    for (var off = 0; off < s.length; off += 16) {
      var chunk = s.slice(off, off + 16);
      var hex = "",
        ascii = "";
      for (var i = 0; i < 16; i++) {
        if (i < chunk.length) {
          var c = chunk.charCodeAt(i) & 0xff;
          hex += (c < 16 ? "0" : "") + c.toString(16) + " ";
          ascii += c >= 32 && c < 127 ? chunk.charAt(i) : ".";
        } else {
          hex += "   ";
        }
        if (i === 7) hex += " ";
      }
      var offStr = ("0000" + off.toString(16)).slice(-4);
      out +=
        '<div class="xp-tn-hexline"><span class="xp-tn-hexoff">' +
        offStr +
        "</span>" +
        '<span class="xp-tn-hexb">' +
        hex +
        "</span>" +
        '<span class="xp-tn-hexa">|' +
        esc(ascii) +
        "|</span></div>";
    }
    return out;
  }

  // Authored focus line — ProfileData has no `focus` field, so the engine owns a
  // sensible, role-aware default an AI engineer can edit. Kept terse on purpose.
  function tnFocus(data) {
    var r = (role(data) || "").toLowerCase();
    if (/ai|ml|machine|agent|llm|model/.test(r))
      return "LLMs \u00b7 agents \u00b7 developer tooling";
    if (/full.?stack|backend|frontend|web/.test(r))
      return "Systems \u00b7 interfaces \u00b7 tooling";
    return "Systems \u00b7 tooling \u00b7 interfaces";
  }

  // FIELD_LOG — intercepted signal fragments. Authored entries in an AI-engineer's
  // voice. Specific, technical, no lorem. Each fragment now also carries a
  // source/channel tag so it reads as "intelligence captured from somewhere",
  // not as a blog list.
  var TN_LOG = [
    {
      hash: "a1f9c2",
      t: "2026-06-21",
      src: "/agent/loop",
      k: "agent eval harness",
      b: "Wired a deterministic grader into the agent loop. Trace-level scoring cut false-positive tool calls by ~40% on the eval set. Still hunting the last retry storm.",
    },
    {
      hash: "7e0b18",
      t: "2026-06-14",
      src: "/training/qlora",
      k: "QLoRA on a 7B base",
      b: "Ran QLoRA with synthetic + LLM-judged pairs. Judge tracked the human rubric within 0.08 kappa. Cheaper than expected \u2014 latency is the real constraint.",
    },
    {
      hash: "c43d77",
      t: "2026-06-07",
      src: "/ui/stream",
      k: "streaming UX",
      b: "Swapped request/response for token streaming with a cancelable abort. First token under 300ms, perceived latency collapsed. It finally feels like a conversation.",
    },
    {
      hash: "0e8a5b",
      t: "2026-05-29",
      src: "/rag/guard",
      k: "RAG that doesn't lie",
      b: "Added citations plus a retrieval guard that refuses when grounding is weak. Accuracy up \u2014 but people trust the \u2018I don\u2019t know\u2019 more than the confident answer. Noted.",
    },
  ];
  function tnFieldLog() {
    return TN_LOG.map(function (e, i) {
      return (
        '<div class="xp-tn-logentry reveal" style="--i:' +
        i +
        '">' +
        '<span class="xp-tn-loghash">' +
        esc(e.hash) +
        "</span>" +
        '<span class="xp-tn-logtime">' +
        esc(e.t) +
        " \u00b7 " +
        esc(e.src) +
        "</span>" +
        "<p><b>" +
        esc(e.k) +
        "</b> \u2014 " +
        esc(e.b) +
        "</p></div>"
      );
    }).join("");
  }

  function terminalNexus(data) {
    var l = links(data);
    var loc = identity(data).location || "";
    var handle = ghHandle(data) || name(data);
    var host = siteHost(data);
    var brand = (handle || name(data) || "ghost").toUpperCase();
    var user = brand.toLowerCase();
    var gh = ghHandle(data);
    var stackStr = tnStack(data);

    var items = [
      { id: "hero", k: "00", label: "ROOT" },
      { id: "status", k: "01", label: "STATUS" },
      { id: "systems", k: "02", label: "SYSTEMS" },
      { id: "log", k: "03", label: "FIELD_LOG" },
      { id: "ping", k: "04", label: "SIGNAL" },
    ];
    var rail =
      '<nav class="xp-nav xp-tn-rail" aria-label="Sections">' +
      items
        .map(function (it, i) {
          return (
            '<a href="#' +
            it.id +
            '" class="' +
            (i === 0 ? "active" : "") +
            '"><em>' +
            it.k +
            "</em><span>" +
            esc(it.label) +
            "</span></a>"
          );
        })
        .join("") +
      "</nav>";

    // ---- top telemetry HUD strip ----
    var strip =
      '<header class="xp-tn-strip">' +
      '<span class="xp-tn-strip-brand"><b>&gt;_</b> ' +
      esc(brand) +
      (host
        ? '<i>//</i><span class="xp-tn-host">' + esc(host) + "</span>"
        : "") +
      "</span>" +
      '<span class="xp-tn-strip-mid"><span class="xp-tn-up">UPLINK <b>SECURE</b></span>' +
      '<i class="xp-tn-blink">&#9679;</i><span class="xp-tn-lat">LAT <b>24</b>ms</span></span>' +
      '<span class="xp-tn-strip-r">TMP <b class="xp-tn-temp">41.2&#176;C</b> <i>//</i> <span class="xp-tn-clock">00:00:00</span> UTC</span>' +
      "</header>";

    var progress =
      '<div class="xp-tn-progress" aria-hidden="true"><i></i></div>';

    // ---- compact macOS terminal (hero centerpiece; carries ALL identity) ----
    // The visible default is exactly the identity readout plus a real input line.
    var termRows =
      '<div class="xp-tn-session-line"><span>$</span><b>./whoami.sh</b></div>' +
      '<div class="xp-tn-twhoami">' +
      tnKv("name", name(data)) +
      tnKv("role", role(data)) +
      tnKv("location", loc) +
      tnKv("focus", tnFocus(data)) +
      tnKv("stack", stackStr) +
      tnKv("email", email(data)) +
      tnKv("site", host || l.site) +
      tnKv("github", gh ? "@" + gh : "") +
      "</div>";
    var term =
      '<div class="xp-tn-term reveal" id="ph-term">' +
      '<div class="xp-tn-term-glow" aria-hidden="true"></div>' +
      '<div class="xp-tn-term-bar"><span class="xp-tn-term-dots"><i></i><i></i><i></i></span>' +
      '<span class="xp-tn-term-title">whoami.sh</span></div>' +
      '<div class="xp-tn-term-body" id="ph-term-out">' +
      termRows +
      "</div>" +
      '<div class="xp-tn-term-in"><span class="xp-tn-term-pr">$</span>' +
      '<input id="ph-term-input" class="xp-tn-term-field" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="terminal input" /></div>' +
      "</div>";

    // ---- STATUS telemetry band (real stats) ----
    var stats = arr(data.stats)
      .slice(0, 4)
      .map(function (s, i) {
        return (
          '<div class="xp-tn-tstat reveal" style="--i:' +
          i +
          '"><b>' +
          esc(s.value) +
          "</b><span>" +
          esc(s.label) +
          "</span></div>"
        );
      })
      .join("");

    // ---- SYSTEMS — minimal horizontal project grid (3 up / 3 down), shaped ----
    var repos = arr(data.projects)
      .slice(0, 6)
      .map(function (p, i) {
        var tech = arr(p.tech)
          .slice(0, 3)
          .map(function (t) {
            return "<span>" + esc(t) + "</span>";
          })
          .join("");
        var stars = p.stars
          ? '<span class="xp-tn-star">&#9733; ' + esc(p.stars) + "</span>"
          : "";
        return (
          '<a class="xp-tn-card reveal" style="--i:' +
          i +
          '" href="' +
          esc(p.repoUrl) +
          '" target="_blank" rel="noreferrer">' +
          '<div class="xp-tn-card-glow" aria-hidden="true"></div>' +
          '<div class="xp-tn-card-top"><span class="xp-tn-card-idx">' +
          String(i + 1).padStart(2, "0") +
          "</span>" +
          stars +
          "</div>" +
          '<div class="xp-tn-cardname">' +
          esc(p.name) +
          "</div>" +
          "<p>" +
          esc(p.blurb || "Repository.") +
          "</p>" +
          '<div class="xp-tn-card-foot"><div class="xp-tn-tech">' +
          tech +
          '</div><i class="xp-tn-go">&#8599;</i></div></a>'
        );
      })
      .join("");

    return (
      '<div class="xp xp-terminalNexus xp-ghost">' +
      strip +
      progress +
      rail +
      '<div class="xp-tn-vignette" aria-hidden="true"></div>' +
      '<section id="hero" class="xp-tn-hero xp-hero"><div class="xp-tn-hero-inner">' +
      '<div class="xp-tn-eyebrow">// SECURE_SHELL \u2014 session established</div>' +
      '<h1 class="ph-display xp-tn-name" data-text="' +
      esc(brand) +
      '">' +
      esc(brand) +
      "</h1>" +
      '<div class="xp-tn-roleline"><i class="xp-tn-role-dot"></i><span class="xp-tn-role">' +
      esc(role(data)) +
      '</span><span class="xp-tn-caret"></span></div>' +
      term +
      '</div><a class="xp-tn-scroll" href="#status" aria-label="Scroll to status"><span>scroll</span><i></i></a></section>' +
      '<main class="xp-tn-main">' +
      '<section id="status" class="xp-tn-section xp-tn-status">' +
      tnHead("01", "STATUS", "TELEMETRY") +
      '<div class="xp-tn-prompt xp-tn-lsprompt">root@' +
      esc(user) +
      ":~# proc/status --live</div>" +
      '<div class="xp-tn-tstats">' +
      stats +
      "</div></section>" +
      '<section id="systems" class="xp-tn-section xp-tn-systems">' +
      tnHead("02", "SYSTEMS", "DIR_LIST") +
      '<div class="xp-tn-prompt xp-tn-lsprompt">root@' +
      esc(user) +
      ":~# ls -lA --sort=stars /var/repos/ \u00b7 6 found</div>" +
      '<div class="xp-tn-grid">' +
      repos +
      "</div></section>" +
      '<section id="log" class="xp-tn-section">' +
      tnHead("03", "FIELD_LOG", "NOTES") +
      '<div class="xp-tn-prompt xp-tn-lsprompt">root@' +
      esc(user) +
      ":~# tail -n 4 /var/log/field.log</div>" +
      '<div class="xp-tn-log">' +
      tnFieldLog() +
      "</div></section>" +
      '<section id="ping" class="xp-tn-section xp-tn-ping">' +
      tnHead("04", "SIGNAL", "PING") +
      '<div class="xp-tn-console"><div class="xp-tn-panelbar"><span>root@' +
      esc(user) +
      ':~# ./ping --secure</span><i class="xp-tn-panel-dot"></i></div>' +
      '<div class="xp-tn-consolebody"><div class="xp-tn-handshake xp-scramble" data-text="initiate_handshake">initiate_handshake</div>' +
      (email(data)
        ? '<button class="xp-tn-mail xp-copy" data-copy="' +
          esc(email(data)) +
          '">' +
          esc(email(data)) +
          "<i>&#10697;</i></button>"
        : '<span class="xp-tn-mail">CHANNEL_OPEN</span>') +
      '<div class="xp-tn-links">' +
      (l.github
        ? '<a href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GITHUB &#8599;</a>'
        : "") +
      (l.site
        ? '<a href="' +
          esc(l.site) +
          '" target="_blank" rel="noreferrer">WEBSITE &#8599;</a>'
        : "") +
      (loc ? '<span class="xp-tn-loc">' + esc(loc) + "</span>" : "") +
      "</div></div></div></section>" +
      "</main>" +
      '<footer class="xp-tn-foot"><span>ENCRYPTED_CONNECTION</span><span>' +
      esc(brand) +
      "</span><span>&#169; 2026 &#47;&#47; INTERNET</span></footer>" +
      "</div>"
    );
  }

  function instrument(data) {
    var loc = identity(data).location || "";
    var l = links(data);
    var items = [
      { id: "hero", k: "01", label: "signal" },
      { id: "craft", k: "02", label: "craft" },
      { id: "work", k: "03", label: "work" },
      { id: "contact", k: "04", label: "contact" },
    ];
    var stats = arr(data.stats)
      .slice(0, 3)
      .map(function (s) {
        return (
          '<div class="xp-ins-stat reveal"><b>' +
          esc(s.value) +
          "</b><span>" +
          esc(s.label) +
          "</span></div>"
        );
      })
      .join("");
    var skills = abilities(data)
      .map(function (a, i) {
        return (
          '<div class="xp-ins-skill reveal"><em>' +
          String(i + 1).padStart(2, "0") +
          "</em><span>" +
          esc(a.label) +
          "</span></div>"
        );
      })
      .join("");
    var langs = arr(data.languages)
      .map(function (l2) {
        return "<span>" + esc(l2.label) + "</span>";
      })
      .join("");
    var work = arr(data.projects)
      .slice(0, 6)
      .map(function (p) {
        var tech = arr(p.tech)
          .slice(0, 4)
          .map(function (t) {
            return "<span>" + esc(t) + "</span>";
          })
          .join("");
        var stars = p.stars
          ? "<small>&#9733; " + esc(p.stars) + "</small>"
          : "";
        return (
          '<a class="xp-ins-proj reveal" href="' +
          esc(p.repoUrl) +
          '" target="_blank" rel="noreferrer">' +
          "<header><b>" +
          esc(p.name) +
          "</b>" +
          stars +
          "</header>" +
          "<p>" +
          esc(p.blurb || "Repository.") +
          "</p>" +
          '<div class="xp-ins-tech">' +
          tech +
          '</div><i class="xp-ins-arrow">&#8599;</i></a>'
        );
      })
      .join("");
    var contact =
      '<div class="xp-ins-actions">' +
      (email(data)
        ? '<button class="xp-action xp-copy xp-ins-act" data-copy="' +
          esc(email(data)) +
          '">' +
          esc(email(data)) +
          "</button>"
        : "") +
      (l.github
        ? '<a class="xp-action xp-ins-act" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GitHub &#8599;</a>'
        : "") +
      (l.site
        ? '<a class="xp-action xp-ins-act" href="' +
          esc(l.site) +
          '" target="_blank" rel="noreferrer">Website &#8599;</a>'
        : "") +
      "</div>";

    return (
      '<div class="xp xp-instrument">' +
      '<header class="xp-ins-top"><a class="xp-ins-brand" href="#hero">' +
      esc(name(data)) +
      "</a>" +
      nav(items, "xp-ins-nav") +
      "</header>" +
      '<main class="xp-ins-main">' +
      '<section id="hero" class="xp-ins-hero xp-hero"><div class="xp-ins-hero-l">' +
      '<div class="xp-ins-kicker">PORTFOLIO &#47;&#47; ' +
      esc(role(data).toUpperCase()) +
      "</div>" +
      '<h1 class="ph-display xp-ins-name xp-scramble" data-text="' +
      esc(name(data)) +
      '">' +
      esc(name(data)) +
      "</h1>" +
      '<p class="xp-ins-role">' +
      esc(role(data)) +
      "</p>" +
      '<p class="xp-ins-intro">' +
      esc(headline(data)) +
      "</p>" +
      '<div class="xp-ins-cta"><a class="xp-ins-btn primary" href="#work">View work</a>' +
      (l.github
        ? '<a class="xp-ins-btn" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GitHub</a>'
        : "") +
      "</div></div>" +
      '<div class="xp-ins-hero-r"><div class="xp-ins-panel"><div class="xp-ins-panel-bar"><span>VISUAL_CORTEX</span><i class="xp-ins-dot"></i></div>' +
      '<div id="ph-stage" class="xp-ins-stage"></div>' +
      '<div class="xp-ins-panel-foot"><span>RENDER</span><span>WEBGL &#183; LIVE</span></div></div></div></section>' +
      '<section id="stats" class="xp-ins-statbar reveal">' +
      stats +
      "</section>" +
      '<section id="craft" class="xp-ins-section"><div class="xp-ins-head"><span class="xp-ins-num">02</span><h2>Craft</h2><span class="xp-ins-rule"></span></div>' +
      '<div class="xp-ins-skills">' +
      skills +
      "</div>" +
      (langs
        ? '<div class="xp-ins-langs"><span class="xp-ins-langlabel">Works in</span>' +
          langs +
          "</div>"
        : "") +
      "</section>" +
      '<section id="work" class="xp-ins-section"><div class="xp-ins-head"><span class="xp-ins-num">03</span><h2>Selected Work</h2><span class="xp-ins-rule"></span></div>' +
      '<div class="xp-ins-grid">' +
      work +
      "</div></section>" +
      '<section id="contact" class="xp-ins-section xp-ins-contact"><div class="xp-ins-head"><span class="xp-ins-num">04</span><h2>Contact</h2><span class="xp-ins-rule"></span></div>' +
      '<p class="xp-ins-intro">Open to work and collaboration' +
      (loc ? " &#183; " + esc(loc) : "") +
      ".</p>" +
      contact +
      "</section>" +
      "</main>" +
      '<footer class="xp-ins-foot"><span>' +
      esc(name(data)) +
      "</span><span>Built with PortHub</span></footer></div>"
    );
  }

  function brutalist(data) {
    var loc = identity(data).location || "";
    var l = links(data);
    var items = [
      { id: "hero", k: "00", label: "PROFILE" },
      { id: "record", k: "01", label: "RECORD" },
      { id: "work", k: "02", label: "WORK" },
      { id: "caps", k: "03", label: "CAPS" },
      { id: "transmit", k: "04", label: "TRANSMIT" },
    ];
    var stats = arr(data.stats)
      .slice(0, 3)
      .map(function (s, i) {
        return (
          '<div class="xp-br-stat reveal"><em>' +
          String(i + 1).padStart(2, "0") +
          "</em>" +
          "<b>" +
          esc(s.value) +
          "</b><span>" +
          esc(s.label) +
          "</span></div>"
        );
      })
      .join("");
    var skills = abilities(data)
      .map(function (a, i) {
        return (
          '<div class="xp-br-skill reveal"><em>' +
          String(i + 1).padStart(2, "0") +
          "</em>" +
          "<span>" +
          esc(a.label) +
          "</span></div>"
        );
      })
      .join("");
    var langs = arr(data.languages)
      .map(function (l2) {
        return "<span>" + esc(l2.label) + "</span>";
      })
      .join("");
    var work = arr(data.projects)
      .slice(0, 6)
      .map(function (p, i) {
        var tech = arr(p.tech)
          .slice(0, 4)
          .map(function (t) {
            return "<span>" + esc(t) + "</span>";
          })
          .join("");
        var stars = p.stars
          ? "<small>&#9733; " + esc(p.stars) + "</small>"
          : "";
        return (
          '<a class="xp-br-card reveal" href="' +
          esc(p.repoUrl) +
          '" target="_blank" rel="noreferrer">' +
          '<span class="xp-br-cardnum">' +
          String(i + 1).padStart(2, "0") +
          "</span>" +
          "<header><b>" +
          esc(p.name) +
          "</b>" +
          stars +
          "</header>" +
          "<p>" +
          esc(p.blurb || "Repository.") +
          "</p>" +
          '<div class="xp-br-tech">' +
          tech +
          '</div><i class="xp-br-go">&#8594;</i></a>'
        );
      })
      .join("");

    return (
      '<div class="xp xp-brutalist">' +
      '<header class="xp-br-top"><a class="xp-br-logo" href="#hero">' +
      esc(name(data)) +
      "</a>" +
      nav(items, "xp-br-nav") +
      '<span class="xp-br-status">AVAILABLE</span></header>' +
      '<main class="xp-br-main">' +
      '<section id="hero" class="xp-br-hero xp-hero">' +
      '<div class="xp-br-hero-grid">' +
      '<div class="xp-br-hero-l">' +
      '<div class="xp-br-meta"><span>PORTFOLIO</span><span>&#47;&#47;</span><span>EST. ' +
      esc(role(data).toUpperCase()) +
      "</span></div>" +
      '<h1 class="ph-display xp-br-name xp-scramble" data-text="' +
      esc(name(data)) +
      '">' +
      esc(name(data)) +
      "</h1>" +
      '<div class="xp-br-rolebox"><span>' +
      esc(role(data)) +
      "</span></div>" +
      '<p class="xp-br-intro">' +
      esc(headline(data)) +
      "</p>" +
      "</div>" +
      '<div class="xp-br-hero-r"><div class="xp-br-stage-frame"><div class="xp-br-stage-bar"><span>OBJ_01</span><span>RENDER</span></div>' +
      '<div id="ph-stage" class="xp-br-stage"></div>' +
      '<div class="xp-br-stage-bar"><span>WEBGL</span><span>LIVE</span></div></div></div>' +
      "</div></section>" +
      '<section id="record" class="xp-br-band xp-br-light"><div class="xp-br-bandhead"><span>01</span><h2>THE RECORD</h2></div>' +
      '<div class="xp-br-record"><p class="xp-br-bio">' +
      esc(headline(data)) +
      "</p>" +
      '<div class="xp-br-stats">' +
      stats +
      "</div></div></section>" +
      '<section id="work" class="xp-br-band xp-br-dark"><div class="xp-br-bandhead"><span>02</span><h2>SELECTED WORK</h2></div>' +
      '<div class="xp-br-grid">' +
      work +
      "</div></section>" +
      '<section id="caps" class="xp-br-band xp-br-light"><div class="xp-br-bandhead"><span>03</span><h2>CAPABILITIES</h2></div>' +
      '<div class="xp-br-skills">' +
      skills +
      "</div>" +
      (langs
        ? '<div class="xp-br-langs"><span class="xp-br-langlabel">WORKS IN</span>' +
          langs +
          "</div>"
        : "") +
      "</section>" +
      '<section id="transmit" class="xp-br-band xp-br-dark xp-br-contact"><div class="xp-br-bandhead"><span>04</span><h2>TRANSMIT</h2></div>' +
      (email(data)
        ? '<button class="xp-br-email xp-copy" data-copy="' +
          esc(email(data)) +
          '">' +
          esc(email(data)) +
          "<i>&#8599;</i></button>"
        : l.github
          ? '<a class="xp-br-email" href="' +
            esc(l.github) +
            '" target="_blank" rel="noreferrer">LET&#8217;S BUILD<i>&#8599;</i></a>'
          : '<span class="xp-br-email">LET&#8217;S BUILD</span>') +
      '<div class="xp-br-foot-row"><div class="xp-br-links">' +
      (l.github
        ? '<a href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GITHUB &#8599;</a>'
        : "") +
      (l.site
        ? '<a href="' +
          esc(l.site) +
          '" target="_blank" rel="noreferrer">WEBSITE &#8599;</a>'
        : "") +
      "</div>" +
      (loc ? '<span class="xp-br-loc">' + esc(loc) + "</span>" : "") +
      "</div></section>" +
      "</main>" +
      '<footer class="xp-br-footer"><span>' +
      esc(name(data)) +
      "</span><span>&#169; 2026 &#183; BUILT WITH PORTHUB</span></footer></div>"
    );
  }

  function aurora(data) {
    var loc = identity(data).location || "";
    var l = links(data);
    var items = [
      { id: "hero", k: "", label: "Home" },
      { id: "about", k: "", label: "About" },
      { id: "work", k: "", label: "Work" },
      { id: "contact", k: "", label: "Contact" },
    ];
    var stats = arr(data.stats)
      .slice(0, 3)
      .map(function (s) {
        return (
          '<div class="xp-au-stat reveal"><b>' +
          esc(s.value) +
          "</b><span>" +
          esc(s.label) +
          "</span></div>"
        );
      })
      .join("");
    var skills = abilities(data)
      .map(function (a) {
        return '<span class="xp-au-skill reveal">' + esc(a.label) + "</span>";
      })
      .join("");
    var langs = arr(data.languages)
      .map(function (l2) {
        return "<span>" + esc(l2.label) + "</span>";
      })
      .join("");
    var work = arr(data.projects)
      .slice(0, 6)
      .map(function (p, i) {
        var tech = arr(p.tech)
          .slice(0, 4)
          .map(function (t) {
            return "<span>" + esc(t) + "</span>";
          })
          .join("");
        var stars = p.stars
          ? "<small>&#9733; " + esc(p.stars) + "</small>"
          : "";
        return (
          '<a class="xp-au-card reveal" href="' +
          esc(p.repoUrl) +
          '" target="_blank" rel="noreferrer">' +
          '<div class="xp-au-card-top"><b>' +
          esc(p.name) +
          "</b>" +
          stars +
          "</div>" +
          "<p>" +
          esc(p.blurb || "Repository.") +
          "</p>" +
          '<div class="xp-au-tech">' +
          tech +
          '</div><i class="xp-au-arrow">&#8599;</i></a>'
        );
      })
      .join("");

    return (
      '<div class="xp xp-aurora">' +
      '<header class="xp-au-nav-wrap"><nav class="xp-nav xp-au-nav" aria-label="Sections">' +
      '<a class="xp-au-brand" href="#hero">' +
      esc(name(data)) +
      "</a>" +
      '<span class="xp-au-navlinks">' +
      items
        .slice(1)
        .map(function (it, i) {
          return (
            '<a href="#' +
            it.id +
            '" class="' +
            (i === -1 ? "active" : "") +
            '">' +
            esc(it.label) +
            "</a>"
          );
        })
        .join("") +
      "</span>" +
      (l.github
        ? '<a class="xp-au-navcta" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GitHub</a>'
        : "") +
      "</nav></header>" +
      '<main class="xp-au-main">' +
      '<section id="hero" class="xp-au-hero xp-hero">' +
      '<div class="xp-au-orb"><div class="xp-au-orb-glow"></div><div id="ph-stage" class="xp-au-stage"></div></div>' +
      '<div class="xp-au-badge"><i></i>' +
      (loc ? esc(loc) + " &#183; " : "") +
      "Available for work</div>" +
      '<h1 class="ph-display xp-au-name xp-scramble" data-text="' +
      esc(name(data)) +
      '">' +
      esc(name(data)) +
      "</h1>" +
      '<p class="xp-au-role">' +
      esc(role(data)) +
      "</p>" +
      '<p class="xp-au-intro">' +
      esc(headline(data)) +
      "</p>" +
      '<div class="xp-au-cta"><a class="xp-au-btn primary" href="#work">View work</a>' +
      (email(data)
        ? '<button class="xp-au-btn xp-copy" data-copy="' +
          esc(email(data)) +
          '">Copy email</button>'
        : "") +
      "</div>" +
      "</section>" +
      '<section id="about" class="xp-au-section"><div class="xp-au-about">' +
      '<div class="xp-au-about-l"><span class="xp-au-eyebrow">About</span><p class="xp-au-lead">' +
      esc(headline(data)) +
      "</p>" +
      (langs
        ? '<div class="xp-au-langs"><span class="xp-au-langlabel">Works in</span>' +
          langs +
          "</div>"
        : "") +
      "</div>" +
      '<div class="xp-au-stats">' +
      stats +
      "</div></div>" +
      '<div class="xp-au-skills">' +
      skills +
      "</div></section>" +
      '<section id="work" class="xp-au-section"><span class="xp-au-eyebrow">Selected work</span>' +
      '<h2 class="xp-au-h2">Things I&#8217;ve built</h2>' +
      '<div class="xp-au-grid">' +
      work +
      "</div></section>" +
      '<section id="contact" class="xp-au-section xp-au-contact"><div class="xp-au-contact-card">' +
      '<span class="xp-au-eyebrow">Contact</span><h2 class="xp-au-h2">Let&#8217;s build something.</h2>' +
      '<div class="xp-au-contact-actions">' +
      (email(data)
        ? '<button class="xp-au-btn primary xp-copy" data-copy="' +
          esc(email(data)) +
          '">' +
          esc(email(data)) +
          "</button>"
        : "") +
      (l.github
        ? '<a class="xp-au-btn" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">GitHub &#8599;</a>'
        : "") +
      (l.site
        ? '<a class="xp-au-btn" href="' +
          esc(l.site) +
          '" target="_blank" rel="noreferrer">Website &#8599;</a>'
        : "") +
      "</div></div></section>" +
      "</main>" +
      '<footer class="xp-au-foot"><span>' +
      esc(name(data)) +
      "</span><span>Built with PortHub</span></footer></div>"
    );
  }

  // ---- GENERATIVE pack: one renderer, composition rolled from spec.layout ----
  function genStage(L) {
    // Fullbleed: render NO #ph-stage so the engine mounts the object full-screen
    // behind the hero (dimmed on scroll). The scrim + overlay come from CSS.
    if (L.stage === "fullbleed") return "";
    if (L.stage === "orb") {
      return (
        '<div class="xp-gen-orb"><div class="xp-gen-orb-glow"></div>' +
        '<div id="ph-stage" class="xp-gen-stage xp-gen-stage-round"></div></div>'
      );
    }
    if (L.stage === "bare") {
      return '<div class="xp-gen-stage-bare"><div id="ph-stage" class="xp-gen-stage"></div></div>';
    }
    return (
      '<div class="xp-gen-stage-frame"><div class="xp-gen-stage-bar"><span>OBJ_01</span><span>RENDER</span></div>' +
      '<div id="ph-stage" class="xp-gen-stage"></div>' +
      '<div class="xp-gen-stage-bar"><span>WEBGL</span><span>LIVE</span></div></div>'
    );
  }

  function genNav(data, items, L) {
    var l = links(data);
    var linksHtml = items
      .map(function (it, i) {
        return (
          '<a href="#' +
          it.id +
          '" class="' +
          (i === 0 ? "active" : "") +
          '">' +
          (L.chrome === "rail" ? "<em>" + it.k + "</em>" : "") +
          "<span>" +
          esc(it.label) +
          "</span></a>"
        );
      })
      .join("");
    var cta = l.github
      ? '<a class="xp-gen-navcta" href="' +
        esc(l.github) +
        '" target="_blank" rel="noreferrer">GitHub</a>'
      : "";
    return (
      '<header class="xp-gen-navwrap"><nav class="xp-nav xp-gen-nav" aria-label="Sections">' +
      '<a class="xp-gen-brand" href="#hero">' +
      esc(name(data)) +
      "</a>" +
      '<span class="xp-gen-navlinks">' +
      linksHtml +
      "</span>" +
      cta +
      "</nav></header>"
    );
  }

  function genSection(id, num, title, inner, extra) {
    return (
      '<section id="' +
      id +
      '" class="xp-gen-section ' +
      (extra || "") +
      '">' +
      '<div class="xp-gen-head"><span class="xp-gen-num">' +
      num +
      "</span>" +
      '<h2 class="xp-gen-h2">' +
      title +
      '</h2><span class="xp-gen-rule"></span></div>' +
      inner +
      "</section>"
    );
  }

  function generative(data, spec) {
    var L = (spec && spec.layout) || {
      chrome: "topbar",
      hero: "split",
      container: "panel",
      density: "normal",
      borders: "hairline",
      stage: "viewport",
      upper: true,
      accentBlock: false,
    };
    var lex = (spec && spec.lexicon) || {
      nav: ["Home", "About", "Work", "Contact"],
      about: "About",
      work: "Selected work",
      contact: "Contact",
      cta: "Let's build",
      worksIn: "Works in",
      kicker: "Portfolio",
    };
    var nv =
      arr(lex.nav).length === 4
        ? lex.nav
        : ["Home", "About", "Work", "Contact"];
    var loc = identity(data).location || "";
    var l = links(data);
    var items = [
      { id: "hero", k: "00", label: nv[0] },
      { id: "about", k: "01", label: nv[1] },
      { id: "work", k: "02", label: nv[2] },
      { id: "contact", k: "03", label: nv[3] },
    ];

    var stats = arr(data.stats)
      .slice(0, 3)
      .map(function (s) {
        return (
          '<div class="xp-gen-stat reveal"><b>' +
          esc(s.value) +
          "</b><span>" +
          esc(s.label) +
          "</span></div>"
        );
      })
      .join("");
    var skills = abilities(data)
      .map(function (a, i) {
        return (
          '<div class="xp-gen-skill reveal"><em>' +
          String(i + 1).padStart(2, "0") +
          "</em><span>" +
          esc(a.label) +
          "</span></div>"
        );
      })
      .join("");
    var langs = arr(data.languages)
      .map(function (l2) {
        return "<span>" + esc(l2.label) + "</span>";
      })
      .join("");
    var work = arr(data.projects)
      .slice(0, 6)
      .map(function (p, i) {
        var tech = arr(p.tech)
          .slice(0, 4)
          .map(function (t) {
            return "<span>" + esc(t) + "</span>";
          })
          .join("");
        var stars = p.stars
          ? "<small>&#9733; " + esc(p.stars) + "</small>"
          : "";
        return (
          '<a class="xp-gen-card reveal" href="' +
          esc(p.repoUrl) +
          '" target="_blank" rel="noreferrer">' +
          '<span class="xp-gen-cardnum">' +
          String(i + 1).padStart(2, "0") +
          "</span>" +
          '<div class="xp-gen-card-top"><b>' +
          esc(p.name) +
          "</b>" +
          stars +
          "</div>" +
          "<p>" +
          esc(p.blurb || "Repository.") +
          "</p>" +
          '<div class="xp-gen-tech">' +
          tech +
          '</div><i class="xp-gen-go">&#8599;</i></a>'
        );
      })
      .join("");

    var rolebox = L.accentBlock
      ? '<div class="xp-gen-rolebox"><span>' + esc(role(data)) + "</span></div>"
      : '<p class="xp-gen-role">' + esc(role(data)) + "</p>";
    var heroText =
      '<div class="xp-gen-hero-text">' +
      '<div class="xp-gen-kicker">' +
      esc(lex.kicker) +
      " &#47;&#47; " +
      esc(role(data).toUpperCase()) +
      "</div>" +
      '<h1 class="ph-display xp-gen-name xp-scramble" data-text="' +
      esc(name(data)) +
      '">' +
      esc(name(data)) +
      "</h1>" +
      rolebox +
      '<p class="xp-gen-intro">' +
      esc(headline(data)) +
      "</p>" +
      '<div class="xp-gen-cta"><a class="xp-gen-btn primary" href="#work">View work</a>' +
      (email(data)
        ? '<button class="xp-gen-btn xp-copy" data-copy="' +
          esc(email(data)) +
          '">Copy email</button>'
        : "") +
      "</div></div>";
    var heroStage = '<div class="xp-gen-hero-stage">' + genStage(L) + "</div>";

    var about = genSection(
      "about",
      "01",
      esc(lex.about),
      '<div class="xp-gen-about"><p class="xp-gen-lead">' +
        esc(headline(data)) +
        "</p>" +
        '<div class="xp-gen-stats">' +
        stats +
        "</div></div>" +
        '<div class="xp-gen-skills">' +
        skills +
        "</div>" +
        (langs
          ? '<div class="xp-gen-langs"><span class="xp-gen-langlabel">' +
            esc(lex.worksIn) +
            "</span>" +
            langs +
            "</div>"
          : ""),
    );
    var workSec = genSection(
      "work",
      "02",
      esc(lex.work),
      '<div class="xp-gen-grid">' + work + "</div>",
    );
    var ctaTxt = esc(lex.cta);
    var contactBig = email(data)
      ? '<button class="xp-gen-bigmail xp-copy" data-copy="' +
        esc(email(data)) +
        '">' +
        esc(email(data)) +
        "<i>&#8599;</i></button>"
      : l.github
        ? '<a class="xp-gen-bigmail" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer">' +
          ctaTxt +
          "<i>&#8599;</i></a>"
        : '<span class="xp-gen-bigmail">' + ctaTxt + "</span>";
    var contact = genSection(
      "contact",
      "03",
      esc(lex.contact),
      '<div class="xp-gen-contact-inner">' +
        contactBig +
        '<div class="xp-gen-foot-row"><div class="xp-gen-links">' +
        (l.github
          ? '<a href="' +
            esc(l.github) +
            '" target="_blank" rel="noreferrer">GITHUB &#8599;</a>'
          : "") +
        (l.site
          ? '<a href="' +
            esc(l.site) +
            '" target="_blank" rel="noreferrer">WEBSITE &#8599;</a>'
          : "") +
        "</div>" +
        (loc ? '<span class="xp-gen-loc">' + esc(loc) + "</span>" : "") +
        "</div></div>",
      "xp-gen-contact",
    );

    var cls = [
      "xp",
      "xp-gen",
      "xp-gen--chrome-" + L.chrome,
      "xp-gen--hero-" + L.hero,
      "xp-gen--container-" + L.container,
      "xp-gen--density-" + L.density,
      "xp-gen--borders-" + L.borders,
      "xp-gen--stage-" + L.stage,
      L.upper ? "xp-gen--upper" : "",
      L.accentBlock ? "xp-gen--accentblock" : "",
    ].join(" ");

    return (
      '<div class="' +
      cls +
      '">' +
      genNav(data, items, L) +
      '<main class="xp-gen-main">' +
      '<section id="hero" class="xp-gen-hero xp-hero">' +
      heroText +
      heroStage +
      "</section>" +
      about +
      workSec +
      contact +
      "</main>" +
      '<footer class="xp-gen-foot"><span>' +
      esc(name(data)) +
      "</span><span>Built with PortHub</span></footer></div>"
    );
  }

  function directorCut(data) {
    var items = [
      { id: "hero", k: "I", label: "Prologue" },
      { id: "arc", k: "II", label: "Character Arc" },
      { id: "missions", k: "III", label: "Side Missions" },
      { id: "arsenal", k: "IV", label: "Arsenal" },
      { id: "credits", k: "V", label: "Credits" },
    ];
    return (
      '<div class="xp xp-directorCut"><div class="xp-letter top"></div><div class="xp-letter bottom"><span class="xp-timeline"><i class="xp-timeline-fill"></i></span></div>' +
      nav(items, "xp-filmnav") +
      '<main class="xp-film">' +
      '<section id="hero" class="xp-section xp-hero"><span class="xp-act">ACT I</span><p>A FILM BY</p><h1 class="ph-display xp-title xp-scramble" data-text="' +
      esc(name(data)) +
      '">' +
      esc(name(data)) +
      "</h1><b>STARRING AS: " +
      esc(role(data)) +
      "</b><small>" +
      esc(headline(data)) +
      "</small></section>" +
      '<section id="arc" class="xp-section xp-right"><span class="xp-act">ACT II</span><h2>CHARACTER ARC</h2><p>' +
      esc(headline(data)) +
      '</p><div class="xp-stat-row">' +
      statCards(data, "director") +
      "</div></section>" +
      '<section id="missions" class="xp-section"><span class="xp-act">ACT III</span><h2>SIDE MISSIONS</h2>' +
      abilityCloud(data, "director") +
      "</section>" +
      '<section id="arsenal" class="xp-section"><span class="xp-act">ACT IV</span><h2>WEAPONS CACHE</h2><div class="xp-grid">' +
      projects(data, "director", 6) +
      "</div></section>" +
      '<section id="credits" class="xp-section xp-contact"><h2>END OF LINE</h2><p>DIRECTED BY</p><strong>' +
      esc(name(data)) +
      "</strong>" +
      contactBlock(data, "director") +
      "</section>" +
      "</main></div>"
    );
  }

  function scramble(el) {
    var text = el.getAttribute("data-text") || el.textContent || "";
    var glyphs = "!<>-_\\/[]{}=+*^?#________";
    var frame = 0;
    var timer = setInterval(function () {
      el.textContent = text
        .split("")
        .map(function (ch, i) {
          if (ch === " ") return " ";
          if (i < frame / 2) return ch;
          return glyphs[(Math.random() * glyphs.length) | 0];
        })
        .join("");
      frame++;
      if (frame > text.length * 2 + 8) {
        clearInterval(timer);
        el.textContent = text;
      }
    }, 24);
  }

  function mount() {
    document
      .querySelectorAll(
        ".xp-card,.xp-project,.xp-action,.xp-window,.xp-tn-card",
      )
      .forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty("--mx", e.clientX - r.left + "px");
          el.style.setProperty("--my", e.clientY - r.top + "px");
        });
      });
    document.querySelectorAll(".xp-scramble").forEach(function (el) {
      el.addEventListener("pointerenter", function () {
        scramble(el);
      });
    });
    document.querySelectorAll(".xp-copy").forEach(function (el) {
      el.addEventListener("click", function () {
        var v = el.getAttribute("data-copy") || "";
        if (navigator.clipboard && v) navigator.clipboard.writeText(v);
        el.setAttribute("data-copied", "true");
        setTimeout(function () {
          el.removeAttribute("data-copied");
        }, 1400);
      });
    });
    var clock = document.querySelector(".xp-tn-clock");
    var tempEl = document.querySelector(".xp-tn-temp");
    if (clock || tempEl) {
      var tick = function () {
        if (clock) clock.textContent = new Date().toISOString().slice(11, 19);
        // slow drifting fake CPU temp (~38–43°C) — feels alive, not noisy
        if (tempEl)
          tempEl.textContent =
            (41 + Math.sin(Date.now() / 9000) * 1.6).toFixed(1) + "\u00b0C";
      };
      tick();
      setInterval(tick, 1000);
    }
    var navLinks = document.querySelectorAll(".xp-nav a");
    if ("IntersectionObserver" in window && navLinks.length) {
      var byId = {};
      navLinks.forEach(function (a) {
        byId[(a.getAttribute("href") || "").slice(1)] = a;
      });
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            Object.keys(byId).forEach(function (id) {
              byId[id].classList.toggle("active", id === en.target.id);
            });
          });
        },
        { threshold: 0.42 },
      );
      Object.keys(byId).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
  }

  // ---- GHOST//SHELL mount: interactive terminal + matrix rain + live signal ----
  function tnMount(data, spec) {
    mount(data, spec); // shared wiring (cursor-glow, scramble, copy, clock, nav)

    var user = (ghHandle(data) || name(data) || "ghost").toLowerCase();
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coarse =
      window.matchMedia && window.matchMedia("(pointer:coarse)").matches;

    // scroll-progress hairline under the HUD
    var pbar = document.querySelector(".xp-tn-progress > i");
    if (pbar && window.PH && typeof window.PH.onScroll === "function") {
      window.PH.onScroll(function (s) {
        pbar.style.transform = "scaleX(" + s.progress.toFixed(3) + ")";
      });
    }

    // drifting latency — feels alive, never noisy
    var latEl = document.querySelector(".xp-tn-lat b");
    if (latEl) {
      setInterval(function () {
        latEl.textContent = String(
          18 + Math.round(Math.sin(Date.now() / 4700) * 6 + Math.random() * 4),
        );
      }, 1600);
    }

    if (!reduce && !coarse) {
      tnCardTilt();
      tnNameMagnet();
    }
    tnTerminal(data, user);
  }

  // RAMISWORLD — premium magnetic identity. The wordmark leans toward the
  // cursor as it approaches; the lean settles back when the pointer leaves.
  // Drives CSS custom properties (--tx, --ty) — no reflow, no layout jank.
  // Pairs with the CSS chromatic-on-hover and idle phosphor breath.
  function tnNameMagnet() {
    var nameEl = document.querySelector(".xp-tn-name");
    var hero = document.querySelector(".xp-tn-hero");
    if (!nameEl || !hero) return;
    var raf = 0,
      x = 0,
      y = 0,
      tx = 0,
      ty = 0;
    function apply() {
      raf = 0;
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      nameEl.style.setProperty("--tx", x.toFixed(2) + "px");
      nameEl.style.setProperty("--ty", y.toFixed(2) + "px");
      if (Math.abs(x - tx) > 0.2 || Math.abs(y - ty) > 0.2) {
        raf = requestAnimationFrame(apply);
      }
    }
    hero.addEventListener("pointermove", function (e) {
      var r = nameEl.getBoundingClientRect();
      var cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      // Pull strength is bounded so the wordmark never breaks its baseline.
      // Distance falloff so far-away cursor positions have no pull.
      var dx = (e.clientX - cx) / Math.max(180, r.width * 0.7);
      var dy = (e.clientY - cy) / Math.max(120, r.height * 0.9);
      tx = Math.max(-14, Math.min(14, dx * 9));
      ty = Math.max(-8, Math.min(8, dy * 6));
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", function () {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  // Project cards — 3D tilt toward the cursor (the radial glow follows via the
  // --mx/--my pointer handler in mount()). Brings the grid alive under the hand.
  function tnCardTilt() {
    document.querySelectorAll(".xp-tn-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--rx", (-py * 9).toFixed(2) + "deg");
        card.style.setProperty("--ry", (px * 11).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  // The interactive terminal — deliberately restrained. The default whoami.sh
  // readout stays fixed; users can focus and type without turning the hero into
  // a noisy toy terminal.
  function tnTerminal(data, user) {
    var term = document.getElementById("ph-term");
    var out = document.getElementById("ph-term-out");
    var input = document.getElementById("ph-term-input");
    if (!term || !out || !input) return;

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        input.value = "";
      } else if (e.key === "Escape") {
        input.value = "";
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        input.value = "";
      }
    });

    // click anywhere in the terminal → focus the input
    term.addEventListener("click", function () {
      input.focus();
    });
    // prefix-link clicks inside output (e.g. open-in-browser) shouldn't steal focus oddly
    out.addEventListener("click", function (e) {
      if (e.target.closest("a,button")) return;
      input.focus();
    });
    window.setTimeout(function () {
      input.focus();
    }, 500);
  }

  PH.experiences = {
    generative: { render: generative, mount: mount },
    instrument: { render: instrument, mount: mount },
    brutalist: { render: brutalist, mount: mount },
    aurora: { render: aurora, mount: mount },
    terminalNexus: { render: terminalNexus, mount: tnMount },
    directorCut: { render: directorCut, mount: mount },
  };
})();
