// debug-imports.js
'use strict';

require('dotenv').config();

console.log('🔍 Debugging imports for app.js\n');

const modules = [
    { name: './config/database', file: './config/database.js' },
    { name: './config/session', file: './config/session.js' },
    { name: './config/handlebars', file: './config/handlebars.js' },
    { name: './middleware/templateLocals', file: './middleware/templateLocals.js' },
    { name: './middleware/errorHandler', file: './middleware/errorHandler.js' },
    { name: './routes/index', file: './routes/index.js' },
];

for (const mod of modules) {
    try {
        const imported = require(mod.name);
        console.log(`✅ ${mod.file}:`, typeof imported);
        
        // Special checks for specific modules
        if (mod.name === './config/session' && typeof imported !== 'function') {
            console.error(`   ❌ ERROR: session must be a function, but got ${typeof imported}`);
        }
        if (mod.name === './middleware/templateLocals' && typeof imported !== 'function') {
            console.error(`   ❌ ERROR: templateLocals must be a function, but got ${typeof imported}`);
        }
        if (mod.name === './routes/index' && typeof imported !== 'function') {
            console.error(`   ❌ ERROR: routes must be a function (router), but got ${typeof imported}`);
        }
        if (mod.name === './middleware/errorHandler') {
            console.log(`   - apiJsonHeader: ${typeof imported.apiJsonHeader}`);
            console.log(`   - apiErrorHandler: ${typeof imported.apiErrorHandler}`);
            console.log(`   - notFound: ${typeof imported.notFound}`);
        }
        if (mod.name === './config/handlebars') {
            console.log(`   - setupHandlebars: ${typeof imported.setupHandlebars}`);
        }
    } catch (err) {
        console.error(`❌ ${mod.file}:`, err.message);
    }
    console.log('');
}

console.log('✅ Debug complete');