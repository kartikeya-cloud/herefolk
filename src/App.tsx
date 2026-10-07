import { useState, useEffect, useCallback, useRef } from "react";
import {
  Compass,
  MapPin,
  Users,
  ArrowUpRight,
  ArrowRight,
  Search,
  Plus,
  X,
  Clock,
  Leaf,
  Coffee,
  Check,
  LogOut,
  Trash2,
  Heart,
  MessageCircle,
  Info,
  AlertCircle,
  LoaderCircle,
  WifiOff,
  RotateCcw,
  ChevronRight,
  Bell,
} from "lucide-react";
import {
  venues as samples,
  demoMe,
  demoPeople,
  type Venue,
  type Profile,
  type Checkin,
  type Post,
  type Request,
} from "./data";
import { supabase, api } from "./client";
type Page = "Discover" | "Venue feed" | "Connections" | "Profile";
import {
  initialDemo,
  freshDemo,
  STORAGE_KEY,
  timeAgo,
  friendlyError,
} from "./demo";
const nav: Page[] = ["Discover", "Venue feed", "Connections", "Profile"];
function Avatar({ person }: { person: Profile }) {
  return (
    <span className={"avatar color-" + (person.display_name.charCodeAt(0) % 4)}>
      {person.display_name.slice(0, 1)}
    </span>
  );
}
export default function App() {
  const [demo] = useState(initialDemo),
    [me, setMe] = useState<Profile | null>(supabase ? null : demo.profile),
    [list, setList] = useState<Venue[]>(samples),
    [checkin, setCheckin] = useState<Checkin | null>(
      supabase ? null : demo.checkin,
    ),
    [posts, setPosts] = useState<Post[]>(supabase ? [] : demo.posts),
    [people, setPeople] = useState<Profile[]>(supabase ? [] : demoPeople),
    [requests, setRequests] = useState<Request[]>(
      supabase ? [] : demo.requests,
    ),
    [directory, setDirectory] = useState<Profile[]>([]);
  const [page, setPage] = useState<Page>("Discover"),
    [category, setCategory] = useState("All places"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Venue | null>(null),
    [text, setText] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState(false),
    [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [clock, setClock] = useState(Date.now()),
    [loaded, setLoaded] = useState(!supabase),
    [error, setError] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      label: string;
      action: () => Promise<void>;
    } | null>(null),
    [profileVersion, setProfileVersion] = useState(0),
    [realtime, setRealtime] = useState("Connecting");
  const actionLock = useRef(false),
    refreshVersion = useRef(0),
    contentRef = useRef<HTMLElement>(null),
    modalRef = useRef<HTMLElement>(null);
  const active =
    checkin && Date.parse(checkin.expires_at) > clock ? checkin : null;
  const current = list.find((v) => v.id === active?.venue_id);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const version = ++refreshVersion.current;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError")
      throw authError;
    if (version !== refreshVersion.current) return;
    if (!user) {
      setMe(null);
      setCheckin(null);
      setPosts([]);
      setPeople([]);
      setRequests([]);
      setDirectory([]);
      setLoaded(true);
      setError("");
      return;
    }
    const results = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("venues").select("*"),
      supabase
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle(),
      supabase.from("connection_requests").select("*"),
    ]);
    for (const r of results) if (r.error) throw new Error(r.error.message);
    const nextCheckin = results[2].data,
      nextRequests = results[3].data || [];
    const ids = [
      ...new Set(
        nextRequests.flatMap((r: Request) => [r.sender_id, r.receiver_id]),
      ),
    ];
    let nextDirectory: Profile[] = [],
      nextPosts: Post[] = [],
      nextPeople: Profile[] = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids);
      if (error) throw error;
      nextDirectory = data || [];
    }
    if (nextCheckin) {
      const vid = nextCheckin.venue_id;
      const [feed, members] = await Promise.all([
        supabase
          .from("posts")
          .select("*,profiles(*)")
          .eq("venue_id", vid)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("check_ins")
          .select("profiles(*)")
          .eq("venue_id", vid)
          .gt("expires_at", new Date().toISOString()),
      ]);
      if (feed.error) throw feed.error;
      if (members.error) throw members.error;
      nextPosts = feed.data || [];
      nextPeople = (members.data || [])
        .map((x: any) => x.profiles)
        .filter((x: Profile) => x && x.id !== user.id);
    }
    if (version !== refreshVersion.current) return;
    setMe(results[0].data);
    setList(results[1].data || []);
    setCheckin(nextCheckin);
    setRequests(nextRequests);
    setDirectory(nextDirectory);
    setPosts(nextPosts);
    setPeople(nextPeople);
    setLoaded(true);
    setError("");
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(friendlyError(e));
      setLoaded(true);
    });
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => refresh().catch((e) => setError(friendlyError(e))), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  useEffect(() => {
    if (!supabase) {
      const state = { profile: me || demoMe, checkin, posts, requests };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        setError(
          "Your browser could not save demo changes. They will last until you close this page.",
        );
      }
    }
  }, [me, checkin, posts, requests]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (checkin && !active) {
      setCheckin(null);
      setNotice("Your check-in expired. Check in again to join the feed.");
    }
  }, [clock, checkin, active]);
  useEffect(() => {
    if (!supabase || !me) return;
    const channel = supabase
      .channel("venue-" + (active?.venue_id || me.id))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `venue_id=eq.${active?.venue_id || "00000000-0000-0000-0000-000000000000"}`,
        },
        () => refresh().catch((e) => setError(friendlyError(e))),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        () => refresh().catch((e) => setError(friendlyError(e))),
      )
      .subscribe((status) =>
        setRealtime(
          status === "SUBSCRIBED"
            ? "Live"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "Reconnecting"
              : "Connecting",
        ),
      );
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [me?.id, active?.venue_id, refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    setText("");
    contentRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);
  useEffect(() => {
    if (!selected && !auth && !confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = () =>
      modalRef.current
        ?.querySelector<HTMLElement>("button:not(:disabled), input, textarea")
        ?.focus();
    const timer = setTimeout(focus, 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setSelected(null);
        setAuth(false);
        setConfirm(null);
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [!!selected, auth, !!confirm, busy]);
  async function run(fn: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function requireMe() {
    if (!me) {
      setSelected(null);
      setError("");
      setAuth(true);
      return false;
    }
    return true;
  }
  async function enter(v: Venue) {
    if (!requireMe()) return;
    if (active?.venue_id === v.id) {
      setSelected(null);
      setPage("Venue feed");
      return;
    }
    await run(async () => {
      if (supabase) {
        await api("/check-in", { venue_id: v.id });
        await refresh();
      } else
        setCheckin({
          id: crypto.randomUUID(),
          user_id: me!.id,
          venue_id: v.id,
          expires_at: new Date(Date.now() + 2 * 3600000).toISOString(),
        });
      setSelected(null);
      setPage("Venue feed");
      setNotice(`You're checked in at ${v.name}. Say hello!`);
    });
  }
  async function leave() {
    if (supabase) {
      await api("/check-out", {});
      await refresh();
    } else setCheckin(null);
    setPage("Discover");
    setNotice("You have left the venue.");
  }
  async function publish() {
    if (!active || !text.trim()) return;
    await run(async () => {
      if (supabase) {
        await api("/posts", {
          venue_id: active.venue_id,
          content: text.trim(),
        });
        await refresh();
      } else
        setPosts((p) => [
          {
            id: crypto.randomUUID(),
            user_id: me!.id,
            venue_id: active.venue_id,
            content: text.trim(),
            created_at: new Date().toISOString(),
            profiles: me!,
          },
          ...p,
        ]);
      setText("");
      setNotice("Your post is shared with this venue.");
    });
  }
  async function connect(p: Profile) {
    if (!active) return;
    await run(async () => {
      if (supabase) {
        await api("/requests", {
          receiver_id: p.id,
          venue_id: active.venue_id,
        });
        await refresh();
      } else {
        if (
          requests.some(
            (r) =>
              (r.sender_id === me!.id && r.receiver_id === p.id) ||
              (r.sender_id === p.id && r.receiver_id === me!.id),
          )
        )
          throw new Error("You already have an invitation with this person.");
        setRequests((r) => [
          ...r,
          {
            id: crypto.randomUUID(),
            sender_id: me!.id,
            receiver_id: p.id,
            status: "pending",
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setNotice(`Connection request sent to ${p.display_name}.`);
    });
  }
  async function respond(r: Request, status: string) {
    await run(async () => {
      if (supabase) {
        await api("/requests/" + r.id, { status });
        await refresh();
      } else
        setRequests((rs) =>
          rs.map((x) => (x.id === r.id ? { ...x, status } : x)),
        );
      setNotice(
        status === "accepted"
          ? "You are now connected. Say hello in person!"
          : "Request declined.",
      );
    });
  }
  const findPerson = (id: string) =>
    [
      ...(me ? [me] : []),
      ...people,
      ...directory,
      ...(!supabase ? demoPeople : []),
    ].find((p) => p.id === id) || { id, display_name: "Member", bio: "" };
  const filtered = list.filter(
    (v) =>
      (category === "All places" || v.category === category) &&
      (v.name + " " + v.address + " " + v.tags.join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pending = requests.filter(
    (r) => r.receiver_id === me?.id && r.status === "pending",
  );
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" inert={!!selected || auth || !!confirm}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Discover");
          }}
        >
          <span className="brand-icon">
            <Leaf size={22} />
          </span>
          here<span>folk</span>
        </a>
        <div className="nav-caption">YOUR LITTLE WORLD</div>
        <nav>
          {nav.map((n, i) => {
            const Icon = [Compass, MessageCircle, Users, Heart][i];
            return (
              <button
                key={n}
                aria-label={n}
                aria-current={page === n ? "page" : undefined}
                className={page === n ? "nav active" : "nav"}
                onClick={() => setPage(n)}
              >
                <Icon size={19} />
                {n}
                {n === "Connections" && pending.length > 0 && (
                  <small>{pending.length}</small>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="little-flower">✳</span>
          <h3>
            Less scrolling.
            <br />
            More connecting.
          </h3>
          <p>The best conversations start with a hello.</p>
        </div>
        <div className="account">
          {me ? (
            <>
              <Avatar person={me} />
              <div>
                <strong>{me.display_name}</strong>
                <small>{supabase ? "Your account" : "Demo account"}</small>
              </div>
              <button
                aria-label="Open profile"
                onClick={() => setPage("Profile")}
              >
                <ArrowUpRight size={18} />
              </button>
            </>
          ) : (
            <button className="primary" onClick={() => setAuth(true)}>
              Sign in <ArrowRight size={16} />
            </button>
          )}
        </div>
      </aside>
      <div className="workspace" inert={!!selected || auth || !!confirm}>
        <header className="topbar">
          <a
            className="mobile-brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("Discover");
            }}
          >
            <span className="brand-icon">
              <Leaf size={18} />
            </span>
            here<span>folk</span>
          </a>
          <span className="topbar-tagline">Meet here. Connect for real.</span>
          <div>
            <a className="demo-switch" href={supabase ? "?demo=1" : "/"}>
              {supabase ? "Try demo" : "Back to live"}
            </a>
            <span className="mode">
              <i />
              {supabase ? "Connected" : "Demo mode"}
            </span>
            <button
              className="notification-button"
              aria-label={`Connections, ${pending.length} new invitations`}
              onClick={() => setPage("Connections")}
            >
              <Bell size={18} />
              {pending.length > 0 && <span>{pending.length}</span>}
            </button>
            <button
              className="round"
              aria-label="Open account"
              onClick={() => (me ? setPage("Profile") : setAuth(true))}
            >
              {me ? me.display_name[0] : <Users size={18} />}
            </button>
          </div>
        </header>
        <main id="main-content" ref={contentRef} tabIndex={-1}>
          {!supabase && (
            <div className="demo-banner">
              <Info size={16} />
              <span>
                A little preview of Herefolk. People and places are fictional;
                changes stay in this browser.
              </span>
              <button onClick={() => setPage("Profile")}>
                About demo <ChevronRight size={14} />
              </button>
            </div>
          )}
          {offline && (
            <div className="error-banner" role="status">
              <WifiOff size={18} />
              <span>
                You are offline.{" "}
                {supabase
                  ? "Reconnect to load and save your changes."
                  : "You can still explore this demo."}
              </span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              {supabase && (
                <button disabled={busy} onClick={() => run(refresh)}>
                  Try again <RotateCcw size={14} />
                </button>
              )}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "Discover" && (
            <>
              <div className="eyebrow">
                <span /> A LITTLE CLOSER TO YOUR PEOPLE
              </div>
              <div className="heading-row">
                <div>
                  <h1>
                    Find your place.
                    <br />
                    <em>Meet your people.</em>
                  </h1>
                  <p>
                    Good places bring good people together. Find your next
                    hello.
                  </p>
                </div>
                <div className="location">
                  <MapPin size={16} />
                  <div>
                    Exploring<strong>Delhi, India</strong>
                  </div>
                </div>
              </div>
              <div className="hero">
                <div className="hero-copy">
                  <span className="pill">SMALL MOMENTS. REAL CONNECTIONS.</span>
                  <h2>
                    Your kind of place.
                    <br />
                    Your kind of people.
                  </h2>
                  <p>
                    Check in, share what you're up to, and turn familiar faces
                    into new connections.
                  </p>
                  <button
                    onClick={() =>
                      document
                        .getElementById("places")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Explore places <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orb orb-one" />
                  <div className="orb orb-two" />
                  <div className="art-window">
                    <div className="window-lines" />
                    <div className="plant">
                      <Leaf />
                      <Leaf />
                      <Leaf />
                    </div>
                    <div className="table" />
                    <div className="cup">
                      <Coffee size={65} />
                    </div>
                  </div>
                  <span className="floating-chip chip-one">
                    <i />A new hello is nearby
                  </span>
                  <span className="floating-chip chip-two">
                    ☕ Coffee, anyone?
                  </span>
                  <span className="spark">✳</span>
                </div>
              </div>
              {current && (
                <div className="checkin-bar">
                  <MapPin size={19} />
                  <div>
                    You're in the loop at <strong>{current.name}</strong>
                    <small>
                      {Math.max(
                        1,
                        Math.ceil(
                          (Date.parse(active!.expires_at) - clock) / 60000,
                        ),
                      )}{" "}
                      minutes left
                    </small>
                  </div>
                  <button onClick={() => setPage("Venue feed")}>
                    Open feed <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <section id="places">
                <div className="section-heading">
                  <div>
                    <h2>
                      Places to find your people <span>{filtered.length}</span>
                    </h2>
                    <p>A seat, a shared interest, a reason to say hello.</p>
                  </div>
                  <span className="curated">
                    <Leaf size={15} /> Sample places
                  </span>
                </div>
                <div className="filters">
                  <div className="categories">
                    {[
                      "All places",
                      "Café",
                      "Coworking",
                      "Outdoors",
                      "Events",
                    ].map((c) => (
                      <button
                        aria-pressed={category === c}
                        className={category === c ? "selected" : ""}
                        onClick={() => setCategory(c)}
                        key={c}
                      >
                        {c === "Café" && <Coffee size={15} />} {c}
                      </button>
                    ))}
                  </div>
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search places"
                      placeholder="Find a place…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                </div>
                <div className="venue-grid">
                  {(loaded ? filtered : []).map((v) => (
                    <button
                      className="venue-card"
                      key={v.id}
                      onClick={() => setSelected(v)}
                    >
                      <VenueArt venue={v} />
                      <div className="card-body">
                        <div className="card-title">
                          <h3>{v.name}</h3>
                          <ArrowUpRight size={20} />
                        </div>
                        <p>
                          <MapPin size={13} />
                          {v.address}
                        </p>
                        <div className="card-tags">
                          {v.tags.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {!loaded && (
                  <div
                    className="skeleton-grid"
                    role="status"
                    aria-label="Loading places"
                  >
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                  </div>
                )}
                {loaded && !filtered.length && (
                  <Empty
                    title="No places found"
                    text="Try another name, or explore all our sample places."
                    action={() => {
                      setSearch("");
                      setCategory("All places");
                    }}
                    label="Clear filters"
                  />
                )}
              </section>
              <div className="footer-note">
                <Leaf size={16} /> Real places. Real people. A little more
                connection.
              </div>
            </>
          )}
          {page === "Venue feed" && (
            <>
              <div className="eyebrow">THE CONVERSATION STARTS HERE</div>
              <h1>{current ? current.name : "Get in the loop."}</h1>
              <p className="subtitle">
                {current
                  ? "Share a thought, meet a familiar face, say hello in person."
                  : "Check into a place to join its conversation."}
              </p>
              {current ? (
                <>
                  <div className="checkin-bar">
                    <span className="live-dot" />
                    <div>
                      {supabase ? realtime + " · " : "Demo session · "}Checked
                      in{" "}
                      <small>
                        <Clock size={12} />{" "}
                        {Math.ceil(
                          (Date.parse(active!.expires_at) - clock) / 60000,
                        )}{" "}
                        minutes left
                      </small>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: "Leave this place?",
                          description:
                            "Your feed access will end. Your connections will stay with you.",
                          label: "Leave venue",
                          action: leave,
                        })
                      }
                    >
                      Leave venue <LogOut size={16} />
                    </button>
                  </div>
                  <div className="feed-layout">
                    <div>
                      <div className="composer">
                        <div className="composer-top">
                          <Avatar person={me!} />
                          <strong>What's happening, {me!.display_name}?</strong>
                        </div>
                        <textarea
                          aria-label="Write a venue post"
                          disabled={busy}
                          maxLength={500}
                          placeholder="A thought, a question, an invitation for coffee…"
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                        <div>
                          <small>
                            {text.length}/500 · Visible to people checked in
                            here
                          </small>
                          <button
                            className="primary"
                            disabled={
                              busy || !text.trim() || (offline && !!supabase)
                            }
                            onClick={publish}
                          >
                            Post to the loop <Plus size={15} />
                          </button>
                        </div>
                      </div>
                      <h3 className="feed-label">Around you right now</h3>
                      {posts
                        .filter((p) => p.venue_id === active!.venue_id)
                        .map((p) => (
                          <article className="post" key={p.id}>
                            <div className="post-head">
                              <Avatar
                                person={p.profiles || findPerson(p.user_id)}
                              />
                              <div>
                                <strong>
                                  {
                                    (p.profiles || findPerson(p.user_id))
                                      .display_name
                                  }
                                </strong>
                                <small>
                                  <time
                                    dateTime={p.created_at}
                                    title={new Date(
                                      p.created_at,
                                    ).toLocaleString()}
                                  >
                                    {timeAgo(p.created_at, clock)}
                                  </time>
                                </small>
                              </div>
                              {p.user_id === me!.id && (
                                <button
                                  aria-label="Delete your post"
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirm({
                                      title: "Delete this post?",
                                      description:
                                        "This will remove your post from the venue feed. This action cannot be undone.",
                                      label: "Delete post",
                                      action: async () => {
                                        if (supabase) {
                                          const { error } = await supabase
                                            .from("posts")
                                            .delete()
                                            .eq("id", p.id);
                                          if (error) throw error;
                                          await refresh();
                                        } else
                                          setPosts((ps) =>
                                            ps.filter((x) => x.id !== p.id),
                                          );
                                        setNotice("Your post was deleted.");
                                      },
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            <p>{p.content}</p>
                            <span className="post-foot">
                              <MapPin size={13} /> Here at {current.name}
                            </span>
                          </article>
                        ))}
                      {!posts.some((p) => p.venue_id === active!.venue_id) && (
                        <Empty
                          title="Be the first to say hello"
                          text="Start the conversation with a short post."
                        />
                      )}
                    </div>
                    <aside className="people-panel">
                      <h3>
                        People in the loop <span>{people.length}</span>
                      </h3>
                      <p>Send an invitation. Then say hello.</p>
                      {people.map((p) => {
                        const existing = requests.find(
                          (r) =>
                            (r.sender_id === me!.id &&
                              r.receiver_id === p.id) ||
                            (r.sender_id === p.id && r.receiver_id === me!.id),
                        );
                        return (
                          <div className="person" key={p.id}>
                            <Avatar person={p} />
                            <div>
                              <strong>{p.display_name}</strong>
                              <p>{p.bio}</p>
                              <button
                                disabled={busy || !!existing}
                                onClick={() => connect(p)}
                              >
                                {existing ? (
                                  <Check size={14} />
                                ) : (
                                  <Plus size={14} />
                                )}{" "}
                                {existing
                                  ? existing.status === "accepted"
                                    ? "Connected"
                                    : existing.status === "declined"
                                      ? "Request declined"
                                      : "Request pending"
                                  : "Say hello"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!people.length && (
                        <p>
                          You're the first here. Invite a friend to try the app
                          with you.
                        </p>
                      )}
                      <div className="gentle-note">
                        <Leaf size={17} />A request is just an invitation. Be
                        kind, give people space.
                      </div>
                    </aside>
                  </div>
                </>
              ) : (
                <Empty
                  title="Every connection starts somewhere"
                  text="Find a place and check in. Your session lasts two hours."
                  action={() => setPage("Discover")}
                  label="Discover places"
                />
              )}
            </>
          )}
          {page === "Connections" && (
            <>
              <div className="eyebrow">FAMILIAR FACES, NEW CONNECTIONS</div>
              <h1>Your people.</h1>
              <p className="subtitle">
                A hello today could be a friendship tomorrow.
              </p>
              <h2 className="subheading">
                Waiting for your hello <span>{pending.length}</span>
              </h2>
              {pending.map((r) => {
                const p = findPerson(r.sender_id);
                return (
                  <div className="connection-card" key={r.id}>
                    <Avatar person={p} />
                    <div>
                      <h3>{p.display_name}</h3>
                      <p>{p.bio || "Would like to connect with you."}</p>
                    </div>
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() => respond(r, "declined")}
                    >
                      Decline
                    </button>
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() => respond(r, "accepted")}
                    >
                      Accept <Check size={15} />
                    </button>
                  </div>
                );
              })}
              {!pending.length && (
                <p className="muted">
                  No new invitations. Good things take a little time.
                </p>
              )}
              <h2 className="subheading">Your connections</h2>
              {requests
                .filter((r) => r.status === "accepted")
                .map((r) => {
                  const p = findPerson(
                    r.sender_id === me?.id ? r.receiver_id : r.sender_id,
                  );
                  return (
                    <div className="connection-card" key={r.id}>
                      <Avatar person={p} />
                      <div>
                        <h3>{p.display_name}</h3>
                        <p>{p.bio}</p>
                      </div>
                      <span className="connected">
                        <Check size={15} /> Connected
                      </span>
                    </div>
                  );
                })}
              {!requests.some((r) => r.status === "accepted") && (
                <Empty
                  title="Make room for someone new"
                  text="Check into a venue and send a connection request to someone there."
                  action={() => setPage("Discover")}
                  label="Find a place"
                />
              )}
              <h2 className="subheading">Sent invitations</h2>
              {requests
                .filter((r) => r.sender_id === me?.id && r.status === "pending")
                .map((r) => (
                  <div className="connection-card" key={r.id}>
                    <Avatar person={findPerson(r.receiver_id)} />
                    <strong>{findPerson(r.receiver_id).display_name}</strong>
                    <span className="muted">Waiting for a reply</span>
                  </div>
                ))}
            </>
          )}
          {page === "Profile" && (
            <>
              <div className="eyebrow">A LITTLE ABOUT YOU</div>
              <h1>Bring yourself.</h1>
              <p className="subtitle">Good connections start with being you.</p>
              {me ? (
                <form
                  key={profileVersion}
                  className="profile-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const values = new FormData(e.currentTarget);
                    run(async () => {
                      const updated = {
                        ...me,
                        display_name: String(values.get("display_name")).trim(),
                        bio: String(values.get("bio")).trim(),
                      };
                      if (updated.display_name.length < 2)
                        throw new Error(
                          "Use at least two characters for your name.",
                        );
                      if (supabase) {
                        const { error } = await supabase
                          .from("profiles")
                          .update({
                            display_name: updated.display_name,
                            bio: updated.bio,
                          })
                          .eq("id", me.id);
                        if (error) throw error;
                      }
                      setMe(updated);
                      setNotice("Profile saved.");
                    });
                  }}
                >
                  <Avatar person={me} />
                  <label>
                    Display name
                    <input
                      name="display_name"
                      required
                      minLength={2}
                      maxLength={40}
                      defaultValue={me.display_name}
                    />
                  </label>
                  <label>
                    A little about you
                    <textarea
                      name="bio"
                      maxLength={180}
                      defaultValue={me.bio}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    {" "}
                    {busy ? "Saving…" : "Save profile"} <Check size={16} />
                  </button>
                  <div className="profile-info">
                    {supabase
                      ? "Your profile is visible to people at your venue and your connections."
                      : "Demo mode: changes stay in this browser. Live authentication and realtime require a connected Supabase project."}
                  </div>
                  {supabase && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const { error } = await supabase!.auth.signOut();
                          if (error) throw error;
                          setPage("Discover");
                          setNotice("You are signed out.");
                        })
                      }
                    >
                      Sign out <LogOut size={16} />
                    </button>
                  )}
                  {!supabase && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setConfirm({
                          title: "Start fresh?",
                          description:
                            "This resets your demo profile, posts, check-in, and invitations in this browser.",
                          label: "Reset demo",
                          action: async () => {
                            const d = freshDemo();
                            setMe(d.profile);
                            setCheckin(null);
                            setPosts(d.posts);
                            setRequests(d.requests);
                            setProfileVersion((v) => v + 1);
                            setNotice("Demo reset.");
                          },
                        })
                      }
                    >
                      Reset demo
                    </button>
                  )}
                </form>
              ) : (
                <Empty
                  title="Your next hello starts here"
                  text="Create an account or sign in to join the loop."
                  action={() => setAuth(true)}
                  label="Sign in"
                />
              )}
            </>
          )}
          {!loaded && (
            <div className="loading" role="status">
              <LoaderCircle className="spin" size={17} /> Finding your people…
            </div>
          )}
        </main>
      </div>
      <nav className="mobile-nav" inert={!!selected || auth || !!confirm}>
        {nav.map((n, i) => {
          const Icon = [Compass, MessageCircle, Users, Heart][i];
          return (
            <button
              aria-current={page === n ? "page" : undefined}
              className={page === n ? "active" : ""}
              onClick={() => setPage(n)}
              key={n}
            >
              <Icon size={20} />
              <span>{n === "Venue feed" ? "Feed" : n}</span>
            </button>
          );
        })}
      </nav>
      {notice && (
        <div role="status" className="toast">
          <Check size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {selected && (
        <div className="overlay" onClick={() => !busy && setSelected(null)}>
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="venue-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close venue"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <VenueArt venue={selected} />
            <div className="modal-body">
              <span className="eyebrow">YOUR NEXT HELLO</span>
              <h2 id="venue-title">{selected.name}</h2>
              <p className="venue-location">
                <MapPin size={16} />
                {selected.address}
              </p>
              <p>{selected.description}</p>
              <div className="modal-detail">
                <Clock size={18} />
                <div>
                  <strong>Stay in the loop for 2 hours</strong>
                  <small>
                    Leave whenever you like. Your feed is only visible while
                    checked in.
                  </small>
                </div>
              </div>
              {active && active.venue_id !== selected.id && (
                <p className="switch-note">
                  Checking in here will end your current venue session.
                </p>
              )}
              <div>
                {error && (
                  <div className="error-banner" role="alert">
                    <AlertCircle size={17} />
                    {error}
                  </div>
                )}
              </div>
              <button
                className="primary full"
                disabled={busy || (offline && !!supabase)}
                onClick={() => enter(selected!)}
              >
                {active?.venue_id === selected.id
                  ? "Open venue feed"
                  : "Check in & say hello"}
                <ArrowRight size={18} />
              </button>
              <small className="disclaimer">
                Venue selection is manual. GPS presence is not verified.
              </small>
            </div>
          </section>
        </div>
      )}
      {confirm && (
        <div className="overlay" onClick={() => !busy && setConfirm(null)}>
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            className="modal confirmation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="confirmation-icon">
              <Info size={24} />
            </span>
            <h2 id="confirmation-title">{confirm.title}</h2>
            <p>{confirm.description}</p>
            <div>
              {error && (
                <div className="error-banner" role="alert">
                  <AlertCircle size={17} />
                  {error}
                </div>
              )}
            </div>
            <div className="confirmation-actions">
              <button
                disabled={busy}
                className="secondary"
                onClick={() => setConfirm(null)}
              >
                Keep it
              </button>
              <button
                disabled={busy}
                className="primary"
                onClick={() =>
                  run(async () => {
                    await confirm.action();
                    setConfirm(null);
                  })
                }
              >
                {busy ? "Please wait…" : confirm.label}
              </button>
            </div>
          </section>
        </div>
      )}
      {auth && (
        <div className="overlay">
          <form
            ref={(el) => {
              modalRef.current = el;
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            className="modal auth-modal"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (!supabase) return;
                if (signup && name.trim().length < 2)
                  throw new Error("Use at least two characters for your name.");
                const { error } = signup
                  ? await supabase.auth.signUp({
                      email: email.trim(),
                      password,
                      options: {
                        data: { display_name: name.trim() },
                        emailRedirectTo: window.location.origin,
                      },
                    })
                  : await supabase.auth.signInWithPassword({
                      email: email.trim(),
                      password,
                    });
                if (error) throw error;
                setAuth(false);
                setNotice(
                  signup
                    ? "Check your email to confirm your account."
                    : "Welcome back.",
                );
                await refresh();
              });
            }}
          >
            <button
              type="button"
              className="close"
              aria-label="Close login"
              disabled={busy}
              onClick={() => setAuth(false)}
            >
              <X />
            </button>
            <span className="brand-icon">
              <Leaf />
            </span>
            <h2 id="auth-title">
              {signup ? "Join your little world." : "Welcome back."}
            </h2>
            <p>
              {signup
                ? "A place for your next real connection."
                : "Your next hello is waiting."}
            </p>
            {signup && (
              <label>
                Your name
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div>
              {error && (
                <div className="error-banner" role="alert">
                  <AlertCircle size={17} />
                  {error}
                </div>
              )}
            </div>
            <button className="primary full" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={16} />
            </button>
            <button
              disabled={busy}
              className="text-button"
              type="button"
              onClick={() => setSignup(!signup)}
            >
              {signup
                ? "Already in the loop? Sign in"
                : "New here? Create an account"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  action,
  label,
}: {
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <span>
        <Leaf size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={action}>
          {label}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function VenueArt({ venue }: { venue: Venue }) {
  return (
    <div className={"venue-art " + venue.cover}>
      <span className="venue-category">{venue.category}</span>
      <div className="scene">
        {venue.cover === "cafe" ? (
          <>
            <div className="cafe-window" />
            <div className="cafe-table" />
            <div className="cafe-cup">
              <Coffee size={52} />
            </div>
            <div className="cafe-plant">
              <Leaf size={64} />
            </div>
          </>
        ) : venue.cover === "work" ? (
          <>
            <div className="work-window" />
            <div className="work-desk" />
            <div className="work-laptop" />
            <div className="work-lamp" />
          </>
        ) : venue.cover === "park" ? (
          <>
            <div className="sun" />
            <div className="tree t1" />
            <div className="tree t2" />
            <div className="tree t3" />
            <div className="path" />
          </>
        ) : (
          <>
            <div className="studio-frame" />
            <div className="studio-vase" />
            <div className="studio-circle" />
          </>
        )}
      </div>
      <span className="art-caption">
        {venue.cover === "cafe"
          ? "STAY A LITTLE LONGER"
          : venue.cover === "work"
            ? "MAKE SOMETHING GOOD"
            : venue.cover === "park"
              ? "A BREATH OF FRESH AIR"
              : "ROOM FOR NEW IDEAS"}
      </span>
    </div>
  );
}
