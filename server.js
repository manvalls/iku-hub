var Su = require('u-su'),
    unique = require('u-rand').unique,
    Emitter = require('y-emitter'),
    wrap = require('y-walk').wrap,
    
    peers = Su(),
    remotePeers = Su(),
    roomPeers = Su(),
    emitter = Su(),
    rid = Su(),
    pids = Su(),
    total = Su(),
    localTotal = Su(),
    ip = Su(),
    cw = Su(),
    rooms = Su(),
    
    room = Su(),
    pid = Su(),
    gid = Su(),
    to = Su(),
    
    plugins = new Emitter(),
    clientPlugins = new Emitter(),
    getPlugins = new Emitter(),
    roomGetPlugins = new Emitter(),
    coworkerPlugins = new Emitter(),
    
    Server;

// Room utils

function checkRoute(msg,room){
  msg.route = msg.route || {};
  
  if(msg.route[room[rid]]) return true;
  msg.route[room[rid]] = true;
  
  return false;
}

function broadcast(room,msg,pid){
  var keys,i,j;
  
  if(checkRoute(msg,room)) return;
  
  keys = Object.keys(room[roomPeers]);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    if(!msg.route[room[roomPeers][i][rid]]) room[roomPeers][i].give('msg',msg);
  }
  
  delete msg.route;
  msg.rid = room[rid];
  
  if(pid){
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      if(i !== pid) room[peers][i][ip].give('msg',msg);
    }
    
  }else{
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      room[peers][i][ip].give('msg',msg);
    }
    
  }
  
}

function getPeerList(room){
  var ret;
  
  ret = Object.keys(room[peers]);
  ret = ret.concat(Object.keys(room[remotePeers]));
  
  return ret;
}

function remoteSend(msg,to,room){
  var rp;
  
  if(rp = room[remotePeers][to]){
    
    if(msg.route[rp[rid]]){
      
      delete room[remotePeers][to];
      delete msg.route[room[rid]];
      findOrDelete([to],room,msg);
      
    }else rp.give('msg',msg);
    
  }
  
}

function send(msg,room){
  var to = msg.to;
  
  if(checkRoute(msg,room)) return;
  
  if(room[peers][to]){
    
    if(!msg.test){
      delete msg.route;
      delete msg.to;
      msg.rid = room[rid];
      
      room[peers][to][ip].give('msg',msg);
    }
    
    return;
  }
  
  remoteSend(msg,to,room);
}

function handleGet(msg,room){
  var req,rp;
  
  if(checkRoute(msg,room)) return;
  
  if(!msg.pid){
    req = new Request(msg.from,msg.gid,msg.pid,room,msg.data);
    roomGetPlugins.give(msg.type,[req,room[emitter]]);
    return;
  }
  
  if(room[peers][msg.pid]){
    req = new Request(msg.from,msg.gid,msg.pid,room,msg.data);
    getPlugins.give(msg.type,[req,room[peers][msg.pid][emitter]]);
    return;
  }
  
  remoteSend(msg,msg.pid,room);
}

