(function() {
'use strict';

angular.module('socket-io', [])
  .provider('socket', function SocketProvider() {
    var ioHost = '';
    this.host = function (url) {
      ioHost = url;
    };

    this.$get = ["$rootScope","io", function SocketFactory($rootScope, io) {
      // when forwarding events, prefix the event name
      // TODO: allow options to change prefix
      var defaultPrefix = 'socket:',
          defaultScope = $rootScope;

      var socket = ioHost ? io.connect(ioHost) : io.connect(),
          events = {},
          that = {};

      var addCallback = function(name, callback, scope) {
        var event = events[name],
            wrappedCallback = wrapCallback(callback, scope);

        if (!event) {
          event = events[name] = [];
        }

        event.push({ callback: callback, wrapper: wrappedCallback });
          return wrappedCallback;
      };

      var removeCallback = function(name, callback) {
        var event = events[name],
            wrappedCallback;

        if (event) {
          for(var i = event.length - 1; i >= 0; i--) {
            if (event[i].callback === callback) {
              wrappedCallback = event[i].wrapper;
              event.slice(i, 1);
              break;
            }
          }
        }
        return wrappedCallback;
      };

      var removeAllCallbacks = function(name) {
        delete events[name];
      };

      var wrapCallback = function(callback, scope) {
        var wrappedCallback = angular.noop;

        if (callback) {
          wrappedCallback = function() {
            var args = arguments;
            (scope || $rootScope).$apply(function() {
              callback.apply(socket, args);
            });
          };
        }
        return wrappedCallback;
      };

      var listener = function(name, callback) {
        return {
          bindTo: function(scope) {
            if (scope != null) {
              scope.$on('$destroy', function() {
                that.removeListener(name, callback);
              });
            }
          }
        };
      };

      that = {
        on: function(name, callback) {
          socket.on(name, addCallback(name, callback));
          return listener(name, callback);
        },
        once: function(name, callback) {
          socket.once(name, addCallback(name, callback));
          return listener(name, callback);
        },
        removeListener: function(name, callback) {
          socket.removeListener(name, removeCallback(name, callback));
        },
        removeAllListeners: function(name) {
          socket.removeAllListeners(name);
          removeAllCallbacks(name);
        },
        emit: function(name, data, callback) {
          if (callback) {
            socket.emit(name, data, wrapCallback(callback));
          }
          else {
            socket.emit(name, data);
          }
        },

        // TODO: move to a provider config
        // TODO: add karma spec
        // Ported from:
        /*
        * angular-socket-io v0.3.0 https://github.com/btford/angular-socket-io
        * (c) 2014 Brian Ford http://briantford.com
        * License: MIT
        */
        // when socket.on('someEvent', fn (data) { ... }),
        // call scope.$broadcast('someEvent', data)
        forward: function (events, scope) {
          if (events instanceof Array === false) {
            events = [events];
          }
          if (!scope) {
            scope = defaultScope;
          }
          var listeners = {};
          events.forEach(function (eventName) {
            var prefixedEvent = defaultPrefix + eventName;
            //var forwardBroadcast = asyncAngularify(socket, function (data) {
            var forwardBroadcast = addCallback(eventName, function (data) {
              scope.$broadcast(prefixedEvent, data);
            }, scope);
            var l = new listener(eventName, forwardBroadcast);
            l.bindTo(scope);
            listeners[eventName] = l;
            // scope.$on('$destroy', function () {
            //   // socket.removeListener(eventName, forwardBroadcast);
            //   removeCallback(eventName, forwardBroadcast);
            // });
            socket.on(eventName, forwardBroadcast);
          });
          return listeners;
        }
      };

      return that;
    }];
})
.factory('io', function() {
    return io;
});

}());
