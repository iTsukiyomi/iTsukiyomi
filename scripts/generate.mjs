import fs from "fs";
import path from "path";
const cfg = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const OUT = "assets";
const TOKEN = process.env.GITHUB_TOKEN;
const MOCK = process.env.MOCK === "1";
const esc = (s = "") => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cut = (s = "", n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const k = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n));

// ---------- fonts (embedded so they work inside <img> SVGs) ----------
let fontCss = "";
try {
  const p = path.resolve("node_modules/@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2");
  fontCss = `@font-face{font-family:'Silkscreen';src:url(data:font/woff2;base64,${fs.readFileSync(p).toString("base64")}) format('woff2');}`;
} catch { console.warn("pixel font not found, using fallback"); }
const PX = "Silkscreen,'Courier New',monospace";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// ---------- data ----------
async function gql(query, variables) {
  const r = await fetch("https://api.github.com/graphql", { method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }) });
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data.user;
}
async function load() {
  if (MOCK) {
    const days = Array.from({ length: 371 }, (_, i) => ({ date: new Date(Date.now() - (370 - i) * 864e5).toISOString().slice(0, 10), contributionCount: Math.random() < .6 ? Math.floor(Math.random() * 9) : 0 }));
    return { user: { name: "Meet Rathod", bio: "BSc IT student building compilers, bots and tools.", location: "India", avatarUrl: "", followers: { totalCount: 12 }, repositories: { totalCount: 30, nodes: [{ stargazerCount: 14, languages: { nodes: [{ name: "C++", color: "#f34b7d" }, { name: "Python", color: "#3572A5" }] } }] },
      pinnedItems: { nodes: [{ name: "ani-cli-cpp", description: "C++ port of ani-cli", stargazerCount: 12, primaryLanguage: { name: "C++", color: "#f34b7d" } }, { name: "mafioso", description: "Anime Mafia Discord bot", stargazerCount: 4, primaryLanguage: { name: "Python", color: "#3572A5" } }, { name: "pokemon-duel", description: "Discord Pokémon battle bot", stargazerCount: 3, primaryLanguage: { name: "Python", color: "#3572A5" } }, { name: "portfolio", description: "OS-style portfolio", stargazerCount: 1, primaryLanguage: { name: "JavaScript", color: "#f1e05a" } }] },
      contributionsCollection: { totalCommitContributions: 420, totalPullRequestContributions: 9, contributionCalendar: { totalContributions: 900, weeks: Array.from({ length: 53 }, (_, w) => ({ contributionDays: days.slice(w * 7, w * 7 + 7) })) } } },
      commits: [["ani-cli-cpp", "a1b2c3d", "add TUI search"], ["mafioso", "d4e5f6a", "roles: add detective"], ["pokemon-duel", "9f8e7d6", "fix AI move scoring"]], weather: "clear" };
  }
  const user = await gql(`query($login:String!){user(login:$login){name bio location avatarUrl followers{totalCount}
    repositories(first:100,ownerAffiliations:OWNER,isFork:false,orderBy:{field:PUSHED_AT,direction:DESC}){totalCount nodes{stargazerCount languages(first:3,orderBy:{field:SIZE,direction:DESC}){nodes{name color}}}}
    pinnedItems(first:4,types:REPOSITORY){nodes{... on Repository{name description stargazerCount primaryLanguage{name color}}}}
    contributionsCollection{totalCommitContributions totalPullRequestContributions contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}}}`, { login: cfg.login });
  const h = { Authorization: `bearer ${TOKEN}`, "User-Agent": "profile-readme" };
  const ev = await (await fetch(`https://api.github.com/users/${cfg.login}/events/public?per_page=50`, { headers: h })).json();
  const commits = [];
  for (const e of Array.isArray(ev) ? ev : []) if (e.type === "PushEvent") for (const c of [...(e.payload.commits || [])].reverse())
    if (commits.length < 12) commits.push([e.repo.name.split("/")[1], c.sha.slice(0, 7), c.message.split("\n")[0]]);
  if (commits.length < 10) try {
    const repos = await (await fetch(`https://api.github.com/users/${cfg.login}/repos?sort=pushed&per_page=6`, { headers: h })).json();
    for (const r of Array.isArray(repos) ? repos : []) {
      const cs = await (await fetch(`https://api.github.com/repos/${r.full_name}/commits?author=${cfg.login}&per_page=5`, { headers: h })).json();
      for (const c of Array.isArray(cs) ? cs : []) { const sha = c.sha.slice(0, 7);
        if (commits.length < 12 && !commits.some(x => x[1] === sha)) commits.push([r.name, sha, c.commit.message.split("\n")[0]]); }
    }
  } catch {}
  let weather = null;
  if (cfg.weather.enabled) try {
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cfg.weather.lat}&longitude=${cfg.weather.lon}&current=weather_code`)).json();
    const c = w.current.weather_code; weather = c >= 51 ? "rain" : c >= 1 ? "cloud" : "clear";
  } catch {}
  return { user, commits, weather };
}

// ---------- helpers ----------
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function identicon(name, x, y, size = 56) {
  let h = hash(name), out = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="6" fill="#16304f"/>`;
  const cell = (size - 12) / 5;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const on = (h >> (r * 3 + c)) & 1;
    if (!on) continue; for (const cc of c === 2 ? [2] : [c, 4 - c])
      out += `<rect x="${x + 6 + cc * cell}" y="${y + 6 + r * cell}" width="${cell}" height="${cell}" fill="#3b82f6"/>`; }
  return out;
}
function streaks(weeks) {
  const days = weeks.flatMap(w => w.contributionDays); let best = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; best = Math.max(best, run); }
  let cur = 0, i = days.length - 1; if (days[i] && days[i].contributionCount === 0) i--;
  for (; i >= 0 && days[i].contributionCount > 0; i--) cur++;
  return { best, cur, days };
}
const svg = (w, h, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${fontCss}.px{font-family:${PX}}.mono{font-family:${MONO}}${extra}</style>${body}</svg>`;

// ---------- banner ----------
function banner(d) {
  const { user, commits, weather } = d;
  const W = 860, H = 420, LH = 13, shown = commits.length ? commits : null;
  const lines = shown ? shown.map(([r, s, m]) => `${s} ${cut(r + ": " + m, 46)}`) : ["no recent public commits"];
  while (lines.length < 6) lines.push("");
  lines.push("");
  const loop = lines.length * LH, scroll = true;
  const list = (off) => lines.map((l, i) => `<text x="0" y="${off + i * LH}" fill="#4ade80" font-size="9" class="mono">${esc(l)}</text>`).join("");
  const langs = [...new Map(user.repositories.nodes.flatMap(r => r.languages.nodes).map(l => [l.name, l.color])).entries()].slice(0, 6);
  const books = langs.map(([n, c], i) => `<rect x="${620 + i * 17}" y="${118 - (i % 3) * 5}" width="14" height="${34 + (i % 3) * 5}" fill="${c || "#888"}"><title>${esc(n)}</title></rect>`).join("");
  const stars = [[60, 55], [110, 80], [170, 50], [190, 120], [80, 130], [140, 105]].map(([x, y], i) =>
    `<rect x="${x}" y="${y}" width="3" height="3" fill="#fff"><animate attributeName="opacity" values="1;.2;1" dur="${2 + i * .6}s" repeatCount="indefinite"/></rect>`).join("");
  const rain = weather === "rain" ? Array.from({ length: 10 }, (_, i) => `<rect x="${48 + i * 18}" y="40" width="2" height="9" fill="#7fb4ff"><animate attributeName="y" values="40;150" dur="${.6 + (i % 4) * .15}s" repeatCount="indefinite"/></rect>`).join("") : "";
  const sky = weather === "clear" ? `<circle cx="190" cy="62" r="12" fill="#f5e6a0" opacity=".9"/>` : "";
  const body = `
  <defs><clipPath id="scr"><rect x="290" y="198" width="300" height="82"/></clipPath>
  <clipPath id="win"><rect x="42" y="42" width="176" height="126"/></clipPath></defs>
  <rect width="${W}" height="${H}" rx="14" fill="#141a2e"/>
  ${Array.from({ length: 22 }, (_, i) => `<rect x="${i * 40}" y="0" width="20" height="330" fill="#fff" opacity=".02"/>`).join("")}
  <rect y="330" width="${W}" height="90" fill="#6b4226"/>
  ${Array.from({ length: 6 }, (_, i) => `<rect y="${338 + i * 14}" width="${W}" height="2" fill="#4b2d18"/>`).join("")}
  <rect x="30" y="30" width="200" height="150" fill="#3a2a1c"/><g clip-path="url(#win)"><rect x="42" y="42" width="176" height="126" fill="#0b1a3d"/>${stars}${sky}${rain}</g>
  <rect x="127" y="42" width="6" height="126" fill="#3a2a1c"/><rect x="42" y="102" width="176" height="6" fill="#3a2a1c"/>
  <rect x="30" y="180" width="200" height="8" fill="#5a3b22"/>
  <rect x="300" y="26" width="260" height="46" rx="3" fill="#f3e6c8" stroke="#2b2118" stroke-width="3"/>
  <text x="430" y="58" text-anchor="middle" font-size="22" fill="#2b2118" class="px">${esc(cfg.displayName)}</text>
  <circle cx="760" cy="62" r="24" fill="#f3e6c8" stroke="#2b2118" stroke-width="3"/>
  <line x1="760" y1="62" x2="760" y2="46" stroke="#2b2118" stroke-width="3"><animateTransform attributeName="transform" type="rotate" from="0 760 62" to="360 760 62" dur="60s" repeatCount="indefinite"/></line>
  <line x1="760" y1="62" x2="772" y2="62" stroke="#2b2118" stroke-width="3"><animateTransform attributeName="transform" type="rotate" from="0 760 62" to="360 760 62" dur="720s" repeatCount="indefinite"/></line>
  <rect x="610" y="152" width="140" height="8" fill="#5a3b22"/>${books}
  <rect x="610" y="228" width="140" height="8" fill="#5a3b22"/><rect x="622" y="214" width="8" height="14" fill="#e8b923"/><rect x="640" y="210" width="8" height="18" fill="#e8b923"/><rect x="658" y="214" width="8" height="14" fill="#e8b923"/>
  <rect x="280" y="188" width="320" height="100" rx="4" fill="#232a3a" stroke="#3b4458" stroke-width="4"/>
  <rect x="290" y="198" width="300" height="82" fill="#081027"/>
  <g clip-path="url(#scr)"><g transform="translate(298,214)">${list(0)}${list(loop)}
    <animateTransform attributeName="transform" type="translate" from="298 214" to="298 ${214 - loop}" dur="${lines.length * 2.6}s" repeatCount="indefinite"/></g></g>
  <rect x="428" y="288" width="24" height="22" fill="#2a3144"/><rect x="400" y="306" width="80" height="6" fill="#2a3144"/>
  <rect x="150" y="300" width="470" height="12" fill="#7a4a28"/><rect x="170" y="312" width="12" height="18" fill="#5a3418"/><rect x="590" y="312" width="12" height="18" fill="#5a3418"/>
  <rect x="640" y="296" width="16" height="12" fill="#e8e4da"/>
  <circle cx="226" cy="240" r="60" fill="#ffd34d" opacity=".07"><animate attributeName="opacity" values=".05;.12;.05" dur="4s" repeatCount="indefinite"/></circle>
  <rect x="216" y="226" width="26" height="12" fill="#ffd34d"/><rect x="226" y="238" width="4" height="62" fill="#3b4458"/>
  <rect x="90" y="360" width="40" height="40" fill="#8a4f2c"/><rect x="108" y="320" width="4" height="40" fill="#2f8f3a"/>
  <rect x="88" y="326" width="22" height="8" fill="#2f8f3a"/><rect x="110" y="316" width="24" height="8" fill="#3fb34d"/><rect x="92" y="340" width="20" height="8" fill="#3fb34d"/>
  <g><rect x="690" y="350" width="70" height="22" rx="6" fill="#e8913a"/><rect x="750" y="342" width="22" height="20" rx="4" fill="#e8913a"/>
  <rect x="752" y="336" width="6" height="8" fill="#e8913a"/><rect x="766" y="336" width="6" height="8" fill="#e8913a"/><rect x="684" y="356" width="14" height="6" fill="#c97424"/>
  <animateTransform attributeName="transform" type="translate" values="0,0;0,-1.5;0,0" dur="3s" repeatCount="indefinite"/></g>
  <text x="780" y="330" fill="#9db7e6" font-size="14" class="px"><animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/>Z</text>`;
  return svg(W, H, body);
}

