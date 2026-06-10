/* NeurowexTech Support Widget — public/js/widget.js v2
 * Self-contained. No external dependencies or AI API calls.
 * Fetches /api/widget-data lazily on first open for live DB content.
 * Panel opens bottom-right and overlays the WhatsApp float when active.
 */
(function () {
  'use strict';

  if (window.__nwWidgetInit) return;
  window.__nwWidgetInit = true;

  // ─── Fallback data ───────────────────────────────────────────────────────────
  var FALLBACK = {
    services: [
      { name: 'Web Development',         description: 'Custom websites and web applications built for your business goals.',  price: 'From KSh 30,000' },
      { name: 'Mobile App Development',  description: 'Native & cross-platform apps for iOS and Android.',                   price: 'From KSh 50,000' },
      { name: 'E-commerce Solutions',    description: 'Full-featured online stores with payment integration.',                price: 'From KSh 45,000' },
      { name: 'UI/UX Design',            description: 'User-centred design for modern digital products.',                    price: 'From KSh 20,000' },
      { name: 'SEO & Digital Marketing', description: 'Boost organic visibility and drive qualified traffic.',               price: 'From KSh 15,000/mo' },
      { name: 'Graphic Design',          description: 'Brand identity, logos, and marketing collateral.',                    price: 'From KSh 10,000' },
    ],
    pricing: [
      { name: 'Starter',    price: 'KSh 30,000',  features: ['5-page website', 'Mobile responsive', 'Basic SEO', '1 month support'] },
      { name: 'Business',   price: 'KSh 80,000',  features: ['10-page site', 'CMS integration', 'Advanced SEO', '3 months support', 'Contact forms'] },
      { name: 'Enterprise', price: 'Custom quote', features: ['Unlimited pages', 'Custom functionality', 'Dedicated support', 'Priority delivery'] },
    ],
    faqs: [
      { question: 'How long does it take to build a website?',   answer: 'Typically 2–6 weeks depending on complexity. A basic marketing site takes 2 weeks; complex web apps can take 4–8 weeks.' },
      { question: 'Do you offer post-launch support?',           answer: 'Yes — all packages include at least 1 month of free support. Extended support plans are available on request.' },
      { question: 'What technologies do you use?',               answer: 'React, Next.js, Node.js, Python, Flutter (mobile), and PostgreSQL / MySQL. We pick the best fit for your project.' },
      { question: 'Can I pay in instalments?',                   answer: 'Yes. We offer flexible payment plans — typically 50% upfront and 50% on delivery.' },
      { question: 'Do you work with clients outside Kenya?',     answer: 'Absolutely. We work with clients globally. Payments via M-Pesa, bank transfer, or PayPal are all accepted.' },
      { question: 'How do I enrol in an Academy course?',        answer: 'Create a free account at /sign_up, browse courses at /learn, and click Enrol on any course page.' },
      { question: 'Are your courses free?',                      answer: 'Some introductory lessons are free. Full course access depends on the course tier — check /learn for pricing.' },
    ],
    team: [
      { name: 'NeurowexTech Team', role: 'Development & Design', bio: 'A skilled team of Kenyan developers, designers, and digital strategists.' },
    ],
    courses: [
      { title: 'Full-Stack Web Development',       category: 'Programming', level: 'Beginner to Advanced' },
      { title: 'Mobile App Development (Flutter)', category: 'Mobile',      level: 'Intermediate' },
      { title: 'UI/UX Design Fundamentals',        category: 'Design',      level: 'Beginner' },
      { title: 'Digital Marketing Mastery',        category: 'Marketing',   level: 'Beginner' },
      { title: 'Cybersecurity Essentials',         category: 'Security',    level: 'Beginner' },
      { title: 'AI & Machine Learning Basics',     category: 'AI',          level: 'Intermediate' },
    ],
    contact: { email: 'techneurowex@gmail.com', phone: '+254 769 329 340', whatsapp: '+254769329340' },
  };

  var _data = null;
  var _fetched = false;

  function fetchData() {
    if (_fetched) return;
    _fetched = true;
    fetch('/api/widget-data')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.success && j.data) _data = j.data; })
      .catch(function () {});
  }

  function data() { return _data || FALLBACK; }

  // ─── CSS ────────────────────────────────────────────────────────────────────
  var CSS = [
    /* ── floating button (bottom-right) ─────────────────────────────────── */
    '.nw-wrap{position:fixed;bottom:20px;right:20px;z-index:10002;}',
    '.nw-btn{',
      'position:relative;width:58px;height:58px;border-radius:50%;',
      'background:linear-gradient(135deg,#1c2b4a 0%,#2563eb 100%);',
      'border:none;',
      'box-shadow:0 4px 22px rgba(37,99,235,.45),0 2px 8px rgba(15,23,42,.25);',
      'display:flex;align-items:center;justify-content:center;',
      'transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s;',
      'outline:none;overflow:visible;}',
    '.nw-btn:hover{transform:scale(1.1);box-shadow:0 8px 32px rgba(37,99,235,.6),0 2px 10px rgba(15,23,42,.3);}',
    '.nw-btn:active{transform:scale(.96);}',
    '.nw-btn svg{width:26px;height:26px;pointer-events:none;flex-shrink:0;}',
    '.nw-btn .nw-ico-close{display:none;}',
    '.nw-btn.nw-open .nw-ico-chat{display:none;}',
    '.nw-btn.nw-open .nw-ico-close{display:block;}',
    /* breathing glow when closed */
    '.nw-btn:not(.nw-open){animation:nwBtnGlow 3s ease-in-out infinite;}',
    '@keyframes nwBtnGlow{',
      '0%,100%{box-shadow:0 4px 22px rgba(37,99,235,.45),0 2px 8px rgba(15,23,42,.2)}',
      '50%{box-shadow:0 6px 36px rgba(37,99,235,.72),0 0 0 10px rgba(37,99,235,.07),0 2px 8px rgba(15,23,42,.2)}',
    '}',
    /* pulse ring 1 */
    '.nw-btn:not(.nw-open)::before{',
      'content:\'\';position:absolute;inset:-5px;border-radius:50%;',
      'border:2px solid rgba(37,99,235,.55);',
      'animation:nwRing 2.6s ease-out infinite;}',
    /* pulse ring 2 */
    '.nw-btn:not(.nw-open)::after{',
      'content:\'\';position:absolute;inset:-5px;border-radius:50%;',
      'border:2px solid rgba(37,99,235,.32);',
      'animation:nwRing 2.6s ease-out .85s infinite;}',
    '@keyframes nwRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.72);opacity:0}}',
    /* live dot (bottom-right of button) */
    '.nw-live{',
      'position:absolute;bottom:1px;right:1px;',
      'width:13px;height:13px;',
      'background:#22c55e;border:2.5px solid #fff;border-radius:50%;',
      'animation:nwLive 2.2s ease-in-out infinite;',
      'transition:opacity .2s;}',
    '.nw-btn.nw-open .nw-live{opacity:0;}',
    '@keyframes nwLive{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.25);opacity:.7}}',
    /* badge */
    '.nw-badge{',
      'position:absolute;top:-3px;left:-3px;',
      'background:#e05c2a;color:#fff;border-radius:50%;',
      'width:19px;height:19px;font-size:10px;font-weight:800;',
      'display:none;align-items:center;justify-content:center;',
      'font-family:system-ui,sans-serif;border:2px solid #fff;',
      'animation:nwBadgePop .4s cubic-bezier(.34,1.56,.64,1) both;}',
    '@keyframes nwBadgePop{0%{transform:scale(0)}100%{transform:scale(1)}}',

    /* ── teaser notification ─────────────────────────────────────────────── */
    '.nw-teaser{',
      'position:fixed;bottom:90px;right:20px;z-index:10003;',
      'background:#fff;border-radius:14px 14px 4px 14px;',
      'padding:11px 36px 11px 12px;',
      'box-shadow:0 8px 32px rgba(15,23,42,.14),0 2px 8px rgba(15,23,42,.06);',
      'border:1px solid rgba(37,99,235,.1);',
      'max-width:245px;min-width:190px;',
      'display:flex;align-items:center;gap:9px;',
      'transform:translateX(18px) scale(.95);opacity:0;',
      'transition:transform .38s cubic-bezier(.34,1.46,.64,1),opacity .28s ease;',
      'pointer-events:none;cursor:pointer;}',
    '.nw-teaser.nw-teaser-vis{transform:translateX(0) scale(1);opacity:1;pointer-events:auto;}',
    '.nw-teaser-av{',
      'width:34px;height:34px;border-radius:50%;flex-shrink:0;',
      'background:linear-gradient(135deg,#1c2b4a,#2563eb);',
      'display:flex;align-items:center;justify-content:center;font-size:16px;}',
    '.nw-teaser-text{flex:1;min-width:0;}',
    '.nw-teaser-name{display:block;font-weight:700;font-size:11px;color:#1c2b4a;',
      'font-family:system-ui,sans-serif;letter-spacing:.2px;}',
    '.nw-teaser-msg{display:block;font-size:12px;color:#475569;line-height:1.45;',
      'font-family:system-ui,sans-serif;margin-top:1px;}',
    /* caret pointing down to button */
    '.nw-teaser::after{content:\'\';position:absolute;bottom:-7px;right:20px;',
      'width:0;height:0;',
      'border-left:7px solid transparent;border-right:7px solid transparent;',
      'border-top:7px solid #fff;}',
    '.nw-teaser-close{',
      'position:absolute;top:7px;right:8px;',
      'background:none;border:none;color:#94a3b8;font-size:13px;line-height:1;',
      'cursor:pointer;padding:2px 4px;border-radius:4px;transition:color .15s,background .15s;}',
    '.nw-teaser-close:hover{color:#475569;background:#f1f5f9;}',
    /* top accent line on teaser */
    '.nw-teaser::before{content:\'\';position:absolute;top:0;left:0;right:0;height:2px;',
      'background:linear-gradient(90deg,#1c2b4a,#2563eb,#e05c2a);border-radius:14px 14px 0 0;}',

    /* ── panel ───────────────────────────────────────────────────────────── */
    '.nw-panel{',
      'position:fixed;bottom:82px;right:20px;z-index:10005;',
      'width:375px;max-height:560px;',
      'display:flex;flex-direction:column;border-radius:18px;',
      'box-shadow:0 16px 56px rgba(15,23,42,.22),0 4px 14px rgba(15,23,42,.1);',
      'background:#fff;',
      "font-family:'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif;font-size:14px;",
      'transform-origin:bottom right;',
      'transform:scale(.88) translateY(16px);opacity:0;pointer-events:none;',
      'transition:transform .3s cubic-bezier(.34,1.46,.64,1),opacity .22s ease;',
      'overflow:hidden;}',
    '.nw-panel.nw-vis{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',

    /* header */
    '.nw-hdr{',
      'background:linear-gradient(135deg,#1c2b4a 0%,#2563eb 100%);color:#fff;',
      'padding:13px 14px 13px 14px;display:flex;align-items:center;gap:11px;flex-shrink:0;',
      'position:relative;overflow:hidden;}',
    /* subtle mesh overlay on header */
    '.nw-hdr::before{content:\'\';position:absolute;inset:0;',
      'background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);',
      'background-size:28px 28px;pointer-events:none;}',
    '.nw-hdr-av{',
      'width:40px;height:40px;border-radius:50%;',
      'background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.25);',
      'display:flex;align-items:center;justify-content:center;font-size:19px;',
      'flex-shrink:0;position:relative;z-index:1;}',
    /* animated ring on header avatar */
    '.nw-hdr-av::after{',
      'content:\'\';position:absolute;inset:-3px;border-radius:50%;',
      'border:1.5px solid rgba(255,255,255,.25);',
      'animation:nwHdrRing 3s ease-out infinite;}',
    '@keyframes nwHdrRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}',
    '.nw-hdr-info{flex:1;min-width:0;position:relative;z-index:1;}',
    '.nw-hdr-name{font-weight:800;font-size:13.5px;letter-spacing:.15px;color:#fff;}',
    '.nw-hdr-status{font-size:11px;color:rgba(255,255,255,.78);display:flex;align-items:center;gap:5px;margin-top:2px;}',
    '.nw-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0;',
      'animation:nwDotPulse 2s ease-in-out infinite;}',
    '@keyframes nwDotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.35)}}',
    '.nw-hdr-acts{display:flex;gap:5px;position:relative;z-index:1;}',
    '.nw-ibtn{',
      'background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);',
      'border-radius:8px;color:#fff;cursor:pointer;padding:5px 7px;font-size:12px;line-height:1;',
      'transition:background .15s,border-color .15s;display:flex;align-items:center;}',
    '.nw-ibtn:hover{background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.3);}',

    /* messages area */
    '.nw-body{',
      'flex:1;overflow-y:auto;padding:14px 13px 6px;',
      'display:flex;flex-direction:column;gap:11px;',
      'background:#f8fafc;scroll-behavior:smooth;}',
    '.nw-body::-webkit-scrollbar{width:3px;}',
    '.nw-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}',

    /* messages */
    '.nw-msg{display:flex;gap:8px;max-width:90%;animation:nwIn .22s ease;}',
    '@keyframes nwIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}',
    '.nw-msg.nw-u{align-self:flex-end;flex-direction:row-reverse;}',
    '.nw-av{',
      'width:28px;height:28px;border-radius:50%;',
      'background:linear-gradient(135deg,#1c2b4a,#2563eb);',
      'flex-shrink:0;display:flex;align-items:center;justify-content:center;',
      'font-size:13px;color:#fff;margin-top:auto;}',
    '.nw-bbl{padding:9px 12px;border-radius:14px;line-height:1.56;word-break:break-word;font-size:13px;}',
    '.nw-msg.nw-b .nw-bbl{',
      'background:#fff;color:#0f172a;border-bottom-left-radius:4px;',
      'box-shadow:0 1px 5px rgba(15,23,42,.08),0 0 0 1px rgba(15,23,42,.04);}',
    '.nw-msg.nw-u .nw-bbl{',
      'background:linear-gradient(135deg,#1c2b4a 0%,#2563eb 100%);',
      'color:#fff;border-bottom-right-radius:4px;}',
    '.nw-ts{font-size:10px;opacity:.42;margin-top:3px;font-family:system-ui,sans-serif;}',
    '.nw-msg.nw-b .nw-ts{text-align:left;}.nw-msg.nw-u .nw-ts{text-align:right;}',

    /* typing indicator */
    '.nw-typing{',
      'display:flex;align-items:center;gap:4px;padding:10px 13px;',
      'background:#fff;border-radius:14px;border-bottom-left-radius:4px;',
      'box-shadow:0 1px 5px rgba(15,23,42,.08),0 0 0 1px rgba(15,23,42,.04);',
      'width:fit-content;}',
    '.nw-typing span{',
      'width:7px;height:7px;border-radius:50%;background:#2563eb;',
      'animation:nwTyp 1.2s ease-in-out infinite;}',
    '.nw-typing span:nth-child(2){animation-delay:.2s}',
    '.nw-typing span:nth-child(3){animation-delay:.4s}',
    '@keyframes nwTyp{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-6px);opacity:1}}',

    /* quick-reply chips */
    '.nw-chips{',
      'padding:7px 11px 10px;display:flex;flex-wrap:wrap;gap:6px;',
      'background:#f8fafc;flex-shrink:0;',
      'border-top:1px solid rgba(15,23,42,.05);}',
    '.nw-chip{',
      'background:#fff;border:1.5px solid #e2e8f0;border-radius:20px;',
      'padding:5px 12px;font-size:12px;color:#334155;',
      'cursor:pointer;font-family:inherit;transition:all .17s;white-space:nowrap;',
      'font-weight:600;}',
    '.nw-chip:hover{background:#2563eb;color:#fff;border-color:#2563eb;',
      'transform:translateY(-1px);box-shadow:0 3px 10px rgba(37,99,235,.25);}',

    /* footer input */
    '.nw-foot{',
      'padding:10px 11px;border-top:1px solid #e2e8f0;background:#fff;',
      'display:flex;align-items:center;gap:7px;flex-shrink:0;}',
    '.nw-inp{',
      'flex:1;border:1.5px solid #e2e8f0;border-radius:22px;',
      'padding:9px 14px;font-size:13px;font-family:inherit;',
      'outline:none;resize:none;background:#f8fafc;',
      'color:#0f172a;transition:border-color .15s,background .15s;',
      'max-height:80px;line-height:1.45;}',
    '.nw-inp:focus{border-color:#2563eb;background:#fff;',
      'box-shadow:0 0 0 3px rgba(37,99,235,.08);}',
    '.nw-inp::placeholder{color:#94a3b8;}',
    '.nw-sbtn,.nw-mbtn{',
      'width:36px;height:36px;border-radius:50%;border:none;',
      'display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0;transition:all .18s;}',
    '.nw-sbtn{',
      'background:linear-gradient(135deg,#1c2b4a 0%,#2563eb 100%);color:#fff;',
      'box-shadow:0 2px 8px rgba(37,99,235,.3);}',
    '.nw-sbtn:hover{transform:scale(1.1);box-shadow:0 4px 14px rgba(37,99,235,.45);}',
    '.nw-sbtn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none;}',
    '.nw-mbtn{background:#f1f5f9;color:#64748b;border:1.5px solid #e2e8f0;}',
    '.nw-mbtn:hover{background:#e2e8f0;color:#1c2b4a;}',
    '.nw-mbtn.nw-rec{background:#e05c2a;color:#fff;border-color:#e05c2a;',
      'animation:nwMic 1s ease infinite;}',
    '@keyframes nwMic{0%,100%{box-shadow:0 0 0 0 rgba(224,92,42,.4)}50%{box-shadow:0 0 0 8px rgba(224,92,42,0)}}',

    /* ── responsive ──────────────────────────────────────────────────────── */
    '@media(max-width:480px){',
      '.nw-wrap{bottom:16px;right:14px;}',
      '.nw-btn{width:52px;height:52px;}',
      '.nw-panel{width:calc(100vw - 28px);right:14px;bottom:76px;max-height:68vh;}',
      '.nw-teaser{right:14px;bottom:84px;max-width:calc(100vw - 90px);}',
    '}',
  ].join('');

  // ─── HTML ───────────────────────────────────────────────────────────────────
  var HTML = [
    /* wrap holds button so z-index context is self-contained */
    '<div class="nw-wrap" id="nwWrap">',

    /* teaser bubble */
    '<div class="nw-teaser" id="nwTeaser">',
      '<div class="nw-teaser-av">🤖</div>',
      '<div class="nw-teaser-text">',
        '<span class="nw-teaser-name">NeurowexTech Support</span>',
        '<span class="nw-teaser-msg">👋 Hi! Need help? Ask me anything.</span>',
      '</div>',
      '<button class="nw-teaser-close" id="nwTeaserClose" aria-label="Dismiss">×</button>',
    '</div>',

    /* floating button */
    '<button class="nw-btn" id="nwBtn" aria-label="Chat with NeurowexTech" title="NeurowexTech Support">',
      '<svg class="nw-ico-chat" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      '</svg>',
      '<svg class="nw-ico-close" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      '</svg>',
      '<span class="nw-live" aria-hidden="true"></span>',
      '<span class="nw-badge" id="nwBadge">1</span>',
    '</button>',

    '</div>',

    /* chat panel */
    '<div class="nw-panel" id="nwPanel" role="dialog" aria-label="NeurowexTech Support Chat" aria-modal="true">',
      '<div class="nw-hdr">',
        '<div class="nw-hdr-av">🤖</div>',
        '<div class="nw-hdr-info">',
          '<div class="nw-hdr-name">NeurowexTech Support</div>',
          '<div class="nw-hdr-status"><span class="nw-dot"></span>Online — typically replies instantly</div>',
        '</div>',
        '<div class="nw-hdr-acts">',
          '<button class="nw-ibtn" id="nwClear" title="Clear conversation" aria-label="Clear conversation">',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">',
              '<polyline points="3 6 5 6 21 6"/>',
              '<path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
              '<path d="M9 6V4h6v2"/>',
            '</svg>',
          '</button>',
          '<button class="nw-ibtn" id="nwClose" title="Close chat" aria-label="Close chat">',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            '</svg>',
          '</button>',
        '</div>',
      '</div>',
      '<div class="nw-body" id="nwBody"></div>',
      '<div class="nw-chips" id="nwChips">',
        '<button class="nw-chip" data-q="What services do you offer?">Our services</button>',
        '<button class="nw-chip" data-q="What are your prices?">Pricing</button>',
        '<button class="nw-chip" data-q="What courses are available?">Academy</button>',
        '<button class="nw-chip" data-q="How can I contact you?">Contact us</button>',
        '<button class="nw-chip" data-q="Tell me about your team">The team</button>',
        '<button class="nw-chip" data-q="How long does it take to build a website?">Timeline</button>',
      '</div>',
      '<div class="nw-foot">',
        '<textarea class="nw-inp" id="nwInp" rows="1" placeholder="Ask about services, courses, pricing…" aria-label="Your message"></textarea>',
        '<button class="nw-mbtn" id="nwMic" title="Voice input" aria-label="Voice input">',
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
            '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>',
            '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>',
            '<line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
          '</svg>',
        '</button>',
        '<button class="nw-sbtn" id="nwSend" aria-label="Send message">',
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">',
            '<line x1="22" y1="2" x2="11" y2="13"/>',
            '<polygon points="22 2 15 22 11 13 2 9 22 2"/>',
          '</svg>',
        '</button>',
      '</div>',
    '</div>',
  ].join('');

  // ─── Intent detection ────────────────────────────────────────────────────────
  var INTENTS = [
    { keys: ['hello','hi ','hey','greet','start','what can','good morning','good afternoon','good evening','sup','howdy'], intent: 'greet' },
    { keys: ['service','offer','provide','what you do','build','develop','create','make','specialise'], intent: 'services' },
    { keys: ['price','cost','how much','pricing','package','plan','rate','charge','fee','budget','pay','afford','quote'], intent: 'pricing' },
    { keys: ['course','academy','learn','training','class','program','enrol','enroll','certificate','lesson','module','study','education'], intent: 'courses' },
    { keys: ['contact','reach','email','phone','whatsapp','call','talk','message','get in touch','speak','chat'], intent: 'contact' },
    { keys: ['team','staff','people','founder','who','member','expert','employee','developer','designer'], intent: 'team' },
    { keys: ['portfolio','project','work','example','sample','showcase','past','previous','client','case study'], intent: 'portfolio' },
    { keys: ['location','address','kenya','nairobi','where','office','based','country'], intent: 'location' },
    { keys: ['web','website','landing page','wordpress','cms','blog'], intent: 'web' },
    { keys: ['mobile','app','android','ios','flutter','react native'], intent: 'mobile' },
    { keys: ['ecommerce','e-commerce','shop','store','woocommerce','shopify','sell online'], intent: 'ecommerce' },
    { keys: ['seo','marketing','social media','google ads','digital marketing'], intent: 'marketing' },
    { keys: ['how long','timeline','duration','delivery','turnaround','deadline','when'], intent: 'timeline' },
    { keys: ['support','maintain','mainten','after launch','update','bug','fix'], intent: 'support' },
    { keys: ['pay','payment','mpesa','m-pesa','installment','deposit','invoice'], intent: 'payment' },
    { keys: ['faq','question','help','explain','tell me','what is','how do','can i','do you'], intent: 'faq' },
  ];

  function detectIntent(q) {
    q = q.toLowerCase();
    var best = null, top = 0;
    for (var i = 0; i < INTENTS.length; i++) {
      var score = 0;
      var keys = INTENTS[i].keys;
      for (var k = 0; k < keys.length; k++) {
        if (q.indexOf(keys[k]) !== -1) score++;
      }
      if (score > top) { top = score; best = INTENTS[i].intent; }
    }
    return top > 0 ? best : 'fallback';
  }

  function safeFeatures(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { var p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch (e) {}
      return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return [];
  }

  function faqScore(faq, q) {
    var haystack = ((faq.question || '') + ' ' + (faq.answer || '')).toLowerCase();
    var words = q.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; });
    var score = 0;
    for (var i = 0; i < words.length; i++) { if (haystack.indexOf(words[i]) !== -1) score++; }
    return score;
  }

  function searchFaq(q, faqs) {
    if (!faqs || !faqs.length) return null;
    var best = null, top = 0;
    for (var i = 0; i < faqs.length; i++) {
      var s = faqScore(faqs[i], q);
      if (s > top) { top = s; best = faqs[i]; }
    }
    var qWords = (best ? best.question : '').toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; });
    if (top >= 2 || (top >= 1 && qWords.length <= 4)) {
      return '**' + best.question + '**\n\n' + best.answer;
    }
    return null;
  }

  function searchServices(q, services) {
    if (!services || !services.length) return [];
    var words = q.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
    return services.filter(function (s) {
      var text = ((s.name || '') + ' ' + (s.description || '')).toLowerCase();
      return words.some(function (w) { return text.indexOf(w) !== -1; });
    });
  }

  function searchCourses(q, courses) {
    if (!courses || !courses.length) return [];
    var words = q.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
    return courses.filter(function (c) {
      var text = ((c.title || '') + ' ' + (c.category || '')).toLowerCase();
      return words.some(function (w) { return text.indexOf(w) !== -1; });
    });
  }

  function buildAnswer(q) {
    var d = data();
    var intent = detectIntent(q);

    var faqHit = searchFaq(q, d.faqs);
    if (faqHit) return faqHit;

    if (intent === 'services' || intent === 'web' || intent === 'mobile' || intent === 'ecommerce' || intent === 'marketing') {
      var matchedSvcs = searchServices(q, d.services);
      if (matchedSvcs.length && matchedSvcs.length < (d.services || []).length) {
        var out = '🛠️ **Relevant service' + (matchedSvcs.length > 1 ? 's' : '') + ':**\n\n';
        matchedSvcs.forEach(function (s) {
          out += '🔹 **' + s.name + '**';
          if (s.price) out += ' — ' + s.price;
          out += '\n';
          if (s.description) out += '   ' + s.description + '\n';
        });
        out += '\n[All services →](/services) | [Get a quote →](/contact)';
        return out;
      }
    }

    if (intent === 'courses') {
      var matchedCs = searchCourses(q, d.courses);
      if (matchedCs.length && matchedCs.length < (d.courses || []).length) {
        var out = '🎓 **Matching course' + (matchedCs.length > 1 ? 's' : '') + ':**\n\n';
        matchedCs.forEach(function (c) {
          out += '📚 **' + c.title + '**';
          if (c.category) out += ' *(' + c.category + ')*';
          if (c.level) out += ' — ' + c.level;
          out += '\n';
        });
        out += '\n[View course →](/learn) | [Sign up free →](/sign_up)';
        return out;
      }
    }

    switch (intent) {

      case 'greet':
        return 'Hi there! 👋 I\'m NeurowexTech\'s support assistant.\n\nI can help you with:\n• **Services** — web, mobile, e-commerce & more\n• **Pricing** — packages & quotes\n• **Academy** — courses & enrolment\n• **Contact** — reach our team\n\nWhat would you like to know?';

      case 'services': {
        var svcs = d.services || [];
        if (!svcs.length) return 'We build web apps, mobile apps, e-commerce stores, and offer design & digital marketing.\n\n[View all services →](/services) | [Get a quote →](/contact)';
        var out = '🛠️ **Our Services:**\n\n';
        svcs.forEach(function (s) {
          out += '🔹 **' + s.name + '**';
          if (s.price) out += ' — ' + s.price;
          out += '\n';
          if (s.description) out += '   ' + s.description + '\n';
        });
        out += '\n[View all services →](/services) | [Get a quote →](/contact)';
        return out;
      }

      case 'pricing': {
        var plans = d.pricing || [];
        if (!plans.length) return '💰 Pricing starts from KSh 30,000 for basic websites. For a custom quote, [contact us →](/contact)';
        var out = '💰 **Our Pricing Plans:**\n\n';
        plans.forEach(function (p) {
          var label = p.name || p.tier || 'Plan';
          var price = p.price || p.base_price || 'Custom';
          out += '**' + label + '** — ' + price + '\n';
          safeFeatures(p.features).slice(0, 5).forEach(function (f) { out += '  ✓ ' + f + '\n'; });
          out += '\n';
        });
        out += '[Full pricing details →](/services#pricing)';
        return out;
      }

      case 'courses': {
        var cs = d.courses || [];
        if (!cs.length) return '🎓 NeurowexTech Academy offers courses in web development, mobile, design, marketing & more.\n\n[Browse all →](/learn) | [Sign up free →](/sign_up)';
        var out = '🎓 **NeurowexTech Academy Courses:**\n\n';
        cs.slice(0, 8).forEach(function (c) {
          out += '📚 **' + c.title + '**';
          if (c.category) out += ' *(' + c.category + ')*';
          if (c.level) out += ' — ' + c.level;
          out += '\n';
        });
        if (cs.length > 8) out += '…and ' + (cs.length - 8) + ' more!\n';
        out += '\n[Browse all courses →](/learn) | [Create free account →](/sign_up)';
        return out;
      }

      case 'contact': {
        var c = d.contact || {};
        var out = '📬 **Contact NeurowexTech:**\n\n';
        if (c.email)    out += '📧 ' + c.email + '\n';
        if (c.phone)    out += '📞 ' + c.phone + '\n';
        if (c.whatsapp) out += '💬 WhatsApp: +' + c.whatsapp.replace(/^\+/, '') + '\n';
        out += '\n[Fill our contact form →](/contact)';
        return out;
      }

      case 'team': {
        var team = d.team || [];
        if (!team.length) return '👥 We\'re a passionate team of Kenyan developers, designers, and digital strategists.\n\n[Meet us →](/about)';
        var out = '👥 **NeurowexTech Team:**\n\n';
        team.slice(0, 6).forEach(function (m) {
          out += '**' + m.name + '** — ' + (m.role || 'Team Member') + '\n';
          if (m.bio) out += (m.bio.length > 100 ? m.bio.slice(0, 100) + '…' : m.bio) + '\n';
        });
        out += '\n[Full team →](/about)';
        return out;
      }

      case 'portfolio':
        return '🖥️ We\'ve delivered projects across e-commerce, fintech, healthtech, and EdTech for clients in Kenya and globally.\n\n[View our portfolio →](/portfolio)';

      case 'location':
        return '📍 NeurowexTech is headquartered in **Kenya** and serves clients worldwide.\n\n[Contact us →](/contact) to schedule a call or meeting.';

      case 'web':
        return '🌐 **Web Development** is our core service:\n• Custom websites & landing pages\n• Web apps (React, Next.js, Node.js)\n• E-commerce & CMS solutions\n\nPricing from KSh 30,000. [Get a quote →](/contact)';

      case 'mobile':
        return '📱 **Mobile App Development** — iOS & Android:\n• Flutter (cross-platform)\n• React Native\n• Native Swift / Kotlin when needed\n\nPricing from KSh 50,000. [Get a quote →](/contact)';

      case 'ecommerce':
        return '🛒 **E-commerce Solutions:**\n• M-Pesa, card & PayPal integration\n• Inventory & order management\n• Mobile-optimised checkout\n\nPricing from KSh 45,000. [Get a quote →](/contact)';

      case 'marketing':
        return '📈 **Digital Marketing & SEO:**\n• Search Engine Optimisation (SEO)\n• Google Ads & social media management\n• Content marketing & email campaigns\n\nFrom KSh 15,000/month. [Learn more →](/services)';

      case 'timeline':
        return '⏱️ **Typical project timelines:**\n• Basic website — 1–2 weeks\n• Business site with CMS — 2–4 weeks\n• E-commerce store — 3–6 weeks\n• Custom web app — 4–8 weeks\n• Mobile app — 6–12 weeks\n\nTimeline depends on scope & feedback speed. [Let\'s talk →](/contact)';

      case 'support':
        return '🛡️ **Post-launch support:**\n• All packages: at least 1 month free support\n• Extended maintenance plans available\n• Bug fixes, hosting guidance & updates\n\n[Contact us for a support plan →](/contact)';

      case 'payment':
        return '💳 **Payment options:**\n• M-Pesa, bank transfer, PayPal\n• 50% upfront + 50% on delivery\n• Milestone billing for larger projects\n\n[Request an invoice →](/contact)';

      case 'faq': {
        var faqs = d.faqs || [];
        if (faqs.length) {
          var best2 = null, top2 = 0;
          for (var fi = 0; fi < faqs.length; fi++) {
            var sc = faqScore(faqs[fi], q);
            if (sc > top2) { top2 = sc; best2 = faqs[fi]; }
          }
          if (top2 >= 1 && best2) return '**' + best2.question + '**\n\n' + best2.answer;
        }
        var c2 = d.contact || {};
        return 'I\'m not sure about that specific question. Here\'s what I can help with:\n\n• **Services** — what we build\n• **Pricing** — our packages\n• **Academy** — courses & enrolment\n• **Team** — who we are\n• **Portfolio** — our past work\n\n' +
          (c2.email ? 'Or email us at **' + c2.email + '** for a personal reply.' : 'Or [contact us directly →](/contact) for a personal reply.');
      }

      default: {
        var c3 = d.contact || {};
        return 'I\'m not sure I caught that! Try asking me about:\n\n• **Services** or **pricing**\n• **Academy courses** & enrolment\n• **Contact** information\n• **Portfolio** or the **team**\n\n' +
          (c3.email ? 'Or reach us at **' + c3.email + '** — we\'re happy to help! 😊' : '[Contact us directly →](/contact) — we\'re happy to help! 😊');
      }
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────
  var STORE_KEY = 'nw_chat_v2';

  function saveHistory(msgs) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-50))); } catch (e) {}
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  }

  function ftime() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function md(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb;text-decoration:underline;font-weight:600">$1</a>')
      .replace(/\n/g, '<br>');
  }

  // ─── WA float helper ─────────────────────────────────────────────────────────
  function setWaFloat(visible) {
    var wa = document.getElementById('wa-float');
    if (!wa) return;
    if (visible) {
      wa.style.transition = 'opacity .25s ease, transform .25s ease';
      wa.style.opacity = '1';
      wa.style.transform = '';
      wa.style.pointerEvents = 'auto';
    } else {
      wa.style.transition = 'opacity .2s ease, transform .2s ease';
      wa.style.opacity = '0';
      wa.style.transform = 'scale(.88) translateY(6px)';
      wa.style.pointerEvents = 'none';
    }
  }

  // ─── Widget ──────────────────────────────────────────────────────────────────
  function Widget() {
    this.msgs  = loadHistory();
    this.open  = false;
    this.busy  = false;
    this.recog = null;
    this._teaserTimer = null;
    this._mount();
  }

  Widget.prototype._mount = function () {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap);

    this.$wrap   = document.getElementById('nwWrap');
    this.$btn    = document.getElementById('nwBtn');
    this.$panel  = document.getElementById('nwPanel');
    this.$body   = document.getElementById('nwBody');
    this.$inp    = document.getElementById('nwInp');
    this.$send   = document.getElementById('nwSend');
    this.$mic    = document.getElementById('nwMic');
    this.$clear  = document.getElementById('nwClear');
    this.$close  = document.getElementById('nwClose');
    this.$badge  = document.getElementById('nwBadge');
    this.$chips  = document.getElementById('nwChips');
    this.$teaser = document.getElementById('nwTeaser');

    this._bind();
    this._restoreHistory();
    this._scheduleTeaserAndBadge();
  };

  Widget.prototype._bind = function () {
    var self = this;

    this.$btn.addEventListener('click',   function () { self._toggle(); });
    this.$close.addEventListener('click', function () { self._close(); });
    this.$clear.addEventListener('click', function () { self._clear(); });
    this.$send.addEventListener('click',  function () { self._send(); });
    this.$mic.addEventListener('click',   function () { self._toggleVoice(); });

    /* clicking teaser opens the widget */
    this.$teaser.addEventListener('click', function (e) {
      if (e.target.id === 'nwTeaserClose') return;
      self._open();
    });
    document.getElementById('nwTeaserClose').addEventListener('click', function (e) {
      e.stopPropagation();
      self._dismissTeaser(true);
    });

    this.$inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self._send(); }
    });

    this.$inp.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });

    this.$chips.addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('.nw-chip') : (e.target.classList.contains('nw-chip') ? e.target : null);
      if (!chip) return;
      self.$inp.value = chip.getAttribute('data-q');
      self._send();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.open) self._close();
    });
  };

  Widget.prototype._scheduleTeaserAndBadge = function () {
    var self = this;
    var dismissed = sessionStorage.getItem('nw-teaser-v2');

    /* show teaser after 4 s if not previously dismissed and widget is untouched */
    if (!dismissed && !this.msgs.length) {
      this._teaserTimer = setTimeout(function () {
        if (!self.open) {
          self.$teaser.classList.add('nw-teaser-vis');
          /* auto-dismiss after 9 s */
          setTimeout(function () { self._dismissTeaser(false); }, 9000);
        }
      }, 4000);
    }

    /* show badge after 3 s if chat history is empty */
    setTimeout(function () {
      if (!self.open && !self.msgs.length) {
        self.$badge.style.display = 'flex';
      }
    }, 3000);
  };

  Widget.prototype._dismissTeaser = function (permanent) {
    this.$teaser.classList.remove('nw-teaser-vis');
    if (permanent) sessionStorage.setItem('nw-teaser-v2', '1');
  };

  Widget.prototype._toggle = function () { this.open ? this._close() : this._open(); };

  Widget.prototype._open = function () {
    this.open = true;
    this.$btn.classList.add('nw-open');
    this.$panel.classList.add('nw-vis');
    this.$badge.style.display = 'none';
    this.$inp.focus();

    /* hide teaser and WA float — panel overlays their space */
    this._dismissTeaser(false);
    setWaFloat(false);

    fetchData();

    if (!this.msgs.length) {
      this._addBot('Hi! 👋 I\'m NeurowexTech\'s support assistant.\n\nAsk me about **services**, **pricing**, **Academy courses**, **contact info**, or anything else — I\'m here to help!');
    }
    this._scrollBottom();
  };

  Widget.prototype._close = function () {
    this.open = false;
    this.$btn.classList.remove('nw-open');
    this.$panel.classList.remove('nw-vis');

    /* restore WA float */
    setWaFloat(true);
  };

  Widget.prototype._send = function () {
    var text = this.$inp.value.trim();
    if (!text || this.busy) return;

    this._addUser(text);
    this.$inp.value = '';
    this.$inp.style.height = 'auto';
    this.$send.disabled = true;
    this.busy = true;
    this.$chips.style.display = 'none';

    var self = this;
    var delay = 550 + Math.random() * 800;
    var typingEl = this._showTyping();

    setTimeout(function () {
      typingEl.remove();
      self._addBot(buildAnswer(text));
      self.busy = false;
      self.$send.disabled = false;
    }, delay);
  };

  Widget.prototype._addUser = function (text) {
    var t = ftime();
    var el = document.createElement('div');
    el.className = 'nw-msg nw-u';
    el.innerHTML = '<div><div class="nw-bbl">' + esc(text) + '</div><div class="nw-ts">' + t + '</div></div><div class="nw-av">U</div>';
    this.$body.appendChild(el);
    this.msgs.push({ r: 'u', text: text, t: t });
    saveHistory(this.msgs);
    this._scrollBottom();
  };

  Widget.prototype._addBot = function (text) {
    var t = ftime();
    var el = document.createElement('div');
    el.className = 'nw-msg nw-b';
    el.innerHTML = '<div class="nw-av">🤖</div><div><div class="nw-bbl">' + md(text) + '</div><div class="nw-ts">' + t + '</div></div>';
    this.$body.appendChild(el);
    this.msgs.push({ r: 'b', text: text, t: t });
    saveHistory(this.msgs);
    this._scrollBottom();
  };

  Widget.prototype._showTyping = function () {
    var el = document.createElement('div');
    el.className = 'nw-msg nw-b';
    el.innerHTML = '<div class="nw-av">🤖</div><div class="nw-typing"><span></span><span></span><span></span></div>';
    this.$body.appendChild(el);
    this._scrollBottom();
    return el;
  };

  Widget.prototype._scrollBottom = function () {
    this.$body.scrollTop = this.$body.scrollHeight;
  };

  Widget.prototype._clear = function () {
    this.msgs = [];
    this.$body.innerHTML = '';
    saveHistory([]);
    this.$chips.style.display = 'flex';
    this._addBot('Chat cleared! 👋 How can I help you today?');
  };

  Widget.prototype._restoreHistory = function () {
    var self = this;
    if (!this.msgs.length) return;
    this.msgs.forEach(function (m) {
      var el = document.createElement('div');
      if (m.r === 'u') {
        el.className = 'nw-msg nw-u';
        el.innerHTML = '<div><div class="nw-bbl">' + esc(m.text) + '</div><div class="nw-ts">' + (m.t || '') + '</div></div><div class="nw-av">U</div>';
      } else {
        el.className = 'nw-msg nw-b';
        el.innerHTML = '<div class="nw-av">🤖</div><div><div class="nw-bbl">' + md(m.text) + '</div><div class="nw-ts">' + (m.t || '') + '</div></div>';
      }
      self.$body.appendChild(el);
    });
    if (this.msgs.length) this.$chips.style.display = 'none';
  };

  Widget.prototype._toggleVoice = function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this._addBot('Voice input is not supported in your browser. Please try Chrome or type your question.');
      return;
    }

    if (this.$mic.classList.contains('nw-rec')) {
      if (this.recog) this.recog.stop();
      this.$mic.classList.remove('nw-rec');
      return;
    }

    var self = this;
    this.recog = new SR();
    this.recog.lang = 'en-US';
    this.recog.interimResults = false;
    this.$mic.classList.add('nw-rec');
    this.recog.start();

    this.recog.onresult = function (e) {
      self.$inp.value = e.results[0][0].transcript;
      self.$mic.classList.remove('nw-rec');
      self._send();
    };
    this.recog.onerror = this.recog.onend = function () {
      self.$mic.classList.remove('nw-rec');
    };
  };

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function boot() { window.__nwWidget = new Widget(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
