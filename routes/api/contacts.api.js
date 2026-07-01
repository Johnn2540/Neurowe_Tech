// routes/api/contacts.api.js — /api/contacts/*
'use strict';

const { Router }                   = require('express');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const db                           = require('../../db/postgres');
const { PAGINATION, TIMEOUTS }     = require('../../config/constants');

const router = Router();
router.use(isAuthenticated, isAdmin);
router.use((req, res, next) => { res.setHeader('Content-Type', 'application/json'); next(); });

// ─── List (paginated) ─────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const page   = parseInt(req.query.page)  || 1;
        const limit  = Math.min(parseInt(req.query.limit) || PAGINATION.CONTACTS_DEFAULT, PAGINATION.CONTACTS_MAX);
        const offset = (page - 1) * limit;

        const [countR, unreadR] = await Promise.all([
            db.query('SELECT COUNT(*) as total FROM contacts'),
            db.query("SELECT COUNT(*) as unread FROM contacts WHERE status='new' OR status IS NULL"),
        ]);
        const total  = parseInt(countR.rows[0]?.total)  || 0;
        const unread = parseInt(unreadR.rows[0]?.unread) || 0;

        const r = await db.query(`
            SELECT id, name, email, phone, company, project_type, budget, message, status, created_at,
                   CASE WHEN status='new' OR status IS NULL THEN true ELSE false END AS is_unread
            FROM contacts
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        return res.json({
            success:    true,
            contacts:   r.rows,
            unread,
            pagination: { page, limit, total, pages: Math.ceil(total/limit),
                          hasNext: offset+limit<total, hasPrev: page>1 },
        });
    } catch (err) {
        console.error('[contacts] GET / error:', err.message);
        return res.status(500).json({ success: false, message: 'Unable to load contacts.',
                                      contacts: [], unread: 0, pagination: null });
    }
});

// ─── Unread count (lightweight) ───────────────────────────────────────────────

router.get('/unread/count', async (req, res) => {
    try {
        const r = await db.query("SELECT COUNT(*) as count FROM contacts WHERE status='new' OR status IS NULL");
        return res.json({ success: true, unread: parseInt(r.rows[0]?.count) || 0 });
    } catch (err) {
        console.error('[contacts] unread count error:', err.message);
        return res.status(500).json({ success: false, unread: 0, message: 'Unable to load unread count' });
    }
});

// ─── Export CSV ───────────────────────────────────────────────────────────────

router.get('/export/csv', async (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=contacts_${new Date().toISOString().split('T')[0]}.csv`);
    try {
        const r = await db.query(
            'SELECT id,name,email,phone,company,project_type,budget,message,status,created_at FROM contacts ORDER BY created_at DESC'
        );
        const headers = ['ID','Name','Email','Phone','Company','Project Type','Budget','Message','Status','Created At'];
        const rows = r.rows.map(row => [
            row.id,
            `"${(row.name||'').replace(/"/g,'""')}"`,
            row.email,
            row.phone||'',
            `"${(row.company||'').replace(/"/g,'""')}"`,
            `"${(row.project_type||'').replace(/"/g,'""')}"`,
            row.budget||'',
            `"${(row.message||'').replace(/"/g,'""').substring(0,500)}"`,
            row.status||'new',
            new Date(row.created_at).toISOString(),
        ]);
        return res.send([headers,...rows].map(r=>r.join(',')).join('\n'));
    } catch (err) {
        console.error('[contacts] export CSV error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to export contacts' });
    }
});

// ─── Bulk delete ──────────────────────────────────────────────────────────────

router.post('/bulk-delete', async (req, res) => {
    try {
        const { contactIds } = req.body;
        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0)
            return res.status(400).json({ success: false, message: 'Contact IDs array is required' });
        if (contactIds.length > PAGINATION.BULK_DELETE_MAX)
            return res.status(400).json({ success: false, message: `Cannot delete more than ${PAGINATION.BULK_DELETE_MAX} contacts at once` });
        const validIds = contactIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (!validIds.length)
            return res.status(400).json({ success: false, message: 'No valid contact IDs provided' });
        const result = await db.query('DELETE FROM contacts WHERE id=ANY($1::int[]) RETURNING id', [validIds]);
        return res.json({ success: true, message: `${result.rowCount} contact(s) deleted successfully`,
                          deletedCount: result.rowCount });
    } catch (err) {
        console.error('[contacts] bulk-delete error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to delete contacts' });
    }
});

// ─── Single contact ───────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid contact ID' });
        const r = await db.query(
            'SELECT id,name,email,phone,company,project_type,budget,message,status,created_at FROM contacts WHERE id=$1',
            [id]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, message: 'Contact not found' });
        return res.json({ success: true, contact: r.rows[0] });
    } catch (err) {
        console.error('[contacts] GET /:id error:', err.message);
        return res.status(500).json({ success: false, message: 'Unable to load contact details' });
    }
});

router.patch('/:id/read', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid contact ID' });
        const check = await db.query('SELECT id,status FROM contacts WHERE id=$1', [id]);
        if (!check.rows.length) return res.status(404).json({ success: false, message: 'Contact not found' });
        if (check.rows[0].status === 'read')
            return res.json({ success: true, message: 'Contact already marked as read' });
        await db.query("UPDATE contacts SET status='read' WHERE id=$1", [id]);
        return res.json({ success: true, message: 'Contact marked as read' });
    } catch (err) {
        console.error('[contacts] PATCH /:id/read error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update contact status' });
    }
});

router.patch('/:id/replied', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid contact ID' });
        const check = await db.query('SELECT id FROM contacts WHERE id=$1', [id]);
        if (!check.rows.length) return res.status(404).json({ success: false, message: 'Contact not found' });
        await db.query("UPDATE contacts SET status='replied' WHERE id=$1", [id]);
        return res.json({ success: true, message: 'Contact marked as replied' });
    } catch (err) {
        console.error('[contacts] PATCH /:id/replied error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update contact status' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid contact ID' });
        const contactR = await db.query('SELECT id,name,email FROM contacts WHERE id=$1', [id]);
        if (!contactR.rows.length) return res.status(404).json({ success: false, message: 'Contact not found' });
        const contact = contactR.rows[0];
        await db.query('DELETE FROM contacts WHERE id=$1', [id]);
        // Fire-and-forget activity log
        db.query(
            `INSERT INTO admin_activities (admin_id,action,details,created_at) VALUES ($1,$2,$3,NOW())`,
            [req.session.userId, 'delete_contact', JSON.stringify({ contact_name:contact.name, contact_email:contact.email, contact_id:id })]
        ).catch(() => {});
        return res.json({ success: true, message: `Message from ${contact.name} has been deleted` });
    } catch (err) {
        console.error('[contacts] DELETE /:id error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to delete contact' });
    }
});

module.exports = router;
