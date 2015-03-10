var Emitter = require('y-emitter'),
    
    on = require('u-proto/on'),
    once = require('u-proto/once'),
    
    Client = require('../../client.js');

function getPeer(url){
  var inP,outP,
      ws = new WebSocket(url);
  
  inP = new Emitter.Hybrid();
  outP = new Emitter.Hybrid();
  Emitter.chain(inP,outP);
  
  ws[once]('open',onceOpen,inP);
  ws[once]('close',onceClosed,inP);
  ws[on]('message',onMsg,inP);
  
  inP.on('msg',sendMsg,ws);
  inP.once('closed',close,ws);
  
  return outP;
}

function onceOpen(e,en,inP){
  inP.set('ready');
}

function onceClosed(e,en,inP){
  inP.unset('ready');
  inP.set('closed');
}

function onMsg(e,en,inP){
  var msg = e.data;
  
  msg = JSON.parse(msg);
  inP.give('msg',msg);
}

function sendMsg(msg,en,ws){
  ws.send(JSON.stringify(msg));
}

function close(e,en,ws){
  ws.close();
  
  this.unset('ready');
  this.set('closed');
}

module.exports = function(url){
  
  if(!url.match(/^wss?:/)){
    url = document.baseURI.replace(/^http/,'ws') + url;
    if(url.charAt(url.length - 1) != '/') url += '/'
  }
  
  return new Client(getPeer(url));
};

