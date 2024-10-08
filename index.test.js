/*eslint-env node,es2022 */

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

  it('404s on short/fake looking digests', async () => {
    expect(handler(event('/1234/some-guid/css/file.mp3')).statusCode).toEqual(404);
    expect(handler(event('/1234/some-guid/admin/file.mp3')).statusCode).toEqual(404);

    const event1 = event('/1234/some-guid/more-than-twenty-chars/file.mp3');
    expect(handler(event1)).toEqual(event1.request);
  });

  it('allows non-expiring digest links through', async () => {
    const event1 = event('/1234/some-guid/some-digest/file.mp3');
    expect(handler(event1)).toEqual(event1.request);

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3');
    expect(handler(event2)).toEqual(event2.request);

    const event3 = event('/use1-whatev/1234/some-guid/some-digest/file.mp3');
    expect(handler(event3)).toEqual(event3.request);

    const event4 = event('/use1-whatev/1234/adfree/some-guid/some-digest/file.mp3');
    expect(handler(event4)).toEqual(event4.request);
  });

  it('allows non-expired links through', async () => {
    const exp = { value: now + 10 };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event1)).toEqual(event1.request);

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event2)).toEqual(event2.request);

    const event3 = event('/use1-whatev/1234/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event3)).toEqual(event3.request);

    const event4 = event('/use1-whatev/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event4)).toEqual(event4.request);
  });

  it('redirects expired links', async () => {
    const exp = { value: now - 10 };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event1).statusCode).toEqual(302);
    expect(handler(event1).headers.location.value).toEqual(
      'https://dovetail.test/1234/some-guid/file.mp3'
    );

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event2).statusCode).toEqual(302);
    expect(handler(event2).headers.location.value).toEqual(
      'https://dovetail.test/1234/adfree/some-guid/file.mp3'
    );

    const event3 = event('/use1-whatev/1234/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event3).statusCode).toEqual(302);
    expect(handler(event3).headers.location.value).toEqual(
      'https://dovetail.test/1234/some-guid/file.mp3'
    );

    const event4 = event('/use1-whatev/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    expect(handler(event4).statusCode).toEqual(302);
    expect(handler(event4).headers.location.value).toEqual(
      'https://dovetail.test/1234/adfree/some-guid/file.mp3'
    );
  });

  it('preserves auth on expired links', async () => {
    const exp = { value: now - 10 };
    const auth = { value: 'my-auth-token' };

    const event1 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp, auth });
    expect(handler(event1).statusCode).toEqual(302);
    expect(handler(event1).headers.location.value).toEqual(
      'https://dovetail.test/1234/adfree/some-guid/file.mp3?auth=my-auth-token'
    );
  });

  it('removes filenames, feed-ids, and regions from uris', async () => {
    const exp = { value: now + 10 };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp });
    const result1 = handler(JSON.parse(JSON.stringify(event1)));
    expect(result1.uri).toEqual('/1234/some-guid/some-digest');

    const event2 = event('/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    const result2 = handler(JSON.parse(JSON.stringify(event2)));
    expect(result2.uri).toEqual('/1234/some-guid/some-digest');

    const event3 = event('/use1-whatev/1234/some-guid/some-digest/file.mp3', { exp });
    const result3 = handler(JSON.parse(JSON.stringify(event3)));
    expect(result3.uri).toEqual('/1234/some-guid/some-digest');

    const event4 = event('/use1-whatev/1234/adfree/some-guid/some-digest/file.mp3', { exp });
    const result4 = handler(JSON.parse(JSON.stringify(event4)));
    expect(result4.uri).toEqual('/1234/some-guid/some-digest');
  });

  it('forces cache-misses and restitching the arrangement', async () => {
    const exp = { value: now + 10 };
    const force = { value: '1' };

    const event1 = event('/1234/some-guid/some-digest/file.mp3', { exp, force });
    const result1 = handler(JSON.parse(JSON.stringify(event1)));
    expect(result1.uri).toMatch('/1234/some-guid/some-digest/force-');
    expect(result1.uri).toMatch(/force-[0-9]+/);
  });

  it('404s on bad looking transcode paths', async () => {
    expect(handler(event('/t')).statusCode).toEqual(404);
    expect(handler(event('/t/path')).statusCode).toEqual(404);
    expect(handler(event('/t/some/path')).statusCode).toEqual(404);
  });

  it('allows transcode links through', async () => {
    const event5 = event('/t/some.domain.com/test.wav/72.1.16000.mp4');
    expect(handler(event5)).toEqual(event5.request);

    const event6 = event('/t/a/up/guid1/test.wav/72.1.16000.mp4');
    expect(handler(event6)).toEqual(event6.request);

    const event7 = event('/t/a/up/p1/p2/guid1/test.wav/72.1.16000.mp4');
    expect(handler(event7)).toEqual(event7.request);

    const event8 = event('/t/some.com/p1/p2/p3/p4/test.wav/72.1.16000.mp4');
    expect(handler(event8)).toEqual(event8.request);
  });
});
