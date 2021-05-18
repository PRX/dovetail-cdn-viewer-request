const fs = require('fs');
const txt = fs.readFileSync('./index.js').toString();

// functions aren't actually exported, so just replace templates and eval
eval(txt.replace('<EXPIRED_REDIRECT_PREFIX>', 'https://dovetail.test'));

describe('handler', () => {
  function event(uri = '', querystring = {}) {
    return { request: { uri, querystring, method: 'GET', headers: {} } };
  }

  // call the handler, duplicating the event so it's not mutated
  function callHandler(event) {
    return handler(JSON.parse(JSON.stringify(event)));
  }

  let now;
  beforeEach(() => (now = Math.round(Date.now() / 1000)));

  it('passes through root paths', async () => {
    expect(handler(event())).toEqual(event().request);
    expect(handler(event(''))).toEqual(event('').request);
    expect(handler(event('/'))).toEqual(event('/').request);
    expect(handler(event('/index.html'))).toEqual(event('/index.html').request);
    expect(handler(event('/favicon.ico'))).toEqual(event('/favicon.ico').request);
  });

  it('404s on bad looking paths', async () => {
    expect(handler(event('/some')).statusCode).toEqual(404);
    expect(handler(event('/some/path')).statusCode).toEqual(404);
    expect(handler(event('/some/path/here')).statusCode).toEqual(404);
  });

  it('allows non-expiring links through', async () => {
    const event1 = event('/1234/some-guid/some-digest/file.mp3');
    expect(handler(event1)).toEqual(event1.request);

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3');
    expect(handler(event2)).toEqual(event2.request);
  });

  it('allows non-expired links through', async () => {
    const exp = { value: now + 10 };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event1)).toEqual(event1.request);

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event2)).toEqual(event2.request);
  });

  it('redirects expired links', async () => {
    const exp = { value: now - 10 };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event1).statusCode).toEqual(302);
    expect(handler(event1).headers.location.value).toEqual(
      'https://dovetail.test/1234/some-guid/file.mp3',
    );

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event2).statusCode).toEqual(302);
    expect(handler(event2).headers.location.value).toEqual(
      'https://dovetail.test/1234/adfree/some-guid/file.mp3',
    );
  });

  it('removes filenames and feed-ids from uris', async () => {
    const exp = { value: now + 10 };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp });
    const result1 = handler(JSON.parse(JSON.stringify(event1)));
    expect(result1.uri).toEqual('/1234/some-guid/some-digest');

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    const result2 = handler(JSON.parse(JSON.stringify(event2)));
    expect(result2.uri).toEqual('/1234/some-guid/some-digest');
  });
});
