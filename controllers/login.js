'use strict';
const assert = require('assert');
const {User} = require('../db');

const app = (module.exports = new (require('koa-router'))());

app.get('/', ctx => ctx.render('login'));

app.post('/', async ctx => {
    let {body} = ctx.request;
    assert(typeof body.email == 'string');
    assert(typeof body.password == 'string');
    let user = body.email && (await User.findOne({where: {email: body.email}}));
    if (!user || !(await user.authenticate(body.password)))
        return await ctx.render('login', {error: 'invalid email/password'});
    ctx.session = {id: user.id, timestamp: Date.now()};
    await ctx.redirect('/');
});
