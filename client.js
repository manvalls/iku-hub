var Su = require('u-su'),
    Emitter = require('y-emitter'),
    
    emitter = Su(),
    peers = Su(),
    srv = Su(),
    id = Su(),
    
    Client;

// Client object

Client = module.exports = function Client(server){
  var args = [this,{},new Server(server)];
  
  Emitter.Target.call(this,emitter);
  
  server.walk(onServerReady,args);
  server.walk(onServerMsg,args);
  server.walk(onServerClose,args);
};

function* onServerReady(client,rooms,server){
  yield this.until('ready');
  client[emitter].give('server',server);
}

function closeAll(room){
  var keys = Object.keys(room[peers]),
      i,j;
  
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    room[peers][i][emitter].set('closed');
  }
}

function* onServerMsg(client,rooms,server){
  var msg = yield this.until('msg'),
      room,peer;
  
  this.walk(onServerMsg,arguments);
  
  if(msg.from && (room = rooms[msg.rid]) && (peer = room[peers][msg.from])){
    peer[emitter].give('msg',msg.data);
  }else{
    if(msg.rid){
      if(msg.peers){
        room = new Room(this,msg.rid,msg.peers);
        rooms[msg.rid] = room;
        client[emitter].give('room',room);
      }else if(msg.hi){
        room = rooms[msg.rid];
        peer = room[peers][msg.hi];
        if(!peer){
          peer = new Peer(this,msg.rid,msg.hi);
          room[peers][msg.hi] = peer;
          room[emitter].give('peer',peer);
        }
      }else if(msg.bye){
        room = rooms[msg.rid];
        peer = room[peers][msg.bye];
        if(peer){
          delete room[peers][msg.bye];
          peer[emitter].set('closed');
        }else{
          room = rooms[msg.rid];
          delete rooms[msg.rid];
          closeAll(room);
          room[emitter].set('closed');
        }
      }
    }else server[emitter].give('msg',msg.data);
  }
  
}

function* onServerClose(client,rooms,server){
  var keys,i,j,rs = [];
  
  yield this.until('close');
  server[emitter].set('closed');
  
  keys = Object.keys(rooms);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    rs.push(rooms[i]);
    delete rooms[i];
  }
  
  for(i = 0;i < rs.length;i++){
    rs[i][emitter].set('closed');
    closeAll(rs[i]);
  }
}

Client.prototype = new Emitter.Target();
Client.prototype.constructor = Client;

// Server object

function Server(server){
  Emitter.Target.call(this,emitter);
  this[srv] = server;
}

Server.prototype = new Emitter.Target();
Server.prototype.constructor = Server;

Object.defineProperties(Server.prototype,{
  
  send: {value: function(data){
    this[srv].give('msg',{data: data});
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
  this.walk(handlePeersFT,[this[peers]]);
}

function* handlePeersFT(peers){
  var keys,i,j;
  
  yield this.until('peer listened');
  
  keys = Object.keys(peers);
  for(j = 0;j < keys.length;j++){
    i = keys[j];
    this[emitter].give('peer',peers[i]);
  }
}

Room.prototype = new Emitter.Target();
Room.prototype.constructor = Room;

Object.defineProperties(Room.prototype,{
  
  send: {value: function(data){
    this[srv].give('msg',{
      to: 'all',
      rid: this[id],
      data: data
    });
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

Peer.prototype = new Emitter.Target();
Peer.prototype.constructor = Peer;

Object.defineProperties(Peer.prototype,{
  
  send: {value: function(data){
    this[srv].give('msg',{
      to: this[id].pid,
      rid: this[id].rid,
      data: data
    });
  }}
  
});


