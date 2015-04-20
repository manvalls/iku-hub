var Su = require('u-su'),
    Emitter = require('y-emitter'),
    
    rtc,
    
    emitter = Su(),
    peers = Su(),
    srv = Su(),
    id = Su(),
    
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

Client.plugins = plugins.target;
Client.peerPlugins = peerPlugins.target;
Client.serverPlugins = serverPlugins.target;

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
  var room,peer,i,pid;
  
  if(msg.from){
    room = rooms[msg.rid];
    if(!room) return;
    
    peer = room[peers][msg.from];
    if(!peer) return;
    
    if(msg.type == 'msg') peer[emitter].give('msg',msg.data);
    else peerPlugins.give(msg.type,[msg.data,peer[emitter]]);
  }else if(msg.rid) switch(msg.type){
      
    case 'hi':
      room = rooms[msg.rid];
      if(!room){
        room = new Room(this,msg.rid,msg.pids);
        rooms[msg.rid] = room;
        client[emitter].give('room',room);
        return;
      }
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        
        peer = room[peers][pid];
        if(!peer){
          peer = new Peer(this,msg.rid,pid,'in');
          room[peers][pid] = peer;
          room[emitter].give('peer',peer);
        }
      }
      
      break;
      
    case 'bye':
      
      room = rooms[msg.rid];
      if(!room) return;
      
      if(!msg.pids.length){
        delete rooms[msg.rid];
        
        closeAll(room);
        room[emitter].set('closed');
        return;
      }
      
      for(i = 0;i < msg.pids.length;i++){
        pid = msg.pids[i];
        
        peer = room[peers][pid];
        if(!peer) return;
        
        delete room[peers][pid];
        peer[emitter].set('closed');
      }
      
      break;
    
  }else{
    if(msg.type == 'msg') server[emitter].give('msg',msg.data);
    else serverPlugins.give(msg.type,[msg.data,serverPlugins]);
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
    rs[i][emitter].set('closed');
  }
  
  client[emitter].unset('server');
  server[emitter].set('closed');
  client[emitter].set('closed');
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

function Room(server,rid,ps){
  var i;
  
  Emitter.Target.call(this,emitter);
  
  this[srv] = server;
  this[id] = rid;
  this[peers] = {};
  
  for(i = 0;i < ps.length;i++) this[peers][ps[i]] = new Peer(server,rid,ps[i],'out');
  this.until('peer').listeners.change().listen(oncePeerListened,[this]);
  
  plugins.give('room',this);
}

Client.Room = Room;

function oncePeerListened(room){
  var keys,i,j;
  
  keys = Object.keys(room[peers]);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    room[emitter].give('peer',room[peers][i]);
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

function Peer(server,rid,pid,dir){
  Emitter.Target.call(this,emitter);
  
  this.direction = dir;
  
  this[srv] = server;
  this[id] = {
    rid: rid,
    pid: pid
  };
  
  plugins.give('peer',this);
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