// ---------- about ----------
async function about(d) {
  const u = d.user; let img = "";
  if (u.avatarUrl) try { const b = Buffer.from(await (await fetch(u.avatarUrl + "&s=160")).arrayBuffer()); img = `data:image/png;base64,${b.toString("base64")}`; } catch {}
  const meta = [u.location, `${u.followers.totalCount} followers`, `${u.repositories.totalCount} repositories`].filter(Boolean).join(" · ");
  const body = `<rect x=".5" y=".5" width="859" height="139" rx="10" fill="#111823" stroke="#1f2a3a"/>
  <text x="24" y="30" fill="#4ade80" font-size="11" class="px">&gt; ABOUT</text>
  <text x="24" y="66" fill="#fff" font-size="24" font-weight="700" class="mono">${esc(u.name || cfg.login)}<animate attributeName="opacity" values="0;1" dur=".8s" fill="freeze"/></text>
  <text x="24" y="92" fill="#c9d4e5" font-size="12" class="mono">${esc(cut(u.bio || "", 90))}</text>
  <text x="24" y="118" fill="#7d8aa0" font-size="11" class="mono">${esc(meta)}</text>
  ${img ? `<rect x="747" y="19" width="94" height="94" fill="#e8dcc0" stroke="#fff" stroke-width="2"/><image href="${img}" x="751" y="23" width="86" height="86"/>` : ""}`;
  return svg(860, 140, body);
}

