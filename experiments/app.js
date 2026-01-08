global.__base = __dirname + '/';

// log start time of server
console.log("=== Server started at " + new Date().toISOString() + " ===");
// run with e.g. $ node app.js >> server.log 2>&1 for a persistent log file

var
  use_https = true,
  argv = require('minimist')(process.argv.slice(2)),
  https = require('https'),
  fs = require('fs'),
  app = require('express')(),
  _ = require('lodash'),
  parser = require('xmldom').DOMParser,
  XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest,
  sendPostRequest = require('request').post,
  cors = require('cors'),
  portastic = require('portastic'),
  { Server } = require("socket.io");

// Add body-parser with increased payload size limit
app.use(require('body-parser').json({limit: '25mb'}));
app.use(require('body-parser').urlencoded({limit: '25mb', extended: true}));

////////// EXPERIMENT GLOBAL PARAMS //////////

var gameport;
var store_port;
var store_process;

var cur_path = process.cwd();
// make sure that we're launching store.js from the right path
if (cur_path.indexOf('/experiments') === -1) {
  cur_path = cur_path + '/experiments/';
} else {
  cur_path = cur_path + '/';
}

if (argv.gameport) {
  try {
    if ((argv.gameport < 8850) || (argv.gameport > 8999)) {
      throw 'error';
    } else {
      gameport = argv.gameport;
      console.log('using public facing port ' + gameport);
    }
  } catch (err) {
    console.log('invalid gameport: choose a gameport between 8850 and 8999');
    process.exit();
  }
} else {
  gameport = 8852;
  console.log(`no gameport specified: using ${gameport}. Use the --gameport flag to change`);
}

// we launch store.js ourselves
// find free internal port
portastic.find({
  min: 4000,
  max: 5000,
  retrieve: 1
}).then(ports => {
  store_port = ports;
  if (argv.local_store) {
    console.log('using local store on port ' + store_port);
    // launch store.js
    store_process = require('child_process').spawn('node', [cur_path+'store_local.js', '--port', store_port], {stdio: 'inherit'});
    console.log("⚠️ LOCAL STORAGE IS BEING USED. THIS IS NOT RECOMMENDED FOR PRODUCTION. YOU MIGHT LOOSE DATA. USE A DATABASE INSTEAD. ⚠️");
  } else {
    console.log('using mongoDB store on port ' + store_port);
    // launch store.js
    store_process = require('child_process').spawn('node', [cur_path+'store.js', '--port', store_port], {stdio: 'inherit'});
  }
});

let server;
let io;

try {
  var privateKey = fs.readFileSync('/etc/letsencrypt/live/cogtoolslab.org/privkey.pem'),
    certificate = fs.readFileSync('/etc/letsencrypt/live/cogtoolslab.org/cert.pem'),
    intermed = fs.readFileSync('/etc/letsencrypt/live/cogtoolslab.org/chain.pem'),
    options = { key: privateKey, cert: certificate, ca: intermed };
  const httpsServer = https.createServer(options, app);
  io = new Server(httpsServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  httpsServer.listen(gameport);
} catch (err) {
  console.log("cannot find SSL certificates; falling back to http");
  const httpServer = require('http').createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  httpServer.listen(gameport);
}

// serve stuff that the client requests
app.get('/*', (req, res) => {
  serveFile(req, res);
});

io.on('connection', function (socket) {
  console.log('\t :: Express :: client connected');

  // on request serve the stimulus data
  socket.on('getStims', function (data) {
    var proj_name = data.proj_name;  // effectively dbname
    var exp_name = data.exp_name;  // effectively collname
    var iter_name = data.iter_name;  // todo: unused right now?
    initializeWithTrials(socket, proj_name, exp_name, iter_name);
  });
  // write data to db upon getting current data
  socket.on('currentData', function (data) {
    // Log payload size in KB and MB when receiving data
    const payloadSize = JSON.stringify(data).length;
    const payloadSizeKB = (payloadSize / 1024).toFixed(2);
    const payloadSizeMB = (payloadSize / (1024 * 1024)).toFixed(2);
    const isIncrementalData = data.isIncrementalData || false;
    const gameID = data.gameID || '';
    console.log(`[${gameID}] Received ${(isIncrementalData) ? 'incremental' : ''}` +
      `currentData payload: ${payloadSizeKB} KB (${payloadSizeMB} MB)`);
    console.log(`[${gameID}] ` + JSON.stringify(data).substring(0,200));

    // Increment games list in mongo here
    var proj_name = data.proj_name;
    var exp_name = data.exp_name;
    var iter_name = data.iter_name;
    writeDataToMongo(data, proj_name, exp_name, iter_name);
  });
});

var FORBIDDEN_FILES = ["auth.json"];

var serveFile = function (req, res) {
  var fileName = req.params[0];
  if (FORBIDDEN_FILES.includes(fileName)) {
    // Don't serve files that contain secrets
    console.log("Forbidden file requested: " + fileName);
    return;
  }

  // Log the referrer to provide some context about which page requested this file
  const referer = req.headers.referer || 'unknown';
  console.log(`\t :: Express :: file requested: ${fileName} (referer: ${referer})`);

  return res.sendFile(fileName, { root: __dirname });
};

function omit(obj, props) { //helper function to remove _id of stim object
  try{
    props = props instanceof Array ? props : [props]
    return eval(`(({${props.join(',')}, ...o}) => o)(obj)`)
  } catch (err) {
    return obj;
  }
}

function initializeWithTrials(socket, proj_name, collection, it_name) {
  var gameid = UUID();
  sendPostRequest('http://localhost:' + store_port + '/db/getstims', {
    json: {
      dbname: proj_name + '_input',
      collname: collection,
      // todo: are these needed?
      it_name: it_name,
      gameid: gameid
    }
  }, (error, res, body) => {
    console.log('body', body);
    if (!error && res.statusCode === 200 && typeof body !== 'undefined') {
      // send trial list (and id) to client
      var packet = {
        gameid: gameid,
        inputid: body['_id'], // using the mongo record ID
        stims: body.trials,
      };
      // fixme: debug
      console.log(`[${gameid}] packet`, packet);
      socket.emit('stims', packet);
    } else {
      console.log(`[${gameid}] error getting stims: ${error} ${body}`);
    }
  });
}

var UUID = function () {
  var baseName = (Math.floor(Math.random() * 10) + '' +
    Math.floor(Math.random() * 10) + '' +
    Math.floor(Math.random() * 10) + '' +
    Math.floor(Math.random() * 10));
  var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  var id = baseName + '-' + template.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return id;
};

var writeDataToMongo = function (data, proj_name, collection, it_name) {
  var db = proj_name + '_output';
  const gameID = data.gameID || '';
  sendPostRequest(
    'http://localhost:' + store_port + '/db/insert',
    {
      json: data,
    },
    (error, res, body) => {
      if (!error && res.statusCode === 200) {
        console.log(`[${gameID}] sent data to store`);
      } else {
        console.log(`[${gameID}] error sending data to store: ${error} ${body}`);
      }
    }
  );
};