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
  // Keep contact private unless the profile data explicitly provides an email.
  var EMAIL_FALLBACK = "";
  function email(data) {
    return links(data).email || EMAIL_FALLBACK;
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
  function socialHandle(url, hostPattern) {
    url = l_safe(url);
    if (!url) return "";
    return url.replace(hostPattern, "").replace(/^@/, "").replace(/\/.*$/, "");
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
    var authored = arr(data.stack)
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(Boolean);
    if (authored.length) return authored.slice(0, 18).join(", ");

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

  // Authored focus line. Older profiles fall back to a sensible, role-aware
  // default so existing portfolios render the same until the user edits them.
  function tnFocus(data) {
    var authored = arr(data.focus)
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(Boolean);
    if (authored.length) return authored.slice(0, 8).join(" \u00b7 ");

    var r = (role(data) || "").toLowerCase();
    if (/ai|ml|machine|agent|llm|model/.test(r))
      return "LLMs \u00b7 agents \u00b7 developer tooling";
    if (/full.?stack|backend|frontend|web/.test(r))
      return "Systems \u00b7 interfaces \u00b7 tooling";
    return "Systems \u00b7 tooling \u00b7 interfaces";
  }

  // CREDENTIALS — user-curated certifications & licenses.
  //
  // Cards mirror the LinkedIn "Licenses & Certifications" block: icon mark,
  // title, issuer, optional credential ID, optional skills row, and a
  // "Show credential" link when the user supplied a verify
  // URL. The section is hidden entirely when `data.credentials` is empty —
  // the default portfolio looks identical to before.
  function tnHasCredentials(data) {
    return arr(data.credentials).length > 0;
  }

  // Local logo asset for a credential. Unknown issuers get a neutral
  // certificate fallback; the runtime never fabricates brand-looking marks.
  function tnCredLogo(c) {
    var rawKey = c.issuerKey || "";
    var key = rawKey;
    var src = PH.issuerLogoSrc ? PH.issuerLogoSrc(key) : "";
    if (!src && PH.normalizeIssuerKey) {
      key = PH.normalizeIssuerKey(c.issuer || c.title || "");
      src = PH.issuerLogoSrc ? PH.issuerLogoSrc(key) : "";
    }

    var known = !!src;
    var col = known && PH.issuerColor ? PH.issuerColor(key) : "";
    var kind = known && PH.issuerLogoKind ? PH.issuerLogoKind(key) : "generic";
    var mark = known && PH.issuerLogoMark ? PH.issuerLogoMark(key) : "square";
    var tile = known && PH.issuerLogoTile ? PH.issuerLogoTile(key) : "neutral";
    var alt =
      known && PH.issuerLogoAlt ? PH.issuerLogoAlt(key) : "Credential issuer";
    if (!src && PH.issuerFallbackSrc) src = PH.issuerFallbackSrc();
    if (!src) src = "/brand/credentials/fallback-certificate.svg";

    return (
      '<span class="xp-tn-cred-logo" data-key="' +
      esc(key || rawKey || "") +
      '" data-kind="' +
      esc(kind) +
      '" data-mark="' +
      esc(mark) +
      '" data-tile="' +
      esc(tile) +
      '"' +
      (col ? ' style="--ph-issuer:' + col + '"' : "") +
      ">" +
      '<img src="' +
      esc(src) +
      '" alt="' +
      esc(alt) +
      '" loading="lazy" decoding="async"/>' +
      "</span>"
    );
  }

  function tnCredCard(c, i) {
    var skills = arr(c.skills)
      .slice(0, 8)
      .map(function (s) {
        return '<span class="xp-tn-cred-skill">' + esc(s) + "</span>";
      })
      .join("");
    var credIdRow = c.credentialId
      ? '<div class="xp-tn-cred-credid"><em>Credential ID</em><span>' +
        esc(c.credentialId) +
        "</span></div>"
      : "";
    var verifyRow = c.url
      ? '<a class="xp-tn-cred-verify" href="' +
        esc(c.url) +
        '" target="_blank" rel="noreferrer">Show credential' +
        '<i aria-hidden="true">&#8599;</i></a>'
      : "";
    // The VERIFIED stamp lives in the card head as a real element (not a
    // ::before pseudo) so the title block always reserves space for it.
    // Without this the badge floated absolute and a long title would slide
    // under it. The stamp is hidden until hover for low-noise resting state.
    return (
      '<article class="xp-tn-cred reveal" style="--i:' +
      i +
      '">' +
      '<div class="xp-tn-cred-glow" aria-hidden="true"></div>' +
      '<div class="xp-tn-cred-head">' +
      tnCredLogo(c) +
      '<div class="xp-tn-cred-meta">' +
      '<h3 class="xp-tn-cred-title">' +
      esc(c.title || "Credential") +
      "</h3>" +
      '<p class="xp-tn-cred-issuer">' +
      esc(c.issuer || "") +
      "</p>" +
      "</div>" +
      '<span class="xp-tn-cred-badge" aria-hidden="true">VERIFIED</span>' +
      "</div>" +
      credIdRow +
      (skills ? '<div class="xp-tn-cred-skills">' + skills + "</div>" : "") +
      verifyRow +
      "</article>"
    );
  }

  function tnCredentials(data) {
    return arr(data.credentials).map(tnCredCard).join("");
  }

  function terminalNexus(data) {
    var l = links(data);
    var loc = identity(data).location || "";
    var handle = ghHandle(data) || name(data);
    var brand = (handle || name(data) || "ghost").toUpperCase();
    var user = brand.toLowerCase();
    var gh = ghHandle(data);
    var stackStr = tnStack(data);

    var hasCreds = tnHasCredentials(data);
    var items = [
      { id: "hero", k: "00", label: "ROOT" },
      { id: "status", k: "01", label: "STATUS" },
      { id: "systems", k: "02", label: "SYSTEMS" },
    ];
    if (hasCreds) {
      items.push({ id: "creds", k: "03", label: "CREDENTIALS" });
      items.push({ id: "ping", k: "04", label: "SIGNAL" });
    } else {
      // No credentials? Re-number the SIGNAL section so the rail stays
      // continuous (00 ROOT, 01 STATUS, 02 SYSTEMS, 03 SIGNAL).
      items.push({ id: "ping", k: "03", label: "SIGNAL" });
    }
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
    // The site host badge ("// rami.co.nz") was removed alongside the SITE
    // link in the contact panel: the portfolio no longer surfaces the user's
    // external site URL anywhere in chrome. It's still accessible from the
    // in-page terminal (`cat contact.txt`) for power users.
    var strip =
      '<header class="xp-tn-strip">' +
      '<span class="xp-tn-strip-brand"><b>&gt;_</b> ' +
      esc(brand) +
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

    // ---- SYSTEMS — minimal project grid (up to 9 → 3x3), shaped ----
    var repoList = arr(data.projects).slice(0, 9);
    var repos = repoList
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
      '<i class="xp-tn-name-rule"></i></h1>' +
      '<div class="xp-tn-roleline"><i class="xp-tn-role-dot"></i><span class="xp-tn-role">' +
      esc(role(data)) +
      '</span><span class="xp-tn-caret"></span></div>' +
      term +
      // Non-interactive scroll cue — a white mouse-wheel hint with a
      // chevron, purely decorative. pointer-events:none on the wrapper means
      // it can never steal a click (and `aria-hidden` keeps it out of the AT
      // tree since the rail already exposes navigation).
      '</div><div class="xp-tn-scrollcue" aria-hidden="true"><span class="xp-tn-scrollcue-wheel"></span><span class="xp-tn-scrollcue-chev"></span></div></section>' +
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
      ":~# ls -lA --sort=stars /var/repos/ \u00b7 " +
      repoList.length +
      " found</div>" +
      '<div class="xp-tn-grid">' +
      repos +
      "</div></section>" +
      (hasCreds
        ? '<section id="creds" class="xp-tn-section xp-tn-creds-section">' +
          tnHead("03", "CREDENTIALS", "VERIFIED") +
          '<div class="xp-tn-prompt xp-tn-lsprompt">root@' +
          esc(user) +
          ":~# cat /etc/credentials.d/* \u00b7 " +
          String(arr(data.credentials).length) +
          " issued</div>" +
          '<div class="xp-tn-creds">' +
          tnCredentials(data) +
          "</div></section>"
        : "") +
      '<section id="ping" class="xp-tn-section xp-tn-ping">' +
      tnHead(hasCreds ? "04" : "03", "SIGNAL", "HANDSHAKE") +
      '<div class="xp-tn-console xp-tn-handshake-console">' +
      '<div class="xp-tn-panelbar"><span>root@' +
      esc(user) +
      ':~# ./handshake --secure --identity</span><span class="xp-tn-conn">CONNECTED <i class="xp-tn-panel-dot"></i></span></div>' +
      '<div class="xp-tn-consolebody">' +
      // -- decoded "INITIATE HANDSHAKE" banner with animated bracket frame
      '<div class="xp-tn-hs-banner">' +
      '<span class="xp-tn-hs-bracket left">[</span>' +
      '<span class="xp-tn-hs-title xp-scramble" data-text="INITIATE_HANDSHAKE">INITIATE_HANDSHAKE</span>' +
      '<span class="xp-tn-hs-bracket right">]</span>' +
      "</div>" +
      // -- live status readout — animates between phases via CSS
      '<div class="xp-tn-hs-status">' +
      '<i class="xp-tn-hs-dot"></i><span>channel encrypted</span>' +
      "<em>AES-256 / SHA-512</em>" +
      "</div>" +
      // -- IDENTITY block: one big copyable row (email). The GitHub handle
      // already shows up in the secondary meta strip below — duplicating it
      // here as a "GITHUB … COPY" row was visually misleading (the value
      // people expect to copy from a labelled MAIL row is a mail address).
      '<div class="xp-tn-hs-grid">' +
      '<button class="xp-tn-hs-row xp-copy" data-copy="' +
      esc(email(data)) +
      '" data-magnetic>' +
      '<span class="xp-tn-hs-k">MAIL</span>' +
      '<span class="xp-tn-hs-v">' +
      esc(email(data)) +
      "</span>" +
      '<span class="xp-tn-hs-act"><b>COPY</b><i>&#10697;</i></span>' +
      "</button>" +
      "</div>" +
      // -- secondary social links (open in new tab). Keep GitHub centered
      // between X/Twitter and LinkedIn when all three are present.
      '<div class="xp-tn-hs-meta">' +
      (l.x
        ? '<a class="xp-tn-hs-meta-link xp-tn-hs-meta-link--x" href="' +
          esc(l.x) +
          '" target="_blank" rel="noreferrer"><span>OPEN</span>x.com/' +
          esc(socialHandle(l.x, /^https?:\/\/(www\.)?(x|twitter)\.com\//i)) +
          "<i>&#8599;</i></a>"
        : "") +
      (l.github
        ? '<a class="xp-tn-hs-meta-link" href="' +
          esc(l.github) +
          '" target="_blank" rel="noreferrer"><span>OPEN</span>github.com/' +
          esc(gh || "") +
          "<i>&#8599;</i></a>"
        : "") +
      (l.linkedin
        ? '<a class="xp-tn-hs-meta-link xp-tn-hs-meta-link--linkedin" href="' +
          esc(l.linkedin) +
          '" target="_blank" rel="noreferrer"><span>OPEN</span>linkedin.com/' +
          esc(
            socialHandle(l.linkedin, /^https?:\/\/(www\.)?linkedin\.com\//i),
          ) +
          "<i>&#8599;</i></a>"
        : "") +
      "</div>" +
      "</div></div></section>" +
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
    // Hijack in-page anchor clicks (e.g. the right-side TerminalNexus rail) so
    // we always smooth-scroll into the section — and so the section header
    // clears the fixed top HUD instead of disappearing underneath it. External
    // links (no leading "#") are left untouched for the browser to handle.
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navLinks.forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) !== "#" || href.length < 2) return;
      a.addEventListener("click", function (ev) {
        var id = href.slice(1);
        var el = document.getElementById(id);
        if (!el) return;
        ev.preventDefault();
        el.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
        // Reflect the destination in the URL without pushing a new history
        // entry on every nav click.
        if (history.replaceState) history.replaceState(null, "", href);
      });
    });
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
    var scue = document.querySelector(".xp-tn-scrollcue");
    if (window.PH && typeof window.PH.onScroll === "function") {
      window.PH.onScroll(function (s) {
        if (pbar)
          pbar.style.transform = "scaleX(" + s.progress.toFixed(3) + ")";
        // Fade the scroll cue out as soon as the visitor starts moving so it
        // doesn't sit on top of the next section. 60px is "intent to scroll",
        // not a full section's worth — feels responsive.
        if (scue) {
          if (s.y > 60) scue.classList.add("xp-tn-scrollcue-hide");
          else scue.classList.remove("xp-tn-scrollcue-hide");
        }
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
    }
    tnNameGlitch();
    tnTerminal(data, user);
  }

  // RAMISWORLD — premium signal-lock glitch.
  // On pointer enter the wordmark snaps into a short glitch sequence: a
  // CSS-driven slice + RGB-split tear that runs once (~280ms). During that
  // window the base text is briefly scrambled to glyph noise so it reads as
  // a real signal decode, not a CSS toy. The colored phantoms (::before /
  // ::after) hold the true brand letters so the wordmark stays legible.
  // We also retrigger the glitch silently every 8-14s when idle to keep the
  // identity feeling alive without becoming arcade noise.
  function tnNameGlitch() {
    var el = document.querySelector(".xp-tn-name");
    if (!el) return;
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var brand = el.getAttribute("data-text") || el.textContent || "";
    var rule = el.querySelector(".xp-tn-name-rule");
    var GLYPHS = "01<>/\\[]{}#$%&*+=!?~^\u2591\u2592\u2593";
    var running = false;
    var idleTimer = 0;

    function setText(s) {
      // Keep the rule child intact while we swap the leading text node.
      el.firstChild ? (el.firstChild.nodeValue = s) : (el.textContent = s);
      if (rule && rule.parentNode !== el) el.appendChild(rule);
    }

    function scramble(durationMs) {
      var frames = Math.max(4, Math.round(durationMs / 30));
      var f = 0;
      var iv = setInterval(function () {
        f++;
        var out = "";
        for (var i = 0; i < brand.length; i++) {
          var ch = brand.charAt(i);
          if (ch === " ") {
            out += " ";
          } else if (Math.random() < f / frames) {
            out += ch;
          } else {
            out += GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
          }
        }
        setText(out);
        if (f >= frames) {
          clearInterval(iv);
          setText(brand);
        }
      }, 30);
    }

    function fire(withScramble) {
      if (running || reduce) return;
      running = true;
      el.classList.remove("glitching");
      // Force a reflow so the class re-add restarts the keyframes.
      // eslint-disable-next-line no-unused-expressions
      void el.offsetWidth;
      el.classList.add("glitching");
      if (withScramble) scramble(260);
      setTimeout(function () {
        el.classList.remove("glitching");
        running = false;
      }, 290);
    }

    el.addEventListener("pointerenter", function () {
      fire(true);
      window.clearTimeout(idleTimer);
      scheduleIdle(6000);
    });
    el.addEventListener("pointerleave", function () {
      // a soft retrigger on leave so the wordmark "snaps back" rather than
      // just settling — feels more alive on the way out.
      setTimeout(function () {
        fire(false);
      }, 80);
    });

    function scheduleIdle(min) {
      idleTimer = window.setTimeout(
        function () {
          if (document.hidden) {
            scheduleIdle(8000);
            return;
          }
          fire(false);
          scheduleIdle(8000 + Math.random() * 6000);
        },
        min + Math.random() * 6000,
      );
    }
    if (!reduce) scheduleIdle(7000);
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

  // The interactive terminal — a real (tiny) POSIX-ish shell over a virtual
  // filesystem synthesized from the visitor's ProfileData. The goal isn't to
  // emulate bash; it's to reward curiosity: ls/ls -a/ls -la, pwd, whoami, cat,
  // echo, cd, clear, history, date, uname, man, help, exit. Output is appended
  // to the same scrollback as the default whoami.sh card so the transcript
  // feels continuous, and Up/Down navigate the command history.
  function tnTerminal(data, user) {
    var term = document.getElementById("ph-term");
    var out = document.getElementById("ph-term-out");
    var input = document.getElementById("ph-term-input");
    if (!term || !out || !input) return;

    var cwd = "~";
    var hist = [];
    var histIdx = 0; // points one past the last entry → "fresh line"

    // --- virtual filesystem, derived from real ProfileData -----------------
    var langs = arr(data.languages).map(function (l) {
      return l.label;
    });
    var stackStr = tnStack(data);
    var projs = arr(data.projects).slice(0, 9);
    var ident = identity(data);
    var contactTxt =
      "name:   " +
      (ident.name || user) +
      "\nrole:   " +
      (ident.role || "—") +
      "\nemail:  " +
      email(data) +
      (links(data).github ? "\ngithub: " + links(data).github : "") +
      "\n";
    var skillsTxt = langs.length ? langs.join("\n") + "\n" : "(none)\n";
    var projectsJson = JSON.stringify(
      projs.map(function (p) {
        return {
          name: p.name,
          blurb: p.blurb,
          tech: arr(p.tech).slice(0, 6),
          stars: p.stars || 0,
          url: p.repoUrl || "",
        };
      }),
      null,
      2,
    );
    // Used to populate ~/credentials.txt in the interactive terminal. Mirrors
    // the data the CREDENTIALS section renders visually so power users can
    // `cat ~/credentials.txt` and get the same info in text form. Returns
    // a friendly "(none yet)" stub when the user hasn't added any.
    var credsTxt = (function () {
      var rows = arr(data.credentials);
      if (!rows.length) return "(none yet)\n";
      return (
        rows
          .map(function (c) {
            var line2 = c.issuer || "";
            var line3 = c.credentialId ? "id: " + c.credentialId : "";
            var line4 = c.url ? "verify: " + c.url : "";
            return [c.title, line2, line3, line4].filter(Boolean).join("\n  ");
          })
          .join("\n\n") + "\n"
      );
    })();

    // Two-tier tree: root → ~/ + children. Anything outside ~ is virtualized
    // away (cd /etc returns the "no such file" you'd expect).
    var FS = {
      "~": {
        type: "dir",
        children: {
          "whoami.sh": {
            type: "file",
            text: "#!/bin/sh\n# Identity card renderer.\n# Re-runs are no-op — the card is already on screen.\n",
          },
          "skills.txt": { type: "file", text: skillsTxt },
          "stack.txt": { type: "file", text: stackStr + "\n" },
          "projects.json": { type: "file", text: projectsJson + "\n" },
          "contact.txt": { type: "file", text: contactTxt },
          "credentials.txt": { type: "file", text: credsTxt },
          ".bashrc": {
            type: "file",
            text: "# minimal\nalias ll='ls -lA'\nalias la='ls -A'\nexport PS1='\\u@\\h:\\w$ '\n",
          },
          ".ssh": {
            type: "dir",
            children: {
              id_ed25519: { type: "file", text: "[REDACTED]\n" },
              "id_ed25519.pub": {
                type: "file",
                text: "ssh-ed25519 AAAA... " + user + "@ghost\n",
              },
              known_hosts: {
                type: "file",
                text: "github.com ssh-rsa AAAA...\n",
              },
            },
          },
        },
      },
    };

    // --- helpers -----------------------------------------------------------
    function escHtml(s) {
      return PH.esc(s);
    }
    // Resolve `path` against `cwd`, returning the FS node or null.
    function resolve(path) {
      if (!path || path === "." || path === "./") return nodeAt(cwd);
      if (path === "~" || path === "~/") return FS["~"];
      // we ignore absolute paths into the host root — this isn't your laptop.
      if (path.charAt(0) === "/") return null;
      var base = cwd.replace(/^~\/?/, "").split("/").filter(Boolean);
      var p = path.replace(/^~\/?/, "").split("/").filter(Boolean);
      var stack = path.charAt(0) === "~" ? [] : base.slice();
      for (var i = 0; i < p.length; i++) {
        if (p[i] === ".") continue;
        if (p[i] === "..") {
          stack.pop();
          continue;
        }
        stack.push(p[i]);
      }
      return nodeAtParts(stack);
    }
    function nodeAt(path) {
      var parts = path.replace(/^~\/?/, "").split("/").filter(Boolean);
      return nodeAtParts(parts);
    }
    function nodeAtParts(parts) {
      var node = FS["~"];
      for (var i = 0; i < parts.length; i++) {
        if (node.type !== "dir") return null;
        node = node.children[parts[i]];
        if (!node) return null;
      }
      return node;
    }
    function cwdToFsPath(c) {
      return c === "~" ? "~" : "~/" + c.replace(/^~\/?/, "");
    }
    function cwdToAbs(c) {
      var rel = c.replace(/^~\/?/, "");
      return "/home/" + user + (rel ? "/" + rel : "");
    }
    function fmtSize(n) {
      var s = String(n);
      while (s.length < 4) s = " " + s;
      return s;
    }
    function fmtLs(node, opts) {
      var names = Object.keys(node.children);
      if (!opts.all) {
        names = names.filter(function (n) {
          return n.charAt(0) !== ".";
        });
      } else if (opts.all && !opts.almostAll) {
        names = [".", ".."].concat(names);
      }
      names.sort();
      if (opts.long) {
        return names
          .map(function (n) {
            if (n === "." || n === "..")
              return (
                '<span class="xp-tn-tperm">drwxr-xr-x</span>  ' +
                fmtSize(0) +
                "  " +
                '<span class="xp-tn-tdir">' +
                escHtml(n) +
                "</span>"
              );
            var c = node.children[n];
            var isDir = c.type === "dir";
            var perm = isDir ? "drwxr-xr-x" : "-rw-r--r--";
            var size = isDir ? 0 : (c.text || "").length;
            return (
              '<span class="xp-tn-tperm">' +
              perm +
              "</span>  " +
              fmtSize(size) +
              "  " +
              (isDir
                ? '<span class="xp-tn-tdir">' + escHtml(n) + "/</span>"
                : escHtml(n))
            );
          })
          .join("\n");
      }
      return names
        .map(function (n) {
          if (n === "." || n === "..")
            return '<span class="xp-tn-tdir">' + escHtml(n) + "</span>";
          var c = node.children[n];
          return c.type === "dir"
            ? '<span class="xp-tn-tdir">' + escHtml(n) + "</span>"
            : escHtml(n);
        })
        .join("  ");
    }

    function promptHtml() {
      return (
        '<span class="xp-tn-tprompt-u">root@' +
        escHtml(user) +
        '</span><span class="xp-tn-tprompt-s">:' +
        escHtml(cwd) +
        "$</span>"
      );
    }
    function emit(html, cls) {
      var div = document.createElement("div");
      div.className = "xp-tn-tline" + (cls ? " " + cls : "");
      div.innerHTML = html;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    }

    // --- commands ----------------------------------------------------------
    var CMD = {
      help: function () {
        return (
          "commands: ls, ls -a, ls -l, ls -la, pwd, whoami, cat &lt;file&gt;, " +
          "echo &lt;text&gt;, cd &lt;dir&gt;, clear, history, date, uname [-a], " +
          "man &lt;cmd&gt;, exit"
        );
      },
      ls: function (args) {
        var flags = "";
        var target = null;
        for (var i = 0; i < args.length; i++) {
          if (args[i].charAt(0) === "-") flags += args[i].slice(1);
          else if (!target) target = args[i];
        }
        var opts = {
          all: /[aA]/.test(flags),
          almostAll: flags.indexOf("A") >= 0 && flags.indexOf("a") < 0,
          long: flags.indexOf("l") >= 0,
        };
        var node = target ? resolve(target) : resolve(cwd);
        if (!node)
          return {
            err:
              "ls: cannot access '" +
              escHtml(target || "") +
              "': No such file or directory",
          };
        if (node.type === "file") return target || "";
        return fmtLs(node, opts);
      },
      pwd: function () {
        return cwdToAbs(cwd);
      },
      whoami: function () {
        return escHtml(user);
      },
      hostname: function () {
        return "ghost";
      },
      cat: function (args) {
        if (!args.length) return { err: "cat: missing operand" };
        return args
          .map(function (a) {
            var n = resolve(a);
            if (!n)
              return (
                '<span class="xp-tn-terr">cat: ' +
                escHtml(a) +
                ": No such file or directory</span>"
              );
            if (n.type !== "file")
              return (
                '<span class="xp-tn-terr">cat: ' +
                escHtml(a) +
                ": Is a directory</span>"
              );
            return escHtml(n.text);
          })
          .join("\n");
      },
      echo: function (args) {
        return escHtml(args.join(" "));
      },
      cd: function (args) {
        var to = args[0] || "~";
        if (to === "~" || to === "/" || to === "/home/" + user) {
          cwd = "~";
          return null;
        }
        var n = resolve(to);
        if (!n)
          return {
            err: "cd: " + escHtml(to) + ": No such file or directory",
          };
        if (n.type !== "dir")
          return {
            err: "cd: " + escHtml(to) + ": Not a directory",
          };
        // Recompute cwd as a normalized ~-relative path.
        var base = cwd.replace(/^~\/?/, "").split("/").filter(Boolean);
        var rel = to.replace(/^~\/?/, "").split("/").filter(Boolean);
        var stack = to.charAt(0) === "~" ? [] : base;
        for (var i = 0; i < rel.length; i++) {
          if (rel[i] === ".") continue;
          if (rel[i] === "..") {
            stack.pop();
            continue;
          }
          stack.push(rel[i]);
        }
        cwd = stack.length ? "~/" + stack.join("/") : "~";
        return null;
      },
      clear: function () {
        out.innerHTML = "";
        return null;
      },
      date: function () {
        return escHtml(new Date().toUTCString());
      },
      uname: function (args) {
        if (args.indexOf("-a") >= 0)
          return "GHOST ghost 6.6.0-ghost #1 SMP PREEMPT x86_64 GNU/Linux";
        return "GHOST";
      },
      history: function () {
        if (!hist.length) return "";
        return hist
          .map(function (h, i) {
            var n = ("    " + (i + 1)).slice(-4);
            return n + "  " + escHtml(h);
          })
          .join("\n");
      },
      man: function (args) {
        if (!args.length) return { err: "What manual page do you want?" };
        return "No manual entry for " + escHtml(args[0]) + " — try `help`.";
      },
      exit: function () {
        return "logout. (session preserved — refresh to reconnect.)";
      },
    };
    CMD.ll = function () {
      return CMD.ls(["-lA"]);
    };
    CMD.la = function () {
      return CMD.ls(["-A"]);
    };
    CMD.logout = CMD.exit;
    CMD["./whoami.sh"] = function () {
      // The card is already on screen as the first session line; re-running
      // is a no-op for the visual but acknowledged so it doesn't read as an
      // error.
      return "ok";
    };

    function run(raw) {
      var trimmed = raw.replace(/\s+$/, "");
      if (!trimmed) return null;
      // Tolerate the no-space variants the user pointed out (ls-a, ls-la, ll).
      var glued = trimmed.match(/^(ls|cat|cd|man|echo|uname)(-\S+)$/);
      if (glued) trimmed = glued[1] + " " + glued[2];
      var parts = trimmed.split(/\s+/);
      var name = parts[0];
      var args = parts.slice(1);
      var fn = CMD[name];
      if (!fn)
        return {
          err: escHtml(name) + ": command not found",
        };
      return fn(args);
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var raw = input.value;
        emit(promptHtml() + " " + escHtml(raw), "xp-tn-tcmd");
        var res = run(raw);
        if (res !== null && res !== undefined && res !== "") {
          if (typeof res === "object" && res.err)
            emit('<span class="xp-tn-terr">' + res.err + "</span>");
          else emit(String(res));
        }
        if (raw.trim().length) {
          hist.push(raw);
          histIdx = hist.length;
        }
        input.value = "";
      } else if (e.key === "ArrowUp") {
        if (!hist.length) return;
        e.preventDefault();
        histIdx = Math.max(0, histIdx - 1);
        input.value = hist[histIdx] || "";
        // Move caret to the end after the value swap.
        var v = input.value;
        input.setSelectionRange(v.length, v.length);
      } else if (e.key === "ArrowDown") {
        if (!hist.length) return;
        e.preventDefault();
        histIdx = Math.min(hist.length, histIdx + 1);
        input.value = histIdx >= hist.length ? "" : hist[histIdx];
        var v2 = input.value;
        input.setSelectionRange(v2.length, v2.length);
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        out.innerHTML = "";
      } else if (e.key === "u" && e.ctrlKey) {
        e.preventDefault();
        input.value = "";
      } else if (e.key === "Escape") {
        input.value = "";
      }
    });

    // click anywhere in the terminal → focus the input
    term.addEventListener("click", function () {
      input.focus();
    });
    // links/buttons inside output should still work but shouldn't refocus
    out.addEventListener("click", function (e) {
      if (e.target.closest("a,button")) return;
      input.focus();
    });
    // Do not autofocus on load. Inside the dashboard preview this document is
    // sandboxed one iframe deeper; focusing the lower terminal input can make
    // the browser scroll the portfolio down before the user sees the hero.
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
