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
    rooms = Su(),
    
    plugins = new Emitter(),
    serverPlugins = new Emitter(),
    
    Server;

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

// Room utils

function broadcast(room,msg,pid){
  var keys,i,j;
  
  msg.route = msg.route || {};
  
  if(msg.route[room[rid]]) return;
  msg.route[room[rid]] = true;
  
  keys = Object.keys(room[roomPeers]);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    if(!msg.route[room[roomPeers][i][rid]]) room[roomPeers][i].give('msg',msg);
  }
  
  delete msg.route;
  
  if(pid){
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      if(i !== pid) room[peers][i].give('msg',msg);
    }
    
  }else{
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      room[peers][i].give('msg',msg);
    }
    
  }
  
}

function getPeerList(room){
  var ret;
  
  ret = Object.keys(room[peers]);
  ret = ret.concat(Object.keys(room[remotePeers]));
  
  return ret;
}

function send(msg,room){
  var rp;
  
  msg.route = msg.route || {};
  
  if(msg.route[room[rid]]) return;
  msg.route[room[rid]] = true;
  
  if(room[peers][msg.to]){
    
    if(!msg.test){
      delete msg.route;
      room[peers][msg.to].give('msg',msg);
    }
    
  }else if(rp = room[remotePeers][msg.to]){
    
    if(msg.route[rp[rid]]){
      delete room[remotePeers][msg.to];
      delete msg.route[room[rid]];
      findOrDelete([msg.to],room,msg);
    }else rp.give('msg',msg);
    
  }
  
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
      rid: room[rid],
      pids: toDelete,
      route: {}
    };
    
    if(peer) msg.route[peer[rid]] = true;
    broadcast(room,msg);
  }
  
}

// Room listeners

function roomOnPeer(peer,c,room){
  var id = Su(),
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
    pids: pids,
    rid: room[rid]
  });
}

function roomOnPeerMsg(msg,c,room,id){
  var i,pid,pids;
  
  if(typeof msg != 'object') return;
  if(typeof msg.route != 'object') return;
  if(msg.route[room[rid]]) return;
  
  if(msg.to){
    if(msg.to == 'all') broadcast(room,msg);
    else send(msg,room);
  }else if(msg.rid) switch(msg.type){
    
    case 'rid':
      this[rid] = msg.rid;
      break;
    
    case 'hi':
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
      
      break;
    
    case 'bye':
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
      
      break;
    
  }else broadcast(room,msg);
  
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
      rid: this[rid],
      pids: [pid]
    });
    
    this[peers][pid] = peer;
    peer.once('closed',room_onceClosed,this,p);
  }},
  
  remove: {value: function(p){
    var pid = p[pids][this[rid]],
        keys,i,j,msg;
    
    if(!pid) return;
    
    if(!this[peers][pid].is('closed')) this[peers][pid].give('msg',{
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
      result.push(this[peers]);
    }
    
    return result;
  }}
  
});

function room_onceClosed(e,cbc,room,p){
  room.remove(p);
}

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

Server.Peer = Peer;
Server.Room = Room;

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
  
  if(msg.rid){
    room = ep[rooms][msg.rid];
    if(!room) return;
    
    msg.from = ep[pids][msg.rid];
    
    if(msg.to == 'all') return broadcast(room,msg,msg.from);
    send(msg,room);
  }else serverPlugins.give(msg.type,[msg.data,ep[emitter]]);
  
}

function onceClosed(e,cbc,ep){
  ep[emitter].set('closed');
}

// Plugins

Server.serverPlugins = serverPlugins.target;
Server.plugins = plugins.target;

function msgHandler(e){
  var data = e[0],
      emitter = e[1];
  
  emitter.give('msg',data);
}

Server.serverPlugins.on('msg',msgHandler);

