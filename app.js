const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const upload = multer({ dest: 'files' });

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const authenticate = (req, res, next) => {
  if (req.body.userId != 'undefined') {
    users.findOne(req.body.userId)
    .then(data => {
      if (data._authToken === req.body.authToken) {
        if (new Date().getTime() < data._sessionExpire) {
          next();
        } else {
          users.update(data._id, {
            $unset: {
              _authToken: null,
              _sessionExpire: null
            }
          });
          res.json(false);
        }
      } else {
        res.json(false);
      }
    });
  } else {
    res.json(false);
  }
}

const monk = require('monk');
const db = monk('localhost:27017/instapapas');

const bcrypt = require('bcrypt');

const users = db.get('users');
const images = db.get('images');

const wade = require('wade');

const config = require('./config.js');

app.post('/sign-up', (req, res) => {
  users.findOne({
    username: req.body.username
  })
  .then(data => {
    if (data) {
      res.json(false);
    } else {
      bcrypt.hash(req.body.password, 12)
      .then(hash => {
        const user = {
          username: req.body.username,
          password: hash,
          email: req.body.email,
          name: req.body.name
        };
        users.insert(user)
        .then(inserted => {
          res.json(true);
        });
      });
    }
  });
});

app.post('/log-in', (req, res) => {
  users.findOne({
    username: req.body.username
  })
  .then(data => {
    if (data) {
      bcrypt.compare(req.body.password, data.password)
      .then(same => {
        if (same) {
          let randStr = '';
          for (let i = 0; i < config.AUTH_TOKEN_LENGTH; i++) {
            randStr += config.AUTH_TOKEN_CHARSET[Math.floor(Math.random() * config.AUTH_TOKEN_CHARSET.length)];
          }

          users.update(data._id, {
            $set: {
              _authToken: randStr,
              _sessionExpire: new Date().getTime() + config.LOGIN_MAX_TIME
            }
          })
          .then(updated => {
            res.json({
              userId: data._id,
              _authToken: randStr
            });
          });
        } else {
          res.json(false);
        }
      });
    } else {
      res.json(false);
    }
  });
});

app.post('/upload-image', authenticate, upload.single('file'), (req, res) => {
  const image = {
    userId: req.body.userId,
    name: req.body.name,
    upvotes: 0,
    downvotes: 0,
    comments: [],
    _path: req.file.path
  };

  images.insert(image)
  .then(data => {
    images.update(data._id, {
      $set: {
        url: config.IMAGE_URL + data._id
      }
    })
    .then(updated => {
      res.json(true);
    });
  });
});

app.post('/vote', authenticate, (req, res) => {
  images.findOne(req.body.imageId)
  .then(data => {
    data[`${req.body.type}votes`]++;
    images.update(data._id, {
      $set: data
    })
    .then(updated => {
      res.json(true);
    });
  });
});

app.post('/comment', authenticate, (req, res) => {
  images.findOne(req.body.image)
  .then(data => {
    data.comments.push({
      userId: req.body.userId,
      text: req.body.text
    });
    images.update(data._id, {
      $set: data
    })
    .then(updated => {
      res.json(true);
    });
  });
});

// Serve image file
app.get('/img/:imageId', (req, res) => {
  images.findOne(req.params.imageId)
  .then(data => {
    res.sendFile(`${__dirname}/${data._path}`);
  });
});

app.get('/get-user', (req, res) => {
  users.findOne(req.query.userId)
  .then(data => {
    res.json({
      userId: data._id,
      username: data.username,
      name: data.name
    });
  });
});

app.get('/get-image', (req, res) => {
  images.findOne(req.query.imageId)
  .then(data => {
    res.json({
      imageId: data._id,
      url: data.url,
      name: data.name,
      upvotes: data.upvotes,
      downvotes: data.downvotes
    });
  });
});

app.get('/search', (req, res) => {
  images.find()
  .then(data => {
    let names = [];
    for (image of data) {
      names.push(image.name);
    }

    const search = wade(names)(req.query.name);

    let results = [];
    for (index of search) {
      const image = data[index.index];
      results.push({
        imageId: image._id,
        url: image.url,
        name: image.name,
        upvotes: image.upvotes,
        downvotes: image.downvotes,
        comments: []
      });
    }

    res.json(results);
  });
});

app.get('/all-images', (req, res) => {
  images.find()
  .then(data => {
    let results = [];
    for (image of data) {
      results.push({
        imageId: image._id,
        url: image.url,
        name: image.name,
        upvotes: image.upvotes,
        downvotes: image.downvotes,
        comments: []
      });
    }
    res.json(results);
  });
});

app.get('/get-comments', (req, res) => {
  images.findOne(req.query.imageId)
  .then(data => {
    res.json(data.comments.splice(0, req.query.amount));
  });
});

app.get('/all-users', (req, res) => {
  users.find()
  .then(data => {
    let results = [];
    for (user of data) {
      results.push({
        userId: user._id,
        username: user.username,
        name: user.name
      });
    }
    res.json(results);
  });
});

app.listen(3000);
