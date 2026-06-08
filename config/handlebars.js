// config/handlebars.js — HBS engine setup + all helpers
'use strict';

const path = require('path');
const fs   = require('fs');
const hbs  = require('hbs');

function registerHelpers() {
    hbs.registerHelper('formatDate', date => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    });
    hbs.registerHelper('shortDate', date => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    });
    hbs.registerHelper('eq',  (a, b) => a === b);
    hbs.registerHelper('neq', (a, b) => a !== b);
    hbs.registerHelper('inc', value => parseInt(value) + 1);
    hbs.registerHelper('dec', value => parseInt(value) - 1);
    hbs.registerHelper('math', (lvalue, operator, rvalue) => {
        lvalue = parseFloat(lvalue); rvalue = parseFloat(rvalue);
        if (isNaN(lvalue) || isNaN(rvalue)) return 0;
        const ops = { '+': lvalue + rvalue, '-': lvalue - rvalue,
                      '*': lvalue * rvalue, '/': lvalue / rvalue };
        return ops[operator] ?? 0;
    });
    hbs.registerHelper('multiply', (a, b) => parseInt(a) * parseInt(b));
    hbs.registerHelper('truncate', (text, length) => {
        if (!text) return '';
        return String(text).length <= length ? text : String(text).substring(0, length) + '...';
    });
    hbs.registerHelper('truncateWords', (text, wordCount) => {
        if (!text) return '';
        const words = String(text).split(' ');
        return words.length <= wordCount ? text : words.slice(0, wordCount).join(' ') + '...';
    });
    hbs.registerHelper('contains', (array, value) => {
        if (!array || !Array.isArray(array)) return false;
        return array.indexOf(value) !== -1;
    });
    hbs.registerHelper('ifContains', function (array, value, options) {
        if (!array || !Array.isArray(array)) return options.inverse(this);
        return array.indexOf(value) !== -1 ? options.fn(this) : options.inverse(this);
    });
    hbs.registerHelper('default', (value, dv) => value || dv);
    hbs.registerHelper('join', (array, sep) => Array.isArray(array) ? array.join(sep || ', ') : '');
    hbs.registerHelper('lowercase', str => str ? String(str).toLowerCase() : '');
    hbs.registerHelper('uppercase', str => str ? String(str).toUpperCase() : '');
    hbs.registerHelper('starRating', rating => {
        const full = Math.floor(rating || 0);
        const half = (rating || 0) % 1 >= 0.5;
        let stars = '★'.repeat(full);
        if (half) stars += '½';
        while (stars.replace('½', '').length < 5) stars += '☆';
        return stars;
    });
    hbs.registerHelper('ifCond', function (v1, operator, v2, options) {
        const ops = { '==': v1 == v2, '===': v1 === v2, '!=': v1 != v2,
                      '<': v1 < v2, '<=': v1 <= v2, '>': v1 > v2, '>=': v1 >= v2 };
        return ops[operator] ? options.fn(this) : options.inverse(this);
    });
    hbs.registerHelper('json',      value => JSON.stringify(value));
    hbs.registerHelper('firstChar', str => str ? str.charAt(0).toUpperCase() : 'N');
    hbs.registerHelper('slice',     (str, start, end) => str ? String(str).slice(start, end) : '');
    hbs.registerHelper('currentYear', () => new Date().getFullYear());
    hbs.registerHelper('and', (a, b) => a && b);
    hbs.registerHelper('or',  (a, b) => a || b);
    hbs.registerHelper('not', a => !a);
    hbs.registerHelper('gt',  (a, b) => a > b);
    hbs.registerHelper('lt',  (a, b) => a < b);
    hbs.registerHelper('gte', (a, b) => a >= b);
    hbs.registerHelper('lte', (a, b) => a <= b);
    hbs.registerHelper('add', (a, b) => Number(a) + Number(b));
    hbs.registerHelper('sub', (a, b) => Number(a) - Number(b));
}

function registerPartialsSync(partialsDir) {
    if (!fs.existsSync(partialsDir)) return;
    // Read all .hbs files synchronously so partials are ready before the
    // first request hits — critical for Vercel cold starts.
    const files = fs.readdirSync(partialsDir);
    files.forEach(file => {
        if (!file.endsWith('.hbs')) return;
        const name    = path.basename(file, '.hbs');
        const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        hbs.registerPartial(name, content);
        console.log(`[HBS] partial registered: ${name}`);
    });
}

function setupHandlebars(app) {
    app.set('view engine', 'hbs');
    app.set('views', path.join(__dirname, '..', 'views'));

    // ── Disable default layout ────────────────────────────────────────────────
    // Our .hbs files are complete standalone HTML documents. We don't use a
    // master layout wrapper. Any view that needs views/layouts/main.hbs must
    // explicitly pass { layout: 'layouts/main' } to res.render().
    app.set('view options', { layout: false });

    // ── Register partials synchronously ───────────────────────────────────────
    // hbs.registerPartials() is async — on Vercel cold starts the first request
    // can arrive before it finishes, causing "partial not found" render errors.
    // Reading and registering synchronously at startup guarantees they're ready.
    const partialsPath = path.join(__dirname, '..', 'views', 'partials');
    registerPartialsSync(partialsPath);

    registerHelpers();

    console.log('[HBS] Handlebars ready — layout: false, views:', path.join(__dirname, '..', 'views'));
}

module.exports = { setupHandlebars };