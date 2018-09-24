'use strict';

const app = (module.exports = new (require('koa-router'))());

app.get('/', async ctx => {
    if (ctx.state.user) await ctx.state.user.update({logout: new Date()});
    ctx.session = null;
    await ctx.redirect('/login');
});
