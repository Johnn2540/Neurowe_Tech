// routes/web/services.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db/postgres');

// Service configuration data
const servicesConfig = {
    'web-development': {
        title: 'Web Development Services – NeurowexTech',
        template: 'services/web_dev',
        category: 'Web Development',
        techStack: ['React', 'Next.js', 'Node.js', 'Python', 'TypeScript', 'Flutter', 'React Native', 'AWS', 'Firebase', 'Docker', 'PostgreSQL', 'MongoDB', 'Figma', 'Git / CI/CD'],
        processSteps: [
            { step: 1, title: 'Discovery & Strategy', description: 'We deep-dive into your goals, users, and market to craft a winning technical roadmap tailored precisely to your vision and budget.' },
            { step: 2, title: 'Design & Prototype', description: 'UI/UX wireframes and interactive prototypes reviewed and approved by you before we write a single line of code.' },
            { step: 3, title: 'Build & Test', description: 'Agile sprints with daily updates, rigorous code reviews, and continuous testing — you\'re always in the loop, every step.' },
            { step: 4, title: 'Launch & Scale', description: 'Deployment, monitoring, and 3 months of post-launch support — completely free with every project.' }
        ],
        heroIcon: 'fa-laptop-code',
        heroTitle: 'Modern Websites & Apps Built to Scale',
        heroDesc: 'From sleek landing pages to complex web applications and mobile solutions — we engineer digital products that perform, convert, and grow with your business.',
        stats: async () => {
            const result = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM projects WHERE category = 'Web Development') as projects,
                    (SELECT COALESCE(AVG(rating), 0) FROM testimonials) as satisfaction
            `);
            return { projects: parseInt(result.rows[0]?.projects) || 500, satisfaction: 98, delivery: '6wks' };
        }
    },
    'graphic-design': {
        title: 'Graphic Design & Branding – NeurowexTech',
        template: 'services/graphic_design',
        category: 'Design',
        portfolioLimit: 6,
        pricingTiers: [
            { name: 'Starter', price: 'Ksh 4,999', features: ['Logo Design (3 concepts)', '2 Revision Rounds', 'PNG, SVG & PDF Files', 'Business Card Design'], popular: false },
            { name: 'Brand Kit', price: 'Ksh 12,499', features: ['Logo + Brand Mark', 'Unlimited Revisions', 'Full Brand Guidelines', 'Social Media Kit (10 templates)', 'Letterhead & Stationery', 'Email Signature'], popular: true },
            { name: 'Enterprise', price: 'Custom', features: ['Full Brand Overhaul', 'Packaging & Print Design', 'Pitch Deck & Presentations', 'Ad Creatives & Banners', 'Ongoing Monthly Retainer', 'Dedicated Designer'], popular: false }
        ],
        heroIcon: 'fa-palette',
        heroTitle: 'Design That Makes People Stop Scrolling',
        heroDesc: 'From logos and brand identities to social media graphics, posters, and packaging — we create visuals that communicate your value instantly.',
        stats: async () => {
            const result = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM projects WHERE category = 'Design') as projects,
                    (SELECT COALESCE(AVG(rating), 0) FROM testimonials WHERE project_type = 'Design') as satisfaction
            `);
            return { projects: parseInt(result.rows[0]?.projects) || 300, satisfaction: 98, turnaround: '3 days' };
        }
    },
    'seo': {
        title: 'SEO & Digital Marketing – NeurowexTech',
        template: 'services/seo',
        category: 'SEO',
        techStack: ['Google Search Console', 'Google Analytics 4', 'SEMrush', 'Ahrefs', 'Moz Pro', 'Google Ads', 'Meta Ads Manager', 'Mailchimp', 'Hotjar', 'Screaming Frog', 'Surfer SEO', 'Google My Business'],
        whyUs: [
            'Data-Driven Strategy — every decision backed by keyword data and competitor analysis',
            'Results in 90 Days — measurable ranking improvements within 90 days',
            'White-Hat Only — Google-approved techniques, no risky shortcuts',
            'Transparent Reporting — plain-English explanations of what we did and what improved',
            'Local SEO Experts — deep understanding of Kenyan search landscape',
            'Full Transparency — monthly reports with clear metrics'
        ],
        heroIcon: 'fa-search',
        heroTitle: 'Rank Higher. Grow Faster. Get Found.',
        heroDesc: 'We combine technical SEO, content strategy, and paid advertising to drive qualified traffic to your business and convert visitors into paying customers — sustainably.',
        stats: async () => {
            return { sitesOptimised: 150, trafficGrowth: '3×', resultsIn: '90 days', retention: 98 };
        }
    },
    'ai-solutions': {
        title: 'AI Solutions – NeurowexTech',
        template: 'services/ai_solutions',
        category: 'AI',
        techStack: ['OpenAI GPT-4', 'Anthropic Claude', 'Python', 'PyTorch', 'TensorFlow', 'scikit-learn', 'LangChain', 'Pinecone', 'AWS SageMaker', 'Vertex AI', 'FastAPI', 'Docker / K8s'],
        processSteps: [
            { step: 1, title: 'Use Case Discovery', description: 'We audit your operations to identify the highest-impact AI opportunities.' },
            { step: 2, title: 'Data Preparation', description: 'We clean, structure, and prepare your data for training.' },
            { step: 3, title: 'Build & Train', description: 'Model selection, fine-tuning, and rigorous evaluation.' },
            { step: 4, title: 'Deploy & Monitor', description: 'Production deployment with live dashboards and continuous improvement.' }
        ],
        heroIcon: 'fa-robot',
        heroTitle: 'Intelligent Automation for Modern Businesses',
        heroDesc: 'Custom AI integrations, chatbots, machine learning models, and intelligent automation that reduce costs, eliminate repetitive work, and unlock insights from your data.',
        stats: async () => {
            return { projects: 50, costReduction: '60%', availability: '24/7', taskAutomation: '80%' };
        }
    },
    'cybersecurity': {
        title: 'Cybersecurity Services – NeurowexTech',
        template: 'services/cybersecurity',
        category: 'Security',
        whyUs: [
            'Certified Ethical Hackers — CEH, OSCP, CompTIA Security+ certified team',
            'Total Confidentiality — NDA signed before any engagement',
            'Plain-English Reports — clear severity ratings and step-by-step fix instructions',
            'Free Retest Included — we retest at no extra cost after remediation',
            'Fast Turnaround — basic pentest delivered in 5–7 days',
            'Comprehensive Coverage — web apps, mobile apps, APIs, infrastructure'
        ],
        processSteps: [
            { step: 1, title: 'Scoping & Planning', description: 'Define assessment boundaries and rules of engagement under signed NDA.' },
            { step: 2, title: 'Reconnaissance & Scanning', description: 'Passive and active information gathering and attack surface mapping.' },
            { step: 3, title: 'Exploitation & Testing', description: 'Controlled exploitation of discovered vulnerabilities.' },
            { step: 4, title: 'Report & Remediate', description: 'Detailed vulnerability report with CVSS scores and step-by-step guidance.' }
        ],
        heroIcon: 'fa-shield-alt',
        heroTitle: 'Protect Your Business Before Attackers Strike',
        heroDesc: 'Penetration testing, security audits, vulnerability assessments, and ongoing monitoring — we find and fix your weaknesses before cybercriminals exploit them.',
        stats: async () => {
            return { companiesProtected: 80, vulnerabilitiesFound: 200, monitoring: '24/7', breachesPostAudit: 0 };
        }
    },
    'ui-ux': {
        title: 'UI/UX Design – NeurowexTech',
        template: 'services/uiux',
        category: 'Design',
        portfolioLimit: 6,
        processSteps: [
            { step: 1, title: 'User Research', description: 'Interviews, surveys, and usability studies to understand your users\' real needs.' },
            { step: 2, title: 'Information Architecture', description: 'User flows, site maps, and wireframes that organise content logically.' },
            { step: 3, title: 'Visual Design', description: 'High-fidelity Figma designs with your brand identity and component library.' },
            { step: 4, title: 'Dev Handoff', description: 'Annotated specs, design tokens, and Figma developer mode handoff.' }
        ],
        heroIcon: 'fa-pencil-ruler',
        heroTitle: 'Interfaces Users Love. Experiences That Convert.',
        heroDesc: 'We design digital products that are beautiful, intuitive, and purpose-built to achieve your business goals — from wireframes to pixel-perfect Figma files ready for development.',
        stats: async () => {
            return { productsDesigned: 150, conversionLift: '40%', rating: '4.9★', firstWireframes: '2 wks' };
        }
    },
    'ecommerce': {
        title: 'E-Commerce Solutions – NeurowexTech',
        template: 'services/ecommerce',
        category: 'E-commerce',
        techStack: ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Custom Solutions'],
        pricingTiers: [
            { name: 'Starter Store', price: 'Ksh 18,999', features: ['Up to 100 Products', 'M-Pesa Integration', 'Mobile Responsive', 'Admin Dashboard', 'Basic SEO Setup'], popular: false },
            { name: 'Growth Store', price: 'Ksh 34,999', features: ['Unlimited Products', 'M-Pesa + Cards + Airtel', 'Multi-Currency Support', 'Advanced Analytics', 'Abandoned Cart Recovery', 'Product Reviews & Ratings', '6 Months Support'], popular: true },
            { name: 'Enterprise', price: 'Custom', features: ['Multi-Vendor Marketplace', 'ERP / Accounting Integration', 'Custom Shipping & Logistics', 'AI Product Recommendations', '12 Months Priority Support', 'Dedicated Account Manager', 'SLA Agreement'], popular: false }
        ],
        processSteps: [
            { step: 1, title: 'Requirements & Strategy', description: 'Product catalogue review, payment gateway selection, shipping strategy, and full feature scoping.' },
            { step: 2, title: 'Design & Branding', description: 'Custom storefront design that reflects your brand and is optimised for conversion.' },
            { step: 3, title: 'Build & Integrate', description: 'Full development including payment gateways, inventory, shipping APIs, and admin dashboard.' },
            { step: 4, title: 'Launch & Grow', description: 'SEO setup, performance testing, team training, and 3 months of free support.' }
        ],
        heroIcon: 'fa-shopping-cart',
        heroTitle: 'Online Stores That Actually Sell',
        heroDesc: 'We build fast, conversion-optimised e-commerce platforms with secure payments, intuitive product management, and the features your customers demand — on any budget.',
        stats: async () => {
            return { storesLaunched: 80, salesGrowth: '2×', launchTime: '4 wks', satisfaction: 98 };
        }
    },
    'analytics': {
        title: 'Data Analytics & Business Intelligence – NeurowexTech',
        template: 'services/analytics',
        category: 'Analytics',
        techStack: ['Power BI', 'Tableau', 'Looker Studio', 'Python / Pandas', 'PostgreSQL', 'AWS Redshift', 'BigQuery', 'Snowflake', 'dbt', 'Apache Airflow', 'Apache Spark', 'Google Analytics 4'],
        whyUs: [
            'Business-First Thinking — we translate data into plain business language',
            'Works With Your Stack — connects to any data source',
            'Fast Time to Insight — first dashboard delivered in 2–3 weeks',
            'Data Security First — encrypted pipelines and role-based access',
            'Team Enablement — we train your team to use and trust the dashboards',
            'Actionable Insights — clear "do this next" recommendations'
        ],
        heroIcon: 'fa-chart-bar',
        heroTitle: 'Turn Your Data Into Business Growth',
        heroDesc: 'Custom dashboards, predictive models, and business intelligence reports that transform raw data into clear, actionable decisions — so you grow with confidence, not guesswork.',
        stats: async () => {
            return { dataProjects: 60, fasterDecisions: '10×', firstDashboard: '2 wks', dataSources: 20 };
        }
    },
    'social-media': {
        title: 'Social Media & Content Creation – NeurowexTech',
        template: 'services/social_media',
        category: 'Marketing',
        whyUs: [
            'Original Content Only — every post created from scratch for your brand',
            'Kenya-Market Experts — understanding of Kenyan humour, culture, and buying psychology',
            'Content Calendar Provided — you approve every post before it goes live',
            'Results-Focused — we track followers, reach, link clicks, and conversions',
            'Dedicated Account Manager — one point of contact who knows your brand deeply',
            'Full Transparency — monthly reports with clear metrics'
        ],
        pricingTiers: [
            { name: 'Essential', price: 'Ksh 8,999/mo', features: ['15 Posts Per Month', '2 Platforms (e.g. IG + FB)', 'Branded Graphics', 'Caption Copywriting', 'Monthly Report'], popular: false },
            { name: 'Growth', price: 'Ksh 18,999/mo', features: ['30 Posts Per Month', '4 Platforms', 'Reels & Short Videos', 'Community Management', 'Influencer Coordination', 'Detailed Analytics Report', 'Dedicated Account Manager'], popular: true },
            { name: 'Enterprise', price: 'Custom', features: ['Unlimited Platforms', 'Paid Ads Management', 'Video Production', 'Influencer Campaigns', 'Crisis Management', 'Weekly Strategy Calls', 'Full Brand Voice Guide'], popular: false }
        ],
        heroIcon: 'fa-share-alt',
        heroTitle: 'Build an Audience That Buys From You',
        heroDesc: 'Strategic content creation, community management, and paid social campaigns that grow your following, build brand trust, and drive real revenue — not just vanity metrics.',
        stats: async () => {
            return { brandsManaged: 120, engagementGrowth: '3×', postsPerMonth: 30, retention: 98 };
        }
    }
};

