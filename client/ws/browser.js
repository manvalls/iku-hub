var Emitter = require('y-emitter'),
    
    walk = require('u-proto/walk'),
    until = require('u-proto/until'),
    
    Client = require('../../client.js');

function getPeer(url){
  var inP,outP,
      ws = new WebSocket(url);
  
  inP = new Emitter.Hybrid();
  outP = new Emitter.Hybrid();
  Emitter.chain(inP,outP);
  
  ws[walk](onOpen,[inP]);
  ws[walk](onMsg,[inP]);
  inP.walk(sendMsg,[ws]);
  
  return outP;
}

function* onOpen(inP){
  yield this[until]('open');
  inP.set('ready');
}

function* onClose(inP){
  yield this[until]('close');
  inP.unset('ready');
  inP.set('closed');
}

function* onMsg(inP){
  var msg = (yield this[until]('message')).data;
  
  this[walk](onMsg,arguments);
  
  msg = JSON.parse(msg);
  inP.give('msg',msg);
}

function* sendMsg(ws){
  var msg = yield this.until('msg');
  
  this.walk(sendMsg,arguments);
  
  ws.send(JSON.stringify(msg));
}

module.exports = function(url){
  return new Client(getPeer(url));
};

