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
    
    Server;

// Room object

function Room(){
  Emitter.Target.call(this,emitter);
  
  this[rid] = unique();
  this[peers] = {};
  this[total] = 0;
}

Room.prototype = new Emitter.Target();
Room.prototype.constructor = Room;

function* handleClose(room,p){
  yield this.until('closed');
  room.remove(p);
}

Object.defineProperties(Room.prototype,{
  
  add: {value: wrap(function*(p){
    var pid,peer,msg,i,j,keys;
    
    if(p[pids][this[rid]]) return;
    
    pid = unique();
    peer = p[ip];
    
    p[pids][this[rid]] = pid;
    p[rooms][this[rid]] = this;
    
    if(!this[total]) this[emitter].unset('empty');
    this[total]++;
    
    peer.give('msg',{
      rid: this[rid],
      peers: keys = Object.keys(this[peers])
    });
    
    msg = {
      rid: this[rid],
      hi: pid
    };
    
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      this[peers][i].give('msg',msg);
    }
    
    this[peers][pid] = peer;
    peer.walk(handleClose,[this,p]);
  })},
  
  remove: {value: function(p){
    var pid = p[pids][this[rid]],
        i,j,msg;
    
    keys = Object.keys(this[peers]);
    
    msg = {
      rid: this[rid],
      bye: pid
    };
    
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      this[peers][i].give('msg',msg);
    }
    
    delete p[pids][this[rid]];
    delete p[rooms][this[rid]];
    delete this[peers][pid];
    
    if(!--this[total]) this[emitter].set('empty');
  }},
  
  send: {value: function(data){
    var keys = Object.keys(this[peers]),
        msg = {data: data},
        i,j;
    
    for(j = 0;j < keys.length;j++){
      i = keys[j];
      this[peers][i].give('msg',msg);
    }
    
  }}
  
});

// External Peer object

function Peer(internalPeer){
  Emitter.Target.call(this,emitter);
  
  this[rooms] = {};
  this[pids] = {};
  this[ip] = internalPeer;
}

Peer.prototype = new Emitter.Target();
Peer.prototype.constructor = Peer;

Object.defineProperties(Peer.prototype,{
  
  send: {value: function(data){
    this[ip].give('msg',{data: data});
  }}
  
});

// Server object

Server = module.exports = function Server(peerMachine){
  Emitter.Target.call(this,emitter);
  this.walk(squeeze,[peerMachine]);
};

Server.Room = Room;

Server.prototype = new Emitter.Target();
Server.prototype.constructor = Server;

function* squeeze(pm){
  while(true) (yield pm.until('peer')).walk(handlePeer,[this]);
};

function* handlePeer(server){
  var externalPeer = new Peer(this),
      msg,room,pid,keys;
  
  server[emitter].give('client',externalPeer);
  this.walk(spHandleClose,[externalPeer]);
  
  while(true){
    msg = yield this.until('msg');
    
    if(!msg) continue;
    
    if(msg.rid){
      room = externalPeer[rooms][msg.rid];
      if(!room) continue;
      
      msg.from = externalPeer[pids][msg.rid];
      
      if(msg.to == 'all'){
        keys = Object.keys(room[peers]);
        
        for(j = 0;j < keys.length;j++){
          i = keys[j];
          if(i != pid) room[peers][i].give('msg',msg);
        }
        
        continue;
      }
      
      if(!room[peers][msg.to]) continue;
      room[peers][msg.to].give('msg',msg);
    }else externalPeer[emitter].give('msg',msg.data);
  }
  
}

function* spHandleClose(ep){
  yield this.until('closed');
  ep[emitter].set('closed');
}

