// middleware/validation.js — lightweight reusable validators
'use strict';

/** True if the string looks like a valid email address. */
const isValidEmail = email => /^\S+@\S+\.\S+$/.test(email);

/** True if the string looks like a valid username (3-20 alphanum + _). */
const isValidUsername = u => /^[a-zA-Z0-9_]{3,20}$/.test(u);

/**
 * Factory: returns middleware that validates req.body fields.
 * Each rule is { field, label, minLength, required, validator }.
 *
 * Usage:
 *   router.post('/foo', validate([{ field:'email', label:'Email', validator: isValidEmail }]), handler)
 */
function validate(rules) {
    return (req, res, next) => {
        const errors = [];
        for (const rule of rules) {
            const val = req.body[rule.field];
            if (rule.required !== false && (!val || String(val).trim() === '')) {
                errors.push(`${rule.label || rule.field} is required`);
                continue;
            }
            if (val && rule.minLength && String(val).trim().length < rule.minLength) {
                errors.push(`${rule.label || rule.field} must be at least ${rule.minLength} characters`);
            }
            if (val && rule.validator && !rule.validator(val)) {
                errors.push(rule.message || `${rule.label || rule.field} is invalid`);
            }
        }
        if (errors.length) {
            if (req.is('application/json'))
                return res.status(400).json({ success: false, message: errors.join('. ') });
            return res.status(400).render('error', { title: 'Validation Error', message: errors.join('. ') });
        }
        next();
    };
}

module.exports = { validate, isValidEmail, isValidUsername };
