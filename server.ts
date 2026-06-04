import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { AdminSettings, TeamMember, ClickLog, ConversionLog, DashboardStats, TeamStats, SubIdStats, Shortlink } from "./src/types";

const app = express();
const PORT = 3000;
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "db.json");

// Dynamic In-Memory DB
interface DatabaseSchema {
  settings: AdminSettings;
  team: TeamMember[];
  clicks: ClickLog[];
  conversions: ConversionLog[];
  shortlinks: Shortlink[];
}

let db: DatabaseSchema = {
  settings: {
    adminPassword: "admin",
    globalSmartlink: "https://cdkpbrl.tenderhusband.org/wh02r8f?s1={team_id}&cid={sub_id}",
    customDomain: ""
  },
  team: [],
  clicks: [],
  conversions: [],
  shortlinks: []
};

// Safe DB persistence
function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      const content = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(content);
      db = {
        settings: parsed.settings || db.settings,
        team: parsed.team || [],
        clicks: parsed.clicks || [],
        conversions: parsed.conversions || [],
        shortlinks: parsed.shortlinks || []
      };

      // Auto migrate from old default link or if it points to hop.lospollos.com
      if (!db.settings.globalSmartlink || db.settings.globalSmartlink.includes("hop.lospollos.com") || db.settings.globalSmartlink === "https://cdkpbrl.tenderhusband.org/wh02r8f") {
        db.settings.globalSmartlink = "https://cdkpbrl.tenderhusband.org/wh02r8f?s1={team_id}&cid={sub_id}";
        saveDatabase();
        console.log("Database Migration: globalSmartlink updated to user's new template URL with s1 & cid parameters.");
      }

      console.log("Database successfully loaded.");
    } catch (e) {
      console.error("Failed to parse existing database. Using default in-memory db instead.", e);
    }
  } else {
    saveDatabase();
    console.log("Initialization: Database file created at", DB_PATH);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save database changes to disk.", e);
  }
}

// Initial DB run
initDatabase();

// Express Middlewares
app.use(express.json());

// Helper function to extract Country from headers
function getCountryCode(req: express.Request): string {
  const headers = [
    "cf-ipcountry",
    "x-country-code",
    "x-vercel-ip-country",
    "x-appengine-country"
  ];
  for (const h of headers) {
    const val = req.headers[h];
    if (typeof val === "string" && val.length > 0) {
      return val.toUpperCase();
    }
  }
  
  // Try parsing accept-language as simple fallback
  const lang = req.headers["accept-language"];
  if (typeof lang === "string" && lang) {
    const primary = lang.split(",")[0].split("-")[1];
    if (primary && primary.length === 2) {
      return primary.toUpperCase();
    }
  }

  return "US"; // Default fallback banner
}

// Static auth verification middleware
function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized access header. Credentials required." });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    res.status(401).json({ error: "Invalid Authorization header format." });
    return;
  }

  const type = parts[0]; // "Admin" or "Team"
  const creds = parts[1]; // password or base64 / plain text username:password

  if (type === "Admin") {
    if (creds === db.settings.adminPassword) {
      (req as any).user = { role: "admin" };
      next();
      return;
    } else {
      res.status(403).json({ error: "Incorrect admin password." });
      return;
    }
  } else if (type === "Team") {
    // team format is username:password
    const [username, password] = creds.split(":");
    const found = db.team.find(t => t.username.toLowerCase() === username.toLowerCase() && t.password === password);
    if (found) {
      (req as any).user = { role: "team", username: found.username, name: found.name };
      next();
      return;
    } else {
      res.status(403).json({ error: "Incorrect team username or password." });
      return;
    }
  }

  res.status(401).json({ error: "Unsupported authentication type." });
}

// ==========================================
// 1. PUBLIC TRACKING REDIRECTION & POSTBACK
// ==========================================

/**
 * CLICK TRACKING REDIRECT ENDPOINT
 * Route: /t/:username
 * Tracks click, builds Lospollos Smartlink with tracking parameters, and redirects the target user.
 */