// ---------- stats ----------
function stats(d) {
  const u = d.user, c = u.contributionsCollection, s = streaks(c.contributionCalendar.weeks);
  const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
  const items = [[k(c.totalCommitContributions), "COMMITS (1Y)"], [k(c.totalPullRequestContributions), "PULL REQS (1Y)"], [k(stars), "STARS"], [`${s.best}D`, "BEST STREAK"]];
  const body = `<rect x=".5" y=".5" width="859" height="68" rx="8" fill="#111823" stroke="#1f2a3a"/>` + items.map(([v, l], i) =>
    `<text x="${24 + i * 210}" y="36" fill="#fff" font-size="26" class="px">${v}</text><text x="${24 + i * 210}" y="56" fill="#7d8aa0" font-size="10" class="px">${l}</text>`).join("");
  return svg(860, 70, body);
}

// ---------- projects ----------
function projects(d) {
  const nodes = d.user.pinnedItems.nodes.slice(0, 4);
  const cards = nodes.map((r, i) => {
    const x = (i % 2) * 436, y = 34 + Math.floor(i / 2) * 96, lang = r.primaryLanguage || { name: "", color: "#888" };
    return `<g transform="translate(${x},${y})"><rect x=".5" y=".5" width="423" height="86" rx="8" fill="#111823" stroke="#1f2a3a"/>
    ${identicon(r.name, 10, 12, 62)}
    <text x="86" y="26" fill="#fff" font-size="12" font-weight="700" class="mono">${esc(cut(r.name, 28))}</text>
    <text x="86" y="46" fill="#9aa7bd" font-size="10" class="mono">${esc(cut(r.description || "", 52))}</text>
    <text x="86" y="74" fill="#4ade80" font-size="12" class="mono">★ ${k(r.stargazerCount)}</text>
    <circle cx="300" cy="70" r="5" fill="${lang.color || "#888"}"/><text x="311" y="74" fill="#9aa7bd" font-size="10" class="mono">${esc(lang.name)}</text>
    <animate attributeName="opacity" values="0;1" dur="${.4 + i * .2}s" fill="freeze"/></g>`;
  }).join("");
  return svg(860, 230, `<text x="0" y="18" fill="#4ade80" font-size="13" class="px">&gt; PROJECTS</text><line x1="130" y1="14" x2="860" y2="14" stroke="#2a3a2f" stroke-dasharray="2 3"/>${cards}`);
}

