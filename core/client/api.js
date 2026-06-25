(function(global) {
  'use strict';

  const API_BASE = '/api';

  function request(method, path, data) {
    const url = API_BASE + path;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    return fetch(url, options)
      .then(function(res) {
        return res.json();
      })
      .catch(function(err) {
        console.error('[API] Request failed:', method, path, err);
        throw err;
      });
  }

  const api = {
    get: function(path) {
      return request('GET', path);
    },

    post: function(path, data) {
      return request('POST', path, data);
    },

    put: function(path, data) {
      return request('PUT', path, data);
    },

    patch: function(path, data) {
      return request('PATCH', path, data);
    },

    delete: function(path) {
      return request('DELETE', path);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CoreAPI = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
