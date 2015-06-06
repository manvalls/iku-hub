var Su = require('u-su'),
    from = require('i-peer/from/dc'),
    unique = require('u-rand').unique,
    
    Client = require('../client.js'),
    rtc = require('./rtc/poly.js'),
    
    pref = '647SNi-iCEMe-',
    max = Su();

if(!rtc.Pc) Object.defineProperty(Client.Room.prototype,'enableRTC',function(n){ });
else{
  
  Client.peerPlugins.on(pref + 'label',function*(e){
    var label = e[0],
        emitter = e[1],
        peer = emitter.target,
        dc;
    
    dc = from(yield peer.until('DC ' + label));
    peer.upgrade(dc);
  });
  
  function onPeer(peer,c,room){
    var dc,label;
    
    if(peer.direction != 'out') return;
    if(room.upgraded >= room[max]) return;
    label = unique();
    
    peer.give(pref + 'label',label);
    dc = from(peer.createDC(label));
    
    peer.upgrade(dc);
  }
  
  Object.defineProperty(Client.Room.prototype,'enableRTC',{value: function(n){
    var was = max in this;
    
    if(n == null) n = Infinity;
    this[max] = n;
    if(was) return;
    
    this.on('peer',onPeer,this);
    
  }});
  
}
