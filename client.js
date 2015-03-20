var Su = require('u-su'),
    Emitter = require('y-emitter'),
    
    rtc,
    
    emitter = Su(),
    peers = Su(),
    srv = Su(),
    id = Su(),
    
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
};

Client.plugins = plugins.target;

function onceServerReady(e,cbc,client,server){
  client[emitter].set('server',server);
}

function closeAll(room){
  var keys = Object.keys(room[peers]),
      i,j;
  
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    room[peers][i][emitter].set('closed');
  }
  
}

function onServerMsg(msg,cbc,client,rooms,server){
  var room,peer;
  
  if(msg.from){
    room = rooms[msg.rid];
    if(!room) return;
    
    peer = room[peers][msg.from];
    if(!peer) return;
    
    if(msg.type == 'msg') peer[emitter].give('msg',msg.data);
    else plugins.give(msg.type,[msg.data,peer[emitter]]);
  }else switch(msg.type){
    
    case 'room-hi':
      room = new Room(this,msg.rid,msg.peers);
      rooms[msg.rid] = room;
      client[emitter].give('room',room);
      break;
      
    case 'room-bye':
      room = rooms[msg.rid];
      if(!room) return;
      delete rooms[msg.rid];
      closeAll(room);
      room[emitter].set('closed');
      break;
      
    case 'hi':
      room = rooms[msg.rid];
      if(!room) return;
      peer = room[peers][msg.pid];
      if(!peer){
        peer = new Peer(this,msg.rid,msg.pid);
        room[peers][msg.pid] = peer;
        room[emitter].give('peer',peer);
      }
      break;
      
    case 'bye':
      room = rooms[msg.rid];
      if(!room) return;
      peer = room[peers][msg.pid];
      if(!peer) return;
      delete room[peers][msg.pid];
      peer[emitter].set('closed');
      break;
    
    case 'msg':
      server[emitter].give('msg',msg.data);
      break;
    
  }
  
}

function onceServerClosed(e,cbc,client,rooms,server){
  var keys,i,j,rs = [];
  
  client[emitter].unset('server');
  client[emitter].set('closed');
  server[emitter].set('closed');
  
  keys = Object.keys(rooms);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    rs.push(rooms[i]);
    delete rooms[i];
  }
  
  for(i = 0;i < rs.length;i++){
    closeAll(rs[i]);
    rs[i][emitter].set('closed');
  }
  
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
}

Server.prototype = new Emitter.Target();
Server.prototype.constructor = Server;

Object.defineProperties(Server.prototype,{
  
  send: {value: function(data){
    this[srv].give('msg',{
      type: 'msg',
      data: data
    });
  }}
  
});

// Room object

function Room(server,rid,ps){
  var i;
  
  Emitter.Target.call(this,emitter);
  
  this[srv] = server;
  this[id] = rid;
  this[peers] = {};
  
  for(i = 0;i < ps.length;i++) this[peers][ps[i]] = new Peer(server,rid,ps[i]);
  this.once('peer listened',oncePeerListened,this[peers]);
}

Client.Room = Room;

function oncePeerListened(e,c,peers){
  var keys,i,j;
  
  keys = Object.keys(peers);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    this[emitter].give('peer',peers[i]);
  }
}

Room.prototype = new Emitter.Target();
Room.prototype.constructor = Room;

Object.defineProperties(Room.prototype,{
  
  give: {value: function(type,data){
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
      result.push(this[peers]);
    }
    
    return result;
  }}
  
});

// Peer object

function Peer(server,rid,pid){
  Emitter.Target.call(this,emitter);
  
  this[srv] = server;
  this[id] = {
    rid: rid,
    pid: pid
  };
}

Client.Peer = Peer;

Peer.prototype = new Emitter.Target();
Peer.prototype.constructor = Peer;

Object.defineProperties(Peer.prototype,{
  
  give: {value: function(type,data){
    type = type.slice(0,127);
    
    this[srv].give('msg',{
      to: this[id].pid,
      rid: this[id].rid,
      
      type: type,
      data: data
    });
  }},
  
  send: {value: function(data){
    this.give('msg',data);
  }}
  
});

// Plugins

rtc = require('./client/rtc.js');
if(rtc.Pc) require('./client/rtc-stream.js');