// Helper function to get service stats
async function getServiceStats(serviceKey) {
    const config = servicesConfig[serviceKey];
    const stats = await config.stats();
    return stats;
}

// Helper function to get portfolio projects
async function getPortfolioProjects(category, limit = 6) {
    try {
        const result = await db.query(`
            SELECT * FROM projects 
            WHERE category = $1 AND featured = true 
            ORDER BY created_at DESC 
            LIMIT $2
        `, [category, limit]);
        return result.rows;
    } catch (err) {
        console.error('Error fetching portfolio:', err.message);
        return [];
    }
}

// Services index page
router.get('/services', async (req, res) => {
    const servicesList = [
        { name: 'Web Development', slug: 'web-development', icon: 'fas fa-laptop-code', description: 'Modern, scalable web applications', color: '#1a56e8' },
        { name: 'Graphic Design', slug: 'graphic-design', icon: 'fas fa-palette', description: 'Stunning visual identities', color: '#e83a5e' },
        { name: 'SEO & Marketing', slug: 'seo', icon: 'fas fa-chart-line', description: 'Rank higher on search engines', color: '#0dbf7e' },
        { name: 'AI Solutions', slug: 'ai-solutions', icon: 'fas fa-brain', description: 'Intelligent automation', color: '#8b5cf6' },
        { name: 'Cybersecurity', slug: 'cybersecurity', icon: 'fas fa-shield-alt', description: 'Protect your digital assets', color: '#f59e0b' },
        { name: 'UI/UX Design', slug: 'ui-ux', icon: 'fas fa-pencil-ruler', description: 'User-centered design', color: '#06b6d4' },
        { name: 'E-commerce', slug: 'ecommerce', icon: 'fas fa-shopping-cart', description: 'Online stores that sell', color: '#ec4899' },
        { name: 'Data Analytics', slug: 'analytics', icon: 'fas fa-chart-pie', description: 'Data-driven decisions', color: '#6366f1' },
        { name: 'Social Media', slug: 'social-media', icon: 'fas fa-hashtag', description: 'Grow your audience', color: '#14b8a6' }
    ];
    
    res.render('services/index', {
        title: 'Our Services – NeurowexTech',
        services: servicesList,
        currentYear: new Date().getFullYear()
    });
});

