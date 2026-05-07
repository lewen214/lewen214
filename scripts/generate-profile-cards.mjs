import fs from "node:fs";
import path from "node:path";

const USERNAME = process.env.GITHUB_USERNAME || "lewen214";
const TOKEN = process.env.GITHUB_TOKEN || "";
const ROOT = process.cwd();
const ASSET_DIR = path.join(ROOT, "assets");

fs.mkdirSync(ASSET_DIR, { recursive: true });

const fallback = {
  contributions: 14,
  repos: 4,
  joinedYear: 2026,
  currentStreak: 1,
  longestStreak: 1,
  values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 10],
};

async function fetchGitHubData() {
  if (!TOKEN) return fallback;

  const query = `
    query($login: String!) {
      user(login: $login) {
        createdAt
        repositories(privacy: PUBLIC, ownerAffiliations: OWNER) {
          totalCount
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      "user-agent": "lewen214-profile-card-generator",
    },
    body: JSON.stringify({ query, variables: { login: USERNAME } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }

  const user = json.data.user;
  const days = user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
  const values = days.slice(-28).map((day) => day.contributionCount);
  const streaks = getStreaks(days);

  return {
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    repos: user.repositories.totalCount,
    joinedYear: new Date(user.createdAt).getUTCFullYear(),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    values,
  };
}

function getStreaks(days) {
  let longest = 0;
  let run = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].contributionCount > 0) current += 1;
    else if (current > 0) break;
  }

  return { current, longest };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[char]));
}

function linePath(values, { x, y, width, height }) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const px = x + (index * width) / Math.max(1, values.length - 1);
    const py = y + height - (value / max) * height;
    return `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
}

function areaPath(values, box) {
  const line = linePath(values, box);
  const endX = box.x + box.width;
  const baseY = box.y + box.height;
  return `${line} L${endX} ${baseY} L${box.x} ${baseY} Z`;
}

function circles(values, box) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const cx = box.x + (index * box.width) / Math.max(1, values.length - 1);
    const cy = box.y + box.height - (value / max) * box.height;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.8"/>`;
  }).join("");
}