function findOrDelete(pids,room,pm,peer){
  var toDelete = [],
      keys,i,j,rp,k,pid,msg;
  
  for(k = 0;k < pids.length;k++){
    pid = pids[k];
    
    if(room[peers][pid]) continue;
    if(room[remotePeers][pid]) continue;
    
    keys = Object.keys(room[roomPeers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      rp = room[roomPeers][i];
      
      if(rp[peers][pid]){
        room[remotePeers][pid] = rp;
        
        pm = pm || {test: true};
        pm.to = pid;
        send(pm,room);
        
        continue;
      }
    }
    
    toDelete.push(pid);
    if(!--room[total]) room[emitter].sun('empty','used');
  }
  
  if(toDelete.length){
    msg = {
      type: 'bye',
      pids: toDelete,
      route: {}
    };
    
    if(peer) msg.route[peer[rid]] = true;
    broadcast(room,msg);
  }
  
}

// Peer requests

function Request(_to,_gid,_pid,_room,data){
  this[to] = _to;
  this[pid] = _pid;
  this[gid] = _gid;
  this[room] = _room;
  this.info = data;
}

Object.defineProperties(Request.prototype,{
  
  answer: {value: function(data){
    var msg = {
      to: this[to],
      gid: this[gid],
      data: data
    };
    
    if(this[pid]) msg.pid = this[pid];
    send(msg,this[room]);
  }},
  
  toString: {value: function(){
    return this.info + '';
  }},
  
  valueOf: {value: function(){
    return this.info;
  }}
  
});

// Room listeners

function roomOnPeer(peer,c,room){
  var id = unique(),
      pids;
  
  room[roomPeers][id] = peer;
  peer[peers] = {};
  peer[rid] = id;
  
  peer.on('msg',roomOnPeerMsg,room,id);
  peer.once('closed',roomOncePeerClosed,room,id);
  
  peer.give('msg',{
    type: 'rid',
    rid: room[rid]
  });
  
  pids = getPeerList(room);
  if(pids.length) peer.give('msg',{
    type: 'hi',
    pids: pids
  });
  
  room[emitter].give('coworker',new Coworker(peer));
  
}

function roomOnPeerMsg(msg,c,room,id){
  var i,pid,pids;
  
  if(typeof msg != 'object') return;
  if(typeof msg.route != 'object') return;
  if(msg.route[room[rid]]) return;
  
  if(msg.to){
    if(msg.to == 'all') broadcast(room,msg);
    else send(msg,room);
    return;
  }
  
  if(msg.gid){
    handleGet(msg,room);
    return;
  }
  
  if(!(msg.pids || msg.rid)){
    coworkerPlugins.give(msg.type,[msg.data,this[cw][emitter]]);
    return;
  }
  
  switch(msg.type){
    
    case 'rid': {
      this[rid] = msg.rid;
    } break;
    
    case 'hi': {
      if(!(msg.pids instanceof Array)) return;
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        this[peers][pid] = true;
        
        if(!(room[remotePeers][pid] || room[peers][pid])){
          room[remotePeers][pid] = this;
          
          if(!room[total]++) room[emitter].sun('used','empty');
        }
      }
      
      msg.rid = room[rid];
      broadcast(room,msg);
      
    } break;
    
    case 'bye': {
      if(!(msg.pids instanceof Array)) return;
      
      pids = [];
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        delete this[peers][pid];
        
        if(room[remotePeers][pid] == this){
          delete room[remotePeers][pid];
          pids.push(pid);
        }
      }
      
      findOrDelete(pids,room,null,this);
      
    } break;
    
  }
  
}

function roomOncePeerClosed(e,c,room,id){
  var pids = [],
      keys,j,i;
  
  delete room[roomPeers][id];
  
  keys = Object.keys(this[peers]);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    if(room[remotePeers][i] == this){
      delete room[remotePeers][i];
      pids.push(i);
    }
  }
  
  findOrDelete(pids,room);
}

// Room object

function Room(pm){
  Emitter.Target.call(this,emitter);
  
  this[rid] = unique();
  this[total] = 0;
  this[localTotal] = 0;
  
  this[peers] = {};
  this[remotePeers] = {};
  this[roomPeers] = {};
  
  if(pm) pm.on('peer',roomOnPeer,this);
  plugins.give('room',this);
}

Room.prototype = new Emitter.Target();
Room.prototype.constructor = Room;

