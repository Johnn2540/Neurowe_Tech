// config/constants.js — shared application constants
'use strict';

const ROLES = Object.freeze({
    ADMIN:      'admin',
    INSTRUCTOR: 'instructor',
    USER:       'user',
});

const CONTACT_STATUS = Object.freeze({
    NEW:     'new',
    READ:    'read',
    REPLIED: 'replied',
});

const ENROLLMENT_STATUS = Object.freeze({
    ACTIVE:    'active',
    COMPLETED: 'completed',
    PAUSED:    'paused',
});

const PAGINATION = Object.freeze({
    CONTACTS_DEFAULT:  100,
    CONTACTS_MAX:      500,
    BULK_DELETE_MAX:   100,
    RECENT_ACTIVITY:    10,
    BLOG_RECENT:         3,
    RELATED_COURSES:     3,
    FEATURED_PROJECTS:   6,
});

const TIMEOUTS = Object.freeze({
    SHORT:  5_000,   // 5 s  — lightweight queries
    MEDIUM: 15_000,  // 15 s — paginated reads
    LONG:   30_000,  // 30 s — exports / bulk ops
});

module.exports = { ROLES, CONTACT_STATUS, ENROLLMENT_STATUS, PAGINATION, TIMEOUTS };