function heroCard(data) {
  const chart = { x: 560, y: 98, width: 828, height: 240 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="430" viewBox="0 0 1500 430" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1500" y2="430" gradientUnits="userSpaceOnUse"><stop stop-color="#060815"/><stop offset="0.42" stop-color="#10243a"/><stop offset="1" stop-color="#062f3f"/></linearGradient>
    <linearGradient id="field" x1="520" y1="350" x2="1370" y2="100" gradientUnits="userSpaceOnUse"><stop stop-color="#22d3ee"/><stop offset="0.46" stop-color="#facc15"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient>
    <linearGradient id="area" x1="540" y1="330" x2="1370" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="#22d3ee" stop-opacity="0.08"/><stop offset="1" stop-color="#ff5c8a" stop-opacity="0.24"/></linearGradient>
    <filter id="glow" x="-10%" y="-35%" width="120%" height="170%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1500" height="430" rx="18" fill="url(#bg)"/>
  <rect x="38" y="38" width="1424" height="354" rx="18" fill="#050816" fill-opacity="0.42" stroke="#243b53"/>
  <text x="86" y="96" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="43" font-weight="700">${esc(USERNAME)}</text>
  <text x="86" y="132" fill="#22d3ee" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">AR Waveguide Optics · Computational Holography · Light Field Explorer</text>
  <g font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="700">
    <text x="94" y="210" fill="#f8fafc">${esc(data.contributions)} Contributions in 2026</text>
    <text x="94" y="264" fill="#f8fafc">${esc(data.repos)} Public Repos</text>
    <text x="94" y="318" fill="#f8fafc">Joined GitHub in ${esc(data.joinedYear)}</text>
  </g>
  <g fill="none" stroke-width="4"><circle cx="74" cy="202" r="15" stroke="#22d3ee"/><rect x="60" y="247" width="28" height="28" rx="4" stroke="#facc15"/><circle cx="74" cy="310" r="15" stroke="#ff5c8a"/><path d="M74 300v12l8 6" stroke="#ff5c8a" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text x="1110" y="96" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="20" font-weight="700">photon trail in the last 28 days</text>
  <g stroke="#334155" stroke-width="1">
    <line x1="560" y1="338" x2="1388" y2="338"/><line x1="560" y1="290" x2="1388" y2="290" stroke-dasharray="5 6"/><line x1="560" y1="242" x2="1388" y2="242" stroke-dasharray="5 6"/><line x1="560" y1="194" x2="1388" y2="194" stroke-dasharray="5 6"/><line x1="560" y1="146" x2="1388" y2="146" stroke-dasharray="5 6"/><line x1="560" y1="98" x2="1388" y2="98" stroke-dasharray="5 6"/>
  </g>
  <path d="${areaPath(data.values, chart)}" fill="url(#area)"/>
  <path d="${linePath(data.values, chart)}" stroke="url(#field)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  <g fill="#facc15">${circles(data.values, chart)}</g>
  <text x="548" y="368" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="16">last 28 days</text>
  <text x="1404" y="343" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15">0</text>
  <text x="1404" y="103" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15">${esc(Math.max(1, ...data.values))}</text>
</svg>`;
}

function opticsCard(data) {
  const python = Math.max(18, Math.min(54, Math.round(data.repos * 8)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="270" viewBox="0 0 900 270" fill="none">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="900" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#060815"/><stop offset="0.55" stop-color="#10243a"/><stop offset="1" stop-color="#073642"/></linearGradient></defs>
  <rect width="900" height="270" rx="16" fill="url(#bg)"/>
  <text x="58" y="54" fill="#22d3ee" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">Optical Stack by Domain</text>
  <g font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">
    <rect x="62" y="90" width="18" height="18" fill="#22d3ee"/><text x="96" y="106" fill="#f8fafc">Waveguide Optics</text>
    <rect x="62" y="128" width="18" height="18" fill="#facc15"/><text x="96" y="144" fill="#f8fafc">PVG / LC Materials</text>
    <rect x="62" y="166" width="18" height="18" fill="#ff5c8a"/><text x="96" y="182" fill="#f8fafc">RCWA / Diffraction</text>
    <rect x="62" y="204" width="18" height="18" fill="#60a5fa"/><text x="96" y="220" fill="#f8fafc">Python Simulation</text>
  </g>
  <circle cx="590" cy="146" r="82" stroke="#172033" stroke-width="44"/>
  <path d="M590 64 A82 82 0 0 1 672 146" stroke="#22d3ee" stroke-width="44"/>
  <path d="M672 146 A82 82 0 0 1 590 228" stroke="#facc15" stroke-width="44"/>
  <path d="M590 228 A82 82 0 0 1 508 146" stroke="#ff5c8a" stroke-width="44"/>
  <path d="M508 146 A82 82 0 0 1 590 64" stroke="#60a5fa" stroke-width="${python}"/>
  <circle cx="590" cy="146" r="44" fill="#060815"/>
  <text x="590" y="139" text-anchor="middle" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">AR</text>
  <text x="590" y="164" text-anchor="middle" fill="#94a3b8" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13">${esc(data.repos)} REPOS</text>
</svg>`;
}

function researchCard(data) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="270" viewBox="0 0 900 270" fill="none">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="900" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#060815"/><stop offset="0.55" stop-color="#111827"/><stop offset="1" stop-color="#10243a"/></linearGradient><linearGradient id="mark" x1="560" y1="65" x2="744" y2="205" gradientUnits="userSpaceOnUse"><stop stop-color="#22d3ee"/><stop offset="0.55" stop-color="#facc15"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient></defs>
  <rect width="900" height="270" rx="16" fill="url(#bg)"/>
  <text x="58" y="54" fill="#22d3ee" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">Research Console</text>
  <g font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18"><text x="62" y="102" fill="#facc15">01</text><text x="108" y="102" fill="#f8fafc" font-weight="700">PVG waveguide simulation</text><text x="62" y="142" fill="#22d3ee">02</text><text x="108" y="142" fill="#f8fafc" font-weight="700">RCWA and FEM modeling</text><text x="62" y="182" fill="#ff5c8a">03</text><text x="108" y="182" fill="#f8fafc" font-weight="700">Simulation-to-fabrication workflow</text><text x="62" y="222" fill="#60a5fa">04</text><text x="108" y="222" fill="#f8fafc" font-weight="700">${esc(data.contributions)} yearly photons logged</text></g>
  <circle cx="656" cy="142" r="78" fill="#0b1224" stroke="url(#mark)" stroke-width="8"/>
  <path d="M604 158 C638 116, 674 108, 710 82" stroke="url(#mark)" stroke-width="8" stroke-linecap="round"/>
  <path d="M602 178 C648 166, 694 174, 740 132" stroke="#22d3ee" stroke-width="5" stroke-linecap="round"/>
  <path d="M618 112 C646 134, 682 148, 728 160" stroke="#facc15" stroke-width="5" stroke-linecap="round"/>
  <text x="656" y="234" text-anchor="middle" fill="#94a3b8" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14">wavefront control</text>
</svg>`;
}

function streakCard(data) {
  const bars = data.values.slice(-22);
  const max = Math.max(1, ...bars);
  const rects = bars.map((value, index) => {
    const h = 8 + (value / max) * 124;
    const x = 126 + index * 32;
    const y = 220 - h;
    return `<rect x="${x}" y="${y.toFixed(1)}" width="18" height="${h.toFixed(1)}" rx="4"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="270" viewBox="0 0 900 270" fill="none">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="900" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#060815"/><stop offset="0.6" stop-color="#10243a"/><stop offset="1" stop-color="#061826"/></linearGradient><linearGradient id="bar" x1="110" y1="220" x2="810" y2="70" gradientUnits="userSpaceOnUse"><stop stop-color="#22d3ee"/><stop offset="0.52" stop-color="#facc15"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient></defs>
  <rect width="900" height="270" rx="16" fill="url(#bg)"/>
  <text x="58" y="54" fill="#22d3ee" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">Commit Pulse</text>
  <text x="58" y="92" fill="#f8fafc" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18">Current streak ${esc(data.currentStreak)} · Longest streak ${esc(data.longestStreak)}</text>
  <g stroke="#334155" stroke-width="1"><line x1="120" y1="220" x2="810" y2="220"/><line x1="120" y1="180" x2="810" y2="180" stroke-dasharray="4 5"/><line x1="120" y1="140" x2="810" y2="140" stroke-dasharray="4 5"/><line x1="120" y1="100" x2="810" y2="100" stroke-dasharray="4 5"/></g>
  <g fill="url(#bar)">${rects}</g>
  <text x="760" y="244" fill="#94a3b8" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13">last 22 days</text>
</svg>`;
}

const data = await fetchGitHubData();

fs.writeFileSync(path.join(ASSET_DIR, "hero-card.svg"), heroCard(data));
fs.writeFileSync(path.join(ASSET_DIR, "optics-card.svg"), opticsCard(data));
fs.writeFileSync(path.join(ASSET_DIR, "research-card.svg"), researchCard(data));
fs.writeFileSync(path.join(ASSET_DIR, "streak-card.svg"), streakCard(data));

console.log(`Generated profile cards for ${USERNAME}`);
