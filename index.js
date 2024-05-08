function handler(event) {
  var request = event.request || {};
  var uri = request.uri || '';

  // pass-through root/favicon
  if (['', '/', '/index.html', '/favicon.ico'].includes(uri)) {
    return request;
  }

  // paths can optionally start with an extra string token, specifying which
  // CloudFront Behavior/Realtime-logs to use. must start with a character.
  var parts = uri.split('/').filter(p => p);
  if (parts[0].match(/^[a-z][a-z0-9\-]+$/)) {
    parts.shift();
  }

  if (parts[0] === 't') {
    return handleTranscode(request, parts);
  } else {
    return handleDigest(request, parts);
  }
}

function handleDigest(request, parts) {
  var EXPIRED_REDIRECT_PREFIX = '<EXPIRED_REDIRECT_PREFIX>';

  // just kick out invalid looking paths
  // /podcast_id/episode_guid/digest/filename.mp3
  // /podcast_id/feed_id/episode_guid/digest/filename.mp3
  if (parts.length !== 4 && parts.length !== 5) {
    return { statusCode: 404, statusDescription: 'Not found. Like, ever.' };
  }

  // kick back expired redirects (TODO: require ?exp later on)
  var querystring = request.querystring || {};
  if (querystring.exp) {
    var now = Math.round(Date.now() / 1000);
    if (now > parseInt(querystring.exp.value, 10)) {
      parts.splice(-2, 1); // digest is always 2nd to last
      var value = `${EXPIRED_REDIRECT_PREFIX}/${parts.join('/')}`;

      // preserve token auth, for private feed enclosures
      if (querystring.auth && querystring.auth.value) {
        value += `?auth=${querystring.auth.value}`;
      }

      var headers = { location: { value } };
      return { headers, statusCode: 302, statusDescription: 'Arrangement expired' };
    }
  }

  // TODO: check/require a signature query param (signing your path/exp/le/force)
  // TEMPORARY: just kick out short/fake looking digests (2nd to last)
  var digest = parts[parts.length - 2];
  if (digest.length < 20 && digest !== 'some-digest') {
    return { statusCode: 404, statusDescription: 'Not found. Like, what?' };
  }

  // normalize stitch requests to /<podcast_id>/<episode_guid>/<digest>
  if (parts.length === 5) {
    parts.splice(1, 1);
  }
  parts.splice(-1, 1);
  request.uri = '/' + parts.join('/');

  // force restitching the arrangement by adding a random string to the url
  // TODO: REAAAALLY need to sign/secret this one somehow
  var querystring = request.querystring || {};
  if (querystring.force) {
    request.uri += `/force-${Date.now()}`;
  }

  return request;
}

function handleTranscode(request, parts) {
  // just kick out invalid looking paths
  // /t/a/path/<file>/<format>.<extension>
  // /t/<host>/[<path>/]<file>/<format>.<extension>
  if (parts.length < 4) {
    return { statusCode: 404, statusDescription: 'Not found. Nope.' };
  }

  return request;
}
