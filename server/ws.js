var ws = require('ws'),
    Emitter = require('y-emitter'),
    
    walk = require('u-proto/walk'),
    until = require('u-proto/until'),
    
    Server = require('../server.js');

function getPeerMachine(server,path){
  var emitter = new Emitter(),
      wss;
  
  path = path || '/';
  if(path.charAt(0) != '/') path = '/' + path;
  if(path.charAt(path.length - 1) != '/') path += '/';
  
  wss = new ws.Server({
    server: server,
    path: path
  });
  
  wss[walk](onConnection,[emitter]);
  
  return emitter.target;
}

function* onConnection(emitter){
  var ws = (yield this[until]('connection'))[0],
      inP,outP;
  
  this[walk](onConnection,arguments);
  
  inP = new Emitter.Hybrid();
  outP = new Emitter.Hybrid();
  Emitter.chain(inP,outP);
  
  inP.walk(sendMsg,[ws]);
  ws[walk](onMsg,[inP]);
  ws[walk](onClose,[inP]);
  
  inP.set('ready');
  
  emitter.give('peer',outP);
}

function* sendMsg(ws){
  var msg = yield this.until('msg');
  
  this[walk](sendMsg,arguments);
  
  try{ ws.send(JSON.stringify(msg)); }
  catch(e){ }
}

function* onMsg(inP){
  var msg = (yield this[until]('message'))[0];
  
  this[walk](onMsg,arguments);
  
  try{ msg = JSON.parse(msg); }
  catch(e){ return; }
  
  inP.give('msg',msg);
}

function* onClose(inP){
  yield this[until]('close');
  
  inP.unset('ready');
  inP.set('closed');
}

module.exports = function(server,path){
  return new Server(getPeerMachine(server,path));
}