Object.defineProperties(Room.prototype,{
  
  add: {value: function(p){
    var pid,peer,msg,i,j;
    
    if(p[pids][this[rid]]) return;
    
    pid = unique();
    peer = p[ip];
    
    p[pids][this[rid]] = pid;
    p[rooms][this[rid]] = this;
    
    if(!this[localTotal]++) this[emitter].sun('locally used','locally empty');
    if(!this[total]++) this[emitter].sun('used','empty');
    
    peer.give('msg',{
      type: 'hi',
      rid: this[rid],
      pids: getPeerList(this)
    });
    
    broadcast(this,{
      type: 'hi',
      pids: [pid]
    });
    
    this[peers][pid] = p;
    peer.once('closed',room_onceClosed,this,p);
  }},
  
  remove: {value: function(p){
    var pid = p[pids][this[rid]],
        keys,i,j,msg;
    
    if(!pid) return;
    
    if(!this[peers][pid][ip].is('closed')) this[peers][pid][ip].give('msg',{
      type: 'bye',
      rid: this[rid],
      pids: []
    });
    
    delete p[pids][this[rid]];
    delete p[rooms][this[rid]];
    delete this[peers][pid];
    
    if(!--this[localTotal]) this[emitter].sun('locally empty','locally used');
    
    findOrDelete([pid],this);
  }},
  
  give: {value: function(type,data){
    
    broadcast(this,{
      type: type,
      data: data
    });
    
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }},
  
  getLocalPeers: {value: function(){
    var result = [],
        i,j,keys;
    
    keys = Object.keys(this[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      result.push(this[peers][i]);
    }
    
    return result;
  }},
  
  getCoworkers: {value: function(){
    var result = [],
        i,j,keys;
    
    keys = Object.keys(this[roomPeers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      result.push(this[roomPeers][i][cw]);
    }
    
    return result;
  }}
  
});

function room_onceClosed(e,cbc,room,p){
  room.remove(p);
}

// Coworker object

function Coworker(peer){
  Emitter.Target.call(this,emitter);
  
  this[ip] = peer;
  peer[cw] = this;
}

Coworker.prototype = new Emitter.Target();
Coworker.prototype.constructor = Room;

Object.defineProperties(Coworker.prototype,{
  
  give: {value: function(type,data){
    
    this[ip].give('msg',{
      type: type,
      data: data
    });
    
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }}
  
});

// External Peer object

function Peer(internalPeer){
  Emitter.Target.call(this,emitter);
  
  this[rooms] = {};
  this[pids] = {};
  this[ip] = internalPeer;
  
  plugins.give('peer',this);
}

Peer.prototype = new Emitter.Target();
Peer.prototype.constructor = Peer;

Object.defineProperties(Peer.prototype,{
  
  give: {value: function(type,data){
    
    this[ip].give('msg',{
      type: type,
      data: data
    });
    
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }},
  
  close: {value: function(){
    this[ip].set('closed');
  }},
  
  set: {value: function(event){
    if(event == 'closed') this.close();
  }}
  
});

// Server object

Server = module.exports = function Server(peerMachine){
  Emitter.Target.call(this,emitter);
  peerMachine.on('peer',onPeer,this);
  
  plugins.give('server',this);
};

Server.Client = Peer;
Server.Room = Room;
Server.Coworker = Coworker;

Server.prototype = new Emitter.Target();
Server.prototype.constructor = Server;

function onPeer(peer,cbc,server){
  var externalPeer = new Peer(peer);
  
  server[emitter].give('client',externalPeer);
  
  peer.once('closed',onceClosed,externalPeer);
  peer.on('msg',onMsg,externalPeer);
}

function onMsg(msg,cbc,ep){
  var room;
  
  if(typeof msg != 'object') return;
  
  if(msg.gid){
    room = ep[rooms][msg.rid];
    if(!room) return;
    
    msg.from = ep[pids][msg.rid];
    handleGet(msg,room);
    
    return;
  }
  
  if(msg.rid){
    room = ep[rooms][msg.rid];
    if(!room) return;
    
    msg.from = ep[pids][msg.rid];
    
    if(msg.to == 'all') return broadcast(room,msg,msg.from);
    send(msg,room);
    return;
  }
  
  clientPlugins.give(msg.type,[msg.data,ep[emitter]]);
  
}

function onceClosed(e,cbc,ep){
  ep[emitter].set('closed');
}

// Plugins

Server.clientPlugins = clientPlugins.target;
Server.coworkerPlugins = coworkerPlugins.target;
Server.roomGetPlugins = roomGetPlugins.target;
Server.getPlugins = getPlugins.target;
Server.plugins = plugins.target;

function msgHandler(e){
  var data = e[0],
      emitter = e[1];
  
  emitter.give('msg',data);
}

Server.coworkerPlugins.on('msg',msgHandler);
Server.clientPlugins.on('msg',msgHandler);

function reqHandler(e){
  var data = e[0],
      emitter = e[1];
  
  emitter.give('request',data);
}

Server.getPlugins.on('info',reqHandler);
Server.roomGetPlugins.on('info',reqHandler);

