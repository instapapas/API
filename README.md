# API
The instapapas API (in development)

###Install
```bash
npm install
```

Create `config.js` file and fill it with
```js
module.exports = {
  IMAGE_HOST: 'api.instapapas.matiascontilde.com',
  AUTH_TOKEN_LENGTH: 64,
  AUTH_TOKEN_CHARSET: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_',
  LOGIN_MAX_TIME: 1000 * 60 * 60 * 6 // Six hours
};

```

### Run
```bash
npm start
```
In parallel:
```bash
mongod --dbpath=./db
```