app.get("/t/:username", (req, res) => {
  const { username } = req.params;
  const teamMember = db.team.find(t => t.username.toLowerCase() === username.toLowerCase());

  if (!teamMember) {
    res.status(404).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
        <h2>Campaign Link Invalid</h2>
        <p>The team member campaign was not found in our database system.</p>
      </div>
    `);
    return;
  }

  // Support parameter keys: subid, s, or subid2
  const subIdVal = (req.query.subid as string) || (req.query.subid2 as string) || (req.query.s as string) || "default";

  // Log the click
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Mozilla/5.0";
  const country = getCountryCode(req);

  const click: ClickLog = {
    id: `clk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    teamId: teamMember.username,
    subId: subIdVal,
    ip,
    userAgent,
    country,
    timestamp: new Date().toISOString()
  };

  db.clicks.push(click);
  saveDatabase();

  // Construct target link based on settings
  let targetLink = db.settings.globalSmartlink || "https://hop.lospollos.com/?pid=9999&cid=9999";

  // Intelligent Wildcard mapping or Automatic parameter appending
  if (targetLink.includes("{team_id}") || targetLink.includes("{sub_id}")) {
    targetLink = targetLink
      .replace(/{team_id}/g, encodeURIComponent(teamMember.username))
      .replace(/{sub_id}/g, encodeURIComponent(subIdVal));
  } else {
    // Parse query inside the smartlink and append mapping for Lospollos
    try {
      const urlObj = new URL(targetLink);
      // Lospollos typically uses "subid" as standard tracker param, and secondary "subid2"
      urlObj.searchParams.set("subid", teamMember.username);
      urlObj.searchParams.set("subid2", subIdVal);
      targetLink = urlObj.toString();
    } catch (e) {
      // String concatenation fallback if Smartlink is formatted non-standardly
      const separator = targetLink.indexOf("?") !== -1 ? "&" : "?";
      targetLink = `${targetLink}${separator}subid=${encodeURIComponent(teamMember.username)}&subid2=${encodeURIComponent(subIdVal)}`;
    }
  }

  // Redirect client to dating network
  res.redirect(302, targetLink);
});

/**
 * SHORTLINK REDIRECT & TRACKING ENDPOINT
 * Route: /s/:code
 * Resolves shortcode, logs standard click for team member & subid, redirects.
 */
