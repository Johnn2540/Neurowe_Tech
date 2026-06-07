// routes/web/blog.routes.js — /blog, /blog/:slug
'use strict';

const { Router } = require('express');
const db         = require('../../db/postgres');

const router = Router();

router.get('/blog', async (req, res) => {
    try {
        const r    = await db.query("SELECT * FROM blog_posts WHERE published=true ORDER BY created_at DESC");
        const posts = r.rows;
        const featuredPost = posts.find(p => p.featured || p.bestseller) || posts[0] || null;
        return res.render('blog', { title: 'Blog – NeurowexTech', posts, featuredPost });
    } catch (err) {
        console.error('[blog] list error:', err);
        return res.render('blog', { title: 'Blog', posts: [], featuredPost: null });
    }
});

router.get('/blog/:slug', async (req, res) => {
    try {
        const r = await db.query(
            'SELECT * FROM blog_posts WHERE slug=$1 AND published=true', [req.params.slug]
        );
        if (!r.rows.length)
            return res.status(404).render('404', { title: 'Post Not Found' });

        const post    = r.rows[0];
        let relatedR  = await db.query(
            'SELECT * FROM blog_posts WHERE published=true AND id!=$1 AND category=$2 ORDER BY created_at DESC LIMIT 3',
            [post.id, post.category]
        );
        const relatedPosts = relatedR.rows.length
            ? relatedR.rows
            : (await db.query(
                'SELECT * FROM blog_posts WHERE published=true AND id!=$1 ORDER BY created_at DESC LIMIT 3',
                [post.id]
              )).rows;

        return res.render('blog-post', {
            title: `${post.title} – NeurowexTech`, post, relatedPosts,
        });
    } catch (err) {
        console.error('[blog] post error:', err);
        return res.status(500).render('error', { title: 'Error', message: err.message });
    }
});

module.exports = router;