// Web Development
router.get('/services/web-development', async (req, res) => {
    const config = servicesConfig['web-development'];
    const stats = await getServiceStats('web-development');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'Web & App Development',
        config: config,
        stats: stats,
        currentYear: new Date().getFullYear()
    });
});

// Graphic Design
router.get('/services/graphic-design', async (req, res) => {
    const config = servicesConfig['graphic-design'];
    const stats = await getServiceStats('graphic-design');
    const portfolio = await getPortfolioProjects('Design', config.portfolioLimit);
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'Graphic Design & Branding',
        config: config,
        stats: stats,
        portfolio: portfolio,
        pricingTiers: config.pricingTiers,
        currentYear: new Date().getFullYear()
    });
});

// SEO & Marketing
router.get('/services/seo', async (req, res) => {
    const config = servicesConfig['seo'];
    const stats = await getServiceStats('seo');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'SEO & Digital Marketing',
        config: config,
        stats: stats,
        whyUs: config.whyUs,
        currentYear: new Date().getFullYear()
    });
});

// AI Solutions
router.get('/services/ai-solutions', async (req, res) => {
    const config = servicesConfig['ai-solutions'];
    const stats = await getServiceStats('ai-solutions');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'AI Solutions',
        config: config,
        stats: stats,
        currentYear: new Date().getFullYear()
    });
});

