// Helper for the LinkedIn 3-legged OAuth flow. LinkedIn tokens expire in ~60
// days, so you re-run this a few times a year and update the secret.
//
// One-time setup at https://www.linkedin.com/developers/apps :
//   1. Create an app, associate it with the EPG Ads Company Page.
//   2. Request the products that grant posting: "Share on LinkedIn" (personal)
//      and/or "Community Management API" (Company Page).
//   3. Add an Authorized redirect URL, e.g. http://localhost:5599/callback
//   4. Put these in .env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET,
//      LINKEDIN_REDIRECT_URI, LINKEDIN_SCOPES
//
// Then:
//   node scripts/get-linkedin-token.js            # prints the URL to visit
//   node scripts/get-linkedin-token.js <code>     # exchanges code for a token
import { config } from '../src/config.js';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const REDIRECT = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5599/callback';
// Personal posting: "w_member_social openid profile". Company Page posting:
// "w_organization_social r_organization_social".
const SCOPES = process.env.LINKEDIN_SCOPES || 'w_member_social openid profile';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const code = process.argv[2];

if (!code) {
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', 'epg' + Math.random().toString(36).slice(2, 8));
  console.log('\n1. Open this URL, approve, and copy the "code" param from the redirect:\n');
  console.log(url.toString());
  console.log('\n2. Then run:  node scripts/get-linkedin-token.js <code>\n');
  process.exit(0);
}

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: REDIRECT,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
});

const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});
const data = await res.json();
if (!res.ok) {
  console.error(`Token exchange failed (HTTP ${res.status}):`, data);
  process.exit(1);
}

console.log('\nLINKEDIN_ACCESS_TOKEN =', data.access_token);
console.log('Expires in', Math.round((data.expires_in || 0) / 86400), 'days.');

// Fetch the person URN if the token carries openid/profile.
try {
  const me = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (me.ok) {
    const info = await me.json();
    console.log('LINKEDIN_AUTHOR_URN   = urn:li:person:' + info.sub, '(personal profile)');
  } else {
    console.log('For a Company Page, set LINKEDIN_AUTHOR_URN = urn:li:organization:<your org id>');
  }
} catch {}
console.log('\nAdd LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN to .env (local) and to GitHub Secrets (CI).');
