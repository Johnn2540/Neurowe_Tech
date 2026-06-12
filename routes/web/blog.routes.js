// routes/web/blog.routes.js — /blog, /blog/:slug
'use strict';

const { Router } = require('express');
const db         = require('../../db/postgres');

const router = Router();

router.get('/blog', async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 24;
        const offset = (page - 1) * limit;
        const [postsR, countR] = await Promise.all([
            db.query(
                'SELECT * FROM blog_posts WHERE published=true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            ),
            db.query('SELECT COUNT(*) AS total FROM blog_posts WHERE published=true'),
        ]);
        const posts      = postsR.rows;
        const total      = parseInt(countR.rows[0]?.total || 0, 10);
        const totalPages = Math.ceil(total / limit);
        const featuredPost = posts.find(p => p.featured || p.bestseller) || posts[0] || null;
        return res.render('blog', {
            title: 'Blog – NeurowexTech', posts, featuredPost,
            page, totalPages, total,
            hasPrev: page > 1, hasNext: page < totalPages,
        });
    } catch (err) {
        console.error('[blog] list error:', err);
        return res.render('blog', { title: 'Blog', posts: [], featuredPost: null, page: 1, totalPages: 1 });
    }
});

router.get('/blog/:slug', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM blog_posts WHERE slug=$1 AND published=true', [req.params.slug]
        );
        if (!r.rows.length)
            return res.status(404).render('404', { title: 'Post Not Found' });

        const post = r.rows[0];
        const relatedR = await db.query(
            `SELECT * FROM blog_posts WHERE published=true AND id != $1 ORDER BY created_at DESC LIMIT 3`,
            [post.id]
        );
        const relatedPosts = relatedR.rows;

        return res.render('blog-post', {
            title: `${post.title} – NeurowexTech`, post, relatedPosts,
        });
    } catch (err) {
        console.error('[blog] post error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

module.exports = router;