// Cybersecurity
router.get('/services/cybersecurity', async (req, res) => {
    const config = servicesConfig['cybersecurity'];
    const stats = await getServiceStats('cybersecurity');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'Cybersecurity',
        config: config,
        stats: stats,
        whyUs: config.whyUs,
        currentYear: new Date().getFullYear()
    });
});

// UI/UX Design
router.get('/services/ui-ux', async (req, res) => {
    const config = servicesConfig['ui-ux'];
    const stats = await getServiceStats('ui-ux');
    const portfolio = await getPortfolioProjects('Design', config.portfolioLimit);
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'UI/UX Design',
        config: config,
        stats: stats,
        portfolio: portfolio,
        currentYear: new Date().getFullYear()
    });
});

// E-commerce
router.get('/services/ecommerce', async (req, res) => {
    const config = servicesConfig['ecommerce'];
    const stats = await getServiceStats('ecommerce');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'E-Commerce Solutions',
        config: config,
        stats: stats,
        pricingTiers: config.pricingTiers,
        currentYear: new Date().getFullYear()
    });
});

// Data Analytics
router.get('/services/analytics', async (req, res) => {
    const config = servicesConfig['analytics'];
    const stats = await getServiceStats('analytics');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'Data Analytics & BI',
        config: config,
        stats: stats,
        whyUs: config.whyUs,
        currentYear: new Date().getFullYear()
    });
});

// Social Media
router.get('/services/social-media', async (req, res) => {
    const config = servicesConfig['social-media'];
    const stats = await getServiceStats('social-media');
    
    res.render(config.template, {
        title: config.title,
        serviceName: 'Social Media Management',
        config: config,
        stats: stats,
        whyUs: config.whyUs,
        pricingTiers: config.pricingTiers,
        currentYear: new Date().getFullYear()
    });
});

module.exports = router;