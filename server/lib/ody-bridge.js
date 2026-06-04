// Loaded synchronously before Odysseus modules when proxied at /chat.
// Rewrites same-origin /api, /static, and SPA paths without mutating JS files.
(function () {
  var PREFIX = '/chat';
  var origin = window.location.origin;

  var SPA_ROUTES = [
    '/notes', '/calendar', '/cookbook', '/email', '/memory',
    '/gallery', '/tasks', '/library', '/login', '/backgrounds',
  ];

  function rewritePath(path) {
    if (!path) return path;
    if (path.indexOf(PREFIX + '/st/') === 0) return path;
    if (path.indexOf(PREFIX + '/s/') === 0) {
      return PREFIX + '/st/' + path.slice((PREFIX + '/s/').length);
    }
    if (path.indexOf(PREFIX + '/static/') === 0) {
      return PREFIX + '/st/' + path.slice((PREFIX + '/static/').length);
    }
    if (path.indexOf(PREFIX + '/api/') === 0) return path;
    if (path.indexOf('/static/') === 0) return PREFIX + '/st' + path.slice('/static'.length);
    if (path.indexOf('/api/') === 0) return PREFIX + path;
    for (var i = 0; i < SPA_ROUTES.length; i++) {
      var r = SPA_ROUTES[i];
      if (path === r || path.indexOf(r + '/') === 0 || path.indexOf(r + '?') === 0) {
        return PREFIX + path;
      }
    }
    return path;
  }

  function rewriteUrl(url) {
    if (!url || typeof url !== 'string') return url;

    if (url.indexOf('ws://') === 0 || url.indexOf('wss://') === 0) {
      try {
        var wu = new URL(url);
        if (wu.origin === origin || wu.host === window.location.host) {
          wu.pathname = rewritePath(wu.pathname);
          return wu.toString();
        }
      } catch (_) { /* keep original */ }
      return url;
    }

    if (url.indexOf('/') === 0) return rewritePath(url);

    if (url.indexOf(origin + '/') === 0) {
      var path = url.slice(origin.length);
      var next = rewritePath(path);
      return next === path ? url : origin + next;
    }

    return url;
  }

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string') {
      return origFetch.call(this, rewriteUrl(input), init);
    }
    if (input instanceof Request) {
      var next = rewriteUrl(input.url);
      if (next !== input.url) {
        input = new Request(next, input);
      }
    }
    return origFetch.call(this, input, init);
  };

  if (window.EventSource) {
    var OrigES = window.EventSource;
    window.EventSource = function (url, config) {
      return new OrigES(rewriteUrl(url), config);
    };
    window.EventSource.prototype = OrigES.prototype;
  }

  if (window.WebSocket) {
    var OrigWS = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      if (protocols !== undefined) return new OrigWS(rewriteUrl(url), protocols);
      return new OrigWS(rewriteUrl(url));
    };
    window.WebSocket.prototype = OrigWS.prototype;
    window.WebSocket.CONNECTING = OrigWS.CONNECTING;
    window.WebSocket.OPEN = OrigWS.OPEN;
    window.WebSocket.CLOSING = OrigWS.CLOSING;
    window.WebSocket.CLOSED = OrigWS.CLOSED;
  }

  var origOpen = window.open;
  window.open = function (url, target, features) {
    if (typeof url === 'string') url = rewriteUrl(url);
    return origOpen.call(window, url, target, features);
  };

  function patchUrlProperty(proto, prop) {
    var desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        desc.set.call(this, typeof value === 'string' ? rewriteUrl(value) : value);
      },
    });
  }

  patchUrlProperty(HTMLImageElement.prototype, 'src');
  patchUrlProperty(HTMLScriptElement.prototype, 'src');
  patchUrlProperty(HTMLLinkElement.prototype, 'href');
  patchUrlProperty(HTMLAnchorElement.prototype, 'href');
  patchUrlProperty(HTMLIFrameElement.prototype, 'src');
  patchUrlProperty(HTMLMediaElement.prototype, 'src');

  var locProto = window.Location.prototype;
  ['assign', 'replace'].forEach(function (method) {
    var orig = locProto[method];
    locProto[method] = function (url) {
      return orig.call(this, rewriteUrl(String(url)));
    };
  });

  var origPush = history.pushState.bind(history);
  var origReplace = history.replaceState.bind(history);
  history.pushState = function (state, title, url) {
    if (url != null) url = rewriteUrl(String(url));
    return origPush(state, title, url);
  };
  history.replaceState = function (state, title, url) {
    if (url != null) url = rewriteUrl(String(url));
    return origReplace(state, title, url);
  };
})();
