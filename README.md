# iku hub

## Sample usage

### Server

```javascript
var Server = require('iku-hub/server'),
    WsPm = require('i-pm/ws'),
    
    Room = Server.Room,
    server = require('http').createServer().listen(8080),
    
    hub = new Server(WsPm(server,'.hub')),
    room = new Room();

hub.walk(function*(){
  var client;
  
  while(true){
    client = yield this.until('client');
    room.add(client);
  }
  
});

```

### Client

```javascript
var Client = require('iku-hub/client'),
    WsP = require('i-peer/ws'),
    
    hub = new Client(WsP('ws://localhost:8080/.hub/'));

hub.walk(function*(){
  var room = yield this.until('room');
  
  room.walk(function* cb(){
    var peer = yield this.until('peer');
    
    this.walk(cb);
    peer.send('hi');
    
    peer.walk(function* cb(){
      var msg = yield this.until('msg');
      
      this.walk(cb);
      console.log(msg); // hi
    });
    
  });
  
});
```
