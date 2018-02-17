'use strict';

const gallery = require('../gallery/gallery.model');

function homeRouter(router) {
    router.get('/', (req, res) => {
        gallery.getAll((err, g) => {
            console.dir(g,{depth:3});
            return res.render('index', {title: "Simple NODE Gallery", galleries: g});
        });
    });
}

module.exports = homeRouter;
