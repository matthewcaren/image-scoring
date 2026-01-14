'use strict';

const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require('express');
const mongodb = require('mongodb');
const colors = require('colors/safe');
const ConfigParser = require('configparser');
const fs = require('fs');
const config = new ConfigParser();
const app = express();
var path = require('path');
const ObjectID = mongodb.ObjectID;
const MongoClient = mongodb.MongoClient;

const settings_file = 'settings.conf';
try{
  config.read(settings_file);
} catch {
  console.log("Failed to read config file. Make sure settings.conf exists and that you started app.js with the experiments folder as working directory.")
}
const DEFAULT_CONFIG_FILENAME = config.get('DEFAULTS', 'CONFIG_FILENAME');
const DEFAULT_MONGODB_PORT = config.get('DEFAULTS', 'MONGODB_PORT');
const DEFAULT_MONGODB_HOST = config.get('DEFAULTS', 'MONGODB_HOST');
const DEFAULT_MONGODB_USER = config.get('DEFAULTS', 'MONGODB_USER');

var CONFIGFILE;
if ("CAB_CONFIGFILE" in process.env) {
  CONFIGFILE = process.env["CAB_CONFIGFILE"]
} else {
  CONFIGFILE = path.join(process.env['HOME'], DEFAULT_CONFIG_FILENAME);
}

if (fs.existsSync(CONFIGFILE)) {
  config.read(CONFIGFILE);
} else {
  console.log(`No config exists at path ${CONFIGFILE}, check settings`);
}

var user;
if (config.get('DB', 'username')) {
  user = config.get('DB', 'username');
} else {
  user = DEFAULT_MONGODB_USER
} 
const pswd = config.get('DB', 'password');

const mongoURL = `mongodb://${user}:${pswd}@${DEFAULT_MONGODB_HOST}:${DEFAULT_MONGODB_PORT}/`;

var argv = require('minimist')(process.argv.slice(2));

const port = argv.port || 8012;

function makeMessage(text) {
  return `${colors.blue('[store]')} ${text}`;
}

function log(text) {
  console.log(makeMessage(text));
}

function failure(response, text) {
  const message = makeMessage(text);
  console.error(message);
  return response.status(500).send(message);
}

function success(response, text) {
  const message = makeMessage(text);
  console.log(message);
  return response.send(message);
}

function mongoConnectWithRetry(delayInMilliseconds, callback) {
  MongoClient.connect(mongoURL, (err, connection) => {
    if (err) {
      console.error(`Error connecting to MongoDB: ${err}`);
      setTimeout(() => mongoConnectWithRetry(delayInMilliseconds, callback), delayInMilliseconds);
    } else {
      log('connected succesfully to mongodb');
      callback(connection);
    }
  });
}

function markAnnotation(collection, gameid, sketchid) {
  collection.update({ _id: ObjectID(sketchid) }, {
    $push: { games: gameid },
    $inc: { numGames: 1 }
  }, function (err, items) {
    if (err) {
      console.log(`error marking annotation data: ${err}`);
    } else {
      console.log(`successfully marked annotation. result: ${JSON.stringify(items).substring(0,200)}`);
    }
  });
};


function serve() {
  mongoConnectWithRetry(2000, (connection) => {

    // 5-2-25 fixing PayloadTooLargeError
    app.use(bodyParser.json({limit: '25mb'}));
    app.use(bodyParser.urlencoded({limit: '25mb', extended: true}));

    app.post('/db/insert', (request, response) => {
      console.log("begin insert request processing");

      if (!request.body) {
        return failure(response, '/db/insert needs post request body');
      }
      console.log('request body:',request.body);
      console.log(`got request to insert into ${request.body.study_metadata.project}, ${request.body.study_metadata.experiment}`);

      var databaseName = request.body.study_metadata.project;
      var collectionName = request.body.study_metadata.experiment;
      if (!collectionName) {
        return failure(response, '/db/insert needs collection');
      }
      if (!databaseName) {
        return failure(response, '/db/insert needs database');
      }

      const database = connection.db(databaseName);

      // Add collection if it doesn't already exist
      if (!database.collection(collectionName)) {
        console.log('creating collection ' + collectionName);
        database.createCollection(collectionName);
      }

      const collection = database.collection(collectionName);

      const data = _.omit(request.body, ['project', 'experiment']);
      collection.insert(data, (err, result) => {
        if (err) {
          return failure(response, `error inserting data: ${err}`);
        } else {
          return success(response, `successfully inserted data. result: ${JSON.stringify(result).substring(0,200)}`);
        }
      });
    });

    app.listen(port, () => {
      log(`running at http://localhost:${port}`);
    });

  });

}

serve();
