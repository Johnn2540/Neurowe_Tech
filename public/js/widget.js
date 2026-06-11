/* NeurowexTech Support Widget — public/js/widget.js v3
 * Enhanced intelligence + live activity notifications.
 * Self-contained. No external deps or AI API calls.
 * Position: fixed bottom-left (unchanged).
 */
(function () {
  'use strict';

  if (window.__nwWidgetInit) return;
  window.__nwWidgetInit = true;

  // ─── Business knowledge ──────────────────────────────────────────────────────
  var FALLBACK = {
    services: [
      { name: 'Basic Website',           description: 'Clean, fast, mobile-ready marketing or portfolio site.',         price: 'From KSh 13,000' },
      { name: 'Business Website',        description: 'Multi-page site with CMS, advanced SEO & contact forms.',        price: 'From KSh 35,000' },
      { name: 'E-commerce Store',        description: 'Full online store with M-Pesa & card payment integration.',      price: 'From KSh 45,000' },
      { name: 'Mobile App',              description: 'Native & cross-platform apps for iOS and Android.',              price: 'From KSh 50,000' },
      { name: 'UI/UX Design',            description: 'User-centred design for modern digital products.',               price: 'From KSh 15,000' },
      { name: 'SEO & Digital Marketing', description: 'Boost organic visibility and drive qualified traffic.',          price: 'From KSh 12,000/mo' },
      { name: 'Graphic Design',          description: 'Brand identity, logos, and marketing collateral.',               price: 'From KSh 8,000' },
      { name: 'AI Solutions',            description: 'Custom AI integrations, chatbots, and smart automation.',        price: 'From KSh 60,000' },
    ],
    pricing: [
      { name: 'Basic',      price: 'KSh 13,000', features: ['3–5 page website', 'Mobile responsive', 'Basic SEO', 'Contact form', '2 weeks delivery', '1 month support'] },
      { name: 'Business',   price: 'KSh 35,000', features: ['Up to 10 pages', 'CMS (edit content yourself)', 'Advanced SEO', 'Blog & contact forms', 'WhatsApp button', '3 months support'] },
      { name: 'E-commerce', price: 'KSh 45,000', features: ['Full online store', 'M-Pesa + card payments', 'Product & order management', 'Mobile-optimised checkout', '3 months support'] },
      { name: 'Enterprise', price: 'Custom quote', features: ['Unlimited pages & features', 'Custom functionality', 'Dedicated project manager', 'Priority delivery', '6 months support'] },
    ],
    faqs: [
      { question: 'How much does a basic website cost?',       answer: 'A basic 3–5 page website starts from **KSh 13,000**. It includes mobile responsiveness, basic SEO, and a contact form — delivered in about 2 weeks.' },
      { question: 'Who is the founder of NeurowexTech?',       answer: '**Johnston J** is the founder and CEO of NeurowexTech. He built the company with a mission to make world-class digital solutions accessible across Africa, leading a team that has now delivered 500+ projects across 20+ countries.' },
      { question: 'How long does it take to build a website?', answer: '**Basic website:** 1–2 weeks\n**Business site with CMS:** 2–4 weeks\n**E-commerce store:** 3–6 weeks\n**Custom web app:** 4–8 weeks\n**Mobile app:** 6–12 weeks\n\nTimeline depends on scope and feedback speed.' },
      { question: 'Do you offer post-launch support?',         answer: 'Yes — all packages include at least **1 month of free support**. Extended maintenance plans are available. We\'re here after launch for bug fixes, updates, and guidance.' },
      { question: 'What technologies do you use?',             answer: 'We use **React, Next.js, Node.js, Python, Flutter** (mobile), and **PostgreSQL/MySQL**. We pick the best stack for your project and budget.' },
      { question: 'Can I pay in instalments?',                 answer: 'Yes. We offer **50% upfront + 50% on delivery**. For larger projects, milestone-based billing is available. Payment via M-Pesa, bank transfer, or PayPal.' },
      { question: 'Do you work with clients outside Kenya?',   answer: 'Absolutely — we work with clients in **20+ countries**. Payments via M-Pesa, bank transfer, PayPal, or Wise.' },
      { question: 'How do I enrol in a course?',               answer: 'Create a free account at **/sign_up**, browse courses at **/learn**, and click **Enrol**. Some courses are completely free to start!' },
      { question: 'Are the courses free?',                     answer: 'Some introductory content is **completely free**. Full access depends on the course tier — check **/learn** for pricing. We regularly run discounts and free trials.' },
      { question: 'Do you offer discounts?',                   answer: 'Yes! We offer **student discounts**, early-bird pricing, and seasonal promotions. Contact us to ask about current deals.' },
    ],
    team: [
      { name: 'Johnston J',        role: 'Founder & CEO',         bio: 'Visionary leader building world-class digital solutions from Kenya to the world. 5+ years driving innovation in web, mobile, and AI.' },
      { name: 'NeurowexTech Team', role: 'Development & Design',  bio: 'A skilled team of developers, designers, and digital strategists who have delivered 500+ projects across 20+ countries.' },
    ],
    courses: [
      { title: 'Full-Stack Web Development',       category: 'Programming', level: 'Beginner → Advanced', price: 'Free to start' },
      { title: 'Mobile App Development (Flutter)', category: 'Mobile',      level: 'Intermediate',        price: 'Paid' },
      { title: 'UI/UX Design Fundamentals',        category: 'Design',      level: 'Beginner',            price: 'Free to start' },
      { title: 'Digital Marketing Mastery',        category: 'Marketing',   level: 'Beginner',            price: 'Free to start' },
      { title: 'Cybersecurity Essentials',         category: 'Security',    level: 'Beginner',            price: 'Paid' },
      { title: 'AI & Machine Learning Basics',     category: 'AI',          level: 'Intermediate',        price: 'Paid' },
      { title: 'Graphic Design with Canva',        category: 'Design',      level: 'Beginner',            price: 'Free to start' },
      { title: 'Kids Coding Bootcamp',             category: 'Kids',        level: 'All ages',            price: 'Paid' },
    ],
    contact: { email: 'techneurowex@gmail.com', phone: '+254 769 329 340', whatsapp: '+254769329340' },
    stats:   { projects: '500+', countries: '20+', rating: '4.9/5', clients: '300+', years: '5+' },
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

  // ─── Context helpers ─────────────────────────────────────────────────────────
  function timeGreeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function pageCtx() {
    var p = window.location.pathname;
    if (p.indexOf('/learn') !== -1)     return 'academy';
    if (p.indexOf('/contact') !== -1)   return 'contact';
    if (p.indexOf('/services') !== -1)  return 'services';
    if (p.indexOf('/portfolio') !== -1) return 'portfolio';
    if (p.indexOf('/about') !== -1)     return 'about';
    if (p === '/')                      return 'home';
    return 'other';
  }

  // ─── Live notification messages ──────────────────────────────────────────────
  var LIVE_NOTIFS = [
    { icon: '🕐', text: '24/7 support — always here for you' },
    { icon: '✅', text: 'Websites from KSh 13,000 · no hidden fees' },
    { icon: '⚡', text: 'Websites built in just 1–2 weeks' },
    { icon: '📱', text: 'Free consultation — book yours today' },
    { icon: '🌍', text: 'Trusted by clients in 20+ countries' },
    { icon: '⭐', text: '4.9 / 5 rating · 300+ satisfied clients' },
    { icon: '🚀', text: '500+ successful projects delivered' },
    { icon: '💬', text: 'Average reply time: under 2 hours' },
    { icon: '🎓', text: 'Free courses — start learning today' },
    { icon: '🔒', text: 'Secure, fast & SEO-optimised websites' },
    { icon: '📈', text: 'Sites that rank on Google — built-in SEO' },
    { icon: '💳', text: 'Flexible payments — 50% now, 50% on delivery' },
    { icon: '🏆', text: "Kenya's top-rated digital agency" },
    { icon: '🎁', text: 'Student & startup discounts available' },
    { icon: '🤝', text: 'Post-launch support in every package' },
  ];

  var TEASER_MSGS = [
    '👋 ' + timeGreeting() + '! A basic website is just KSh 13,000. Ask me anything!',
    '🎓 Free Academy courses available — explore them now!',
    '⚡ We build websites in as little as 1–2 weeks!',
    '💬 Our team is online right now — how can we help?',
    '🌍 Trusted by 300+ clients across 20+ countries. Let\'s work together!',
    '🔒 Secure, SEO-optimised websites — built for results!',
    '📈 Free project quote — we respond in under 2 hours!',
    '🕐 24/7 support — we\'re always here for you.',
  ];

  // ─── Intent detection ────────────────────────────────────────────────────────
  var INTENTS = [
    { keys: ['hello','hi ','hey','greet','start','good morning','good afternoon','good evening','sup','howdy','what can you','help me'], intent: 'greet' },
    { keys: ['service','offer','provide','what you do','build','develop','create','make','specialise','specializ'], intent: 'services' },
    { keys: ['price','cost','how much','pricing','package','plan','rate','charge','fee','budget','pay','afford','quote','estimate','invoice','13000','13,000','cheap','expensive'], intent: 'pricing' },
    { keys: ['course','academy','learn','training','class','program','enrol','enroll','certificate','lesson','module','study','education','bootcamp'], intent: 'courses' },
    { keys: ['contact','reach','email','phone','whatsapp','call','talk','message','get in touch','speak','live chat'], intent: 'contact' },
    { keys: ['team','staff','people','founder','who','member','expert','employee','developer','designer','johnston','ceo','about the company','about neurowex'], intent: 'team' },
    { keys: ['portfolio','project','work','example','sample','showcase','past','previous','client','case study','what have you built'], intent: 'portfolio' },
    { keys: ['location','address','kenya','nairobi','where','office','based','country','headquarters'], intent: 'location' },
    { keys: ['web','website','landing page','wordpress','cms','blog','basic site','business site'], intent: 'web' },
    { keys: ['mobile','app','android','ios','flutter','react native','iphone'], intent: 'mobile' },
    { keys: ['ecommerce','e-commerce','shop','store','woocommerce','shopify','sell online','mpesa shop'], intent: 'ecommerce' },
    { keys: ['seo','marketing','social media','google ads','digital marketing','content','email campaign'], intent: 'marketing' },
    { keys: ['how long','timeline','duration','delivery','turnaround','deadline','when will','how fast'], intent: 'timeline' },
    { keys: ['support','maintain','mainten','after launch','update','bug','fix','post-launch'], intent: 'support' },
    { keys: ['pay','payment','mpesa','m-pesa','installment','instalment','deposit','50%','transfer'], intent: 'payment' },
    { keys: ['discount','deal','offer','promo','coupon','reduction','cheaper','negotiate'], intent: 'discount' },
    { keys: ['review','testimonial','rating','star','feedback','satisfied','happy client','trusted'], intent: 'testimonials' },
    { keys: ['urgent','asap','emergency','today','tonight','immediate','rush','quickly','fast'], intent: 'urgent' },
    { keys: ['ai','artificial intelligence','machine learning','chatbot','automation','gpt','openai'], intent: 'ai' },
    { keys: ['graphic','logo','brand','branding','identity','flyer','poster','banner','design'], intent: 'graphic' },
    { keys: ['faq','question','help','explain','tell me','what is','how do','can i','do you'], intent: 'faq' },
    { keys: ['compare','difference between','which plan','best plan','which package','versus','suitable for me','right for me','best for me','which option','which is better','what should i choose'], intent: 'compare' },
    { keys: ['get started','start a project','begin','i need a website','build my site','need an app','want a website','create my website','launch my','new project','how do i start','kick off','ready to start','i want to build','i want to create','let\'s start'], intent: 'getstarted' },
    { keys: ['rank','google','search engine','serp','keyword','backlink','organic','on-page','technical seo','local seo','seo audit'], intent: 'seo' },
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

  // ─── Search helpers ──────────────────────────────────────────────────────────
  function safeFeatures(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { var p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch (_e) {}
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
    if (!best) return null;
    var qWords = best.question.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; });
    if (top >= 2 || (top >= 1 && qWords.length <= 5)) {
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

  // ─── Context-aware follow-up chips ───────────────────────────────────────────
  var FOLLOWUPS = {
    services:     ['💰 Pricing',          '⏱️ Timeline',          '📬 Get a quote'],
    pricing:      ['📞 WhatsApp us',      '⏱️ How long?',         '💳 Payment options'],
    courses:      ['🎓 Free courses?',    '📜 Certificates?',     '🔗 Browse /learn'],
    contact:      ['💬 WhatsApp now',     '📧 Send email',        '📋 Contact form'],
    team:         ['👨‍💼 Our founder',    '🛠️ Our services',      '📂 Portfolio'],
    web:          ['💰 Basic site cost?', '⏱️ Timeline',          '🛒 E-commerce?'],
    mobile:       ['💰 App pricing',      '⏱️ How long?',         '📱 Cross-platform?'],
    ecommerce:    ['💳 M-Pesa support?',  '💰 Pricing',           '⏱️ Timeline'],
    marketing:    ['📈 SEO details',      '💰 Pricing',           '📬 Get a quote'],
    timeline:     ['💰 Pricing',          '📬 Get a quote',       '📞 WhatsApp us'],
    support:      ['💰 Pricing',          '📬 Contact us',        '🛠️ Services'],
    payment:      ['💰 Packages',         '📬 Get a quote',       '📞 WhatsApp us'],
    discount:     ['📬 Ask for a deal',   '🎓 Free courses',      '💰 Pricing'],
    testimonials: ['📂 Portfolio',        '🛠️ Our services',      '📬 Get a quote'],
    urgent:       ['📞 WhatsApp now',     '📧 Email us',          '📋 Contact form'],
    ai:           ['💰 AI pricing',       '⏱️ Timeline',          '📬 Get a quote'],
    graphic:      ['💰 Graphic pricing',  '📂 Our portfolio',     '📬 Get a quote'],
    location:     ['🌍 International?',   '📞 WhatsApp us',       '📬 Contact form'],
    portfolio:    ['🛠️ Our services',     '💰 Pricing',           '📬 Get a quote'],
    compare:      ['🚀 Get started',      '📬 Get a quote',       '📞 WhatsApp us'],
    getstarted:   ['💬 WhatsApp now',     '📬 Fill contact form', '💰 Pricing'],
    seo:          ['📈 SEO pricing',      '⏱️ Timeline',          '📬 Get a quote'],
  };

  function getFollowups(intent) {
    return FOLLOWUPS[intent] || ['🛠️ Services', '💰 Pricing', '📬 Contact'];
  }

  // ─── Answer builder ──────────────────────────────────────────────────────────
  function buildAnswer(q) {
    var d = data();
    var intent = detectIntent(q);

    /* FAQ hit takes priority */
    var faqHit = searchFaq(q, d.faqs);
    if (faqHit) return { text: faqHit, intent: intent };

    /* service keyword match */
    if (intent === 'services' || intent === 'web' || intent === 'mobile' || intent === 'ecommerce' || intent === 'marketing' || intent === 'ai' || intent === 'graphic') {
      var matchedSvcs = searchServices(q, d.services);
      if (matchedSvcs.length && matchedSvcs.length < (d.services || []).length) {
        var out = '🛠️ **Relevant service' + (matchedSvcs.length > 1 ? 's' : '') + ':**\n\n';
        matchedSvcs.forEach(function (s) {
          out += '🔹 **' + s.name + '**';
          if (s.price) out += ' — ' + s.price;
          out += '\n' + (s.description ? '   ' + s.description + '\n' : '');
        });
        out += '\n[All services →](/services) | [Get a quote →](/contact)';
        return { text: out, intent: intent };
      }
    }

    /* course keyword match */
    if (intent === 'courses') {
      var matchedCs = searchCourses(q, d.courses);
      if (matchedCs.length && matchedCs.length < (d.courses || []).length) {
        var out = '🎓 **Matching course' + (matchedCs.length > 1 ? 's' : '') + ':**\n\n';
        matchedCs.forEach(function (c) {
          out += '📚 **' + c.title + '**';
          if (c.category) out += ' *(' + c.category + ')*';
          if (c.level) out += ' — ' + c.level;
          if (c.price) out += ' · ' + c.price;
          out += '\n';
        });
        out += '\n[Browse courses →](/learn) | [Sign up free →](/sign_up)';
        return { text: out, intent: intent };
      }
    }

    var txt = '';
    switch (intent) {

      case 'greet': {
        var pg = pageCtx();
        var contextLine = '';
        if (pg === 'academy')   contextLine = '\n\nI see you\'re exploring our **Academy** — I can help you find the right course! 🎓';
        if (pg === 'services')  contextLine = '\n\nI see you\'re checking out our **services** — I can answer any pricing or timeline questions! 🛠️';
        if (pg === 'contact')   contextLine = '\n\nReady to get in touch? I can help you before you send that message! 📬';
        if (pg === 'portfolio') contextLine = '\n\nBrowsing our **portfolio**? I can tell you more about any of our projects! 📂';
        txt = timeGreeting() + '! 👋 Great to have you here.\n\n' +
              'I\'m the NeurowexTech support assistant — happy to help with anything!\n\n• **Pricing & services** — websites start at just KSh 13,000\n• **Academy** — find a course that works for you\n• **Our team** — based right here in Kenya 🇰🇪\n• **Get in touch** — we\'re always a message away' +
              contextLine + '\n\nWhat\'s on your mind?';
        return { text: txt, intent: intent };
      }

      case 'services': {
        var svcs = d.services || [];
        if (!svcs.length) return { text: 'We cover a lot of ground — web apps, mobile apps, e-commerce stores, graphic design, digital marketing, and AI solutions. Prices start from as low as KSh 13,000!\n\n[See all our services →](/services) | [Get a free quote →](/contact)', intent: intent };
        var out = '🛠️ **Our Services:**\n\n';
        svcs.forEach(function (s) {
          out += '🔹 **' + s.name + '**';
          if (s.price) out += ' — ' + s.price;
          out += '\n' + (s.description ? '   ' + s.description + '\n' : '');
        });
        out += '\n[Full services →](/services) | [Get a quote →](/contact)';
        return { text: out, intent: intent };
      }

      case 'pricing': {
        var plans = d.pricing || [];
        if (!plans.length) return { text: '💰 Good news — we keep our prices accessible! A basic website starts at just **KSh 13,000**. [Chat with us →](/contact) and we\'ll put together a quote that fits your budget.', intent: intent };
        var out = '💰 **Our Pricing:**\n\n';
        plans.forEach(function (p) {
          var price = p.price || p.base_price || 'Custom';
          out += '**' + p.name + '** — ' + price + '\n';
          safeFeatures(p.features).slice(0, 5).forEach(function (f) { out += '  ✓ ' + f + '\n'; });
          out += '\n';
        });
        out += '💳 Pay 50% upfront, 50% on delivery · M-Pesa, bank, PayPal accepted\n\n[Full pricing →](/services#pricing) | [Get a quote →](/contact)';
        return { text: out, intent: intent };
      }

      case 'courses': {
        var cs = d.courses || [];
        if (!cs.length) return { text: '🎓 We\'ve got courses on web development, mobile apps, design, digital marketing and more — and yes, some of them are completely free! Whether you\'re just starting out or leveling up, there\'s something for you.\n\n[Browse all courses →](/learn) | [Create a free account →](/sign_up)', intent: intent };
        var out = '🎓 **NeurowexTech Academy:**\n\n';
        cs.slice(0, 8).forEach(function (c) {
          out += '📚 **' + c.title + '**';
          if (c.category) out += ' *(' + c.category + ')*';
          if (c.level) out += ' — ' + c.level;
          if (c.price) out += ' · *' + c.price + '*';
          out += '\n';
        });
        if (cs.length > 8) out += '…and ' + (cs.length - 8) + ' more!\n';
        out += '\n[Browse all courses →](/learn) | [Create free account →](/sign_up)';
        return { text: out, intent: intent };
      }

      case 'contact': {
        var c = d.contact || {};
        var out = '📬 **Contact NeurowexTech:**\n\n';
        if (c.phone)    out += '📞 **Phone:** ' + c.phone + '\n';
        if (c.whatsapp) out += '💬 **WhatsApp:** [Chat now](https://wa.me/' + c.whatsapp.replace(/\D/g,'') + ')\n';
        if (c.email)    out += '📧 **Email:** ' + c.email + '\n';
        out += '\n🕐 We\'re pretty quick — we usually reply **within 2 hours** during business hours!\n\n[Fill the contact form →](/contact)';
        return { text: out, intent: intent };
      }

      case 'team': {
        var team = (d.team && d.team.length) ? d.team : FALLBACK.team;
        var out = '👥 **NeurowexTech Team:**\n\n';
        team.slice(0, 4).forEach(function (m) {
          out += '**' + m.name + '** — *' + (m.role || 'Team Member') + '*\n';
          if (m.bio) out += (m.bio.length > 120 ? m.bio.slice(0, 120) + '…' : m.bio) + '\n\n';
        });
        out += 'We\'re a tight-knit group and we love what we do! [Meet everyone →](/about)';
        return { text: out, intent: intent };
      }

      case 'portfolio':
        return { text: '🖥️ We\'re really proud of what we\'ve built together with our clients! Over **500 projects** delivered across e-commerce, fintech, healthtech, and EdTech — from Kenya to clients all over the world.\n\nA few highlights: FitSync, ChatSphere, TaskFlow, MediBook, ShopEase, EduLearn & more!\n\n[Check out our full portfolio →](/portfolio)', intent: intent };

      case 'location':
        return { text: '📍 We\'re based in **Kenya** 🇰🇪 — but distance is never a barrier for us! We\'ve worked with clients across **20+ countries** and we\'re very comfortable collaborating remotely.\n\nFeel free to [reach out →](/contact) and we can set up a call or virtual meeting anytime.', intent: intent };

      case 'web':
        return { text: '🌐 Web development is honestly what we love most! Here\'s a quick rundown:\n\n• **Basic website** — from **KSh 13,000** · ready in 1–2 weeks\n• **Business site with CMS** — from **KSh 35,000** · 2–4 weeks\n• **Custom web app** — from **KSh 60,000** · 4–8 weeks\n\nWe work with React, Next.js, Node.js, WordPress and more — whatever fits your project best.\n\n[Get a quote →](/contact) | [See our work →](/portfolio)', intent: intent };

      case 'mobile':
        return { text: '📱 We\'d love to help bring your app idea to life! We build cross-platform apps using Flutter and React Native — so it works great on both iOS and Android without double the cost.\n\n• **Flutter or React Native** — from **KSh 50,000**\n• Most apps are ready in **6–12 weeks** depending on complexity\n\n[Let\'s talk about your idea →](/contact)', intent: intent };

      case 'ecommerce':
        return { text: '🛒 We\'ll set you up with a store that actually converts! Here\'s what you get from **KSh 45,000:**\n\n• M-Pesa, card & PayPal payments built right in\n• Product catalogue & inventory management\n• Order tracking & customer dashboard\n• A checkout that looks and feels great on mobile\n• Up and running in **3–6 weeks**\n\n[Get a quote →](/contact)', intent: intent };

      case 'marketing':
        return { text: '📈 Let\'s get your brand seen! Our digital marketing packages start from **KSh 12,000/month** and include:\n\n• SEO — so you show up on Google\n• Google Ads & social media management\n• Content marketing & email campaigns\n• Monthly reports so you always know what\'s working\n\n[Learn more →](/services) | [Get a quote →](/contact)', intent: intent };

      case 'timeline':
        return { text: '⏱️ Here\'s a rough idea of how long things typically take:\n\n• **Basic website** — 1–2 weeks\n• **Business site with CMS** — 2–4 weeks\n• **E-commerce store** — 3–6 weeks\n• **Custom web app** — 4–8 weeks\n• **Mobile app** — 6–12 weeks\n\nTiming also depends on how quickly you\'re able to provide feedback and content — we\'ll always be upfront if anything might shift. Need it done faster? Just [ask us →](/contact) and we\'ll see what we can do!', intent: intent };

      case 'support':
        return { text: '🛡️ We don\'t just hand things over and disappear — we stay with you! Every package includes at least **1 month of free support** after launch.\n\n• Ongoing maintenance plans available if you want more coverage\n• Bug fixes, updates & hosting help — we\'ve got you\n• We\'ll always get back to you **within 24 hours**\n\n[Talk to us about a support plan →](/contact)', intent: intent };

      case 'payment':
        return { text: '💳 We try to make paying as easy as possible! Here\'s how it works:\n\n• **M-Pesa** — till number available, super convenient\n• Bank transfer — KCB, Equity, NCBA\n• PayPal & Wise — for our international clients\n• **50% upfront, 50% on delivery** — no surprises\n• Milestone payments available for larger projects\n\n[Request an invoice →](/contact)', intent: intent };

      case 'discount':
        return { text: '🎁 We love making it work for people! Here are some ways you could save:\n\n• **Student/graduate discount** — just let us know, we\'re happy to help\n• **Referral bonus** — send a client our way and we\'ll knock KSh 5,000 off your next project\n• **Bundle deals** — combine services and we\'ll sort you out\n• **Seasonal promos** — follow us or just ask what\'s on!\n\n[Ask about a deal →](/contact)', intent: intent };

      case 'testimonials':
        return { text: '⭐ We really value the trust our clients put in us — here\'s what a couple of them had to say:\n\n*"NeurowexTech delivered our MVP in 5 weeks. Incredibly responsive and talented."* — John S., TechStartup Inc.\n\n*"Our e-commerce sales tripled after the redesign. Highly recommended!"* — Sarah C., ShopEase\n\nWe\'re sitting at **4.9 / 5** · **300+ happy clients** · **20+ countries** 😊\n\n[See our portfolio →](/portfolio)', intent: intent };

      case 'urgent':
        return { text: '🚨 **We hear you — let\'s move fast!**\n\nThe quickest way to reach us right now:\n\n💬 **WhatsApp:** [Message our team now](https://wa.me/' + ((d.contact || {}).whatsapp || FALLBACK.contact.whatsapp).replace(/\D/g,'') + ')\n📞 **Call:** ' + ((d.contact || {}).phone || FALLBACK.contact.phone) + '\n\nWe do offer **rush delivery** for select projects. Just share your deadline and we\'ll be straight with you about whether we can make it!', intent: intent };

      case 'ai':
        return { text: '🤖 AI is genuinely exciting — and we\'re glad you asked! Here\'s what we can build for you, starting from **KSh 60,000:**\n\n• Custom AI chatbots & virtual assistants (like this one!)\n• Automating repetitive business processes\n• AI-powered analytics to make sense of your data\n• OpenAI / Claude API integrations\n• Machine learning model deployment\n\n[Book a free AI consultation →](/contact)', intent: intent };

      case 'graphic':
        return { text: '🎨 Great design makes such a difference! We handle it all, starting from **KSh 8,000:**\n\n• Logo & brand identity\n• Social media graphics\n• Flyers, posters & banners\n• Pitch decks\n• Packaging design\n\nWe work fast too — most jobs are wrapped up in **3–5 days**.\n\n[Get a quote →](/contact)', intent: intent };

      case 'faq': {
        var faqs = d.faqs || [];
        if (faqs.length) {
          var bestFaq = null, topScore = 0;
          for (var fi = 0; fi < faqs.length; fi++) {
            var sc = faqScore(faqs[fi], q);
            if (sc > topScore) { topScore = sc; bestFaq = faqs[fi]; }
          }
          if (topScore >= 1 && bestFaq) return { text: '**' + bestFaq.question + '**\n\n' + bestFaq.answer, intent: intent };
        }
        var c2 = d.contact || {};
        return { text: 'Happy to help! Here\'s what I can answer for you:\n\n• **Pricing** — websites from KSh 13,000\n• **Services** — web, mobile, AI & more\n• **Academy** — courses & certificates\n• **Compare plans** — find the right fit\n• **Portfolio** — 500+ projects delivered\n\n' + (c2.email ? 'Or just email us at **' + c2.email + '** and we\'ll reply personally 😊' : '[Contact us →](/contact) and we\'ll get back to you personally'), intent: intent };
      }

      case 'compare': {
        var wa2 = ((d.contact || {}).whatsapp || FALLBACK.contact.whatsapp).replace(/\D/g,'');
        return { text: '📊 **Which package is right for you?**\n\n🟢 **Basic — KSh 13,000**\nBest for: personal sites, portfolios, small businesses\n  ✓ 3–5 pages · contact form · mobile-ready · 2 weeks\n\n🔵 **Business — KSh 35,000**\nBest for: growing businesses needing a CMS & blog\n  ✓ Up to 10 pages · edit your own content · SEO · WhatsApp\n\n🟠 **E-commerce — KSh 45,000**\nBest for: selling products or services online\n  ✓ M-Pesa + card payments · product catalogue · order tracking\n\n🔴 **Enterprise — Custom quote**\nBest for: large-scale apps, custom integrations, SaaS\n\n💡 Not sure? [WhatsApp us](https://wa.me/' + wa2 + ') — we\'ll recommend the right fit in minutes!', intent: intent };
      }

      case 'getstarted': {
        var wa3 = ((d.contact || {}).whatsapp || FALLBACK.contact.whatsapp).replace(/\D/g,'');
        return { text: '🚀 **Let\'s build something great!**\n\nHere\'s how it works:\n\n1️⃣ **Tell us what you need** — website, app, design?\n2️⃣ **Free quote within 2 hours** — no obligation\n3️⃣ **Agree on scope & timeline** — no surprises\n4️⃣ **We build, you review** — staged delivery\n5️⃣ **Launch + support** — 1 month included\n\n💳 Pay **50% now, 50% on delivery** · M-Pesa accepted\n\n👇 **Pick the fastest path:**\n💬 [WhatsApp us now](https://wa.me/' + wa3 + ') · [Fill our form →](/contact)', intent: intent };
      }

      case 'seo': {
        return { text: '📈 Want to actually show up on Google? Here\'s what our SEO service covers:\n\n  ✓ Full site audit — we\'ll find exactly what\'s holding you back\n  ✓ Keyword research & strategy\n  ✓ On-page optimisation (titles, meta, headings, schema)\n  ✓ Technical SEO — speed, Core Web Vitals, mobile\n  ✓ Local SEO & Google Business Profile\n  ✓ Backlink building\n  ✓ Monthly ranking reports so you can track progress\n\n**Starting from KSh 12,000/month.** By the way — every website we build is already SEO-ready from day one.\n\n[Get a free SEO audit →](/contact) | [Learn more →](/services)', intent: intent };
      }

      default: {
        var c3 = d.contact || {};
        return { text: 'Hmm, I\'m not quite sure I caught that — sorry about that! 😊 Here are some things you could try asking:\n\n• **"How much is a basic website?"**\n• **"What services do you offer?"**\n• **"Compare your pricing plans"**\n• **"How do I get started?"**\n\n' + (c3.email ? 'Or just drop us an email at **' + c3.email + '** and we\'ll sort you out personally!' : '[Contact us →](/contact) and we\'ll get back to you personally.'), intent: 'fallback' };
      }
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────
  var STORE_KEY = 'nw_chat_v3';

  function saveHistory(msgs) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-60))); } catch (_e) {}
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (_e) { return []; }
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
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb;text-decoration:underline;font-weight:600" target="_self">$1</a>')
      .replace(/\n/g, '<br>');
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────────
  var CSS = [
    /* ── wrap (bottom-left) ───────────────────────────────────────────────── */
    '.nw-wrap{position:fixed;bottom:20px;left:20px;z-index:10002;}',

    /* ── floating button ──────────────────────────────────────────────────── */
    '.nw-btn{',
      'position:relative;width:58px;height:58px;border-radius:50%;',
      'background:linear-gradient(135deg,#1c2b4a 0%,#1e40af 60%,#2563eb 100%);',
      'border:none;cursor:pointer;',
      'box-shadow:0 4px 22px rgba(37,99,235,.5),0 2px 8px rgba(15,23,42,.3);',
      'display:flex;align-items:center;justify-content:center;',
      'transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s;',
      'outline:none;overflow:visible;}',
    '.nw-btn:hover{transform:scale(1.12);box-shadow:0 10px 36px rgba(37,99,235,.65),0 2px 10px rgba(15,23,42,.3);}',
    '.nw-btn:active{transform:scale(.95);}',
    '.nw-btn svg{width:26px;height:26px;pointer-events:none;flex-shrink:0;transition:transform .25s;}',
    '.nw-btn:hover svg{transform:scale(1.08);}',
    '.nw-btn .nw-ico-close{display:none;}',
    '.nw-btn.nw-open .nw-ico-chat{display:none;}',
    '.nw-btn.nw-open .nw-ico-close{display:block;}',

    /* breathing glow */
    '.nw-btn:not(.nw-open){animation:nwBtnGlow 3s ease-in-out infinite;}',
    '@keyframes nwBtnGlow{',
      '0%,100%{box-shadow:0 4px 22px rgba(37,99,235,.5),0 2px 8px rgba(15,23,42,.2)}',
      '50%{box-shadow:0 6px 38px rgba(37,99,235,.78),0 0 0 12px rgba(37,99,235,.06),0 2px 8px rgba(15,23,42,.2)}',
    '}',
    /* ring 1 */
    '.nw-btn:not(.nw-open)::before{',
      'content:\'\';position:absolute;inset:-6px;border-radius:50%;',
      'border:2px solid rgba(37,99,235,.6);',
      'animation:nwRing 2.8s ease-out infinite;}',
    /* ring 2 */
    '.nw-btn:not(.nw-open)::after{',
      'content:\'\';position:absolute;inset:-6px;border-radius:50%;',
      'border:2px solid rgba(37,99,235,.35);',
      'animation:nwRing 2.8s ease-out .9s infinite;}',
    '@keyframes nwRing{0%{transform:scale(1);opacity:.85}100%{transform:scale(1.85);opacity:0}}',

    /* ring 3 (extra outer, slow) */
    '.nw-ring3{position:absolute;inset:-6px;border-radius:50%;',
      'border:1.5px solid rgba(37,99,235,.18);pointer-events:none;',
      'animation:nwRing3 3.6s ease-out 1.8s infinite;}',
    '@keyframes nwRing3{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.2);opacity:0}}',

    /* live dot */
    '.nw-live{',
      'position:absolute;bottom:1px;right:1px;',
      'width:13px;height:13px;',
      'background:#22c55e;border:2.5px solid #fff;border-radius:50%;',
      'animation:nwLive 2.2s ease-in-out infinite;transition:opacity .2s;}',
    '.nw-btn.nw-open .nw-live{opacity:0;}',
    '@keyframes nwLive{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.65}}',

    /* badge */
    '.nw-badge{',
      'position:absolute;top:-3px;left:-3px;',
      'background:#e05c2a;color:#fff;border-radius:50%;',
      'width:19px;height:19px;font-size:10px;font-weight:800;',
      'display:none;align-items:center;justify-content:center;',
      'font-family:system-ui,sans-serif;border:2px solid #fff;',
      'animation:nwBadgePop .4s cubic-bezier(.34,1.56,.64,1) both;}',
    '@keyframes nwBadgePop{0%{transform:scale(0)}100%{transform:scale(1)}}',

    /* floating label beside the button */
    '.nw-label{',
      'position:absolute;left:68px;bottom:10px;',
      'background:#fff;color:#1c2b4a;',
      'border-radius:20px;padding:7px 14px;',
      'font-size:12.5px;font-weight:700;',
      'font-family:system-ui,sans-serif;white-space:nowrap;',
      'box-shadow:0 4px 18px rgba(15,23,42,.14);',
      'border:1px solid rgba(37,99,235,.12);',
      'opacity:0;pointer-events:none;',
      'transform:translateX(-8px);',
      'transition:opacity .32s ease,transform .32s cubic-bezier(.34,1.46,.64,1);}',
    '.nw-label.nw-label-vis{opacity:1;pointer-events:auto;transform:translateX(0);}',
    /* little arrow pointing left to button */
    '.nw-label::before{content:\'\';position:absolute;left:-7px;top:50%;transform:translateY(-50%);',
      'width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;',
      'border-right:7px solid #fff;}',

    /* ── live activity notification toasts ────────────────────────────────── */
    '.nw-notif{',
      'position:fixed;bottom:90px;left:20px;z-index:10004;',
      'background:#fff;border-radius:12px 12px 12px 4px;',
      'padding:9px 14px 9px 11px;',
      'display:flex;align-items:center;gap:8px;',
      'box-shadow:0 6px 24px rgba(15,23,42,.13),0 2px 6px rgba(15,23,42,.06);',
      'border:1px solid rgba(37,99,235,.1);',
      'max-width:240px;min-width:180px;',
      'font-family:system-ui,sans-serif;',
      'opacity:0;pointer-events:none;',
      'transform:translateX(-14px) scale(.96);',
      'transition:opacity .32s ease,transform .32s cubic-bezier(.34,1.46,.64,1);}',
    '.nw-notif.nw-notif-vis{opacity:1;pointer-events:none;transform:translateX(0) scale(1);}',
    '.nw-notif-icon{font-size:16px;flex-shrink:0;line-height:1;}',
    '.nw-notif-text{font-size:11.5px;color:#1e293b;font-weight:600;line-height:1.38;}',
    /* top accent */
    '.nw-notif::before{content:\'\';position:absolute;top:0;left:0;right:0;height:2px;',
      'background:linear-gradient(90deg,#1c2b4a,#2563eb);border-radius:12px 12px 0 0;}',

    /* ── teaser bubble ────────────────────────────────────────────────────── */
    '.nw-teaser{',
      'position:fixed;bottom:90px;left:20px;z-index:10003;',
      'background:#fff;border-radius:14px 14px 14px 4px;',
      'padding:11px 36px 11px 12px;',
      'box-shadow:0 8px 32px rgba(15,23,42,.14),0 2px 8px rgba(15,23,42,.06);',
      'border:1px solid rgba(37,99,235,.1);',
      'max-width:252px;min-width:190px;',
      'display:flex;align-items:center;gap:9px;',
      'transform:translateX(-18px) scale(.95);opacity:0;',
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
    '.nw-teaser-msg{display:block;font-size:11.5px;color:#475569;line-height:1.5;',
      'font-family:system-ui,sans-serif;margin-top:2px;}',
    '.nw-teaser::after{content:\'\';position:absolute;bottom:-7px;left:20px;',
      'width:0;height:0;',
      'border-left:7px solid transparent;border-right:7px solid transparent;',
      'border-top:7px solid #fff;}',
    '.nw-teaser-close{',
      'position:absolute;top:7px;right:8px;',
      'background:none;border:none;color:#94a3b8;font-size:13px;line-height:1;',
      'cursor:pointer;padding:2px 4px;border-radius:4px;transition:color .15s,background .15s;}',
    '.nw-teaser-close:hover{color:#475569;background:#f1f5f9;}',
    '.nw-teaser::before{content:\'\';position:absolute;top:0;left:0;right:0;height:2px;',
      'background:linear-gradient(90deg,#1c2b4a,#2563eb,#e05c2a);border-radius:14px 14px 0 0;}',

    /* ── panel ────────────────────────────────────────────────────────────── */
    '.nw-panel{',
      'position:fixed;bottom:82px;left:20px;z-index:10005;',
      'width:375px;max-height:570px;',
      'display:flex;flex-direction:column;border-radius:20px;',
      'box-shadow:0 20px 60px rgba(15,23,42,.22),0 4px 14px rgba(15,23,42,.1);',
      'background:#fff;',
      "font-family:'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif;font-size:14px;",
      'transform-origin:bottom left;',
      'transform:scale(.88) translateY(16px);opacity:0;pointer-events:none;',
      'transition:transform .3s cubic-bezier(.34,1.46,.64,1),opacity .22s ease;',
      'overflow:hidden;}',
    '.nw-panel.nw-vis{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',

    /* header */
    '.nw-hdr{',
      'background:linear-gradient(135deg,#1c2b4a 0%,#1e3a8a 50%,#2563eb 100%);color:#fff;',
      'padding:13px 14px;display:flex;align-items:center;gap:11px;flex-shrink:0;',
      'position:relative;overflow:hidden;}',
    '.nw-hdr::before{content:\'\';position:absolute;inset:0;',
      'background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);',
      'background-size:28px 28px;pointer-events:none;}',
    /* shimmer bar at top of header */
    '.nw-hdr::after{content:\'\';position:absolute;top:0;left:-100%;width:60%;height:100%;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);',
      'animation:nwShimmer 4s linear infinite;}',
    '@keyframes nwShimmer{0%{left:-100%}100%{left:200%}}',
    '.nw-hdr-av{',
      'width:42px;height:42px;border-radius:50%;',
      'background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.28);',
      'display:flex;align-items:center;justify-content:center;font-size:20px;',
      'flex-shrink:0;position:relative;z-index:1;}',
    '.nw-hdr-av::after{',
      'content:\'\';position:absolute;inset:-3px;border-radius:50%;',
      'border:1.5px solid rgba(255,255,255,.28);',
      'animation:nwHdrRing 3s ease-out infinite;}',
    '@keyframes nwHdrRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.5);opacity:0}}',
    '.nw-hdr-info{flex:1;min-width:0;position:relative;z-index:1;}',
    '.nw-hdr-name{font-weight:800;font-size:13.5px;letter-spacing:.1px;color:#fff;}',
    '.nw-hdr-sub{font-size:10px;color:rgba(255,255,255,.6);margin-top:1px;font-style:italic;}',
    '.nw-hdr-status{font-size:11px;color:rgba(255,255,255,.78);display:flex;align-items:center;gap:5px;margin-top:3px;}',
    '.nw-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0;',
      'animation:nwDotPulse 2s ease-in-out infinite;}',
    '@keyframes nwDotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}',
    '.nw-hdr-acts{display:flex;gap:5px;position:relative;z-index:1;}',
    '.nw-ibtn{',
      'background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);',
      'border-radius:8px;color:#fff;cursor:pointer;padding:5px 7px;font-size:12px;line-height:1;',
      'transition:background .15s,border-color .15s;display:flex;align-items:center;}',
    '.nw-ibtn:hover{background:rgba(255,255,255,.3);border-color:rgba(255,255,255,.35);}',

    /* messages area */
    '.nw-body{',
      'flex:1;overflow-y:auto;padding:14px 13px 6px;',
      'display:flex;flex-direction:column;gap:11px;',
      'background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);scroll-behavior:smooth;}',
    '.nw-body::-webkit-scrollbar{width:3px;}',
    '.nw-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}',

    /* messages */
    '.nw-msg{display:flex;gap:8px;max-width:92%;animation:nwIn .22s ease;}',
    '@keyframes nwIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
    '.nw-msg.nw-u{align-self:flex-end;flex-direction:row-reverse;}',
    '.nw-av{',
      'width:29px;height:29px;border-radius:50%;',
      'background:linear-gradient(135deg,#1c2b4a,#2563eb);',
      'flex-shrink:0;display:flex;align-items:center;justify-content:center;',
      'font-size:13px;color:#fff;margin-top:auto;box-shadow:0 2px 8px rgba(37,99,235,.3);}',
    '.nw-bbl{padding:9px 12px;border-radius:14px;line-height:1.58;word-break:break-word;font-size:13px;}',
    '.nw-msg.nw-b .nw-bbl{',
      'background:#fff;color:#0f172a;border-bottom-left-radius:4px;',
      'box-shadow:0 1px 5px rgba(15,23,42,.08),0 0 0 1px rgba(15,23,42,.04);}',
    '.nw-msg.nw-u .nw-bbl{',
      'background:linear-gradient(135deg,#1c2b4a 0%,#2563eb 100%);',
      'color:#fff;border-bottom-right-radius:4px;}',
    '.nw-ts{font-size:10px;opacity:.38;margin-top:3px;font-family:system-ui,sans-serif;}',
    '.nw-msg.nw-b .nw-ts{text-align:left;}.nw-msg.nw-u .nw-ts{text-align:right;}',

    /* typing indicator */
    '.nw-typing{',
      'display:flex;align-items:center;gap:4px;padding:10px 14px;',
      'background:#fff;border-radius:14px;border-bottom-left-radius:4px;',
      'box-shadow:0 1px 5px rgba(15,23,42,.08),0 0 0 1px rgba(15,23,42,.04);',
      'width:fit-content;}',
    '.nw-typing span{',
      'width:7px;height:7px;border-radius:50%;background:#2563eb;',
      'animation:nwTyp 1.2s ease-in-out infinite;}',
    '.nw-typing span:nth-child(2){animation-delay:.2s}',
    '.nw-typing span:nth-child(3){animation-delay:.4s}',
    '@keyframes nwTyp{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-6px);opacity:1}}',

    /* quick-reply chips */
    '.nw-chips{',
      'padding:7px 11px 10px;display:flex;flex-wrap:wrap;gap:6px;',
      'background:#f8fafc;flex-shrink:0;',
      'border-top:1px solid rgba(15,23,42,.05);}',
    '.nw-chip{',
      'background:#fff;border:1.5px solid #e2e8f0;border-radius:20px;',
      'padding:5px 12px;font-size:11.5px;color:#334155;',
      'cursor:pointer;font-family:inherit;transition:all .18s;white-space:nowrap;',
      'font-weight:600;line-height:1.4;}',
    '.nw-chip:hover{background:#2563eb;color:#fff;border-color:#2563eb;',
      'transform:translateY(-1px);box-shadow:0 3px 10px rgba(37,99,235,.28);}',

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
      'cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0;transition:all .18s;}',
    '.nw-sbtn{',
      'background:linear-gradient(135deg,#1c2b4a 0%,#2563eb 100%);color:#fff;',
      'box-shadow:0 2px 10px rgba(37,99,235,.32);}',
    '.nw-sbtn:hover{transform:scale(1.1);box-shadow:0 4px 16px rgba(37,99,235,.48);}',
    '.nw-sbtn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none;}',
    '.nw-mbtn{background:#f1f5f9;color:#64748b;border:1.5px solid #e2e8f0;}',
    '.nw-mbtn:hover{background:#e2e8f0;color:#1c2b4a;}',
    '.nw-mbtn.nw-rec{background:#e05c2a;color:#fff;border-color:#e05c2a;',
      'animation:nwMic 1s ease infinite;}',
    '@keyframes nwMic{0%,100%{box-shadow:0 0 0 0 rgba(224,92,42,.4)}50%{box-shadow:0 0 0 8px rgba(224,92,42,0)}}',

    /* branding footer */
    '.nw-brand{',
      'text-align:center;font-size:10px;color:#94a3b8;padding:5px 0 8px;',
      'font-family:system-ui,sans-serif;letter-spacing:.3px;background:#fff;}',
    '.nw-brand strong{color:#1c2b4a;}',

    /* ── responsive ──────────────────────────────────────────────────────── */
    '@media(max-width:480px){',
      '.nw-wrap{bottom:16px;left:14px;}',
      '.nw-btn{width:52px;height:52px;}',
      '.nw-panel{width:calc(100vw - 28px);left:14px;bottom:76px;max-height:70vh;}',
      '.nw-teaser{left:14px;bottom:84px;max-width:calc(100vw - 90px);}',
      '.nw-notif{left:14px;bottom:84px;max-width:calc(100vw - 90px);}',
      '.nw-label{display:none;}',
    '}',

    /* ── global overrides ───────────────────────────────────────────────── */
    '#theme-toggle,#theme-toggle-fixed{display:none!important}',

    '.nw-nav-dark-btn{',
      'width:36px;height:36px;border-radius:50%;border:1.5px solid rgba(15,23,42,.1);',
      'background:#fff;display:flex;align-items:center;justify-content:center;',
      'cursor:pointer;transition:all .22s;flex-shrink:0;}',
    '.nw-nav-dark-btn svg{width:16px;height:16px;stroke:#64748b;stroke-width:1.8;fill:none;',
      'stroke-linecap:round;stroke-linejoin:round;transition:stroke .2s;}',
    '.nw-nav-dark-btn:hover{background:#2563eb;border-color:#2563eb;transform:rotate(18deg) scale(1.06);}',
    '.nw-nav-dark-btn:hover svg{stroke:#fff;}',
    'body.dark .nw-nav-dark-btn{background:#1a2236;border-color:rgba(255,255,255,.1);}',
    'body.dark .nw-nav-dark-btn svg{stroke:rgba(255,255,255,.8);}',
  ].join('');

  // ─── HTML ─────────────────────────────────────────────────────────────────────
  var HTML = [
    '<div class="nw-wrap" id="nwWrap">',

    /* live activity notification */
    '<div class="nw-notif" id="nwNotif">',
      '<span class="nw-notif-icon" id="nwNotifIcon">⚡</span>',
      '<span class="nw-notif-text" id="nwNotifText">24/7 support — always here for you</span>',
    '</div>',

    /* teaser bubble */
    '<div class="nw-teaser" id="nwTeaser">',
      '<div class="nw-teaser-av">🤖</div>',
      '<div class="nw-teaser-text">',
        '<span class="nw-teaser-name">NeurowexTech · AI Support</span>',
        '<span class="nw-teaser-msg" id="nwTeaserMsg">👋 Hi! A basic website is just KSh 13,000. Ask me anything!</span>',
      '</div>',
      '<button class="nw-teaser-close" id="nwTeaserClose" aria-label="Dismiss">×</button>',
    '</div>',

    /* label beside button */
    '<div class="nw-label" id="nwLabel">💬 Chat with us</div>',

    /* floating button */
    '<button class="nw-btn" id="nwBtn" aria-label="Chat with NeurowexTech" title="NeurowexTech Support">',
      '<span class="nw-ring3" aria-hidden="true"></span>',
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
          '<div class="nw-hdr-name">NeurowexTech · AI Support</div>',
          '<div class="nw-hdr-sub">AI Support · Kenya 🇰🇪</div>',
          '<div class="nw-hdr-status"><span class="nw-dot"></span><span id="nwOnlineTxt">Online · we reply in &lt;2 hours</span></div>',
        '</div>',
        '<div class="nw-hdr-acts">',
          '<button class="nw-ibtn" id="nwClear" title="Clear conversation" aria-label="Clear conversation">',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">',
              '<polyline points="3 6 5 6 21 6"/>',
              '<path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
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
        '<button class="nw-chip" data-q="How much is a basic website?">💰 Website cost</button>',
        '<button class="nw-chip" data-q="What services do you offer?">🛠️ Services</button>',
        '<button class="nw-chip" data-q="What courses are available?">🎓 Academy</button>',
        '<button class="nw-chip" data-q="How can I contact you?">📬 Contact</button>',
        '<button class="nw-chip" data-q="Who is the founder?">👨‍💼 Founder</button>',
        '<button class="nw-chip" data-q="How long does it take to build a website?">⏱️ Timeline</button>',
      '</div>',
      '<div class="nw-foot">',
        '<textarea class="nw-inp" id="nwInp" rows="1" placeholder="Ask about pricing, courses, timeline…" aria-label="Your message"></textarea>',
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
      '<div class="nw-brand">Powered by <strong>NeurowexTech</strong> · AI Support Team 🇰🇪</div>',
    '</div>',
  ].join('');

  // ─── WA float helper ─────────────────────────────────────────────────────────
  function setWaFloat(visible) {
    var wa = document.getElementById('wa-float');
    if (!wa) return;
    if (visible) {
      wa.style.transition = 'opacity .25s ease,transform .25s ease';
      wa.style.opacity = '1';
      wa.style.transform = '';
      wa.style.pointerEvents = 'auto';
    } else {
      wa.style.transition = 'opacity .2s ease,transform .2s ease';
      wa.style.opacity = '0';
      wa.style.transform = 'scale(.88) translateY(6px)';
      wa.style.pointerEvents = 'none';
    }
  }

  // ─── Widget ──────────────────────────────────────────────────────────────────
  function Widget() {
    this.msgs         = loadHistory();
    this.open         = false;
    this.busy         = false;
    this.recog        = null;
    this._notifIdx    = 0;
    this._notifTimer  = null;
    this._idleTimer   = null;
    this._lastIntent  = null;
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
    this.$notif  = document.getElementById('nwNotif');
    this.$label  = document.getElementById('nwLabel');

    this._bind();
    this._restoreHistory();
    this._scheduleTeaserAndBadge();
    this._scheduleLabel();
    this._scheduleNotifs();
  };

  Widget.prototype._bind = function () {
    var self = this;
    this.$btn.addEventListener('click',   function () { self._toggle(); });
    this.$close.addEventListener('click', function () { self._close(); });
    this.$clear.addEventListener('click', function () { self._clear(); });
    this.$send.addEventListener('click',  function () { self._send(); });
    this.$mic.addEventListener('click',   function () { self._toggleVoice(); });

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

  /* ── Teaser ── */
  Widget.prototype._scheduleTeaserAndBadge = function () {
    var self = this;
    var dismissed = sessionStorage.getItem('nw-teaser-v3');
    if (!dismissed && !this.msgs.length) {
      setTimeout(function () {
        if (!self.open) {
          /* pick a random teaser message */
          var msg = TEASER_MSGS[Math.floor(Math.random() * TEASER_MSGS.length)];
          var el = document.getElementById('nwTeaserMsg');
          if (el) el.textContent = msg;
          self.$teaser.classList.add('nw-teaser-vis');
          setTimeout(function () { self._dismissTeaser(false); }, 10000);
        }
      }, 4500);
    }
    setTimeout(function () {
      if (!self.open && !self.msgs.length) self.$badge.style.display = 'flex';
    }, 3000);
  };

  Widget.prototype._dismissTeaser = function (permanent) {
    this.$teaser.classList.remove('nw-teaser-vis');
    if (permanent) sessionStorage.setItem('nw-teaser-v3', '1');
  };

  /* ── Floating label ── */
  Widget.prototype._scheduleLabel = function () {
    var self = this;
    if (sessionStorage.getItem('nw-label-v3')) return;
    setTimeout(function () {
      if (!self.open) {
        self.$label.classList.add('nw-label-vis');
        setTimeout(function () {
          self.$label.classList.remove('nw-label-vis');
          sessionStorage.setItem('nw-label-v3', '1');
        }, 6000);
      }
    }, 2000);
  };

  /* ── Live activity notifications ── */
  Widget.prototype._scheduleNotifs = function () {
    var self = this;
    /* first notif after 18s, then every 22s */
    setTimeout(function () { self._showNextNotif(); }, 18000);
  };

  Widget.prototype._showNextNotif = function () {
    var self = this;
    if (this.open) {
      /* push next one when panel is closed */
      setTimeout(function () { self._showNextNotif(); }, 22000);
      return;
    }
    var n = LIVE_NOTIFS[this._notifIdx % LIVE_NOTIFS.length];
    this._notifIdx++;

    var iconEl = document.getElementById('nwNotifIcon');
    var textEl = document.getElementById('nwNotifText');
    if (iconEl) iconEl.textContent = n.icon;
    if (textEl) textEl.textContent = n.text;

    this.$notif.classList.add('nw-notif-vis');
    setTimeout(function () {
      self.$notif.classList.remove('nw-notif-vis');
      setTimeout(function () { self._showNextNotif(); }, 22000);
    }, 5000);
  };

  /* ── Open / close / toggle ── */
  Widget.prototype._toggle = function () { this.open ? this._close() : this._open(); };

  Widget.prototype._open = function () {
    this.open = true;
    this.$btn.classList.add('nw-open');
    this.$panel.classList.add('nw-vis');
    this.$badge.style.display = 'none';
    this.$label.classList.remove('nw-label-vis');
    this._dismissTeaser(false);
    this.$notif.classList.remove('nw-notif-vis');
    setWaFloat(false);
    fetchData();
    this._startIdleTimer();
    this.$inp.focus();

    if (!this.msgs.length) {
      var self = this;
      var t1 = self._showTyping();
      setTimeout(function () {
        t1.remove();
        self._addBot(timeGreeting() + '! 👋 I\'m NeurowexTech\'s virtual assistant — here to help you 24/7.');
        var t2 = self._showTyping();
        setTimeout(function () {
          t2.remove();
          var pg = pageCtx();
          var extra = pg === 'academy'   ? '\n\n🎓 You\'re on the Academy page — I can help you find the perfect course!'
                    : pg === 'services'  ? '\n\n🛠️ You\'re browsing our services — ask me about pricing or timelines!'
                    : pg === 'contact'   ? '\n\n📬 Ready to get in touch? Ask me anything first!'
                    : '\n\n💡 Quick fact: a basic website starts from just **KSh 13,000** — ask me anything!';
          self._addBot('Ask me about **services, pricing, courses, the team**, or anything else.' + extra);
        }, 950);
      }, 780);
    }
    this._scrollBottom();
  };

  Widget.prototype._close = function () {
    this.open = false;
    this.$btn.classList.remove('nw-open');
    this.$panel.classList.remove('nw-vis');
    this._clearIdleTimer();
    setWaFloat(true);
  };

  /* ── Idle proactive message ── */
  Widget.prototype._startIdleTimer = function () {
    var self = this;
    this._clearIdleTimer();
    this._idleTimer = setTimeout(function () {
      if (self.open && !self.busy) {
        self._addBot('Still there? 😊 Here are some things I can quickly answer:\n\n• **"How much is a basic website?"** → KSh 13,000\n• **"Who is the founder?"** → Johnston J\n• **"What free courses do you have?"** → Several!\n\nOr [WhatsApp us directly →](https://wa.me/' + FALLBACK.contact.whatsapp.replace(/\D/g, '') + ') 💬');
      }
    }, 45000);
  };

  Widget.prototype._clearIdleTimer = function () {
    if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; }
  };

  Widget.prototype._resetIdleTimer = function () {
    if (this.open) this._startIdleTimer();
  };

  /* ── Send ── */
  Widget.prototype._send = function () {
    var text = this.$inp.value.trim();
    if (!text || this.busy) return;

    this._addUser(text);
    this.$inp.value = '';
    this.$inp.style.height = 'auto';
    this.$send.disabled = true;
    this.busy = true;
    this.$chips.style.display = 'none';
    this._clearIdleTimer();

    var self = this;
    var delay = 520 + Math.random() * 900;
    var typingEl = this._showTyping();

    setTimeout(function () {
      typingEl.remove();
      var result = buildAnswer(text);
      var answerText = typeof result === 'object' ? result.text : result;
      var intent     = typeof result === 'object' ? result.intent : 'fallback';
      self._lastIntent = intent;
      self._addBot(answerText);
      self._showFollowupChips(intent);
      self.busy = false;
      self.$send.disabled = false;
      self._resetIdleTimer();
    }, delay);
  };

  /* ── Follow-up chips ── */
  Widget.prototype._showFollowupChips = function (intent) {
    var chips = getFollowups(intent);
    var self = this;
    /* remap chip label → question */
    var labelToQ = {
      '💰 Pricing':          'What are your prices?',
      '⏱️ Timeline':         'How long does it take to build a website?',
      '📬 Get a quote':      'How can I get a quote?',
      '📞 WhatsApp us':      'How can I contact you?',
      '⏱️ How long?':        'How long does it take?',
      '💳 Payment options':  'How can I pay?',
      '🎓 Free courses?':    'Are there free courses?',
      '📜 Certificates?':    'Do you offer certificates?',
      '🔗 Browse /learn':    'What courses are available?',
      '💬 WhatsApp now':     'How can I contact you?',
      '📧 Send email':       'What is your email address?',
      '📋 Contact form':     'How can I contact you?',
      '👨‍💼 Our founder':   'Who is the founder?',
      '🛠️ Our services':     'What services do you offer?',
      '📂 Portfolio':        'Can I see your portfolio?',
      '💰 Basic site cost?': 'How much is a basic website?',
      '🛒 E-commerce?':      'How much is an e-commerce store?',
      '💰 App pricing':      'How much does a mobile app cost?',
      '📱 Cross-platform?':  'Do you build cross-platform apps?',
      '💳 M-Pesa support?':  'Do you support M-Pesa payments?',
      '📈 SEO details':      'Tell me about your SEO service',
      '📬 Contact us':       'How can I contact you?',
      '📬 Ask for a deal':   'Do you offer discounts?',
      '🌍 International?':   'Do you work with clients outside Kenya?',
      '💰 AI pricing':       'How much does an AI solution cost?',
      '💰 Graphic pricing':  'How much does graphic design cost?',
      '📂 Our portfolio':    'Can I see your portfolio?',
      '🎓 Free courses':     'Are there free courses?',
      '📬 Contact form':     'How can I contact you?',
      '🛠️ Services':         'What services do you offer?',
      '💰 Pricing':          'What are your prices?',
      '📬 Contact':          'How can I contact you?',
      '🚀 Get started':      'I want to get started on a project',
      '📊 Compare plans':    'Can you compare your packages?',
      '📈 SEO pricing':      'How much does SEO cost?',
      '💬 WhatsApp now':     'How can I contact you?',
      '📬 Fill contact form':'How can I contact you?',
    };

    setTimeout(function () {
      self.$chips.innerHTML = '';
      chips.forEach(function (label) {
        var q = labelToQ[label] || label.replace(/^[^\s]+\s/, '');
        var btn = document.createElement('button');
        btn.className = 'nw-chip';
        btn.setAttribute('data-q', q);
        btn.textContent = label;
        self.$chips.appendChild(btn);
      });
      self.$chips.style.display = 'flex';
    }, 200);
  };

  /* ── Message rendering ── */
  Widget.prototype._addUser = function (text) {
    var t = ftime();
    var el = document.createElement('div');
    el.className = 'nw-msg nw-u';
    el.innerHTML = '<div><div class="nw-bbl">' + esc(text) + '</div><div class="nw-ts">' + t + '</div></div><div class="nw-av">👤</div>';
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
    this.$chips.innerHTML = '';
    ['💰 Website cost', '🛠️ Services', '🎓 Academy', '📬 Contact', '👨‍💼 Founder', '⏱️ Timeline'].forEach(function (lbl) {
      var qMap = { '💰 Website cost': 'How much is a basic website?', '🛠️ Services': 'What services do you offer?', '🎓 Academy': 'What courses are available?', '📬 Contact': 'How can I contact you?', '👨‍💼 Founder': 'Who is the founder?', '⏱️ Timeline': 'How long does it take to build a website?' };
      var btn = document.createElement('button');
      btn.className = 'nw-chip';
      btn.setAttribute('data-q', qMap[lbl] || lbl);
      btn.textContent = lbl;
      document.getElementById('nwChips').appendChild(btn);
    });
    this.$chips.style.display = 'flex';
    this._addBot('Chat cleared! 👋 ' + timeGreeting() + ' — how can I help you today?');
    this._resetIdleTimer();
  };

  Widget.prototype._restoreHistory = function () {
    var self = this;
    if (!this.msgs.length) return;
    this.msgs.forEach(function (m) {
      var el = document.createElement('div');
      if (m.r === 'u') {
        el.className = 'nw-msg nw-u';
        el.innerHTML = '<div><div class="nw-bbl">' + esc(m.text) + '</div><div class="nw-ts">' + (m.t || '') + '</div></div><div class="nw-av">👤</div>';
      } else {
        el.className = 'nw-msg nw-b';
        el.innerHTML = '<div class="nw-av">🤖</div><div><div class="nw-bbl">' + md(m.text) + '</div><div class="nw-ts">' + (m.t || '') + '</div></div>';
      }
      self.$body.appendChild(el);
    });
    if (this.msgs.length) this.$chips.style.display = 'none';
  };

  /* ── Voice input ── */
  Widget.prototype._toggleVoice = function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this._addBot('Voice input isn\'t supported in your browser. Please use Chrome or type your question 😊');
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

  // ─── Global theme manager ────────────────────────────────────────────────────
  var SVG_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  var SVG_SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  function initTheme() {
    var dark = localStorage.getItem('nw-theme') === 'dark' ||
               (!localStorage.getItem('nw-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches);

    function applyTheme() {
      document.body.classList.toggle('dark', dark);
      ['theme-toggle', 'theme-toggle-fixed', 'theme-toggle-nav'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.innerHTML = dark ? SVG_SUN : SVG_MOON;
      });
      ['mobThemeBtn'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      });
      var injected = document.getElementById('nwNavTheme');
      if (injected) injected.innerHTML = dark ? SVG_SUN : SVG_MOON;
    }

    function toggle() {
      dark = !dark;
      localStorage.setItem('nw-theme', dark ? 'dark' : 'light');
      applyTheme();
    }

    applyTheme();

    ['theme-toggle', 'theme-toggle-fixed', 'theme-toggle-nav', 'mobThemeBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn && !btn.__nwThemeWired) {
        btn.__nwThemeWired = true;
        btn.addEventListener('click', toggle);
      }
    });

    var cta = document.querySelector('.nav-cta');
    if (cta && !document.getElementById('nwNavTheme') && !document.getElementById('theme-toggle-nav')) {
      var btn = document.createElement('button');
      btn.id = 'nwNavTheme';
      btn.className = 'nw-nav-dark-btn';
      btn.title = 'Toggle dark mode';
      btn.setAttribute('aria-label', 'Toggle dark mode');
      btn.innerHTML = dark ? SVG_SUN : SVG_MOON;
      btn.addEventListener('click', toggle);
      cta.insertBefore(btn, cta.firstChild);
    }

    window.__nwToggleTheme = toggle;
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    initTheme();
    window.__nwWidget = new Widget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