// ---------- activity ----------
function activity(d) {
  const c = d.user.contributionsCollection.contributionCalendar, s = streaks(c.weeks);
  const weeks = c.weeks.slice(-26), shade = n => n === 0 ? "#162033" : n < 3 ? "#0e4429" : n < 6 ? "#006d32" : n < 10 ? "#26a641" : "#39d353";
  const cells = weeks.map((w, wi) => w.contributionDays.map((day, di) =>
    `<rect x="${wi * 16}" y="${di * 14}" width="12" height="11" fill="${shade(day.contributionCount)}"><animate attributeName="opacity" values="0;1" dur="${(.3 + wi * .03).toFixed(2)}s" fill="freeze"/></rect>`).join("")).join("");
  const side = [["CURRENT STREAK", `${s.cur} days`], ["BEST STREAK", `${s.best} days`], ["THIS YEAR", c.totalContributions.toLocaleString("en-US")]]
    .map(([l, v], i) => `<text x="560" y="${52 + i * 34}" fill="#7d8aa0" font-size="9" class="px">${l}</text><text x="560" y="${70 + i * 34}" fill="#fff" font-size="15" font-weight="700" class="mono">${v}</text>`).join("");
  return svg(860, 150, `<rect x=".5" y=".5" width="859" height="149" rx="10" fill="#111823" stroke="#1f2a3a"/><text x="24" y="30" fill="#4ade80" font-size="11" class="px">&gt; ACTIVITY</text><g transform="translate(24,42)">${cells}</g>${side}`);
}

// ---------- run ----------
const d = await load();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/banner.svg`, banner(d));
fs.writeFileSync(`${OUT}/about.svg`, await about(d));
fs.writeFileSync(`${OUT}/stats.svg`, stats(d));
fs.writeFileSync(`${OUT}/projects.svg`, projects(d));
fs.writeFileSync(`${OUT}/activity.svg`, activity(d));
const links = Object.entries(cfg.links).map(([n, u]) => `[${n}](${u})`).join(" · ");
fs.writeFileSync("README.md", `<img src="assets/banner.svg" alt="${cfg.displayName} room" width="100%"/>

${d.weather ? `The window shows the weather in ${cfg.weather.label} right now. ` : ""}The monitor scrolls my latest public commits; the shelf holds a book for each language I write.

${links}

<img src="assets/about.svg" alt="about" width="100%"/>
<img src="assets/stats.svg" alt="stats" width="100%"/>
<img src="assets/projects.svg" alt="projects" width="100%"/>
<img src="assets/activity.svg" alt="activity" width="100%"/>
`);
console.log("generated");
