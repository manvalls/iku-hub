var Su = require('u-su'),
    unique = require('u-rand').unique,
    wrap = require('y-walk').wrap,
    
    walk = require('u-proto/walk'),
    until = require('u-proto/until'),
    
    Client = require('../../client.js'),
    rtc = require('./rtc.js'),
    
    streams = Su();

function* handleIce(peer,sid){
  var e = yield this[until]('icecandidate'),
      ice;
  
  if(!(e && e.candidate)) return;
  this[walk](handleIce,arguments);
  
  ice = {
    candidate: e.candidate.candidate,
    sdpMid: e.candidate.sdpMid,
    sdpMLineIndex: e.candidate.sdpMLineIndex
  };
  
  peer.give('rtc-stream',{
    type: 'ice',
    sid: sid,
    ice: ice
  });
  
}

function* closePc(pc){
  yield this.until('closed');
  pc.close();
}

Object.defineProperty(Client.Peer.prototype,'sendStream',{value: wrap(function*(stream,opts){
  var pc = new rtc.Pc(opts || rtc.PcOpts),
      sid = unique(),
      offer,msg;
  
  this.give('rtc-stream',{
    type: 'new',
    opt: opts,
    sid: sid
  });
  
  this[streams] = this[streams] || {};
  this[streams][sid] = pc;
  
  pc[walk](handleIce,[this,sid]);
  pc.addStream(stream);
  
  offer = yield rtc.offer(pc);
  yield rtc.local(pc,offer);
  
  msg = {
    type: offer.type,
    sdp: offer.sdp
  };
  
  this.give('rtc-stream',{
    type: 'offer',
    sid: sid,
    offer: msg
  });
  
})});

Client.plugins.walk(function* cb(){
  var args,msg,peer,emitter,pc,e,answer;
  
  args = yield this.until('rtc-stream');
  this.walk(cb);
  
  msg = args[0];
  emitter = args[1];
  peer = emitter.target;
  
  peer[streams] = peer[streams] || {};
  
  switch(msg.type){
    
    case 'new':
      if(peer[streams][msg.sid]) return;
      
      pc = peer[streams][msg.sid] = new rtc.Pc(msg.opt || rtc.PcOpts);
      pc[walk](handleIce,[peer,msg.sid]);
      emitter.target.walk(closePc,[pc]);
      
      e = yield pc[until]('addstream');
      emitter.give('stream',e.stream);
      
      break;
    
    case 'ice':
      if(!(pc = peer[streams][msg.sid])) return;
      
      rtc.ice(pc,new rtc.Ice(msg.ice));
      
      break;
    
    case 'offer':
      if(!(pc = peer[streams][msg.sid])) return;
      
      yield rtc.remote(pc,new rtc.Sd(msg.offer));
      answer = yield rtc.answer(pc);
      yield rtc.local(pc,answer);
      
      peer.give('rtc-stream',{
        type: 'answer',
        sid: msg.sid,
        answer: {
          type: answer.type,
          sdp: answer.sdp
        }
      });
      
      break;
    
    case 'answer':
      if(!(pc = peer[streams][msg.sid])) return;
      
      yield rtc.remote(pc,new rtc.Sd(msg.answer));
      
      break;
    
  }
  
});

