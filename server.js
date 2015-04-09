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
  
  this[peers] = {};
  this[remotePeers] = {};
  this[roomPeers] = {};
  
  if(pm) pm.on('peer',roomOnPeer,this);
  plugins.give('room',this);
}

// Room utils

function broadcast(room,msg,pid){
  var keys,i,j,peer;
  
  if(msg[room[rid]]) return;
  msg[room[rid]] = true;
  
  if(typeof pid == 'string'){
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      if(i !== pid) room[peers][i].give('msg',msg);
    }
    
    pid = null;
    
  }else{
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      room[peers][i].give('msg',msg);
    }
    
  }
  
  peer = pid;
  
  if(peer){
    
    keys = Object.keys(room[roomPeers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      if(room[roomPeers][i] != peer) room[roomPeers][i].give('msg',msg);
    }
    
  }else{
    
    keys = Object.keys(room[roomPeers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      room[roomPeers][i].give('msg',msg);
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
  if(room[peers][msg.to]) room[peers][msg.to].give('msg',msg);
  else if(room[remotePeers][msg.to]) room[remotePeers][msg.to].give('msg',msg);
}

function findOrDelete(pid,room,peer){
  var keys,i,j,rp;
  
  // TODO: multiple pids support
  
  if(room[remotePeers][pid]) return;
  
  keys = Object.keys(room[roomPeers]);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    rp = room[roomPeers][i];
    
    if(rp[peers][pid]){
      room[remotePeers][pid] = rp;
      return;
    }
  }
  
  broadcast(room,{
    type: 'bye',
    rid: room[rid],
    pids: [pid]
  },peer);
  
  if(!--room[total]) room[emitter].set('empty');
}

// Room listeners

function roomOnPeer(peer,c,room){
  var id = Su(),
      pids;
  
  room[roomPeers][id] = peer;
  peer[peers] = {};
  
  peer.on('msg',roomOnPeerMsg,room,id);
  peer.once('closed',roomOncePeerClosed,room,id);
  
  pids = getPeerList(room);
  if(pids.length) peer.give('msg',{
    type: 'hi',
    pids: pids
  });
}

function roomOnPeerMsg(msg,c,room,id){
  var i,pid;
  
  if(typeof msg != 'object') return;
  
  if(msg.from){
    if(msg.to == 'all') broadcast(room,msg,this);
    else send(msg,room);
  }else if(msg.rid) switch(msg.type){
    
    case 'hi':
      if(!(msg.pids instanceof Array)) return;
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        this[peers][pid] = true;
        
        if(!(room[remotePeers][pid] || room[peers][pid])){
          room[remotePeers][pid] = this;
          
          if(!room[total]) room[emitter].unset('empty');
          room[total]++;
        }
      }
      
      msg.rid = room[rid];
      broadcast(room,msg,this);
      
      break;
    
    case 'bye':
      if(!(msg.pids instanceof Array)) return;
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        delete this[peers][pid];
        
        if(room[remotePeers][pid] == this){
          delete room[remotePeers][pid];
          findOrDelete(pid,room,this);
        }
      }
      
      break;
    
  }else broadcast(room,msg,this);
  
}

function roomOncePeerClosed(e,c,room,id){
  var keys,j,i;
  
  delete room[roomPeers][id];
  
  keys = Object.keys(this[peers]);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    if(room[remotePeers][i] == this){
      delete room[remotePeers][i];
      findOrDelete(i,room);
    }
  }
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
    
    if(!this[total]) this[emitter].unset('empty');
    this[total]++;
    
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
    
    findOrDelete(pid,this);
  }},
  
  give: {value: function(type,data){
    
    broadcast(this,{
      type: type,
      data: data
    });
    
  }},
  
  send: {value: function(data){
    this.give('msg',data);
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

Server.serverPlugins = serverPlugins.target;
Server.plugins = plugins.target;

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
  }else if(msg.type == 'msg') ep[emitter].give('msg',msg.data);
  else serverPlugins.give(msg.type,[msg.data,ep[emitter]]);
  
}

function onceClosed(e,cbc,ep){
  ep[emitter].set('closed');
}


