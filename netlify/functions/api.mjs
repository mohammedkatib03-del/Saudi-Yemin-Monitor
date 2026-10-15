// Netlify Function: proxies X recent search so your token stays private.
// Set these in Netlify > Site configuration > Environment variables:
//   X_BEARER_TOKEN    (required) your X API Bearer token
//   TEAM_PASSWORD     (optional) password typed once in the dashboard
//   DAILY_POST_BUDGET (optional) max X posts read per day, default 2000
const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-bearer,x-team', 'content-type': 'application/json' };
const friendly = (s, m) => ({
  401: 'X rejected the token. Check X_BEARER_TOKEN.',
  402: 'No X API credits. Add credits in console.x.com.',
  403: 'X denied access. Your plan may not include search.',
  429: 'Rate limited by X. It will retry on the next refresh.'
}[s] || m || 'X API error');
const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: H });
const cache = new Map();
let spent = { d: '', n: 0 };
const TTL = 10 * 60 * 1000;

export default async (req) => {
  const env = process.env;
  const u = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  const team = env.TEAM_PASSWORD || '', authed = !team || req.headers.get('x-team') === team;
  if (u.pathname === '/api/health') return out({ ok: true, env: !!env.X_BEARER_TOKEN, team: !!team, authed });
  if (u.pathname === '/api/search') {
    if (!authed) return out({ error: 'Wrong or missing team password.' }, 401);
    const tok = env.X_BEARER_TOKEN || req.headers.get('x-bearer') || '', q = (u.searchParams.get('q') || '').slice(0, 480);
    if (!tok || !q) return out({ error: !tok ? 'No X token set on the host.' : 'missing q' }, 400);
    const hit = cache.get(q);
    if (hit && Date.now() - hit.t < TTL) return out({ data: hit.v, cached: true });
    const day = new Date().toISOString().slice(0, 10), budget = +env.DAILY_POST_BUDGET || 2000;
    if (spent.d !== day) spent = { d: day, n: 0 };
    if (spent.n >= budget) return out({ error: 'Daily budget of ' + budget + ' posts reached. Raise DAILY_POST_BUDGET to continue.' }, 429);
    const x = new URL('https://api.x.com/2/tweets/search/recent');
    x.search = new URLSearchParams({
      query: q + ' -is:retweet', max_results: '20',
      'tweet.fields': 'created_at,lang,public_metrics', expansions: 'author_id', 'user.fields': 'username'
    });
    const r = await fetch(x, { headers: { Authorization: 'Bearer ' + tok } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return out({ error: friendly(r.status, j.detail || j.title) }, r.status);
    const users = {};
    (j.includes?.users || []).forEach(a => (users[a.id] = a.username));
    const v = (j.data || []).map(t => ({
      id: t.id, text: t.text, user: users[t.author_id] || '', created_at: t.created_at, lang: t.lang,
      likes: t.public_metrics?.like_count || 0, retweets: t.public_metrics?.retweet_count || 0 }));
    spent.n += v.length; cache.set(q, { t: Date.now(), v });
    return out({ data: v });
  }
  return out({ error: 'Not found' }, 404);
};

export const config = { path: ['/api/health', '/api/search'] };
