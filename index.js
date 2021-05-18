function handler(event) {
  var DOVETAIL_HOST = '<REPLACE_DOVETAIL_HOST>';
  var request = event.request || {};
  var querystring = request.querystring || {};
  var uri = request.uri || '';

  // pass-through root/favicon
  if (['', '/', '/index.html', '/favicon.ico'].includes(uri)) {
    return request;
  }

  // just kick out invalid looking paths
  // either: /podcast_id/episode_guid/digest/filename.mp3
  //     or: /podcast_id/feed_id/episode_guid/digest/filename.mp3
  var parts = uri.split('/').filter(p => p);
  if (parts.length !== 4 && parts.length !== 5) {
    return { statusCode: 404, statusDescription: 'Not found. Like, ever.' };
  }

  // kick back expired redirects (TODO: require ?exp later on)
  if (querystring.exp) {
    var now = Math.round(Date.now() / 1000);
    if (now > parseInt(querystring.exp.value, 10)) {
      parts.splice(-2, 1); // digest is always 2nd to last
      var headers = { location: { value: `${DOVETAIL_HOST}/${parts.join('/')}` } };
      return { headers, statusCode: 302, statusDescription: 'Arrangement expired' };
    }
  }

  // TODO: check/require a signature query param (signing your path/exp/le)
  // TODO: some sort of ?force requests to re-stitch (maybe add a uuid to uri?)

  // normalize stitch requests to /<podcast_id>/<episode_guid>/<digest>
  if (parts.length === 5) {
    parts.splice(1, 1);
  }
  parts.splice(-1, 1);
  request.uri = '/' + parts.join('/');

  return request;
}
