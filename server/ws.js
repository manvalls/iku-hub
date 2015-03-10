var ws = require('ws'),
    Emitter = require('y-emitter'),
    
    on = require('u-proto/on'),
    once = require('u-proto/once'),
    
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
  
  wss[on]('connection',onConnection,emitter);
  
  return emitter.target;
}

function onConnection(e,en,emitter){
  var ws = e[0],
      inP,outP;
  
  inP = new Emitter.Hybrid();
  outP = new Emitter.Hybrid();
  Emitter.chain(inP,outP);
  
  inP.on('msg',sendMsg,ws);
  inP.once('closed',close,ws);
  
  ws[on]('message',onMsg,inP);
  ws[once]('close',onceClose,inP);
  
  inP.set('ready');
  emitter.give('peer',outP);
}

function sendMsg(msg,en,ws){
  try{ ws.send(JSON.stringify(msg)); }
  catch(e){ }
}

function close(e,en,ws){
  ws.close();
  inP.unset('ready');
  inP.set('closed');
}

function onMsg(e,en,inP){
  var msg = e[0];
  
  try{ msg = JSON.parse(msg); }
  catch(e){ return; }
  
  inP.give('msg',msg);
}

function onceClose(e,en,inP){
  inP.unset('ready');
  inP.set('closed');
}

module.exports = function(server,path){
  return new Server(getPeerMachine(server,path));
}