app.get("/s/:code", (req, res) => {
  const { code } = req.params;
  const link = db.shortlinks.find(s => s.code.toLowerCase() === code.trim().toLowerCase());

  if (!link) {
    res.status(404).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 100px; background: #0b1329; color: #f1f5f9; padding: 40px; border-radius: 20px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #1e293b;">
        <h2 style="color: #ef4444; font-size: 24px; margin-bottom: 10px;">Shortlink Tidak Valid</h2>
        <p style="color: #94a3b8; font-size: 14px;">Tautan pelacakan singkat ini tidak terdaftar, telah kedaluwarsa atau dihapus dari sistem tracker.</p>
      </div>
    `);
    return;
  }

  const teamMember = db.team.find(t => t.username.toLowerCase() === link.teamId.toLowerCase());
  const isTargetAdmin = link.teamId.toLowerCase() === "admin";

  if (!teamMember && !isTargetAdmin) {
    res.status(404).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 100px; background: #0b1329; color: #f1f5f9; padding: 40px; border-radius: 20px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #1e293b;">
        <h2 style="color: #ef4444; font-size: 24px; margin-bottom: 10px;">Media Buyer Tidak Ditemukan</h2>
        <p style="color: #94a3b8; font-size: 14px;">Anggota tim yang mengunggah link kampanye singkat ini tidak aktif atau tidak ditemukan pada basis data.</p>
      </div>
    `);
    return;
  }

  const linkTeamId = isTargetAdmin ? "admin" : (teamMember?.username || link.teamId);

  // Increment clicks inside the shortlink record itself
  link.clicks = (link.clicks || 0) + 1;

  // Log standard click
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Mozilla/5.0";
  const country = getCountryCode(req);

  const click: ClickLog = {
    id: `clk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    teamId: linkTeamId,
    subId: link.subId,
    ip,
    userAgent,
    country,
    timestamp: new Date().toISOString()
  };

  db.clicks.push(click);
  saveDatabase();

  // Construct target link based on settings
  let targetLink = db.settings.globalSmartlink || "https://hop.lospollos.com/?pid=9999&cid=9999";

  if (targetLink.includes("{team_id}") || targetLink.includes("{sub_id}")) {
    targetLink = targetLink
      .replace(/{team_id}/g, encodeURIComponent(linkTeamId))
      .replace(/{sub_id}/g, encodeURIComponent(link.subId));
  } else {
    // Determine the query parameters format by platform domain
    if (targetLink.includes("cdkpbrl.tenderhusband.org") || targetLink.includes("tenderhusband.org")) {
      try {
        const urlObj = new URL(targetLink);
        urlObj.searchParams.set("s1", linkTeamId);
        urlObj.searchParams.set("cid", link.subId);
        targetLink = urlObj.toString();
      } catch (e) {
        const separator = targetLink.indexOf("?") !== -1 ? "&" : "?";
        targetLink = `${targetLink}${separator}s1=${encodeURIComponent(linkTeamId)}&cid=${encodeURIComponent(link.subId)}`;
      }
    } else {
      try {
        const urlObj = new URL(targetLink);
        urlObj.searchParams.set("subid", linkTeamId);
        urlObj.searchParams.set("subid2", link.subId);
        targetLink = urlObj.toString();
      } catch (e) {
        const separator = targetLink.indexOf("?") !== -1 ? "&" : "?";
        targetLink = `${targetLink}${separator}subid=${encodeURIComponent(linkTeamId)}&subid2=${encodeURIComponent(link.subId)}`;
      }
    }
  }

  // Redirect visitor to target destination
  res.redirect(302, targetLink);
});

/**
 * CLIENT POSTBACK RECEIVER ENDPOINT (Lospollos integration)
 * Route: /api/postback
 * Expected URL called by Lospollos:
 * http://[app-url]/api/postback?subid={subid}&subid2={subid2}&payout={payout}&status={status}
 */
app.get("/api/postback", (req, res) => {
  console.log("Postback received parameters:", req.query);

  const subid = req.query.subid as string; // Team username (e.g. "alex")
  const subid2 = req.query.subid2 as string; // Sub-ID campaign (e.g. "tiktok")
  const payoutStr = req.query.payout as string; // Cash scale value (e.g. "1.80")
  const status = (req.query.status as string) || "approved";

  if (!subid) {
    res.status(400).json({ error: "Missing subid parameter identifying the team member." });
    return;
  }

  const teamMember = db.team.find(t => t.username.toLowerCase() === subid.toLowerCase());
  if (!teamMember) {
    console.warn(`Postback warning: Team member with username '${subid}' not found in DB.`);
    // Still we can accept to log or reply with warning so Lospollos doesn't drop it code-wise,
    // let's save under 'unknown' or just ignore. 
  }

  const cleanSubId = subid2 || "default";
  const payout = parseFloat(payoutStr) || 0;

  const conversion: ConversionLog = {
    id: `con_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    teamId: subid,
    subId: cleanSubId,
    payout,
    status,
    timestamp: new Date().toISOString(),
    rawParams: JSON.stringify(req.query)
  };

  db.conversions.push(conversion);
  saveDatabase();

  res.status(200).json({ status: "success", received: conversion });
});

