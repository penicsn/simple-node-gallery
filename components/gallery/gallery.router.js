'use strict';

const gallery = require('./gallery.model');

function galleryRouter(router) {
    router.get('/album/:url*', (req, res) => {
        gallery.getByUrl(req.url, (g) => {
            return res.render('index', {title: "Album: "+g.base, galleries: g});
        });
    });
}

module.exports = galleryRouter;
