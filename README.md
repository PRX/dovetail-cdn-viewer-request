# Dovetail CDN Viewer Request

[CloudFront Function](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
to verify and normalize all requests to the [Dovetail CDN](https://github.com/PRX/Infrastructure/tree/main/cdn/dovetail-cdn).

This function is tied to the CloudFront `viewer-request` event, verifies the
request, redirects old/expired urls, and normalizes the requested paths.

![image](https://user-images.githubusercontent.com/1410587/121265887-cb73eb80-c876-11eb-8cd8-7292da09208c.png)

## Configuration

As this is a CloudFront Function, you must hardcode everything instead of any
configurations. That said, we use a [Custom::CodeFetcher](https://github.com/PRX/Infrastructure/tree/main/cdn/dovetail-cdn) and a bit of python in CloudFormation to replace values at deploy time.

- `<EXPIRED_REDIRECT_PREFIX>` - the scheme, domain, and optional path to
  redirect requests back to if your url `?exp=` is expired.

## Usage

### Inputs

The lambda is invoked with a CloudFront Function [viewer-request event](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html#functions-event-structure-request)
_(which is **NOT** the same as an edge function viewer-request event!!!)_ of the
structure:

```js
{
  "request": {
    "method": "GET",
    "uri": "/<podcast_id>/<episode_guid>/<arrangement_digest>/filename.mp3",
    "querystring": {
      "exp": { "value": "99999999" },
      "force": { "value": "1" }
    }
  }
}
```

The `uri` may also optionally include a `<feed_id>` token, to indicate this came
from a non-default feed (such as "adfree"):

```
"uri": "/<podcast_id>/<feed_id>/<episode_guid>/<arrangement_digest>/filename.mp3"
```

AND the `uri` may also also optionally start with an `<behavior_prefix>` token,
to indicate which "stack" the Dovetail Router redirect originated from. This
will tie the CloudFront behavior + realtime-logs to that specific dovetail
stack within a region, for analytics processing. This token must start with a
lowercase character, not a number.

The `exp` is a (currently optional) epoch seconds timestamp, when this url will
no longer be valid and must be redirected back for a newer arrangement.

The `force` param optionally forces an edge-server cache miss, so we have to go
all the way down through the origin-request and arranger lambdas to restitch.

### Work

1. Check that the `uri` looks valid, and 404 right away on unknown paths.
2. Verify that the `?exp=<epoch_seconds>` param is still valid. If the url has
   expired, redirect back to `EXPIRED_REDIRECT_PREFIX` for a new redirect.
3. Normalize `uri` so that we don't make a bunch of redundant requests for the
   same `arrangement_digest`. The [dovetail-cdn-origin-request](https://github.com/PRX/dovetail-cdn-origin-request)
   expects `/<podcast_id>/<episode_guid>/<digest>` ... so rewrite to that.
4. If we're `?force`-ing, append a random `/random-<random-stuff>` string to
   the request `uri`. The CloudFront edge server will not have that full path
   cached, so the request will fall through to origin-requesting.
5. Return the rewritten request.

### Error Handling

This function is very simple, and generally should never error. But if it did,
the user would just get a 500.

## Development

Tests can only be run locally. And since this is a CloudFront Function, it's not
really modern javascript, so you can't do any real linting and your syntax is
limited. But `prettier` is installed, so at least use that!

```sh
nvm use
yarn
npm test

# lint things up before committing
npm run lint
```

## Deploying

This function's code is pulled directly from Github via our Infrastructure
[Custom::CodeFetcher](https://github.com/PRX/Infrastructure/blob/master/cdn/dovetail3-cdn.yml).
You will need to change the `Cycle` param and redeploy the stack to pick up any
code changes here.

## License

[AGPL License](https://www.gnu.org/licenses/agpl-3.0.html)
