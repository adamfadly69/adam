import { useState, useEffect, useRef, FormEvent } from "react";
import { 
  Shield, 
  Users, 
  Link as LinkIcon, 
  TrendingUp, 
  DollarSign, 
  MousePointer, 
  CheckCircle, 
  RefreshCw, 
  Copy, 
  UserPlus, 
  Trash2, 
  Settings, 
  Key, 
  Globe, 
  FileText, 
  ArrowRight, 
  Activity, 
  LogOut, 
  Layers, 
  Search, 
  Sparkles,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AdminSettings, TeamMember, ClickLog, ConversionLog, DashboardStats, TeamStats, SubIdStats, Shortlink } from "./types";

export default function App() {
  // Authentication State
  const [user, setUser] = useState<{
    role: "admin" | "team";
    username: string;
    name: string;
    token: string;
  } | null>(() => {
    const saved = localStorage.getItem("cpa_tracker_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Login Form States
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Dashboard States
  const [settings, setSettings] = useState<AdminSettings>({ adminPassword: "", globalSmartlink: "", customDomain: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  
  // Settings Change Admin Password States
  const [newAdminPasswordInput, setNewAdminPasswordInput] = useState("");
  
  // Team Member Form States
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");
  const [teamLoading, setTeamLoading] = useState(false);

  // Loaded Data States
  const [teamList, setTeamList] = useState<TeamMember[]>([]);
  const [adminStats, setAdminStats] = useState<{
    summary: DashboardStats;
    teamLeaderboard: TeamStats[];
    latestClicks: ClickLog[];
    latestConversions: ConversionLog[];
  } | null>(null);

  // Team Dashboard States
  const [teamStats, setTeamStats] = useState<{
    summary: DashboardStats;
    subIdLeaderboard: SubIdStats[];
    latestClicks: ClickLog[];
    latestConversions: ConversionLog[];
  } | null>(null);

  // Link Builder State
  const [customSubId, setCustomSubId] = useState("tiktok");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPostback, setCopiedPostback] = useState(false);

  // Shortlink Generator States
  const [shortlinks, setShortlinks] = useState<Shortlink[]>([]);
  const [shortlinkSubId, setShortlinkSubId] = useState("");
  const [shortlinkLoading, setShortlinkLoading] = useState(false);
  const [shortlinkError, setShortlinkError] = useState("");
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});

  // Search filter
  const [searchTeamQuery, setSearchTeamQuery] = useState("");
  const [searchSubIdQuery, setSearchSubIdQuery] = useState("");

  // Loading indicator for global data fetch requests
  const [dataLoading, setDataLoading] = useState(false);
  
  // Real-time notification lists for conversions
  const [activeNotifications, setActiveNotifications] = useState<string[]>([]);
  const lastConversionCountRef = useRef<number>(0);

  const getBaseUrl = () => {
    if (settings && settings.customDomain && settings.customDomain.trim().length > 0) {
      return settings.customDomain.trim().replace(/\/+$/, "");
    }
    return window.location.origin;
  };

  // Log In action Handler
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Silakan masukkan username dan password.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan verifikasi login.");
      }

      localStorage.setItem("cpa_tracker_user", JSON.stringify(data));
      setUser(data);
      setLoginUsername("");
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(err.message || "Terjadi kesalahan sambungan.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Log Out action Handler
  const handleLogout = () => {
    localStorage.removeItem("cpa_tracker_user");
    setUser(null);
    setAdminStats(null);
    setTeamStats(null);
  };

  // Retrieve Admin Settings
  const fetchAdminSettings = async () => {
    if (!user || user.role !== "admin") return;
    try {
      const res = await fetch("/api/admin/settings", {
        headers: {
          Authorization: `Admin ${user.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  // Retrieve Admin Stats
  const fetchAdminStats = async (silent = false) => {
    if (!user || user.role !== "admin") return;
    if (!silent) setDataLoading(true);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Admin ${user.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);

        // Track conversions for real-time sound/screen alerts check
        if (silent && data && data.latestConversions && data.latestConversions.length > 0) {
          const prevCount = lastConversionCountRef.current;
          const currentCount = data.summary.totalConversions;
          if (prevCount > 0 && currentCount > prevCount) {
            const difference = currentCount - prevCount;
            const newConvs = [...data.latestConversions]
              .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, difference);

            newConvs.forEach((conv: ConversionLog) => {
              triggerNotification(`🎉 Konversi Masuk! Tim: ${conv.teamId.toUpperCase()} | $${conv.payout.toFixed(2)} [${conv.subId}]`);
            });
          }
          lastConversionCountRef.current = currentCount;
        } else if (data) {
          lastConversionCountRef.current = data.summary.totalConversions;
        }
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  // Retrieve Team Members List
  const fetchTeamMembers = async () => {
    if (!user || user.role !== "admin") return;
    try {
      const res = await fetch("/api/admin/team", {
        headers: {
          Authorization: `Admin ${user.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamList(data.team);
      }
    } catch (err) {
      console.error("Error fetching team list:", err);
    }
  };

  // Retrieve Team stats
  const fetchTeamStats = async (silent = false) => {
    if (!user || user.role !== "team") return;
    if (!silent) setDataLoading(true);
    try {
      const res = await fetch("/api/team/stats", {
        headers: {
          Authorization: `Team ${user.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamStats(data);

        // Track conversions for team member-specific notification check
        if (silent && data && data.latestConversions && data.latestConversions.length > 0) {
          const prevCount = lastConversionCountRef.current;
          const currentCount = data.summary.totalConversions;
          if (prevCount > 0 && currentCount > prevCount) {
             const difference = currentCount - prevCount;
             const newConvs = [...data.latestConversions]
              .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, difference);

            newConvs.forEach((conv: ConversionLog) => {
              triggerNotification(`🔥 Leads Berhasil! Anda mendapat Komisi $${conv.payout.toFixed(2)} dari subid: ${conv.subId}`);
            });
          }
          lastConversionCountRef.current = currentCount;
        } else if (data) {
          lastConversionCountRef.current = data.summary.totalConversions;
        }
      }
    } catch (err) {
      console.error("Error fetching team member stats:", err);
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  // Alert Manager Helper
  const triggerNotification = (message: string) => {
    const notifyId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setActiveNotifications(prev => [...prev, message]);
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setActiveNotifications(prev => prev.filter(msg => msg !== message));
    }, 5000);
  };

  // Admin save Settings Action
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;

    setSettingsLoading(true);
    setSettingsMessage("");

    try {
      const bodyPayload: any = {
        globalSmartlink: settings.globalSmartlink,
        customDomain: settings.customDomain || ""
      };
      if (newAdminPasswordInput.trim().length > 0) {
        bodyPayload.adminPassword = newAdminPasswordInput.trim();
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Admin ${user.token}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        setSettingsMessage("✅ Pengaturan Smartlink & keamanan berhasil diperbarui!");
        setNewAdminPasswordInput("");
        // If password was updated, update token session so admin remains logged in
        if (bodyPayload.adminPassword) {
          const updatedUser = { ...user, token: bodyPayload.adminPassword };
          localStorage.setItem("cpa_tracker_user", JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      } else {
        setSettingsMessage(`❌ ${data.error || "Gagal memperbarui pengaturan."}`);
      }
    } catch (err) {
      setSettingsMessage("❌ Kesalahan jaringan dalam menyimpan.");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Add New Team Member Action
  const handleAddTeamMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;

    if (!newUsername.trim() || !newPassword.trim() || !newName.trim()) {
      setTeamError("Silakan isi semua data anggota tim.");
      return;
    }

    setTeamLoading(true);
    setTeamError("");
    setTeamSuccess("");

    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Admin ${user.token}`,
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          name: newName.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTeamSuccess(`✅ Akun ID Tim '${data.member.username}' berhasil dibuat!`);
        setNewUsername("");
        setNewPassword("");
        setNewName("");
        fetchTeamMembers(); // reload lists
        fetchAdminStats(); // reload aggregated stats structures
      } else {
        setTeamError(data.error || "Gagal membuat ID tim baru.");
      }
    } catch (err) {
      setTeamError("Gagal menyambung ke server.");
    } finally {
      setTeamLoading(false);
    }
  };

  // Delete Team Member action
  const handleDeleteTeam = async (id: string, name: string) => {
    if (!user || user.role !== "admin") return;
    if (!confirm(`Apakah Anda yakin ingin menghapus anggota tim: ${name}? Semua performa tim akan hilang.`)) return;

    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Admin ${user.token}`,
        },
      });
      if (res.ok) {
        fetchTeamMembers(); // reload list
        fetchAdminStats(); // update dashboard numbers
        triggerNotification(`🗑️ Akun ${name} telah berhasil dihapus.`);
      }
    } catch (err) {
      console.error("Gagal menghapus team member", err);
    }
  };

  // Automated Real-Time polling interval configurations
  useEffect(() => {
    if (user) {
      fetchShortlinks();
      if (user.role === "admin") {
        fetchAdminSettings();
        fetchAdminStats();
        fetchTeamMembers();

        const interval = setInterval(() => {
          fetchAdminStats(true); // silent fetch to look for new conversions
          fetchShortlinks(); // keep shortlinks fresh
        }, 5000);

        return () => clearInterval(interval);
      } else if (user.role === "team") {
        fetchTeamStats();

        const interval = setInterval(() => {
          fetchTeamStats(true); // silent fetch for real-time clicks/income update
          fetchShortlinks(); // keep shortlinks clicks updated
        }, 5000);

        return () => clearInterval(interval);
      }
    }
  }, [user]);

  // Retrieve shortlinks for current team/admin user
  const fetchShortlinks = async () => {
    if (!user) return;
    try {
      const authHeaderType = user.role === "admin" ? "Admin" : "Team";
      const res = await fetch("/api/team/shortlinks", {
        headers: {
          Authorization: `${authHeaderType} ${user.token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setShortlinks(data.shortlinks || []);
      }
    } catch (err) {
      console.error("Gagal mengambil shortlink:", err);
    }
  };

  // Generate shortlink
  const handleCreateShortlink = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setShortlinkLoading(true);
    setShortlinkError("");
    try {
      const authHeaderType = user.role === "admin" ? "Admin" : "Team";
      const res = await fetch("/api/team/shortlinks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${authHeaderType} ${user.token}`,
        },
        body: JSON.stringify({
          subId: "", // Auto generated on Server
          teamId: user.role === "admin" ? "admin" : user.username,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShortlinkSubId("");
        fetchShortlinks();
        triggerNotification(`🔗 Shortlink '${data.shortlink.code}' berhasil dibuat!`);
      } else {
        setShortlinkError(data.error || "Gagal membuat shortlink.");
      }
    } catch (err) {
      setShortlinkError("Gagal menyambung ke server.");
    } finally {
      setShortlinkLoading(false);
    }
  };

  // Delete shortlink
  const handleDeleteShortlink = async (id: string, code: string) => {
    if (!user) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus shortlink ${code}?`)) return;

    try {
      const authHeaderType = user.role === "admin" ? "Admin" : "Team";
      const res = await fetch(`/api/team/shortlinks/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `${authHeaderType} ${user.token}`,
        },
      });
      if (res.ok) {
        fetchShortlinks();
        triggerNotification(`🗑️ Shortlink ${code} telah dihapus.`);
      }
    } catch (err) {
      console.error("Gagal menghapus shortlink:", err);
    }
  };

  // Copy individual shortlink URL helper
  const copyShortlinkToClipboard = (code: string) => {
    const fullUrl = `${getBaseUrl()}/s/${code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkMap(prev => ({ ...prev, [code]: true }));
    setTimeout(() => {
      setCopiedLinkMap(prev => ({ ...prev, [code]: false }));
    }, 2000);
  };

  // Copy target item helper
  const copyToClipboard = (text: string, type: "link" | "postback") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedPostback(true);
      setTimeout(() => setCopiedPostback(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Real-time floating toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {activeNotifications.map((note, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="bg-slate-900 border-2 border-emerald-500/50 shadow-lg shadow-emerald-950/40 text-emerald-300 font-medium px-4 py-3 rounded-xl flex items-center gap-3 backdrop-blur-md"
            >
              <Zap className="h-5 w-5 text-emerald-400 animate-bounce shrink-0" />
              <span className="text-sm">{note}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Hero background decoration glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-900/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-rose-900/10 blur-[120px]" />
      </div>

      {/* Core navigation header container */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 to-emerald-500 p-[2px] flex items-center justify-center shadow-lg shadow-rose-950/20">
              <div className="h-full w-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Lospollos Tracker
              </h1>
              <p className="text-xs text-rose-400/90 font-mono tracking-wider">CPA DATING PANEL</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-sm">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{user.name}</span>
                <span className="text-xs text-slate-500 capitalize px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800 font-mono">
                  {user.role === "admin" ? "Admin" : "Tim"}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/50 hover:border-rose-700/60 transition-all text-slate-300 font-medium px-4 py-2 rounded-xl text-sm"
              >
                <LogOut className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="hidden md:inline">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CORE WRAPPER SCREEN MAIN */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <AnimatePresence mode="wait">
          
          {/* PHASE 1: LOGIN PORTAL SCREEN */}
          {!user && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="min-h-[70vh] flex flex-col justify-center items-center py-10"
            >
              <div className="w-full max-w-md bg-slate-900/50 border border-slate-900 rounded-3xl p-8 hover:border-slate-800/80 transition-all duration-300 backdrop-blur-xl relative shadow-2xl shadow-black/80">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-emerald-500 p-[2px] shadow-xl">
                    <div className="h-full w-full rounded-[14px] bg-slate-900 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>

                <div className="text-center mt-6 mb-8">
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Login Portal</h2>
                  <p className="text-sm text-slate-400">
                    Gunakan ID Tim Anda atau ketik <code className="text-rose-400 font-mono px-1 py-0.5 bg-slate-950 rounded border border-slate-800">admin</code> untuk panel pengelola.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="Contoh: admin atau alex"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 text-white rounded-xl px-4 py-3 placeholder:text-slate-600 transition-colors focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Password</label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan sandi..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 text-white rounded-xl px-4 py-3 placeholder:text-slate-600 transition-colors focus:outline-none"
                    />
                  </div>

                  {loginError && (
                    <div className="bg-rose-950/30 border border-rose-900/50 text-rose-300 text-sm p-3.5 rounded-xl text-center font-medium">
                      ⚠️ {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-gradient-to-r from-rose-600 to-emerald-600 hover:from-rose-500 hover:to-emerald-500 transition-all font-medium py-3.5 rounded-xl text-white shadow-lg shadow-emerald-900/20 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-md"
                  >
                    {loginLoading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Masuk ke Dashboard</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 border-t border-slate-800 pt-6 text-center text-xs text-slate-500 space-y-1 bg-slate-950/40 p-4 rounded-xl">
                  <p className="font-semibold text-slate-400">Pemberitahuan Sistem Lospollos</p>
                  <p>Tracker ini membaca hit klik & postback konversi secara instan 100% real-time dengan akurasi tinggi.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: ADMIN PANEL VIEW */}
          {user && user.role === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Header block with statistics indicator updates */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-900">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-emerald-400" />
                    Panel Administrator
                  </h2>
                  <p className="text-sm text-slate-400">
                    Kelola kampanye, buat akun tim, dan pantau arus konversi di bawah lisensi Lospollos.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-mono">
                    Pembaruan Terakhir: {adminStats ? new Date().toLocaleTimeString() : "-"}
                  </span>
                  <button
                    onClick={() => { fetchAdminStats(); fetchTeamMembers(); }}
                    disabled={dataLoading}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 p-2.5 rounded-xl border border-slate-800 transition-colors flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />
                    <span>Muat Ulang Data</span>
                  </button>
                </div>
              </div>

              {/* REALTIME KPI STATS CARDS MATRIX */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden group hover:border-slate-800 transition-colors shadow-lg">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                  <div className="flex justify-between items-start mb-3">
                    <MousePointer className="h-6 w-6 text-blue-400" />
                    <span className="text-[10px] font-mono bg-blue-900/30 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-900/40 uppercase">Clicks</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {adminStats ? adminStats.summary.totalClicks.toLocaleString() : "0"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-blue-400 font-bold font-mono">+{adminStats?.summary.clicksToday || "0"}</span> Hari ini
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden group hover:border-slate-800 transition-colors shadow-lg">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                  <div className="flex justify-between items-start mb-3">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                    <span className="text-[10px] font-mono bg-emerald-900/30 text-emerald-300 font-semibold px-2 py-0.5 rounded border border-emerald-900/40 uppercase">Convs</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {adminStats ? adminStats.summary.totalConversions.toLocaleString() : "0"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold font-mono">+{adminStats?.summary.conversionsToday || "0"}</span> Konversi baru
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden group hover:border-slate-800 transition-colors shadow-lg">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
                  <div className="flex justify-between items-start mb-3">
                    <DollarSign className="h-6 w-6 text-amber-400" />
                    <span className="text-[10px] font-mono bg-amber-900/30 text-amber-300 font-semibold px-2 py-0.5 rounded border border-amber-900/40 uppercase">Revenue</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    ${adminStats ? adminStats.summary.totalPayout.toFixed(2) : "0.00"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold font-mono">+${adminStats?.summary.payoutToday.toFixed(2) || "0.00"}</span> Hasil hari ini
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden group hover:border-slate-800 transition-colors shadow-lg">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 bg-fuchsia-500/5 rounded-full blur-2xl group-hover:bg-fuchsia-500/10 transition-colors" />
                  <div className="flex justify-between items-start mb-3">
                    <TrendingUp className="h-6 w-6 text-fuchsia-400" />
                    <span className="text-[10px] font-mono bg-fuchsia-900/30 text-fuchsia-300 font-semibold px-2 py-0.5 rounded border border-fuchsia-900/40 uppercase">CR (avg)</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {adminStats ? adminStats.summary.conversionRate.toFixed(2) : "0.00"}%
                  </h3>
                  <p className="text-xs text-fuchsia-400 mt-2 font-mono tracking-wider font-semibold">
                    REAL-TIME STATS ⚡
                  </p>
                </div>
              </div>

              {/* TWO COLUMN GRID : PANEL CONFIG & NEW TEAM MEMBER ACCOUNT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* SETTINGS MODULE */}
                <div className="bg-slate-900/50 border border-slate-900 p-6 md:p-8 rounded-3xl space-y-6">
                  <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 mb-2">
                    <Settings className="h-5 w-5 text-indigo-400" />
                    Pengaturan Smartlink & Postback
                  </h3>

                  <form onSubmit={handleSaveSettings} className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase">Lospollos Smartlink Template</label>
                        <span className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-900/50 px-1.5 py-0.5 rounded font-mono">Affiliate dating</span>
                      </div>
                      <input
                        type="url"
                        required
                        value={settings.globalSmartlink}
                        onChange={(e) => setSettings({ ...settings, globalSmartlink: e.target.value })}
                        placeholder="https://hop.lospollos.com/?pid=XXXX&cid=YYYY"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 text-white rounded-xl px-4 py-3 text-sm focus:outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-2 font-medium">
                        Masukkan tautan utama Lospollos Anda. Format parameter otomatis me-redirect ke format pelacakan tim dengan variabel <code className="text-slate-300 font-mono px-1 bg-slate-950 border border-slate-800">subid</code> & <code className="text-slate-300 font-mono px-1 bg-slate-950 border border-slate-800">subid2</code>.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase">Domain Utama Shortlink (Mengatasi Google Login)</label>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-1.5 py-0.5 rounded font-mono">Custom Domain / Public URL</span>
                      </div>
                      <input
                        type="text"
                        value={settings.customDomain || ""}
                        onChange={(e) => setSettings({ ...settings, customDomain: e.target.value })}
                        placeholder="Misal: https://domain-pengenal-anda.com"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 text-white rounded-xl px-4 py-3 text-sm focus:outline-none placeholder:text-slate-600"
                      />
                      <p className="text-xs text-slate-500 mt-2 font-medium">
                        ⚠️ <strong className="text-slate-300">Cara Melewati Login Gmail:</strong> Preview default AI Studio dilindungi login akun Google. Pasang Domain/Hosting kustom Anda atau nama domain publik yang diarahkan ke aplikasi ini di sini agar shortlink bisa langsung diakses tanpa login akun Google/Gmail.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">Ganti Sandi Admin Panel</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 transform -translate-y-1/2">
                          <Key className="h-4 w-4 text-slate-500" />
                        </span>
                        <input
                          type="password"
                          value={newAdminPasswordInput}
                          onChange={(e) => setNewAdminPasswordInput(e.target.value)}
                          placeholder="Kosongkan jika tidak ingin diganti"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {settingsMessage && (
                      <div className={`p-3.5 rounded-xl text-center text-sm font-semibold border ${
                        settingsMessage.startsWith("✅") 
                          ? "bg-indigo-950/30 border-indigo-950/80 text-indigo-300"
                          : "bg-rose-950/30 border-rose-950/80 text-rose-300"
                      }`}>
                        {settingsMessage}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={settingsLoading}
                        className="bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-medium px-6 py-2.5 rounded-xl text-sm shadow-md shadow-indigo-950/20 flex items-center gap-2"
                      >
                        {settingsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        <span>Simpan Konfigurasi</span>
                      </button>
                    </div>
                  </form>

                  {/* POSTBACK CONFIG BLOCK COPIER */}
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 mt-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono tracking-wider text-emerald-400 font-bold uppercase">Lospollos Postback URL</span>
                      <button
                        onClick={() => copyToClipboard(`${getBaseUrl()}/api/postback?subid={subid}&subid2={subid2}&payout={payout}&status={status}`, "postback")}
                        className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 transition-all flex items-center gap-1 w-fit"
                      >
                        {copiedPostback ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-slate-400" />
                            <span>Salin Tautan</span>
                          </>
                        )}
                      </button>
                    </div>
                    <code className="block bg-slate-900 break-all p-3 text-xs rounded-xl border border-slate-800 text-slate-300 font-mono leading-relaxed">
                      {getBaseUrl()}/api/postback?subid={"{"}subid{"}"}&amp;subid2={"{"}subid2{"}"}&amp;payout={"{"}payout{"}"}&amp;status={"{"}status{"}"}
                    </code>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      ⚠️ <strong className="text-slate-200">Wajib Dipasang:</strong> Copy-Paste URL di atas ke dalam menu <strong>Global Postback</strong> di akun Lospollos Anda untuk mengintegrasikan data klik / konversi real-time dengan sub-ID ke tracker ini cara instan.
                    </p>
                  </div>
                </div>

                {/* CREATOR NEW TEAM MEMBER */}
                <div className="bg-slate-900/50 border border-slate-900 p-6 md:p-8 rounded-3xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 mb-2">
                      <UserPlus className="h-5 w-5 text-emerald-400" />
                      Buat Akun Tim Baru
                    </h3>
                    <p className="text-sm text-slate-400 mb-6">Create credentials for target media buyer members to build campaign and sub-id tracking logs.</p>

                    <form onSubmit={handleAddTeamMember} className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-1.5">Nama Anggota Tim</label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Contoh: Alex Sugiantoro"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/80 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-1.5">Username (Unik)</label>
                          <input
                            type="text"
                            required
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                            placeholder="Contoh: alex01"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/80 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono tracking-wider text-slate-400 uppercase mb-1.5">Password</label>
                          <input
                            type="text"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Sandi login tim..."
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/80 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      {teamError && (
                        <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 text-rose-300 text-sm rounded-xl text-center font-medium">
                          ⚠️ {teamError}
                        </div>
                      )}
                      
                      {teamSuccess && (
                        <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-sm rounded-xl text-center font-medium">
                          {teamSuccess}
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={teamLoading}
                          className="bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-medium px-6 py-2.5 rounded-xl text-sm shadow-md shadow-emerald-950/20 flex items-center gap-2"
                        >
                          {teamLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          <span>Daftarkan Anggota</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="border-t border-slate-800/80 pt-6 mt-6 bg-rose-950/10 p-4 rounded-xl border border-rose-900/20">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-rose-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-300 uppercase tracking-tight mb-1">Skema Redirect Lospollos</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Anggota tim akan login ke dashboard mereka sendiri untuk membuat link kampanye dengan sub-ID khusus (misal: tiktok, line-chat). Link tersebut akan otomatis me-redirect pengunjung ke domain Lospollos yang dipetakan langsung dengan ID tim bersangkutan secara real-time.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIST OF TEAM MEMBERS AND DETAILS MATRIX */}
              <div className="bg-slate-900/30 border border-slate-900 p-6 md:p-8 rounded-3xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-400" />
                      Daftar &amp; Performa Anggota Tim ({teamList.length})
                    </h3>
                    <p className="text-sm text-slate-400">Statistik real-time, sandi login, dan performa masing-masing media buyer.</p>
                  </div>

                  {/* Search filter username */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari Username / Nama..."
                      value={searchTeamQuery}
                      onChange={(e) => setSearchTeamQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs px-9 py-2 rounded-xl text-white w-full sm:w-60 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950">
                  <table className="w-full text-left border-collapse table-auto text-sm">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-850/80 text-slate-400 font-mono text-xs uppercase tracking-wider">
                        <th className="py-4 px-6 font-semibold">Username / Tim</th>
                        <th className="py-4 px-6 font-semibold">Sandi</th>
                        <th className="py-4 px-6/30 font-semibold text-center">Clicks</th>
                        <th className="py-4 px-6 font-semibold text-center">Convs</th>
                        <th className="py-4 px-6 font-semibold text-center">Rate CR</th>
                        <th className="py-4 px-6 font-semibold text-center text-emerald-400">Omset USD</th>
                        <th className="py-4 px-6 font-semibold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {teamList.filter(t => 
                        t.username.toLowerCase().includes(searchTeamQuery.toLowerCase()) || 
                        t.name.toLowerCase().includes(searchTeamQuery.toLowerCase())
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 px-6 text-center text-slate-500 font-medium font-mono text-xs">
                            Belum ada anggota tim terdaftar atau tidak cocok.
                          </td>
                        </tr>
                      ) : (
                        teamList.filter(t => 
                          t.username.toLowerCase().includes(searchTeamQuery.toLowerCase()) || 
                          t.name.toLowerCase().includes(searchTeamQuery.toLowerCase())
                        ).map((member) => {
                          const state = adminStats?.teamLeaderboard.find(x => x.username === member.username) || {
                            totalClicks: 0,
                            totalConversions: 0,
                            conversionRate: 0,
                            totalPayout: 0
                          };

                          return (
                            <tr key={member.id} className="hover:bg-slate-900/30 transition-colors">
                              <td className="py-4 px-6">
                                <div className="font-semibold text-white">{member.name}</div>
                                <div className="text-xs text-rose-400 font-mono">@{member.username}</div>
                              </td>
                              <td className="py-4 px-6">
                                <code className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-xs text-slate-300 font-mono">
                                  {member.password}
                                </code>
                              </td>
                              <td className="py-4 px-6 text-center font-mono text-blue-400 font-bold">
                                {state.totalClicks.toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-center font-mono text-emerald-400 font-bold">
                                {state.totalConversions.toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className="bg-fuchsia-950/40 border border-fuchsia-900/50 text-fuchsia-300 font-mono text-xs px-2 py-0.5 rounded-lg">
                                  {state.conversionRate.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center font-mono text-emerald-300 font-bold">
                                ${state.totalPayout.toFixed(2)}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <button
                                  onClick={() => handleDeleteTeam(member.id, member.name)}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-950/20 hover:border-rose-900 p-2 rounded-xl transition-all"
                                  title="Hapus ID Tim"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* REAL-TIME DYNAMIC LOGS OF CLICKFEED AND CONVERSION AUDIT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* RECENT CLICKS MATRIX (LATEST 15 CHANNELS) */}
                <div className="bg-slate-900/30 border border-slate-905 p-6 md:p-8 rounded-3xl space-y-4">
                  <h3 className="text-md font-bold tracking-tight text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
                      Log Klik Terakhir Realtime
                    </span>
                    <span className="text-[10px] bg-blue-950/45 border border-blue-900 text-blue-400 font-semibold px-2 py-0.5 rounded font-mono">REAL-TIME</span>
                  </h3>
                  <div className="overflow-y-auto max-h-[360px] border border-slate-900 rounded-2xl bg-slate-950 divide-y divide-slate-900">
                    {adminStats?.latestClicks && adminStats.latestClicks.length > 0 ? (
                      adminStats.latestClicks.map((clk) => (
                        <div key={clk.id} className="p-3.5 hover:bg-slate-900/40 transition-colors flex items-center justify-between text-xs font-mono">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-200 font-bold bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">@{clk.teamId}</span>
                              <span className="text-blue-400 font-semibold">→ {clk.subId}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              <span>IP: {clk.ip}</span>
                              <span className="max-w-[120px] truncate text-slate-600" title={clk.userAgent}>{clk.userAgent}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1 shrink-0 ml-4">
                            <div className="bg-slate-900 px-2 py-0.5 rounded text-[10px] font-bold text-slate-300 border border-slate-805 uppercase inline-flex items-center gap-1">
                              <Globe className="h-3 w-3 text-emerald-400" />
                              <span>{clk.country}</span>
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {new Date(clk.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-600 font-mono text-xs">
                        Belum ada klik terdeteksi. Silakan bagikan link tracking.
                      </div>
                    )}
                  </div>
                </div>

                {/* RECENT CONVERSIONS RECORD PANEL */}
                <div className="bg-slate-900/30 border border-slate-905 p-6 md:p-8 rounded-3xl space-y-4">
                  <h3 className="text-md font-bold tracking-tight text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-emerald-400 animate-pulse" />
                      Log Konversi Terakhir (Postback)
                    </span>
                    <span className="text-[10px] bg-emerald-950/45 border border-emerald-950 text-emerald-400 font-semibold px-2 py-0.5 rounded font-mono">LEADS LOGS</span>
                  </h3>
                  <div className="overflow-y-auto max-h-[360px] border border-slate-900 rounded-2xl bg-slate-950 divide-y divide-slate-900">
                    {adminStats?.latestConversions && adminStats.latestConversions.length > 0 ? (
                      adminStats.latestConversions.map((conv) => (
                        <div key={conv.id} className="p-3.5 hover:bg-slate-900/40 transition-colors flex items-center justify-between text-xs font-mono">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/50 px-1.5 py-0.5 rounded">@{conv.teamId}</strong>
                              <span className="text-slate-400">Sub-ID: {conv.subId}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Sandi: {conv.status.toUpperCase()} | ID: {conv.id}
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-bold ml-4">
                            <div className="text-emerald-400 text-sm font-black">+${conv.payout.toFixed(2)}</div>
                            <div className="text-[9px] font-normal text-slate-500">
                              {new Date(conv.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-600 font-mono text-xs">
                        Belum ada konversi Lospollos masuk. Pasang Postback URL di network utama Anda.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* PHASE 3: TEAM MEMBER PANEL VIEW */}
          {user && user.role === "team" && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Profile welcome bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-900">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    Halo, {user.name}!
                  </h2>
                  <p className="text-sm text-slate-400">
                    Kelola kampanye Anda, generate link afiliasi instan, dan pantau sub-ID secara optimal.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-mono animate-pulse flex items-center gap-1 bg-slate-900 border border-slate-820 px-2 py-1 rounded">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    SINKRONISASI REAL-TIME
                  </span>
                  <button
                    onClick={() => fetchTeamStats()}
                    disabled={dataLoading}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-300 p-2.5 rounded-xl border border-slate-800 transition-colors flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />
                    <span>Perbarui Monitor</span>
                  </button>
                </div>
              </div>

              {/* SHORTLINK GENERATOR FOR MEMBER */}
              <div className="bg-gradient-to-tr from-slate-900/60 via-slate-900/30 to-slate-950 border border-slate-900 p-6 md:p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-y-[-10px] translate-x-10 w-96 h-96 rounded-full bg-emerald-600/5 blur-[80px]" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                      Generator Shortlink Kampanye
                    </h3>
                    <p className="text-sm text-slate-400">
                      Buat link pendek pintar (shortlink) untuk menyembunyikan URL kampanye asli. Berguna untuk meminimalkan deteksi spam/blokir di media sosial.
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-950 border border-emerald-900 text-emerald-400 font-semibold px-2 py-1 rounded-lg font-mono">
                    PREMIUM SHORTENER
                  </span>
                </div>

                <form onSubmit={handleCreateShortlink} className="max-w-md mb-6">
                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={shortlinkLoading}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 transition-all text-white font-bold py-4 px-8 rounded-2xl text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/40 cursor-pointer active:scale-98"
                    >
                      {shortlinkLoading ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <LinkIcon className="h-5 w-5" />
                      )}
                      <span>+ Buat Instan Shortlink Acak</span>
                    </button>
                    {shortlinkError && (
                      <p className="text-xs text-rose-550 mt-1 font-mono">{shortlinkError}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      ⚡ Sistem otomatis menghasilkan kode tracking acak (Sub-ID unik) untuk setiap tautan untuk mengurangi risiko blokir sosial media.
                    </p>
                  </div>
                </form>

                {/* List of shortlinks */}
                <div className="mt-4">
                  <h4 className="text-xs font-mono tracking-wider text-slate-400 uppercase mb-3">Daftar Link Pendek Aktif Anda</h4>
                  <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950">
                    <table className="w-full text-left border-collapse table-auto text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-850/80 text-slate-400">
                          <th className="py-3 px-4 font-semibold">Short Link URL</th>
                          <th className="py-3 px-4 font-semibold text-center">Sub-ID Terkait</th>
                          <th className="py-3 px-4 font-semibold text-center">Total Klik</th>
                          <th className="py-3 px-4 font-semibold text-center">Tanggal Dibuat</th>
                          <th className="py-3 px-4 font-semibold text-center">Aksi Pelacakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 font-mono text-slate-300">
                        {shortlinks.length > 0 ? (
                          shortlinks.map((link) => {
                            const fullShortUrl = `${getBaseUrl()}/s/${link.code}`;
                            return (
                              <tr key={link.id} className="hover:bg-slate-900/20 transition-colors">
                                <td className="py-3 px-4 text-emerald-400 font-bold break-all">
                                  {fullShortUrl}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-rose-300 text-[11px]">
                                    {link.subId}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center text-blue-400 font-bold text-sm">
                                  {(link.clicks || 0).toLocaleString()} klik
                                </td>
                                <td className="py-3 px-4 text-center text-slate-500 text-[10px]">
                                  {new Date(link.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => copyShortlinkToClipboard(link.code)}
                                      className="bg-slate-950 hover:bg-slate-900 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1.5"
                                    >
                                      {copiedLinkMap[link.code] ? (
                                        <>
                                          <CheckCircle className="h-3 w-3 text-emerald-400" />
                                          <span>Tersalin</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5 text-slate-450" />
                                          <span>Salin URL</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteShortlink(link.id, link.code)}
                                      className="text-rose-400 hover:bg-rose-950/40 p-1.5 rounded-lg border border-transparent hover:border-rose-900 transition-colors"
                                      title="Hapus Shortlink"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-6 px-4 text-center text-slate-500 font-medium font-sans">
                              Belum ada shortlink yang didaftarkan. Gunakan input kolom di atas untuk membuat shortlink instan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* INDIVIDUAL KPI STATS CARDS MATRIX */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <MousePointer className="h-6 w-6 text-blue-400" />
                    <span className="text-[10px] font-mono bg-blue-900/30 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-900/40 uppercase">Clicks</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {teamStats ? teamStats.summary.totalClicks.toLocaleString() : "0"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-blue-400 font-bold font-mono">+{teamStats?.summary.clicksToday || "0"}</span> Hari ini
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                    <span className="text-[10px] font-mono bg-emerald-900/30 text-emerald-300 font-semibold px-2 py-0.5 rounded border border-emerald-900/40 uppercase">Convs</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {teamStats ? teamStats.summary.totalConversions.toLocaleString() : "0"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold font-mono">+{teamStats?.summary.conversionsToday || "0"}</span> Konversi baru
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <DollarSign className="h-6 w-6 text-amber-400" />
                    <span className="text-[10px] font-mono bg-amber-900/30 text-amber-300 font-semibold px-2 py-0.5 rounded border border-amber-900/40 uppercase">Pendapatan</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    ${teamStats ? teamStats.summary.totalPayout.toFixed(2) : "0.00"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 font-medium flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold font-mono">+${teamStats?.summary.payoutToday.toFixed(2) || "0.00"}</span> Hari ini
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <TrendingUp className="h-6 w-6 text-fuchsia-400" />
                    <span className="text-[10px] font-mono bg-fuchsia-900/30 text-fuchsia-300 font-semibold px-2 py-0.5 rounded border border-fuchsia-900/40 uppercase">CR Member</span>
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {teamStats ? teamStats.summary.conversionRate.toFixed(2) : "0.00"}%
                  </h3>
                  <p className="text-xs text-fuchsia-400 mt-2 font-mono tracking-wider font-semibold">
                    INDIVIDUAL CR⚡
                  </p>
                </div>
              </div>

              {/* INDIVIDUAL CAMPAIGN SUB-ID PERFORM MATRIX */}
              <div className="bg-slate-900/30 border border-slate-900 p-6 md:p-8 rounded-3xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-400" />
                      Analisis Kinerja Berdasarkan Sub-ID Anda
                    </h3>
                    <p className="text-sm text-slate-400">Lihat perbandingan performa klik, konversi, CR, dan untung dari tiap sub-ID parameter.</p>
                  </div>

                  {/* Filter Sub-ID input selection */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari Parameter Sub-ID..."
                      value={searchSubIdQuery}
                      onChange={(e) => setSearchSubIdQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs px-9 py-2 rounded-xl text-white w-full sm:w-60 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950">
                  <table className="w-full text-left border-collapse table-auto text-sm">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-850/80 text-slate-400 font-mono text-xs uppercase tracking-wider">
                        <th className="py-4 px-6 font-semibold">Parameter Sub-ID</th>
                        <th className="py-4 px-6 font-semibold text-center">Clicks</th>
                        <th className="py-4 px-6 font-semibold text-center">Conversions</th>
                        <th className="py-4 px-6 font-semibold text-center">Conversion Rate (CR)</th>
                        <th className="py-4 px-6 font-semibold text-center text-emerald-400">Total Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 font-mono text-xs">
                      {teamStats?.subIdLeaderboard && teamStats.subIdLeaderboard.filter(x => x.subId.toLowerCase().includes(searchSubIdQuery.toLowerCase())).length > 0 ? (
                        teamStats.subIdLeaderboard
                          .filter(x => x.subId.toLowerCase().includes(searchSubIdQuery.toLowerCase()))
                          .map((row) => (
                            <tr key={row.subId} className="hover:bg-slate-900/30 transition-colors">
                              <td className="py-4 px-6 font-semibold text-white">
                                <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-rose-300">
                                  {row.subId}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center text-blue-400 font-bold">
                                {row.clicks.toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-center text-emerald-400 font-bold">
                                {row.conversions.toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className="bg-fuchsia-950/40 border border-fuchsia-900/50 text-fuchsia-300 px-2 py-0.5 rounded-lg text-xs font-semibold">
                                  {row.conversionRate.toFixed(2)}%
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center text-emerald-300 font-black">
                                ${row.payout.toFixed(2)}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 px-6 text-center text-slate-500 font-medium">
                            Belum ada sub-ID yang tercatat. Gunakan Link Afiliasi di atas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INDIVIDUAL RECENT EVENT FEEDS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* YOUR LATEST CLICKS */}
                <div className="bg-slate-900/30 border border-slate-905 p-6 md:p-8 rounded-3xl space-y-4">
                  <h3 className="text-md font-bold tracking-tight text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
                      Arus Klik Terakhir Anda
                    </span>
                    <span className="text-[10px] bg-slate-950/45 border border-blue-900 text-blue-400 font-semibold px-2 py-0.5 rounded font-mono">LIVE CLICKS</span>
                  </h3>
                  <div className="overflow-y-auto max-h-[300px] border border-slate-900 rounded-2xl bg-slate-950 divide-y divide-slate-900 text-xs">
                    {teamStats?.latestClicks && teamStats.latestClicks.length > 0 ? (
                      teamStats.latestClicks.map((clk) => (
                        <div key={clk.id} className="p-3.5 hover:bg-slate-900/40 transition-colors flex items-center justify-between font-mono">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-blue-400 font-semibold uppercase">[{clk.subId}]</span>
                              <span className="text-slate-500">IP: {clk.ip}</span>
                            </div>
                            <div className="text-[10px] text-slate-600 truncate max-w-[200px]" title={clk.userAgent}>
                              {clk.userAgent}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="bg-slate-900 px-2 py-0.5 rounded text-[10px] font-bold text-slate-300 border border-slate-805 uppercase flex items-center gap-1 w-fit ml-auto mb-1">
                              <Globe className="h-3 w-3 text-emerald-400" />
                              <span>{clk.country}</span>
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {new Date(clk.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-600 font-mono">
                        Klik promosi Anda belum terekam di sistem.
                      </div>
                    )}
                  </div>
                </div>

                {/* YOUR LATEST CONVERSIONS */}
                <div className="bg-slate-900/30 border border-slate-905 p-6 md:p-8 rounded-3xl space-y-4">
                  <h3 className="text-md font-bold tracking-tight text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-emerald-400 animate-pulse" />
                      Komisi Konversi Terakhir Anda
                    </span>
                    <span className="text-[10px] bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-semibold px-2 py-0.5 rounded font-mono">REVENUE FEEDS</span>
                  </h3>
                  <div className="overflow-y-auto max-h-[300px] border border-slate-900 rounded-2xl bg-slate-950 divide-y divide-slate-900 text-xs">
                    {teamStats?.latestConversions && teamStats.latestConversions.length > 0 ? (
                      teamStats.latestConversions.map((conv) => (
                        <div key={conv.id} className="p-3.5 hover:bg-slate-900/40 transition-colors flex items-center justify-between font-mono">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/50 px-1.5 py-0.5 rounded">+{conv.status.toUpperCase()}</strong>
                              <span className="text-slate-400">Subid: {conv.subId}</span>
                            </div>
                            <div className="text-[10px] text-slate-600">ID: {conv.id}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-emerald-400 font-black text-sm">+${conv.payout.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(conv.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-slate-600 font-mono">
                        Konversi promosi Lospollos belum terdeteksi. Terus tingkatkan kampanye Anda!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 backdrop-blur-md mt-16 py-8 px-4 text-center">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="text-xs text-slate-500 font-mono leading-relaxed">
            &copy; 2026 Lospollos CPA Team Tracker Platform. All Rights Reserved.
          </p>
          <div className="flex justify-center items-center gap-4 text-[10px] font-semibold text-slate-600 tracking-wider">
            <span>REAL-TIME TRACKING LAYER 2</span>
            <span>&bull;</span>
            <span>SECURE CRYPTO AUTH</span>
            <span>&bull;</span>
            <span>POSTBACK PORT 3000 INGRESS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
