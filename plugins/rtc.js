var Su = require('u-su'),
    unique = require('u-rand').unique,
    wrap = require('y-walk').wrap,
    
    on = require('u-proto/on'),
    
    Client = require('../client.js'),
    rtc = require('./rtc/poly.js'),
    
    pref = '3M9E3T-F9qsz-',
    
    pcs = Su();

// Callbacks

function onIce(e,c,peer,cid){
  var ice;
  
  if(!(e && e.candidate)) return;
  
  ice = {
    candidate: e.candidate.candidate,
    sdpMid: e.candidate.sdpMid,
    sdpMLineIndex: e.candidate.sdpMLineIndex
  };
  
  peer.give(pref + 'ice',{
    cid: cid,
    ice: ice
  });
  
}

function onceClosed(e,c,pc){
  pc.close();
}

function onStream(e,c,emitter){
  emitter.give('stream',e.stream);
}

Client.peerPlugins.on(pref + 'new-pc',function(e){
  var data = e[0],
      emitter = e[1],
      peer = emitter.target,
      pc;
  
  peer[pcs] = peer[pcs] || {};
  if(peer[pcs][data.cid]) return;
  
  pc = peer[pcs][data.cid] = new rtc.Pc(data.opt || rtc.PcOpts);
  pc[on]('icecandidate',onIce,peer,data.cid);
  pc[on]('addstream',onStream,emitter);
  peer.once('closed',onceClosed,pc);
  
});

Client.peerPlugins.on(pref + 'ice',function(e){
  var data = e[0],
      emitter = e[1],
      peer = emitter.target,
      pc;
  
  peer[pcs] = peer[pcs] || {};
  pc = peer[pcs][data.cid];
  if(!pc) return;
  
  rtc.ice(pc,new rtc.Ice(data.ice));
  
});

Client.peerPlugins.on(pref + 'offer',function*(e){
  var data = e[0],
      emitter = e[1],
      peer = emitter.target,
      pc;
  
  peer[pcs] = peer[pcs] || {};
  pc = peer[pcs][data.cid];
  if(!pc) return;
  
  yield rtc.remote(pc,new rtc.Sd(data.offer));
  answer = yield rtc.answer(pc);
  yield rtc.local(pc,answer);
  
  peer.give(pref + 'answer',{
    cid: data.cid,
    answer: {
      type: answer.type,
      sdp: answer.sdp
    }
  });
  
});

Client.peerPlugins.on(pref + 'answer',function(e){
  var data = e[0],
      emitter = e[1],
      peer = emitter.target,
      pc;
  
  peer[pcs] = peer[pcs] || {};
  pc = peer[pcs][data.cid];
  if(!pc) return;
  
  rtc.remote(pc,new rtc.Sd(data.answer));
  
});

// Streams

Object.defineProperty(Client.Peer.prototype,'sendStream',{value: wrap(function*(stream,opts){
  var pc = new rtc.Pc(opts || rtc.PcOpts),
      cid = unique(),
      offer,msg;
  
  this.give(pref + 'new-pc',{
    opt: opts,
    cid: cid
  });
  
  this[pcs] = this[pcs] || {};
  this[pcs][cid] = pc;
  
  pc[on]('icecandidate',onIce,this,cid);
  pc.addStream(stream);
  this.once('closed',onceClosed,pc);
  
  offer = yield rtc.offer(pc);
  yield rtc.local(pc,offer);
  
  msg = {
    type: offer.type,
    sdp: offer.sdp
  };
  
  this.give(pref + 'offer',{
    cid: cid,
    offer: msg
  });
  
})});

