// Mock for server/middleware/aspektClient. Each test sets the responses it
// expects via setAspektResponse('GET', '/api/...', { status, data }).
//
// The mock matches by HTTP method + URL prefix (because routes append a
// requestId path segment per call). The first registered prefix that
// matches wins, so register the most specific first.

jest.mock('../../server/middleware/aspektClient', () => {
  const handlers = { GET: [], POST: [] };

  function find(method, url) {
    const list = handlers[method] || [];
    return list.find(h => url.startsWith(h.prefix));
  }

  function respond(method, url) {
    const h = find(method, url);
    if (!h) {
      const err = new Error(`No mock registered for ${method} ${url}`);
      err.response = { status: 404, data: { Code: 404, Msg: 'Service not found' } };
      return Promise.reject(err);
    }
    const value = typeof h.response === 'function' ? h.response(url) : h.response;
    // Mirror axios: success resolves, non-2xx that the routes still inspect
    // is returned as a resolved value (server code reads response.status/data).
    return Promise.resolve({
      status: value.status ?? 200,
      data: value.data ?? {},
    });
  }

  return {
    __mock: {
      reset() {
        handlers.GET = [];
        handlers.POST = [];
      },
      setResponse(method, prefix, response) {
        handlers[method].push({ prefix, response });
      },
    },
    get: (url) => respond('GET', url),
    post: (url) => respond('POST', url),
  };
});

const aspektClient = require('../../server/middleware/aspektClient');

function setAspektResponse(method, prefix, response) {
  aspektClient.__mock.setResponse(method, prefix, response);
}

function resetAspektMock() {
  aspektClient.__mock.reset();
}

module.exports = { setAspektResponse, resetAspektMock };
