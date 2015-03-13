var pair = require('y-callback/pair'),
    prefix = require('u-proto/prefix');

exports.Pc = global[prefix]('RTCPeerConnection');
exports.Ice = global[prefix]('RTCIceCandidate');
exports.Sd = global[prefix]('RTCSessionDescription');

exports.PcOpts=
{
  iceServers: [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'},
    {urls: 'stun:stun2.l.google.com:19302'},
    {urls: 'stun:stun3.l.google.com:19302'},
    {urls: 'stun:stun4.l.google.com:19302'},
    {
      urls: 'turn:192.158.29.39:3478?transport=udp',
      credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
      username: '28224511:1379330808'
    },
    {
      urls: 'turn:192.158.29.39:3478?transport=tcp',
      credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
      username: '28224511:1379330808'
    }
  ]
};

(function(){
  var i;
  
  for(i = 0;i < exports.PcOpts.iceServers.length;i++){
    exports.PcOpts.iceServers[i].url = exports.PcOpts.iceServers[i].urls
  }
  
})();

try{
  
  (new exports.Pc({iceServers: []})).createOffer().then(function(){},function(){});
  
  exports.offer = function(peer,opt){
    return peer.createOffer(opt);
  };
  
  exports.answer = function(peer){
    return peer.createAnswer();
  };
  
  exports.local = function(peer,sd){
    return peer.setLocalDescription(sd);
  };
  
  exports.remote = function(peer,sd){
    return peer.setRemoteDescription(sd);
  };
  
  exports.ice = function(peer,ice){
    return peer.addIceCandidate(ice);
  };
  
}catch(e){
  
  exports.offer = function(peer,opt){
    var p = pair();
    
    peer.createOffer(p[0],p[1]);
    return p;
  };
  
  exports.answer = function(peer){
    var p = pair();
    
    peer.createAnswer(p[0],p[1]);
    return p;
  };
  
  exports.local = function(peer,sd){
    var p = pair();
    
    peer.setLocalDescription(sd,p[0],p[1]);
    return p;
  };
  
  exports.remote = function(peer,sd){
    var p = pair();
    
    peer.setRemoteDescription(sd,p[0],p[1]);
    return p;
  };
  
  exports.ice = function(peer,ice){
    var p = pair();
    
    peer.addIceCandidate(ice,p[0],p[1]);
    return p;
  };
  
}

