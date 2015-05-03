var Su = require('u-su'),
    unique = require('u-rand').unique,
    wrap = require('y-walk').wrap,
    
    on = require('u-proto/on'),
    apply = require('u-proto/apply'),
    
    Client = require('../client.js'),
    rtc = require('./rtc/poly.js'),
    
    pref = '3M9E3T-F9qsz-',
    
    labels = Su(),
    pcs = Su(),
    
    offer;

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
  var label;
  
  emitter.syn('ST ','stream');
  if(this[labels] && (label = this[labels][e.stream.id])) emitter.give('ST ' + label,e.stream);
  else emitter.give('stream',e.stream);
  
}

function onDC(e,c,emitter){
  var label;
  
  emitter.syn('DC ','datachannel');
  if(e.channel.label) emitter.give('DC ' + e.channel.label,e.channel);
  else emitter.give('datachannel',e.stream);
  
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
  pc[on]('datachannel',onDC,emitter);
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

Client.peerPlugins.on(pref + 'label',function(e){
  var data = e[0],
      emitter = e[1],
      peer = emitter.target,
      pc;
  
  peer[pcs] = peer[pcs] || {};
  pc = peer[pcs][data.cid];
  if(!pc) return;
  
  pc[labels] = pc[labels] || {};
  pc[labels][data.id] = data.label;
  
});

// Utils

offer = wrap(function*(pc,that,cid){
  var offer,msg;
  
  offer = yield rtc.offer(pc);
  yield rtc.local(pc,offer);
  
  msg = {
    type: offer.type,
    sdp: offer.sdp
  };
  
  that.give(pref + 'offer',{
    cid: cid,
    offer: msg
  });
  
});

function getOpts(opts){
  var pcOpts;
  
  if(!opts) return rtc.PcOpts;
  
  delete opts.label;
  delete opts.id;
  delete opts.negotiated;
  
  pcOpts = {};
  pcOpts[apply](rtc.PcOpts);
  pcOpts[apply](opts);
}

// Streams

Object.defineProperty(Client.Peer.prototype,'sendStream',{value: function(stream,label,opts){
  var cid = unique(),
      pc,label,pcOpts;
  
  if(typeof label != 'string'){
    opts = label;
    label = null;
  }
  
  pcOpts = getOpts(opts);
  pc = new rtc.Pc(pcOpts);
  
  this.give(pref + 'new-pc',{
    opt: pcOpts,
    cid: cid
  });
  
  if(label) this.give(pref + 'label',{
    id: stream.id,
    label: label,
    cid: cid
  });
  
  this[pcs] = this[pcs] || {};
  this[pcs][cid] = pc;
  
  pc[on]('icecandidate',onIce,this,cid);
  pc.addStream(stream);
  this.once('closed',onceClosed,pc);
  
  offer(pc,this,cid);
  
}});

// DataChannels

Object.defineProperty(Client.Peer.prototype,'createDC',{value: function(label,opts){
  var cid = unique(),
      pc,label,pcOpts,dc;
  
  if(typeof label != 'string'){
    opts = label;
    label = '';
  }
  
  pcOpts = getOpts(opts);
  pc = new rtc.Pc(pcOpts);
  
  this.give(pref + 'new-pc',{
    opt: pcOpts,
    cid: cid
  });
  
  this[pcs] = this[pcs] || {};
  this[pcs][cid] = pc;
  
  pc[on]('icecandidate',onIce,this,cid);
  dc = pc.createDataChannel(label,pcOpts);
  
  this.once('closed',onceClosed,pc);
  offer(pc,this,cid);
  
  return dc;
}});

