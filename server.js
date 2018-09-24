'use strict';
const path = require('path');
const winston = require('winston');
const mount = require('koa-mount');
const {sequelize, User} = require('./db.js');

const __DEV__ = process.env.NODE_ENV == 'development';

winston.add(
    new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(winston.format.colorize({level: true}), winston.format.simple()),
    })
);

const app = new (require('koa'))();
require('koa-ejs')(app, {
    root: path.join(__dirname, 'views'),
    layout: false,
    viewExt: 'ejs',
    cache: !__DEV__,
    locals: {__DEV__},
});

app.keys = [process.env.COOKIE_SECRET || 'secret'];

app.use(require('koa-session')({maxAge: Number(process.env.COOKIE_AGE) || 30 * 86400000}, app));
app.use(require('koa-static')(path.resolve(__dirname, './static')));
app.use(require('koa-bodyparser')());

if (__DEV__) {
    require('longjohn');
    app.use(
        (() => {
            let morgan = require('morgan')('dev');
            return async (ctx, next) => {
                await new Promise((resolve, reject) =>
                    morgan(ctx.req, ctx.res, err => (err ? reject(err) : resolve(ctx)))
                );
                await next();
            };
        })()
    );
    app.use(async (ctx, next) => {
        ctx.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        ctx.set('Expires', '-1');
        ctx.set('Pragma', 'no-cache');
        ctx.set('Access-Control-Allow-Origin', ctx.request.headers.origin || '*');
        ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        ctx.set('Access-Control-Allow-Credentials', 'true');
        await next();
    });
}

app.use(async (ctx, next) => {
    try {
        await next();
        if (ctx.status == 404) ctx.throw(404);
    } catch (err) {
        ctx.status = err.status || 500;
        if (ctx.status == 404) return await ctx.render('404', {url: ctx.url});
        winston.error(err.message, {url: ctx.url, err});
        await ctx.render('500', {url: ctx.url, err});
    }
});

app.use(async (ctx, next) => {
    try {
        let user = ctx.session.id && (await User.findOne({where: {id: ctx.session.id || 0}}));
        if (user && (Number(ctx.session.timestamp) || 0) > (Number(user.logout) || 0)) ctx.state.user = user;
    } catch (err) {
        winston.error(err.message, {err});
    } finally {
        await next();
    }
});

const router = new (require('koa-router'))();

router.get('/', ctx => {
    if (!ctx.state.user) return ctx.redirect('/login');
    return ctx.render('index');
});

app.use(router.routes());

for (const [name, controller] of Object.entries(
    require('require-all')({dirname: path.resolve(__dirname, './controllers'), recursive: false})
)) {
    winston.info(`Registering controller /${name}`);
    app.use(mount(`/${name}`, controller.routes()));
}

process.on('unhandledRejection', err => {
    winston.error(err.message, {err});
    throw err;
});

(async () => {
    await sequelize.sync();
    await new Promise((resolve, reject) => app.listen(Number(process.env.PORT) || 3000, resolve).on('error', reject));
    winston.info('server is running...');
})();
