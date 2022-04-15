function handler(event) {
  var EXPIRED_REDIRECT_PREFIX = '<EXPIRED_REDIRECT_PREFIX>';
  var request = event.request || {};
  var querystring = request.querystring || {};
  var uri = request.uri || '';

  // pass-through root/favicon
  if (['', '/', '/index.html', '/favicon.ico'].includes(uri)) {
    return request;
  }

  // paths can optionally start with a region name, for logging purposes. but
  // we can just remove it here.
  var parts = uri.split('/').filter(p => p);
  if (parts[0].match(/^[a-z]{2}-[a-z\-]+-[0-9]{1}$/)) {
    parts.shift();
  }

  // just kick out invalid looking paths
  // either: /podcast_id/episode_guid/digest/filename.mp3
  //     or: /podcast_id/feed_id/episode_guid/digest/filename.mp3
  if (parts.length !== 4 && parts.length !== 5) {
    return { statusCode: 404, statusDescription: 'Not found. Like, ever.' };
  }

  // kick back expired redirects (TODO: require ?exp later on)
  if (querystring.exp) {
    var now = Math.round(Date.now() / 1000);
    if (now > parseInt(querystring.exp.value, 10)) {
      parts.splice(-2, 1); // digest is always 2nd to last
      var headers = { location: { value: `${EXPIRED_REDIRECT_PREFIX}/${parts.join('/')}` } };
      return { headers, statusCode: 302, statusDescription: 'Arrangement expired' };
    }
  }

  // TODO: check/require a signature query param (signing your path/exp/le/force)

  // normalize stitch requests to /<podcast_id>/<episode_guid>/<digest>
  if (parts.length === 5) {
    parts.splice(1, 1);
  }
  parts.splice(-1, 1);
  request.uri = '/' + parts.join('/');

  // force restitching the arrangement by adding a random string to the url
  // TODO: REAAAALLY need to sign/secret this one somehow
  if (querystring.force) {
    request.uri += `/force-${Date.now()}`;
  }

  return request;
}
