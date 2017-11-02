'use strict';

var Http = require('http');
var Express = require('express');
var BodyParser = require('body-parser');
var Swaggerize = require('swaggerize-express');
var Path = require('path');
var fs = require('fs');
var mongoose = require('./modules/mongoose.js');

var io = require('socket.io')(Http);
var App = Express();
var Server = Http.Server(App);

/* services */
var teams = require('./services/teams.js')
var quizzes = require('./services/quizzes.js')
var questions = require('./services/questions.js')

/**Multer setup */
const uploadPath = './images';
var multer = require('multer');
var mime = require('mime-types') // we need to know what type they uploaded
var crypto = require('crypto'), // used to generate unique filenames
  algorithm = 'aes-256-ctr',
  password = 'd6F3Efeq';
// define diskstorage things
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath)
  },
  filename: function (req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
    });
  }
});
var upload = multer({
  storage: storage
});
// static endpoint for images
App.use(Express.static('./images'));

// other middleware
App.use(BodyParser.json());
App.use(BodyParser.urlencoded({
  extended: true
}));

// we need CORS because we're working from other domains (e.g react runs from your pc)
io.origins('*:*');
App.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

App.use(Swaggerize({
  api: Path.resolve('./config/swagger.yml'),
  handlers: Path.resolve('./handlers')
}));

io.on('connection', function (client) {
  console.log('a client connected');
  client.on("disconnect", () => console.log("a client disconnected"));
});

// Custom endpoints
App.post('/image', upload.single('teamImage'), function (req, res, next) {
  res.send(req.file.filename);
})

App.get('/newQuestionTest', (req, res) => {
  questions.getAllQuestions().then(questions => {
    io.emit('new-question', { question: questions[Math.floor(Math.random() * questions.length)], quizId: '59f9928e0287d21fc55e0668'})
    res.send('websocket message fired!')
  }).catch(err => {
    res.send(err);
  })
});

/**
 * Login to the current quiz (will give you the answer back)
 */
App.post('/login', (req, res) => {
  quizzes.getQuiz(req.body.quizId).then(quiz => {
    if (
      (quiz.password != req.body.pubPass) ||
      (quiz.status == "Closed")
    ) {
      return Promise.reject();
    } else {
      if (quiz.status.toLowerCase() === "open") {
        res.send("please call the quiz master");
      } else {
        teams.getTeamByName(req.body.name).then(team => {
          if (quizzes.teamInQuiz(team, quiz) && teams.verifyPassword(team.password, req.body.password)) {
            var currentQuestion = {}
            quiz.rounds.some(round => {
              let answer = round.questions.filter(question => (question.status === "Open"))
              if (answer.length !== 0) { // if answer isn't empty
                currentQuestion = answer[0]; // return element
                return true; // some will exit if we return true :)
              } else {
                return false;
              }
            });
            questions.getQuestion(currentQuestion.questionId).then(question => {
              res.send({
                quizId: quiz._id,
                question: question
              });
            }).catch(err => {
              res.status(401).send("not authorized")
            })
          } else {
            return Promise.reject();
          }
        }).catch(err => {
          res.status(401).send("not authorized");
        })
      }
    }
  }).catch(err => {
    res.status(401).send("not authorized");
  })
})

App.post('/login/scoreboard', (req, res) => {
  quizzes.getQuiz(req.body.quizId).then(quiz => {
    console.log(quiz.password)
    console.log(req.body.pubPass)
    if ((quiz.password != req.body.pubPass)) {
      res.status(401).send("not authorized");
    } else {
      res.send('granted');
    }
  }).catch(err => {
    res.status(401).send("not authorized");
  })
})

// start server(s) and listen
Server.listen(8080, function () {
  App.swagger.api.host = this.address().address + ':' + this.address().port;
  console.log('App running on %s:%d', this.address().address, this.address().port);
});
io.listen(Server);
