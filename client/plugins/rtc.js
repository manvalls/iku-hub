var pair = require('y-callback/pair');

exports.Pc=
global.RTCPeerConnection ||
global.mozRTCPeerConnection ||
global.webkitRTCPeerConnection;

exports.Ice=
global.RTCIceCandidate ||
global.mozRTCIceCandidate ||
global.webkitRTCIceCandidate;

exports.Sd=
global.RTCSessionDescription ||
global.mozRTCSessionDescription ||
global.webkitRTCSessionDescription;

exports.PcOpts=
{
  iceServers: []
};

try{
  
  (new exports.Pc({iceServers: []})).createOffer().then(function(){},function(){});
  
  exports.offer = function(peer,opt){
    return peer.createOffer(opt);
  };
  
  exports.answer = function(peer){
    return peer.createAnswer(opt);
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

