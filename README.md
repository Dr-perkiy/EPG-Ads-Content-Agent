# EPG Ads Content Agent

Every week this agent picks the next local-SEO topic from `content-calendar.json`,
writes the copy with Claude, renders an 8-slide carousel, runs it through brand
guardrails, and auto-posts it to **Instagram** (as an image carousel) and
**LinkedIn** (as a native swipeable PDF document), plus stages a full article.

It reuses the proven pattern from the 3DCON social agent: Node + GitHub Actions
cron + a deterministic guardrail seatbelt + a kill switch.

## How it works

```
Monday 9am ET (GitHub Actions)
  build.js    pick topic -> generate copy -> guardrails -> render 8 PNGs + carousel.pdf -> stage in output/
  (commit output/ so Instagram can fetch the slides by public URL)
  publish.js  Instagram carousel (Graph API) + LinkedIn document post (Posts API)
  (record the run in state/posted.json so the topic is not repeated)
```

- **One fixed carousel template** (`templates/slides.js`): cover, context, 3 fixes,
  recap, CTA, end. The AI fills the copy; it never invents the layout.
- **Guardrails** (`src/guardrails.js`): a blocking violation stops the whole run
  and nothing posts. Blocks pricing, invented stats/percentages/client counts,
  stray phone/email, non-epgads.net domains, em dashes, and off-pool hashtags.
  The top-3 guarantee and the free audit ARE allowed (they are the real offer).
- **Kill switch**: create a file at `state/PAUSED` (or set repo variable
  `AGENT_ENABLED=false`) and nothing posts.

## Local use

```bash
npm install
cp .env.example .env      # fill in ANTHROPIC_API_KEY at minimum
npm test                  # offline guardrail + template self-test
npm run preview           # dry run: generate + render, publish nothing
```

Then open `output/`: `slide-1.png` ... `slide-8.png`, `carousel.pdf`,
`instagram-caption.txt`, `linkedin-post.txt`, `article.md`.

## Going live (needs your own accounts)

### 1. Instagram (Meta)
Reuse the same Meta app as your 3DCON agent, or make a new one. You need:
- `META_PAGE_ACCESS_TOKEN` (long-lived Page token; the Page must be linked to the
  EPG Ads Instagram **Business** account)
- `META_IG_USER_ID` (the IG business account id)

### 2. LinkedIn
1. Create an app at https://www.linkedin.com/developers/apps and associate it with
   the EPG Ads Company Page.
2. Request the posting product: **Community Management API** (Company Page) or
   **Share on LinkedIn** (personal profile).
3. Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`,
   `LINKEDIN_SCOPES` in `.env`, then:
   ```bash
   npm run linkedin-token          # prints the consent URL
   npm run linkedin-token <code>   # exchanges the code, prints token + URN
   ```
4. Put `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` in `.env`.
   **The token expires about every 60 days**, so re-run this and update the secret.

### 3. Verify
```bash
npm run check     # confirms tokens and shows the connected IG account
```

### 4. Deploy
- Create a **public** GitHub repo (Instagram needs public image URLs) and push.
- Add repo **Secrets**: `ANTHROPIC_API_KEY`, `META_PAGE_ACCESS_TOKEN`,
  `META_IG_USER_ID`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN`.
- Optional repo **Variables**: `AGENT_ENABLED` (default true), `IMAGE_BASE_URL`
  (only if you host images on epgads.net instead of using public raw URLs).
- Run the workflow manually first with **dry_run = true**, download the
  `carousel-*` artifact, and check the slides. When happy, let the Monday
  schedule run, or dispatch with dry_run = false.

## Editing the content

- Add or rewrite topics in `content-calendar.json`. Set `"paused": true` to skip one.
- Tune voice, claims, hashtags, and colors in `brand.json`.
- The agent rotates through every active topic before repeating any.

## Files
```
brand.json              brand voice, approved claims, hashtag pool
content-calendar.json   the weekly topic bank (your 10 hooks)
templates/slides.js     the fixed 8-slide carousel template
src/generate.js         Claude writes the copy into the slots
src/render.js           Puppeteer -> 8 PNGs + carousel.pdf
src/guardrails.js       deterministic pre-publish seatbelt
src/meta.js             Instagram carousel posting
src/linkedin.js         LinkedIn document posting
src/build.js            phase 1: generate + render + stage
src/publish.js          phase 2: post the staged files
src/index.js            local all-in-one (build then publish)
scripts/                check-setup, linkedin-token, test-guardrails
.github/workflows/      weekly cron
```
