var Su = require('u-su'),
    unique = require('u-rand').unique,
    Emitter = require('y-emitter'),
    wrap = require('y-walk').wrap,
    
    peers = Su(),
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

function Room(){
  Emitter.Target.call(this,emitter);
  
  this[rid] = unique();
  this[peers] = {};
  this[total] = 0;
  
  plugins.give('room',this);
}

function broadcast(room,msg,pid){
  var keys,i,j;
  
  if(typeof pid == 'string'){
    
    keys = Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      if(i !== pid) room[peers][i].give('msg',msg);
    }
    
  }else{
    
    keys = pid || Object.keys(room[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      room[peers][i].give('msg',msg);
    }
    
  }
  
}

Room.prototype = new Emitter.Target();
Room.prototype.constructor = Room;

Object.defineProperties(Room.prototype,{
  
  add: {value: function(p){
    var pid,peer,msg,i,j,keys;
    
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
      pids: keys = Object.keys(this[peers])
    });
    
    this[peers][pid] = peer;
    peer.once('closed',room_onceClosed,this,p);
    
    broadcast(this,{
      type: 'hi',
      rid: this[rid],
      pids: [pid]
    },keys);
    
  }},
  
  remove: {value: function(p){
    var pid = p[pids][this[rid]],
        keys,i,j,msg;
    
    if(!this[peers][pid].is('closed')) this[peers][pid].give('msg',{
      type: 'bye',
      rid: this[rid],
      pids: []
    });
    
    delete p[pids][this[rid]];
    delete p[rooms][this[rid]];
    delete this[peers][pid];
    
    broadcast(this,{
      type: 'bye',
      rid: this[rid],
      pids: [pid]
    });
    
    if(!--this[total]) this[emitter].set('empty');
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
  
  if(!msg) return;
  
  if(msg.rid){
    room = ep[rooms][msg.rid];
    if(!room) return;
    
    msg.from = ep[pids][msg.rid];
    
    if(msg.to == 'all') return broadcast(room,msg,msg.from);
    
    if(!room[peers][msg.to]) return;
    room[peers][msg.to].give('msg',msg);
    
  }else if(msg.type == 'msg') ep[emitter].give('msg',msg.data);
  else serverPlugins.give(msg.type,[msg.data,ep[emitter]]);
  
}

function onceClosed(e,cbc,ep){
  ep[emitter].set('closed');
}


