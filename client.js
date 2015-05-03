var Su = require('u-su'),
    Emitter = require('y-emitter'),
    Resolver = require('y-resolver'),
    
    emitter = Su(),
    peers = Su(),
    room = Su(),
    hub = Su(),
    srv = Su(),
    id = Su(),
    
    conn = Su(),
    candidate = Su(),
    ping = Su(),
    queue = Su(),
    k = Su(),
    n = Su(),
    
    total = Su(),
    upgraded = Su(),
    
    petitions = Su(),
    ngid = Su(),
    
    peerPlugins = new Emitter(),
    serverPlugins = new Emitter(),
    plugins = new Emitter(),
    
    Client;

// Client object

Client = module.exports = function Client(server){
  var rooms = {},
      s = new Server(server);
  
  Emitter.Target.call(this,emitter);
  this[srv] = server;
  
  server.once('ready',onceServerReady,this,s);
  server.on('msg',onServerMsg,this,rooms,s);
  server.once('closed',onceServerClosed,this,rooms,s);
  
  plugins.give('client',this);
};

// Plugins

Client.plugins = plugins.target;
Client.peerPlugins = peerPlugins.target;
Client.serverPlugins = serverPlugins.target;

function msgHandler(e){
  var data = e[0],
      emitter = e[1];
  
  emitter.give('msg',data);
}

Client.peerPlugins.on('msg',msgHandler);
Client.serverPlugins.on('msg',msgHandler);

Client.peerPlugins.on('ping',function(e){
  var data = e[0],
      peer = e[1].target;
  
  peer.give('pong',data);
});

Client.peerPlugins.on('pong',function(e){
  var data = e[0],
      peer = e[1].target;
  
  if(!peer[ping]) return;
  if(peer[ping] != data) return;
  
  if(peer[candidate].is('ready')){
    peer[room][upgraded]++;
    peer[conn] = peer[candidate];
    peer[conn].once('closed',oncePeerClosed,peer);
  }
  
  delete peer[ping];
  delete peer[candidate];
  
  while(msg = peer[queue].unshift()) peer[conn].give('msg',msg);
});

// Callbacks

function onceServerReady(e,cbc,client,server){
  server[emitter].set('ready');
  client[emitter].set('ready');
  client[emitter].set('server',server);
}

function closeAll(room){
  var keys = Object.keys(room[peers]),
      i,j;
  
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    room[peers][i][emitter].sun('closed','ready');
  }
  
}

function oncePeerClosed(e,c,peer){
  if(peer[conn] != this) return;
  peer[room][upgraded]--;
  peer.close();
}

function onPeerMsg(msg,cbc,peer){
  
  if(msg.n > peer[n]){
    peer[emitter].sun('closed','ready');
    peer = new Peer(peer[srv],peer[id].rid,peer[id].pid,peer.direction,peer[room],msg.n);
  }
  
  if(msg.n != peer[n]) return;
  
  peerPlugins.give(msg.type,[msg.data,peer[emitter],peer[room][emitter]]);
  
}

function onServerMsg(msg,cbc,client,rooms,server){
  var room,peer,i,pid,res;
  
  if(!msg.rid) return serverPlugins.give(msg.type,[msg.data,server[emitter]]);
  
  if(msg.gid){
    
    room = rooms[msg.rid];
    if(!room) return;
    
    if(msg.pid){
      peer = room[peers][msg.pid];
      if(!peer) return;
    }else peer = room;
    
    res = peer[petitions][msg.gid];
    if(!res) return;
    
    res.accept(msg.data);
    
    return;
  }
  
  if(msg.from){
    
    room = rooms[msg.rid];
    if(!room) return;
    
    peer = room[peers][msg.from];
    if(!peer) return;
    if(msg.to == 'all') msg.n = peer[n];
    
    onPeerMsg(msg,cbc,peer);
    
    return;
  }
  
  switch(msg.type){
      
    case 'hi':
      room = rooms[msg.rid];
      if(!room){
        room = new Room(this,msg.rid,msg.pids,client);
        rooms[msg.rid] = room;
        return;
      }
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        
        peer = room[peers][pid];
        if(!peer) new Peer(this,msg.rid,pid,'in',room);
      }
      
      break;
      
    case 'bye':
      
      room = rooms[msg.rid];
      if(!room) return;
      
      if(!msg.pids.length){
        delete rooms[msg.rid];
        
        closeAll(room);
        room[emitter].sun('closed','ready');
        return;
      }
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        
        peer = room[peers][pid];
        if(!peer) return;
        
        delete room[peers][pid];
        peer[emitter].sun('closed','ready');
      }
      
      break;
    
  }
  
}

function onceServerClosed(e,cbc,client,rooms,server){
  var keys,i,j,rs = [];
  
  keys = Object.keys(rooms);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    rs.push(rooms[i]);
    delete rooms[i];
  }
  
  for(i = 0;i < rs.length;i++){
    closeAll(rs[i]);
    rs[i][emitter].sun('closed','ready');
  }
  
  client[emitter].unset('server');
  server[emitter].sun('closed','ready');
  client[emitter].sun('closed','ready');
}

Client.prototype = new Emitter.Target();
Client.prototype.constructor = Client;

Object.defineProperties(Client.prototype,{
  
  close: {value: function(){
    this[srv].set('closed');
  }}
  
});

// Server object

