'use strict';

const express = require('express');
const router = express.Router();

const homeRouter = require('../components/home/home.router');
const galleryRouter = require('../components/gallery/gallery.router');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
})

homeRouter(router);
galleryRouter(router);

module.exports = router