// For POST callback formats
app.post("/api/postback", (req, res) => {
  const source = Object.keys(req.body).length ? req.body : req.query;
  console.log("Postback POST received parameters:", source);

  const subid = (source.subid || source.subId) as string;
  const subid2 = (source.subid2 || source.subId2) as string;
  const payoutStr = (source.payout || source.amount) as string;
  const status = (source.status as string) || "approved";

  if (!subid) {
    res.status(400).json({ error: "Missing subid parameter identifying the team member." });
    return;
  }

  const cleanSubId = subid2 || "default";
  const payout = parseFloat(payoutStr) || 0;

  const conversion: ConversionLog = {
    id: `con_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    teamId: subid,
    subId: cleanSubId,
    payout,
    status,
    timestamp: new Date().toISOString(),
    rawParams: JSON.stringify(source)
  };

  db.conversions.push(conversion);
  saveDatabase();

  res.status(200).json({ status: "success", received: conversion });
});


// ==========================================
// 2. MANAGEMENT PANEL API ENDPOINTS
// ==========================================

/**
 * LOGIN ENDPOINT (Dynamic role identifier)
 */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required values." });
    return;
  }

  // 1. Check if admin
  if (username.toLowerCase() === "admin") {
    if (password === db.settings.adminPassword) {
      res.json({
        role: "admin",
        username: "admin",
        name: "Administrator Panel",
        token: db.settings.adminPassword
      });
      return;
    } else {
      res.status(400).json({ error: "Incorrect administrator password." });
      return;
    }
  }

  // 2. Check if team member
  const member = db.team.find(t => t.username.toLowerCase() === username.toLowerCase() && t.password === password);
  if (member) {
    res.json({
      role: "team",
      username: member.username,
      name: member.name,
      token: `${member.username}:${member.password}`
    });
    return;
  }

  res.status(400).json({ error: "No matching account credentials found." });
});


/**
 * ADMIN: GET & POST SETTINGS
 */
app.get("/api/admin/settings", authenticateUser, (req, res) => {
  if ((req as any).user.role !== "admin") {
    res.status(403).json({ error: "Access denied limit." });
    return;
  }
  res.json({ settings: db.settings });
});

app.post("/api/admin/settings", authenticateUser, (req, res) => {
  if ((req as any).user.role !== "admin") {
    res.status(403).json({ error: "Access denied limit." });
    return;
  }

  const { adminPassword, globalSmartlink, customDomain } = req.body;

  if (adminPassword && adminPassword.trim().length > 0) {
    db.settings.adminPassword = adminPassword.trim();
  }
  if (globalSmartlink && globalSmartlink.trim().length > 0) {
    db.settings.globalSmartlink = globalSmartlink.trim();
  }
  
  db.settings.customDomain = typeof customDomain === "string" ? customDomain.trim() : "";

  saveDatabase();
  res.json({ message: "Settings saved successfully", settings: db.settings });
});

/**
 * ADMIN: TEAM MEMBERS READ / ADD / DELETE
 */
app.get("/api/admin/team", authenticateUser, (req, res) => {
  if ((req as any).user.role !== "admin") {
    res.status(403).json({ error: "Access denied limit." });
    return;
  }
  res.json({ team: db.team });
});

app.post("/api/admin/team", authenticateUser, (req, res) => {
  if ((req as any).user.role !== "admin") {
    res.status(403).json({ error: "Access denied limit." });
    return;
  }

  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    res.status(400).json({ error: "All account fields are required (username, password, display name)." });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  
  if (cleanUsername === "admin") {
    res.status(400).json({ error: "Cannot create team member with username 'admin'." });
    return;
  }

  if (db.team.some(t => t.username.toLowerCase() === cleanUsername)) {
    res.status(400).json({ error: `Username '${cleanUsername}' already registered within the database.` });
    return;
  }

  const newMember: TeamMember = {
    id: `team_${Date.now()}`,
    username: cleanUsername,
    password: password.trim(),
    name: name.trim(),
    createdAt: new Date().toISOString()
  };

  db.team.push(newMember);
  saveDatabase();

  res.json({ message: "Team member joined successfully.", member: newMember });
});

app.delete("/api/admin/team/:id", authenticateUser, (req, res) => {
  if ((req as any).user.role !== "admin") {
    res.status(403).json({ error: "Access denied limit." });
    return;
  }

  const { id } = req.params;
  const initialCount = db.team.length;
  // Filter out team
  db.team = db.team.filter(t => t.id !== id);

  if (db.team.length === initialCount) {
    res.status(404).json({ error: "Team member ID not found." });
    return;
  }

  saveDatabase();
  res.json({ message: "Team member removed successfully." });
});

/**
 * GLOBAL REALTIME DASHBOARD STATS (ADMIN-ONLY)
 */
app.get("/api/admin/stats", authenticateUser, (req, res) => {
  if ((req as any).user.role !== "admin") {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const totalClicks = db.clicks.length;
  const totalConversions = db.conversions.length;
  const totalPayout = db.conversions.reduce((acc, current) => acc + current.payout, 0);
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  const clicksToday = db.clicks.filter(c => c.timestamp.startsWith(todayStr)).length;
  const conversionsToday = db.conversions.filter(c => c.timestamp.startsWith(todayStr)).length;
  const payoutToday = db.conversions
    .filter(c => c.timestamp.startsWith(todayStr))
    .reduce((sum, item) => sum + item.payout, 0);

  const stats: DashboardStats = {
    totalClicks,
    totalConversions,
    totalPayout,
    conversionRate,
    clicksToday,
    conversionsToday,
    payoutToday
  };

  // Compile team-by-team stats
  const teamStats: TeamStats[] = db.team.map(member => {
    const memberClicks = db.clicks.filter(c => c.teamId.toLowerCase() === member.username.toLowerCase()).length;
    const memberConvs = db.conversions.filter(c => c.teamId.toLowerCase() === member.username.toLowerCase());
    const memberPayout = memberConvs.reduce((acc, curr) => acc + curr.payout, 0);
    const cr = memberClicks > 0 ? (memberConvs.length / memberClicks) * 100 : 0;

    return {
      username: member.username,
      name: member.name,
      totalClicks: memberClicks,
      totalConversions: memberConvs.length,
      totalPayout: memberPayout,
      conversionRate: cr
    };
  });

  // Latest logs
  const latestClicks = [...db.clicks].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 15);
  const latestConversions = [...db.conversions].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 15);

  res.json({
    summary: stats,
    teamLeaderboard: teamStats,
    latestClicks,
    latestConversions
  });
});

/**
 * TEAM MEMBER STATS (MEMBERS-ONLY)
 */
app.get("/api/team/stats", authenticateUser, (req, res) => {
  const user = (req as any).user;
  if (user.role !== "team") {
    res.status(403).json({ error: "Team membership context required." });
    return;
  }

  const teamUsername = user.username.toLowerCase();
  const todayStr = new Date().toISOString().split("T")[0];

  const myClicks = db.clicks.filter(c => c.teamId.toLowerCase() === teamUsername);
  const myConversions = db.conversions.filter(c => c.teamId.toLowerCase() === teamUsername);

  const totalClicksCount = myClicks.length;
  const totalConversionsCount = myConversions.length;
  const totalPayout = myConversions.reduce((acc, curr) => acc + curr.payout, 0);
  const conversionRate = totalClicksCount > 0 ? (totalConversionsCount / totalClicksCount) * 100 : 0;

  const clicksToday = myClicks.filter(c => c.timestamp.startsWith(todayStr)).length;
  const conversionsToday = myConversions.filter(c => c.timestamp.startsWith(todayStr)).length;
  const payoutToday = myConversions
    .filter(c => c.timestamp.startsWith(todayStr))
    .reduce((sum, item) => sum + item.payout, 0);

  const stats: DashboardStats = {
    totalClicks: totalClicksCount,
    totalConversions: totalConversionsCount,
    totalPayout,
    conversionRate,
    clicksToday,
    conversionsToday,
    payoutToday
  };

  // Compile sub-ID breakdown
  const subIds = new Set<string>();
  myClicks.forEach(c => { if (c.subId) subIds.add(c.subId); });
  myConversions.forEach(c => { if (c.subId) subIds.add(c.subId); });

  const subIdStats: SubIdStats[] = Array.from(subIds).map(sid => {
    const sClicks = myClicks.filter(c => c.subId === sid).length;
    const sConvs = myConversions.filter(c => c.subId === sid);
    const sPayout = sConvs.reduce((acc, curr) => acc + curr.payout, 0);
    const cr = sClicks > 0 ? (sConvs.length / sClicks) * 100 : 0;

    return {
      subId: sid,
      clicks: sClicks,
      conversions: sConvs.length,
      payout: sPayout,
      conversionRate: cr
    };
  }).sort((a,b) => b.clicks - a.clicks);

  // Latest activities
  const latestClicks = [...myClicks].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 15);
  const latestConversions = [...myConversions].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 15);

  res.json({
    summary: stats,
    subIdLeaderboard: subIdStats,
    latestClicks: latestClicks,
    latestConversions: latestConversions
  });
});


// ==========================================
// SHORTLINK MANAGER API ENDPOINTS
// ==========================================

/**
 * GET SHORTLINKS (LIST FOR TEAM MEMBER OR ALL FOR ADMIN)
 */
app.get("/api/team/shortlinks", authenticateUser, (req, res) => {
  const user = (req as any).user;
  if (user.role === "admin") {
    res.json({ shortlinks: db.shortlinks });
    return;
  }
  const userLinks = db.shortlinks.filter(s => s.teamId.toLowerCase() === user.username.toLowerCase());
  res.json({ shortlinks: userLinks });
});

/**
 * CREATE SHORTLINK (TEAM-SPECIFIC OR ON BEHALF BY ADMIN)
 */
app.post("/api/team/shortlinks", authenticateUser, (req, res) => {
  const user = (req as any).user;
  const teamId = user.role === "admin" ? req.body.teamId : user.username;
  let { subId } = req.body;

  if (!teamId) {
    res.status(400).json({ error: "Target TeamId wajib ditentukan." });
    return;
  }

  // Auto generate a premium short random subId if none is provided
  if (!subId || typeof subId !== "string" || !subId.trim()) {
    const randomChars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let generatedSub = "r";
    for (let i = 0; i < 5; i++) {
      generatedSub += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    subId = generatedSub;
  }

  const cleanSubId = subId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const cleanTeamId = teamId.trim().toLowerCase();

  // Pick unique 6-char alphanumeric key code
  let code = "";
  let attempts = 0;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (db.shortlinks.some(s => s.code === code) && attempts < 100);

  const newLink: Shortlink = {
    id: `sl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    code,
    teamId: cleanTeamId,
    subId: cleanSubId,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  db.shortlinks.push(newLink);
  saveDatabase();

  res.json({ message: "Shortlink berhasil didaftarkan!", shortlink: newLink });
});

/**
 * DELETE SHORTLINK
 */
app.delete("/api/team/shortlinks/:id", authenticateUser, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const link = db.shortlinks.find(s => s.id === id);
  if (!link) {
    res.status(404).json({ error: "Shortlink tidak ditemukan." });
    return;
  }

  // Admin can dismantle any tracker, media buyer only their own
  if (user.role !== "admin" && link.teamId.toLowerCase() !== user.username.toLowerCase()) {
    res.status(403).json({ error: "Maaf, Anda tidak dapat menghapus asset shortlink anggota tim lain." });
    return;
  }

  db.shortlinks = db.shortlinks.filter(s => s.id !== id);
  saveDatabase();

  res.json({ message: "Shortlink berhasil dihapus." });
});


// ==========================================
// 3. VITE MIDDLEWARE SETUP & SPA ROUTING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CPA Dating Link Generator platform available at http://localhost:${PORT}`);
  });
}

startServer();
