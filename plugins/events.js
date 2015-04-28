var Client = require('../client.js'),
    Server = require('../server.js'),
    
    Su = require('u-su'),
    Emitter = require('y-emitter'),
    
    evs = Su(),
    emitter = Su(),
    
    event = '5uZ5PG-cXUic',
    
    bag;

function pluginListener(e){
  var data = e[0],
      em = e[1],
      e1;
  
  if(!data) return;
  if(!em.target[evs]) return;
  
  e1 = em.target[evs][data.prefix];
  if(!e1) return;
  if(!e1.any.hasOwnProperty(data.method)) return;
  
  em = e1[emitter];
  if(!em) return;
  
  if(em[data.method]) em[data.method].apply(em,data.args);
}

function onAnyEvent(args,c,peer,method,pref){
  
  peer.give(event,{
    method: method,
    args: args,
    prefix: pref
  });
  
}

bag = {ev: {value: function(pref){
  var e1,e2,keys,i,j;
  
  if(pref == null) pref = 'default';
  this[evs] = this[evs] || {};
  
  if(!this[evs][pref]){
    
    e1 = new Emitter.Hybrid();
    e2 = new Emitter();
    Emitter.chain(e1,e2);
    
    e1[emitter] = e2;
    this[evs][pref] = e1;
    
    keys = Object.keys(e1.target.any);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      if(e2[i]) e1.target.on(e1.target.any[i],onAnyEvent,this,i,pref);
    }
    
  }
  
  return this[evs][pref];
}}};

Client.peerPlugins.on(event,pluginListener);
Client.serverPlugins.on(event,pluginListener);

Object.defineProperties(Client.Peer.prototype,bag);
Object.defineProperties(Client.Room.prototype,bag);
Object.defineProperties(Client.Server.prototype,bag);

Server.clientPlugins.on(event,pluginListener);
Server.coworkerPlugins.on(event,pluginListener);

Object.defineProperties(Server.Coworker.prototype,bag);
Object.defineProperties(Server.Room.prototype,bag);
Object.defineProperties(Server.Client.prototype,bag);