function Server(server){
  Emitter.Target.call(this,emitter);
  this[srv] = server;
  
  plugins.give('server',this);
}

Client.Server = Server;

Server.prototype = new Emitter.Target();
Server.prototype.constructor = Server;

Object.defineProperties(Server.prototype,{
  
  give: {value: function(type,data){
    
    this[srv].give('msg',{
      type: type,
      data: data
    });
    
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }},
  
  close: {value: function(){
    this[srv].set('closed');
  }}
  
});

// Room object

function Room(server,rid,ps,client){
  var i;
  
  Emitter.Target.call(this,emitter);
  this[emitter].set('ready');
  
  this[petitions] = {};
  this[ngid] = 0;
  
  this[total] = 0;
  this[upgraded] = 0;
  
  this[hub] = client;
  this[srv] = server;
  this[id] = rid;
  this[peers] = {};
  
  plugins.give('room',this);
  
  client[emitter].give('room',this);
  for(i = 0;i < ps.length;i++) new Peer(server,rid,ps[i],'out',this);
}

Client.Room = Room;

Room.prototype = new Emitter.Target();
Room.prototype.constructor = Room;

Object.defineProperties(Room.prototype,{
  
  hub: {get: function(){ return this[hub]; }},
  
  get: {value: function(type,data){
    var msg = {
      type: type,
      data: data,
      rid: this[id],
      gid: this[ngid] = (this[ngid] + 1)%1e15
    };
    
    this[srv].give('msg',msg);
    this[petitions][msg.gid] = new Resolver();
    
    return this[petitions][msg.gid].yielded;
  }},
  
  request: {value: function(data){
    return this.get('info',data);
  }},
  
  give: {value: function(type,data){
    var i,j,keys;
    
    if(!this[total]) return;
    
    if(this[total] == this[upgraded]){
      
      keys = Object.keys(this[peers]);
      for(j = 0;j < keys.length;j++){
        i = keys[j];
        this[peers][i].give(type,data);
      }
      
      return;
    }
    
    type = type.slice(0,127);
    this[srv].give('msg',{
      to: 'all',
      rid: this[id],
      
      type: type,
      data: data
    });
    
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }},
  
  getPeers: {value: function(){
    var result = [],
        i,j,keys;
    
    keys = Object.keys(this[peers]);
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      result.push(this[peers][i]);
    }
    
    return result;
  }},
  
  total: {get: function(){
    return this[total];
  }},
  
  upgraded: {get: function(){
    return this[upgraded];
  }}
  
});

// Peer object

function Peer(server,rid,pid,dir,rm,nv){
  
  Emitter.Target.call(this,emitter);
  this[emitter].set('ready');
  
  this.direction = dir;
  
  this[queue] = [];
  this[k] = 0;
  this[n] = nv || 0;
  
  this[petitions] = {};
  this[ngid] = 0;
  
  this[srv] = server;
  this[id] = {
    rid: rid,
    pid: pid
  };
  
  rm[total]++;
  this[room] = rm;
  rm[peers][pid] = this;
  
  this.once('closed',cleanup);
  
  plugins.give('peer',this);
  rm[emitter].give('peer',this);
  
}

Client.Peer = Peer;

Peer.prototype = new Emitter.Target();
Peer.prototype.constructor = Peer;

function cleanup(){
  
  if(this[conn]){
    this[conn].set('closed');
    delete this[conn];
  }
  
}

function onceUpPeerReady(e,c,peer){
  peer[candidate] = this;
  this.on('msg',onPeerMsg,peer);
  
  peer.give('ping',peer[ping] = peer[k] = (peer[k] + 1)%1e15);
}

Object.defineProperties(Peer.prototype,{
  
  room: {get: function(){ return this[room]; }},
  
  get: {value: function(type,data){
    var msg = {
      type: type,
      data: data,
      rid: this[id].rid,
      pid: this[id].pid,
      gid: this[ngid] = (this[ngid] + 1)%1e15
    };
    
    this[srv].give('msg',msg);
    this[petitions][msg.gid] = new Resolver();
    
    return this[petitions][msg.gid].yielded;
  }},
  
  request: {value: function(data){
    return this.get('info',data);
  }},
  
  upgrade: {value: function(peer){
    peer.once('ready',onceUpPeerReady,this);
  }},
  
  give: {value: function(type,data){
    var msg;
    
    type = type.slice(0,127);
    msg = {
      type: type,
      data: data,
      n: this[n]
    };
    
    if(this[ping] && type != 'ping' && type != 'pong'){
      this[queue].push(msg);
      return;
    }
    
    if(this[conn]){
      this[conn].give('msg',msg);
      return;
    }
    
    msg.to = this[id].pid;
    msg.rid = this[id].rid;
    
    this[srv].give('msg',msg);
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }},
  
  close: {value: function(){
    var peer;
    
    if(this.is('closed')) return;
    
    this[emitter].sun('closed','ready');
    if(this[room].isNot('closed')){
      peer = new Peer(this[srv],this[id].rid,this[id].pid,this.direction,this[room],this[n] + 1);
      peer.give('ping');
    }
    
  }},
  
  set: {value: function(event){
    if(event == 'closed') this.close();
  }}
  
});

// External plugins

(function(){
  var rtc = require('./plugins/rtc/poly.js');
  
  if(rtc.Pc) require('./plugins/rtc.js');
  require('./plugins/rtc-upgrade.js');
  
  require('./plugins/events.js');
})();

