'use strict';
const assert = require('assert');
const {User} = require('../db');

const app = (module.exports = new (require('koa-router'))());

app.get('/', ctx => ctx.render('register'));

app.post('/', async ctx => {
    try {
        let {email, password, password2} = ctx.request.body;
        assert(typeof email == 'string');
        assert(typeof password == 'string');
        if (password != password2) return ctx.render('register', {error: 'passwords do not match'});
        await User.create({email, password});
        await ctx.redirect('/login');
    } catch (err) {
        for (let {type} of err.errors || []) {
            if (type == 'unique violation') return await ctx.render('register', {error: 'already registered'});
        }
        throw err;
    }
});
