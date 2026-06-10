/* NeurowexTech AI Chat Widget — public/js/widget.js
 * Self-contained. No external dependencies or AI API calls.
 * Fetches /api/widget-data lazily (on first open) for live DB content.
 * Falls back to built-in data if the endpoint is unavailable.
 */
(function () {
  'use strict';

  if (window.__nwWidgetInit) return;
  window.__nwWidgetInit = true;

  // ─── Fallback data (shown when DB data isn't loaded yet / unavailable) ──────
  var FALLBACK = {
    services: [
      { name: 'Web Development',          description: 'Custom websites and web applications built for your business goals.',  price: 'From KSh 30,000' },
      { name: 'Mobile App Development',   description: 'Native & cross-platform apps for iOS and Android.',                   price: 'From KSh 50,000' },
      { name: 'E-commerce Solutions',     description: 'Full-featured online stores with payment integration.',                price: 'From KSh 45,000' },
      { name: 'UI/UX Design',             description: 'User-centred design for modern digital products.',                    price: 'From KSh 20,000' },
      { name: 'SEO & Digital Marketing',  description: 'Boost organic visibility and drive qualified traffic.',               price: 'From KSh 15,000/mo' },
      { name: 'Graphic Design',           description: 'Brand identity, logos, and marketing collateral.',                    price: 'From KSh 10,000' },
    ],
    pricing: [
      { name: 'Starter',    price: 'KSh 30,000',  features: ['5-page website', 'Mobile responsive', 'Basic SEO', '1 month support'] },
      { name: 'Business',   price: 'KSh 80,000',  features: ['10-page site', 'CMS integration', 'Advanced SEO', '3 months support', 'Contact forms'] },
      { name: 'Enterprise', price: 'Custom quote', features: ['Unlimited pages', 'Custom functionality', 'Dedicated support', 'Priority delivery'] },
    ],
    faqs: [
      { question: 'How long does it take to build a website?',    answer: 'Typically 2–6 weeks depending on complexity. A basic marketing site takes 2 weeks; complex web apps can take 4–8 weeks.' },
      { question: 'Do you offer post-launch support?',            answer: 'Yes — all packages include at least 1 month of free support. Extended support plans are available on request.' },
      { question: 'What technologies do you use?',                answer: 'React, Next.js, Node.js, Python, Flutter (mobile), and PostgreSQL / MySQL. We pick the best fit for your project.' },
      { question: 'Can I pay in instalments?',                    answer: 'Yes. We offer flexible payment plans — typically 50% upfront and 50% on delivery.' },
      { question: 'Do you work with clients outside Kenya?',      answer: 'Absolutely. We work with clients globally. Payments via M-Pesa, bank transfer, or PayPal are all accepted.' },
      { question: 'How do I enrol in an Academy course?',         answer: 'Create a free account at /sign_up, browse courses at /learn, and click Enrol on any course page.' },
      { question: 'Are your courses free?',                       answer: 'Some introductory lessons are free. Full course access depends on the course tier — check /learn for pricing.' },
    ],
    team: [
      { name: 'NeurowexTech Team', role: 'Development & Design', bio: 'A skilled team of Kenyan developers, designers, and digital strategists.' },
    ],
    courses: [
      { title: 'Full-Stack Web Development',        category: 'Programming', level: 'Beginner to Advanced' },
      { title: 'Mobile App Development (Flutter)',  category: 'Mobile',      level: 'Intermediate' },
      { title: 'UI/UX Design Fundamentals',         category: 'Design',      level: 'Beginner' },
      { title: 'Digital Marketing Mastery',         category: 'Marketing',   level: 'Beginner' },
      { title: 'Cybersecurity Essentials',          category: 'Security',    level: 'Beginner' },
      { title: 'AI & Machine Learning Basics',      category: 'AI',          level: 'Intermediate' },
    ],
    contact: { email: 'info@neurowextech.com', phone: '+254 700 000 000', whatsapp: '+254 700 000 000' },
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
    /* Hide any per-page dark/light toggle fixed at bottom-left — the widget owns that space */
    '#theme-toggle,#theme-toggle-fixed{display:none!important}',
    /* ---- floating button ---- */
    '.nw-btn{position:fixed;bottom:20px;left:20px;z-index:10001;width:58px;height:58px;border-radius:50%;',
    'background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);border:none;cursor:default;',
    'box-shadow:0 4px 20px rgba(108,99,255,.45);display:flex;align-items:center;justify-content:center;',
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s;outline:none;}',
    '.nw-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(108,99,255,.55);}',
    '.nw-btn:active{transform:scale(.96);}',
    '.nw-btn svg{width:28px;height:28px;pointer-events:none;}',
    '.nw-btn .nw-ico-close{display:none;}',
    '.nw-btn.nw-open .nw-ico-chat{display:none;}',
    '.nw-btn.nw-open .nw-ico-close{display:block;}',
    /* pulse ring */
    '.nw-btn:not(.nw-open)::after{content:\'\';position:absolute;inset:-6px;border-radius:50%;',
    'border:2px solid rgba(108,99,255,.4);animation:nwPulse 2s ease-out infinite;}',
    '@keyframes nwPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}',
    /* badge */
    '.nw-badge{position:absolute;top:-4px;right:-4px;background:#ff4757;color:#fff;border-radius:50%;',
    'width:18px;height:18px;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;}',
    /* ---- panel ---- */
    '.nw-panel{position:fixed;bottom:90px;left:20px;z-index:10000;width:360px;max-height:540px;',
    'display:flex;flex-direction:column;border-radius:18px;',
    'box-shadow:0 12px 48px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.12);background:#fff;',
    'font-family:\'Inter\',system-ui,-apple-system,sans-serif;font-size:14px;',
    'transform-origin:bottom left;transform:scale(.85) translateY(20px);opacity:0;pointer-events:none;',
    'transition:transform .28s cubic-bezier(.34,1.46,.64,1),opacity .22s ease;overflow:hidden;}',
    '.nw-panel.nw-vis{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
    /* header */
    '.nw-hdr{background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#fff;',
    'padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}',
    '.nw-hdr-av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);',
    'display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}',
    '.nw-hdr-info{flex:1;min-width:0;}',
    '.nw-hdr-name{font-weight:700;font-size:14px;letter-spacing:.2px;}',
    '.nw-hdr-status{font-size:11px;opacity:.85;display:flex;align-items:center;gap:4px;}',
    '.nw-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0;}',
    '.nw-hdr-acts{display:flex;gap:6px;}',
    '.nw-ibtn{background:rgba(255,255,255,.18);border:none;border-radius:7px;color:#fff;',
    'cursor:pointer;padding:5px 7px;font-size:13px;line-height:1;',
    'transition:background .15s;display:flex;align-items:center;}',
    '.nw-ibtn:hover{background:rgba(255,255,255,.32);}',
    /* messages area */
    '.nw-body{flex:1;overflow-y:auto;padding:14px 14px 6px;',
    'display:flex;flex-direction:column;gap:10px;background:#f8f9ff;scroll-behavior:smooth;}',
    '.nw-body::-webkit-scrollbar{width:4px;}',
    '.nw-body::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px;}',
    /* messages */
    '.nw-msg{display:flex;gap:8px;max-width:88%;animation:nwIn .22s ease;}',
    '@keyframes nwIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
    '.nw-msg.nw-u{align-self:flex-end;flex-direction:row-reverse;}',
    '.nw-av{width:28px;height:28px;border-radius:50%;',
    'background:linear-gradient(135deg,#6c63ff,#4facfe);flex-shrink:0;',
    'display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;margin-top:auto;}',
    '.nw-bbl{padding:9px 12px;border-radius:14px;line-height:1.55;word-break:break-word;}',
    '.nw-msg.nw-b .nw-bbl{background:#fff;color:#1a1a2e;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.08);}',
    '.nw-msg.nw-u .nw-bbl{background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#fff;border-bottom-right-radius:4px;}',
    '.nw-ts{font-size:10px;opacity:.5;margin-top:3px;}',
    '.nw-msg.nw-b .nw-ts{text-align:left;}.nw-msg.nw-u .nw-ts{text-align:right;}',
    /* typing */
    '.nw-typing{display:flex;align-items:center;gap:4px;padding:10px 13px;background:#fff;',
    'border-radius:14px;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.08);width:fit-content;}',
    '.nw-typing span{width:7px;height:7px;border-radius:50%;background:#6c63ff;',
    'animation:nwTyp 1.2s ease-in-out infinite;}',
    '.nw-typing span:nth-child(2){animation-delay:.2s}',
    '.nw-typing span:nth-child(3){animation-delay:.4s}',
    '@keyframes nwTyp{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}',
    /* suggestions */
    '.nw-chips{padding:6px 12px 10px;display:flex;flex-wrap:wrap;gap:6px;background:#f8f9ff;flex-shrink:0;}',
    '.nw-chip{background:#fff;border:1.5px solid #e5e7ff;border-radius:20px;padding:5px 11px;',
    'font-size:12px;color:#6c63ff;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}',
    '.nw-chip:hover{background:#6c63ff;color:#fff;border-color:#6c63ff;}',
    /* input area */
    '.nw-foot{padding:10px 12px;border-top:1px solid #eee;background:#fff;',
    'display:flex;align-items:center;gap:7px;flex-shrink:0;}',
    '.nw-inp{flex:1;border:1.5px solid #e5e7eb;border-radius:22px;padding:9px 14px;',
    'font-size:13px;font-family:inherit;outline:none;resize:none;background:#f8f9ff;',
    'color:#1a1a2e;transition:border-color .15s;max-height:80px;line-height:1.4;}',
    '.nw-inp:focus{border-color:#6c63ff;background:#fff;}',
    '.nw-inp::placeholder{color:#9ca3af;}',
    '.nw-sbtn,.nw-mbtn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .18s;}',
    '.nw-sbtn{background:linear-gradient(135deg,#6c63ff 0%,#4facfe 100%);color:#fff;}',
    '.nw-sbtn:hover{transform:scale(1.08);box-shadow:0 3px 10px rgba(108,99,255,.35);}',
    '.nw-sbtn:disabled{opacity:.5;cursor:not-allowed;transform:none;}',
    '.nw-mbtn{background:#f3f4f6;color:#6c63ff;}',
    '.nw-mbtn:hover{background:#e5e7ff;}',
    '.nw-mbtn.nw-rec{background:#ff4757;color:#fff;animation:nwMic 1s ease infinite;}',
    '@keyframes nwMic{0%,100%{box-shadow:0 0 0 0 rgba(255,71,87,.4)}50%{box-shadow:0 0 0 8px rgba(255,71,87,0)}}',
    /* mobile */
    '@media(max-width:480px){',
    '.nw-panel{width:calc(100vw - 30px);left:10px;bottom:80px;max-height:65vh;}',
    '.nw-btn{bottom:16px;left:16px;width:52px;height:52px;}',
    '}',
  ].join('');

  // ─── HTML ───────────────────────────────────────────────────────────────────
  var HTML = [
    '<button class="nw-btn" id="nwBtn" aria-label="Chat with NeurowexTech" title="Chat with NeurowexTech">',
    '<svg class="nw-ico-chat" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"',
    ' stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    '<svg class="nw-ico-close" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"',
    ' stroke-linecap="round" stroke-linejoin="round">',
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    '<span class="nw-badge" id="nwBadge">1</span>',
    '</button>',
    '<div class="nw-panel" id="nwPanel" role="dialog" aria-label="NeurowexTech Chat Assistant">',
    '<div class="nw-hdr">',
    '<div class="nw-hdr-av">🤖</div>',
    '<div class="nw-hdr-info">',
    '<div class="nw-hdr-name">NeurowexTech Assistant</div>',
    '<div class="nw-hdr-status"><span class="nw-dot"></span>Online — instant answers</div>',
    '</div>',
    '<div class="nw-hdr-acts">',
    '<button class="nw-ibtn" id="nwClear" title="Clear chat" aria-label="Clear conversation">',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">',
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>',
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
    '</button>',
    '<button class="nw-ibtn" id="nwClose" title="Close" aria-label="Close chat">',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    '</button>',
    '</div></div>',
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
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>',
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>',
    '<line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    '</button>',
    '<button class="nw-sbtn" id="nwSend" aria-label="Send message">',
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">',
    '<line x1="22" y1="2" x2="11" y2="13"/>',
    '<polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    '</button>',
    '</div></div>',
  ].join('');

  // ─── Intent detection ────────────────────────────────────────────────────────
  var INTENTS = [
    { keys: ['hello','hi ','hey','greet','start','what can','good morning','good afternoon','good evening','sup','howdy'], intent: 'greet' },
    { keys: ['service','offer','provide','what you do','build','develop','create','make','specialise','specialise'], intent: 'services' },
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

  /* Score a single FAQ entry against a query (checks question + answer text) */
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
    /* Require at least 2 keyword hits, OR 1 hit when the question is short (≤4 words) */
    var qWords = (best ? best.question : '').toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; });
    if (top >= 2 || (top >= 1 && qWords.length <= 4)) {
      return '**' + best.question + '**\n\n' + best.answer;
    }
    return null;
  }

  /* Return services whose name/description contains any keyword from the query */
  function searchServices(q, services) {
    if (!services || !services.length) return [];
    var words = q.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
    return services.filter(function (s) {
      var text = ((s.name || '') + ' ' + (s.description || '')).toLowerCase();
      return words.some(function (w) { return text.indexOf(w) !== -1; });
    });
  }

  /* Return courses whose title/category contains any keyword from the query */
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

    /* 1 — FAQ full-text search always runs first */
    var faqHit = searchFaq(q, d.faqs);
    if (faqHit) return faqHit;

    /* 2 — Narrow service search: "do you do SEO?", "can you build Flutter apps?" */
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

    /* 3 — Narrow course search: "Python course?", "Flutter training?" */
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
        return 'Hi there! 👋 I\'m NeurowexTech\'s AI assistant.\n\nI can help you with:\n• **Services** — web, mobile, e-commerce & more\n• **Pricing** — packages & quotes\n• **Academy** — courses & enrolment\n• **Contact** — reach our team\n\nWhat would you like to know?';

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
        if (c.whatsapp) out += '💬 WhatsApp: ' + c.whatsapp + '\n';
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
        /* Broad FAQ re-scan with lower threshold */
        var faqs = d.faqs || [];
        if (faqs.length) {
          var best2 = null, top2 = 0;
          for (var fi = 0; fi < faqs.length; fi++) {
            var sc = faqScore(faqs[fi], q);
            if (sc > top2) { top2 = sc; best2 = faqs[fi]; }
          }
          if (top2 >= 1 && best2) return '**' + best2.question + '**\n\n' + best2.answer;
        }
        /* Fall through to helpful fallback */
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
  var STORE_KEY = 'nw_chat_v1';

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
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* Minimal markdown: **bold**, [link](url), newlines */
  function md(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#6c63ff;text-decoration:underline">$1</a>')
      .replace(/\n/g, '<br>');
  }

  // ─── Widget ──────────────────────────────────────────────────────────────────
  function Widget() {
    this.msgs   = loadHistory();
    this.open   = false;
    this.busy   = false;
    this.recog  = null;
    this._mount();
  }

  Widget.prototype._mount = function () {
    /* Inject CSS */
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    /* Inject HTML */
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap);

    this.$btn   = document.getElementById('nwBtn');
    this.$panel = document.getElementById('nwPanel');
    this.$body  = document.getElementById('nwBody');
    this.$inp   = document.getElementById('nwInp');
    this.$send  = document.getElementById('nwSend');
    this.$mic   = document.getElementById('nwMic');
    this.$clear = document.getElementById('nwClear');
    this.$close = document.getElementById('nwClose');
    this.$badge = document.getElementById('nwBadge');
    this.$chips = document.getElementById('nwChips');

    this._bind();
    this._restoreHistory();

    /* Show badge after 3 s if user has never opened the widget */
    var self = this;
    setTimeout(function () {
      if (!self.open && !self.msgs.length) {
        self.$badge.style.display = 'flex';
      }
    }, 3000);
  };

  Widget.prototype._bind = function () {
    var self = this;
    this.$btn.addEventListener('click',   function () { self._toggle(); });
    this.$close.addEventListener('click', function () { self._close(); });
    this.$clear.addEventListener('click', function () { self._clear(); });
    this.$send.addEventListener('click',  function () { self._send(); });
    this.$mic.addEventListener('click',   function () { self._toggleVoice(); });

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

  Widget.prototype._toggle = function () { this.open ? this._close() : this._open(); };

  Widget.prototype._open = function () {
    this.open = true;
    this.$btn.classList.add('nw-open');
    this.$panel.classList.add('nw-vis');
    this.$badge.style.display = 'none';
    this.$inp.focus();
    fetchData(); /* lazy-load live DB data */

    if (!this.msgs.length) {
      this._addBot('Hi! 👋 I\'m NeurowexTech\'s AI assistant.\n\nAsk me about **services**, **pricing**, **Academy courses**, **contact info**, or anything else about NeurowexTech!');
    }
    this._scrollBottom();
  };

  Widget.prototype._close = function () {
    this.open = false;
    this.$btn.classList.remove('nw-open');
    this.$panel.classList.remove('nw-vis');
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
    var delay = 600 + Math.random() * 900;
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
    if (!SR) { alert('Voice input is not supported in your browser. Try Chrome.'); return; }

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
