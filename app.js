const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const upload = multer({
  dest: 'files'
});

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cors());

const authenticate = (req, res, next) => {
  if (req.body.userId != 'undefined') {
    users.findOne(req.body.userId).then(data => {
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
  }).then(data => {
    if (data) {
      res.json(false);
    } else if (req.body.password != req.body.confirmPassword) {
      res.json(false);
    } else {
      bcrypt.hash(req.body.password, 12).then(hash => {
        const user = {
          username: req.body.username,
          password: hash,
          email: req.body.email,
          name: req.body.name
        };
        users.insert(user).then(inserted => {
          res.json(true);
        });
      });
    }
  });
});

app.post('/log-in', (req, res) => {
  users.findOne({
    username: req.body.username
  }).then(data => {
    if (data) {
      bcrypt.compare(req.body.password, data.password).then(same => {
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
          }).then(updated => {
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

app.post('/upload-image', upload.single('file'), authenticate, (req, res) => {
  const image = {
    userId: req.body.userId,
    name: req.body.name,
    upvotes: [],
    downvotes: [],
    comments: [],
    _path: req.file.path
  };

  images.insert(image).then(data => {
    res.json(true);
  });
});


app.post('/vote', authenticate, (req, res) => {
  images.findOne(req.body.imageId).then(data => {
    const toggle = (array, val) => {
      const index = array.indexOf(val);
      if (index === -1) array.push(val);
      else array.splice(index, 1);
      return array;
    };

    if (req.body.type === 'up') {
      images.update(data._id, {
        $set: {
          upvotes: toggle(data.upvotes, req.body.userId)
        }
      }).then(updated => {
        res.json(data.upvotes.length);
      });
    } else if (req.body.type === 'down') {
      images.update(data._id, {
        $set: {
          downvotes: toggle(data.downvotes, req.body.userId)
        }
      }).then(updated => {
        res.json(data.downvotes.length);
      });
    } else {
      res.json(false);
    }
  });
});

app.post('/comment', authenticate, (req, res) => {
  images.findOne(req.body.imageId).then(data => {
    data.comments.push({
      userId: req.body.userId,
      text: req.body.text
    });

    images.update(data._id, {
      $set: data
    }).then(updated => {
      res.json(data.comments.length);
    });
  });
});

app.get('/get-user', (req, res) => {
  users.findOne(req.query.userId).then(data => {
    res.json({
      userId: data._id,
      username: data.username,
      name: data.name
    });
  });
});

app.get('/get-image', (req, res) => {
  images.findOne(req.query.imageId).then(data => {
    res.json({
      imageId: data._id,
      userId: data.userId,
      name: data.name,
      upvotes: data.upvotes.length,
      downvotes: data.downvotes.length,
      comments: data.comments.length
    });
  });
});

app.get('/all-users', (req, res) => {
  users.find().then(data => {
    res.json(data.map(user => {
      return {
        userId: user._id,
        username: user.username,
        name: user.name
      };
    }));
  });
});

app.get('/all-images', (req, res) => {
  images.find().then(data => {
    res.json(data.map(image => {
      return {
        imageId: image._id,
        userId: image.userId,
        name: image.name,
        upvotes: image.upvotes.length,
        downvotes: image.downvotes.length,
        comments: image.comments.length
      };
    }));
  });
});

app.get('/search', (req, res) => {
  images.find().then(data => {
    const search = wade(data.map(image => image.name));
    const results = search(req.query.name);

    res.json(results.map(index => {
      return {
        imageId: data[index.index]._id,
        userId: data[index.index].userId,
        name: data[index.index].name,
        upvotes: data[index.index].upvotes.length,
        downvotes: data[index.index].downvotes.length,
        comments: data[index.index].comments.length
      };
    }));
  });
});

app.get('/get-comments', (req, res) => {
  images.findOne(req.query.imageId).then(data => {
    if (req.query.amount > 0) {
      res.json(data.comments.slice(0, req.query.amount));
    } else {
      res.json(data.comments);
    }
  });
});

// Serve image file
app.get('/img/:imageId', (req, res) => {
  images.findOne(req.params.imageId).then(data => {
    res.sendFile(`${__dirname}/${data._path}`);
  });
});

app.listen(3000);
