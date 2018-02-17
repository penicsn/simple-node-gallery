'use strict';

const express = require('express');
const consolidate = require('consolidate');
const handlebars = require('handlebars');
const routes = require('./routes');

const app = express();

const hostname = '127.0.0.1';
const port = 54821;

global.appPaths = {
    root: __dirname,
    gallery: __dirname + '/galleries'
};

// Configure template engine
app.engine('html', consolidate.handlebars);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Handlebars js helper
handlebars.registerHelper('formatDate', function(date) {
    if(!date) {
        return '';
    }
    return date.toLocaleString();
});

// Set up static folder middleware
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/galleries'));

app.use('/', routes);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
