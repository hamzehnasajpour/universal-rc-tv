import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Disc3,
  ExternalLink,
  FastForward,
  Grid2X2,
  Heart,
  Home,
  Info,
  Keyboard,
  Layers,
  Lightbulb,
  Link,
  ListVideo,
  LoaderCircle,
  Monitor,
  MonitorOff,
  Network,
  Pause,
  Play,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Rewind,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Subtitles,
  Tv,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Trash2,
} from "lucide-react";
import "./remote.css";

const VIEWS = [
  { id: "remote", label: "Remote", icon: Radio },
  { id: "apps", label: "Apps", icon: Grid2X2 },
  { id: "channels", label: "Channels", icon: ListVideo },
  { id: "ambilight", label: "Ambilight", icon: Lightbulb },
  { id: "settings", label: "TV settings", icon: Settings2 },
  { id: "api", label: "API console", icon: Code2 },
];
const VIEW_TITLES = {
  remote: "Remote control",
  apps: "Your applications",
  channels: "TV channels",
  ambilight: "Set the atmosphere",
  settings: "TV settings",
  api: "JointSpace console",
};
async function api(endpoint, options = {}) {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Request failed."), {
      code: result.code,
    });
  return result;
}
const post = (endpoint, body = {}) =>
  api(endpoint, { method: "POST", body: JSON.stringify(body) });
function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={20} strokeWidth={1.8} />
    </button>
  );
}
function Badge({ connected, children, demo }) {
  return (
    <span
      className={`badge ${connected ? "connected" : ""} ${demo ? "demo" : ""}`}
    >
      <span className="status-dot" />
      {children}
    </span>
  );
}
function Empty({ icon: Icon = Monitor, title }) {
  return (
    <div className="empty-state">
      <Icon size={34} strokeWidth={1.3} />
      <h3>{title}</h3>
    </div>
  );
}
function Modal({ title, onClose, children, wide = false }) {
  const container = useRef(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const previous = document.activeElement;
    container.current
      ?.querySelector("input, button, select, textarea")
      ?.focus();
    const listener = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const elements = [
          ...container.current.querySelectorAll(
            'button, input, select, textarea, [tabindex="0"]',
          ),
        ].filter((element) => !element.disabled);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={container}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  );
}
function Devices({
  devices,
  scan,
  subnets,
  selected,
  onSelect,
  onClose,
  reload,
  notify,
}) {
  const [host, setHost] = useState(""),
    [subnet, setSubnet] = useState(subnets[0] || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(callback) {
    setBusy(true);
    setError("");
    try {
      await callback();
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Your devices" onClose={onClose}>
      <div className="scan-status">
        <span className="scan-icon">
          <Wifi size={24} />
        </span>
        <div>
          <h3>{scan.running ? "Searching your network" : "Local network"}</h3>
          <p>
            {scan.running
              ? `${scan.scanned} of ${scan.total} addresses checked`
              : `${devices.filter((tv) => !tv.demo).length} Philips TVs found`}
          </p>
        </div>
        <Badge connected={!scan.running}>
          {scan.running ? "Scanning" : "Ready"}
        </Badge>
      </div>
      {scan.running && (
        <progress
          max={scan.total || 1}
          value={scan.scanned}
          aria-label="Network scan progress"
        />
      )}
      {scan.error && (
        <div className="form-error" role="alert">
          {scan.error}
        </div>
      )}
      <div className="device-list">
        {devices.map((tv) => (
          <div
            className={`device-row ${selected === tv.id ? "selected" : ""}`}
            key={tv.id}
          >
            <button
              className="device-select"
              onClick={() => {
                onSelect(tv.id);
                onClose();
              }}
            >
              <Tv size={23} />
              <span>
                <strong>{tv.name}</strong>
                <small>
                  {tv.demo ? "Demo device" : `${tv.host} / API ${tv.version}`}
                </small>
              </span>
              {selected === tv.id && <Check size={18} />}
            </button>
            <IconButton
              icon={Trash2}
              label={`Forget ${tv.name}`}
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api(`/devices/${tv.id}`, { method: "DELETE" });
                  notify("Device forgotten");
                })
              }
            />
          </div>
        ))}
      </div>
      {!devices.length && <Empty title="No TVs found yet" icon={Search} />}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action(async () => {
            await post("/discovery", { subnet: subnet || undefined });
            notify("Network scan started");
          });
        }}
      >
        <label htmlFor="subnet">Network range</label>
        <div className="input-row">
          <input
            id="subnet"
            value={subnet}
            onChange={(event) => setSubnet(event.target.value)}
            placeholder="192.168.1.0/24"
          />
          <button className="button primary" disabled={busy || scan.running}>
            <RefreshCw size={16} className={scan.running ? "spin" : ""} />
            Scan
          </button>
        </div>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action(async () => {
            const tv = await post("/devices", { host: host.trim() });
            await reload();
            onSelect(tv.id);
            onClose();
          });
        }}
        className="manual-form"
      >
        <label htmlFor="tv-ip">TV IP address</label>
        <div className="input-row">
          <input
            id="tv-ip"
            inputMode="decimal"
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="192.168.1.50"
            required
          />
          <button className="button" disabled={busy}>
            <Plus size={16} />
            Add TV
          </button>
        </div>
      </form>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <footer className="modal-footer">
        <span>
          <ShieldCheck size={15} />
          Local connection
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            action(async () => {
              const tv = await post("/demo");
              await reload();
              onSelect(tv.id);
              onClose();
            })
          }
        >
          Try demo
          <ArrowRight size={15} />
        </button>
      </footer>
    </Modal>
  );
}
function Pairing({ tv, onClose, onPaired }) {
  const [requested, setRequested] = useState(false),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [expires, setExpires] = useState(0),
    [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function request() {
    setBusy(true);
    setError("");
    try {
      const result = await post(`/devices/${tv.id}/pair/request`);
      setExpires(result.expiresAt);
      setRequested(true);
      setClock(Date.now());
      setPin("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const remaining = Math.max(0, Math.ceil((expires - clock) / 1000));
  return (
    <Modal title="Pair your TV" onClose={onClose}>
      <div className="pair-visual">
        <Link size={34} />
        <h3>{tv.name}</h3>
        <p>{tv.host}</p>
      </div>
      {!requested ? (
        <button
          className="button primary full"
          disabled={busy}
          onClick={request}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Link size={18} />
          )}
          Request TV PIN
        </button>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post(`/devices/${tv.id}/pair/grant`, { pin });
              await onPaired();
              onClose();
            } catch (failure) {
              setError(failure.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="pair-pin">PIN displayed on your TV</label>
          <input
            id="pair-pin"
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            maxLength={8}
            className="pin-input"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            required
          />
          <div className="pair-timer">
            {remaining ? `Expires in ${remaining}s` : "PIN expired"}
          </div>
          <button
            className="button primary full"
            disabled={busy || !remaining || pin.length < 4}
          >
            <ShieldCheck size={18} />
            Pair device
          </button>
          <button
            type="button"
            className="text-button new-pin"
            onClick={request}
            disabled={busy}
          >
            Request a new PIN
          </button>
        </form>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
function Remote({
  ready,
  send,
  status,
  catalog,
  tv,
  openKeyboard,
  openNumbers,
}) {
  const key = (value) => send("key", value);
  const [draftVolume, setDraftVolume] = useState(null);
  const volume =
    draftVolume && draftVolume.current === status?.volume?.current
      ? draftVolume.value
      : null;
  const setVolume = (value) =>
    setDraftVolume({ current: status?.volume?.current, value });
  return (
    <div className="remote-layout">
      <section className="remote-tool" aria-label="TV remote">
        <div className="remote-top">
          <span className="section-label">ESSENTIALS</span>
          <IconButton
            icon={Power}
            label="Toggle standby"
            className="power-button"
            disabled={!ready}
            onClick={() => key("Standby")}
          />
        </div>
        <div className="essential-row">
          <button
            className="remote-command"
            disabled={!ready}
            onClick={() => key("Source")}
          >
            <Layers size={20} />
            Source
          </button>
          <button
            className="remote-command"
            disabled={!ready}
            onClick={() => key("Home")}
          >
            <Home size={20} />
            Home
          </button>
          <button
            className="remote-command"
            disabled={!ready}
            onClick={() => key("Options")}
          >
            <SlidersHorizontal size={20} />
            Options
          </button>
        </div>
        <div className="dpad" aria-label="Navigation pad">
          <IconButton
            icon={ArrowUp}
            label="Navigate up"
            className="dpad-up"
            disabled={!ready}
            onClick={() => key("CursorUp")}
          />
          <IconButton
            icon={ArrowLeft}
            label="Navigate left"
            className="dpad-left"
            disabled={!ready}
            onClick={() => key("CursorLeft")}
          />
          <button
            className="dpad-ok"
            aria-label="Confirm selection"
            disabled={!ready}
            onClick={() => key("Confirm")}
          >
            OK
          </button>
          <IconButton
            icon={ArrowRight}
            label="Navigate right"
            className="dpad-right"
            disabled={!ready}
            onClick={() => key("CursorRight")}
          />
          <IconButton
            icon={ArrowDown}
            label="Navigate down"
            className="dpad-down"
            disabled={!ready}
            onClick={() => key("CursorDown")}
          />
        </div>
        <div className="navigation-row">
          <button
            className="remote-command"
            disabled={!ready}
            onClick={() => key("Back")}
          >
            <ArrowLeft size={19} />
            Back
          </button>
          <IconButton
            icon={Info}
            label="Program information"
            disabled={!ready}
            onClick={() => key("Info")}
          />
          <button className="remote-command" onClick={openNumbers}>
            <Grid2X2 size={19} />
            Keypad
          </button>
        </div>
        <div className="remote-divider" />
        <div className="rocker-row">
          <div className="rocker-group">
            <span className="section-label">VOLUME</span>
            <div className="rocker">
              <IconButton
                icon={Plus}
                label="Volume up"
                disabled={!ready}
                onClick={() => key("VolumeUp")}
              />
              <Volume2 size={19} />
              <button
                className="icon-button"
                title="Volume down"
                aria-label="Volume down"
                disabled={!ready}
                onClick={() => key("VolumeDown")}
              >
                <span className="minus" />
              </button>
            </div>
          </div>
          <div className="mute-group">
            <IconButton
              icon={status?.volume?.muted ? VolumeX : Volume1}
              label={status?.volume?.muted ? "Unmute" : "Mute"}
              className={status?.volume?.muted ? "active" : ""}
              disabled={!ready}
              onClick={() => key("Mute")}
            />
            <span>{status?.volume?.muted ? "Muted" : "Mute"}</span>
          </div>
          <div className="rocker-group">
            <span className="section-label">CHANNEL</span>
            <div className="rocker">
              <IconButton
                icon={ArrowUp}
                label="Channel up"
                disabled={!ready}
                onClick={() => key("ChannelStepUp")}
              />
              <span className="channel-symbol">CH</span>
              <IconButton
                icon={ArrowDown}
                label="Channel down"
                disabled={!ready}
                onClick={() => key("ChannelStepDown")}
              />
            </div>
          </div>
        </div>
        <div className="playback-row">
          <IconButton
            icon={Rewind}
            label="Rewind"
            disabled={!ready}
            onClick={() => key("Rewind")}
          />
          <IconButton
            icon={Play}
            label="Play"
            className="play-button"
            disabled={!ready}
            onClick={() => key("Play")}
          />
          <IconButton
            icon={Pause}
            label="Pause"
            disabled={!ready}
            onClick={() => key("Pause")}
          />
          <IconButton
            icon={Square}
            label="Stop"
            disabled={!ready}
            onClick={() => key("Stop")}
          />
          <IconButton
            icon={FastForward}
            label="Fast forward"
            disabled={!ready}
            onClick={() => key("FastForward")}
          />
        </div>
        <div className="color-keys">
          {[
            ["RedColour", "red"],
            ["GreenColour", "green"],
            ["YellowColour", "yellow"],
            ["BlueColour", "blue"],
          ].map(([value, color]) => (
            <button
              key={value}
              className={`color-key ${color}`}
              aria-label={`${color} function key`}
              title={`${color} function key`}
              disabled={!ready}
              onClick={() => key(value)}
            />
          ))}
        </div>
        <button className="keyboard-button" onClick={openKeyboard}>
          <Keyboard size={19} />
          Keyboard & more
          <ChevronRight size={16} />
        </button>
      </section>
      <aside className="tv-overview">
        <div className="overview-title">
          <h2>Your television</h2>
          <span className="section-label">
            {tv?.demo ? "DEMO" : "LIVE STATUS"}
          </span>
        </div>
        <div className={`television ${ready ? "on" : ""}`}>
          <div className="tv-screen">
            {tv?.demo && status?.power?.powerstate === "On" && status?.screen?.screenstate !== "Off" ? (
              <img
                src="/landscape.jpg"
                alt="Mountain landscape on the demo television"
              />
            ) : (
              <div className="tv-screen-state">
                <Tv size={32} strokeWidth={1.1} />
                <span>
                  {!tv
                    ? "No TV connected"
                    : !ready
                      ? "Waiting for TV"
                      : status?.power?.powerstate === "Standby"
                        ? "Standby"
                        : status?.screen?.screenstate === "Off" ? "Screen off" : tv.name}
                </span>
              </div>
            )}
            <span className="screen-corner">
              {tv?.demo ? "DEMO PREVIEW" : "PHILIPS"}
            </span>
          </div>
          <div className="tv-bezel">
            PHILIPS
            <span />
          </div>
        </div>
        <div className="tv-stand" />
        <div className="overview-device">
          <div>
            <h3>{tv?.name || "Philips TV"}</h3>
            <p>
              {tv?.demo
                ? "Philips OLED / Android TV"
                : tv?.system?.model ||
                  (tv ? `JointSpace API ${tv.version}` : "Not connected")}
            </p>
          </div>
          <Badge connected={ready} demo={tv?.demo}>
            {tv?.demo ? "Demo" : ready ? "Connected" : "Offline"}
          </Badge>
        </div>
        <dl className="device-facts">
          <div>
            <dt>
              <Power size={16} />
              Power
            </dt>
            <dd>{status?.power?.powerstate || "Unknown"}</dd>
          </div>
          <div>
            <dt>
              <Network size={16} />
              IP address
            </dt>
            <dd>
              {tv?.demo ? "Simulated device" : tv?.host || "Not available"}
            </dd>
          </div>
          <div>
            <dt>
              <ShieldCheck size={16} />
              Connection
            </dt>
            <dd>
              {tv
                ? tv.protocol === "https"
                  ? "HTTPS / local"
                  : "HTTP / local"
                : "Not available"}
            </dd>
          </div>
        </dl>
        <div className="volume-panel">
          <div>
            <span>
              <Volume2 size={18} />
              Volume
            </span>
            <strong>
              {status?.volume
                ? `${volume ?? status.volume.current} / ${status.volume.max}`
                : "--"}
            </strong>
          </div>
          <input
            aria-label="TV volume"
            type="range"
            min={status?.volume?.min ?? 0}
            max={status?.volume?.max ?? 60}
            value={volume ?? status?.volume?.current ?? 0}
            disabled={!ready || !status?.volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            onPointerUp={(event) => {
              if (volume !== null)
                send("volume", Number(event.currentTarget.value));
            }}
            onKeyUp={(event) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                  "End",
                ].includes(event.key)
              )
                send("volume", Number(event.currentTarget.value));
            }}
          />
        </div>
        <div className="quick-controls">
          <button
            className="button"
            disabled={!ready}
            onClick={() => key("Subtitle")}
          >
            <Subtitles size={17} />
            Subtitles
          </button>
          <button
            className="button"
            disabled={!ready}
            onClick={() => key("AmbilightOnOff")}
          >
            <Lightbulb size={17} />
            Ambilight
          </button>
        </div>
        <div className="mini-apps">
          <div className="overview-title">
            <h2>Quick launch</h2>
            <Grid2X2 size={16} />
          </div>
          {catalog?.apps?.applications?.length ? (
            <div className="quick-app-grid">
              {catalog.apps.applications.slice(0, 4).map((app, index) => (
                <button
                  key={app.id}
                  disabled={!ready}
                  onClick={() => send("app", app.id)}
                >
                  <span className={`app-mark app-color-${index % 6}`}>
                    {app.label?.slice(0, 1) || <Grid2X2 size={18} />}
                  </span>
                  <span>{app.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mini-empty">
              {tv ? "No applications available" : "No device selected"}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
function KeyboardPanel({ ready, send, onClose, keys }) {
  const [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false);
  const extra = [
    { label: "TV guide / Find", key: "Find", icon: Search },
    { label: "Watch TV", key: "WatchTV", icon: Tv },
    { label: "Teletext", key: "Teletext", icon: ListVideo },
    { label: "Picture format", key: "Viewmode", icon: Monitor },
    { label: "Adjust", key: "Adjust", icon: SlidersHorizontal },
    { label: "Record", key: "Record", icon: Circle },
    { label: "Previous", key: "Previous", icon: SkipBack },
    { label: "Next", key: "Next", icon: SkipForward },
    { label: "Play / pause", key: "PlayPause", icon: Play },
    { label: "Online", key: "Online", icon: ExternalLink },
  ];
  return (
    <Modal title="Keyboard & more" onClose={onClose} wide>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          if (await send("text", text)) setText("");
          setBusy(false);
        }}
      >
        <label htmlFor="tv-text">Text input</label>
        <div className="input-row">
          <input
            id="tv-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            placeholder="Search on your TV..."
            required
          />
          <IconButton
            icon={Send}
            label="Send text to TV"
            className="primary"
            disabled={!ready || busy || !text}
            type="submit"
          />
        </div>
      </form>
      <form
        className="url-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          await send("url", url);
          setBusy(false);
        }}
      >
        <label htmlFor="tv-url">Open URL</label>
        <div className="input-row">
          <input
            id="tv-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
            required
          />
          <IconButton
            icon={ExternalLink}
            label="Open URL on TV"
            type="submit"
            disabled={!ready || busy}
          />
        </div>
      </form>
      <h3 className="subheading">Additional controls</h3>
      <div className="extra-controls">
        {extra
          .filter((item) => !keys || keys.includes(item.key))
          .map((item) => (
            <button
              key={item.key}
              className="button"
              disabled={!ready}
              onClick={() => send("key", item.key)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
      </div>
    </Modal>
  );
}
function Keypad({ ready, send, onClose }) {
  return (
    <Modal title="Number keypad" onClose={onClose}>
      <div className="number-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
          <button
            key={number}
            disabled={!ready}
            onClick={() => send("key", `Digit${number}`)}
          >
            {number}
          </button>
        ))}
        <button disabled={!ready} onClick={() => send("key", "Dot")}>
          .
        </button>
        <button disabled={!ready} onClick={() => send("key", "Digit0")}>
          0
        </button>
        <IconButton
          icon={ArrowLeft}
          label="Back"
          disabled={!ready}
          onClick={() => send("key", "Back")}
        />
      </div>
    </Modal>
  );
}
function Library({ type, ready, catalog, send }) {
  const [search, setSearch] = useState(""),
    [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("philips-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const isApps = type === "apps";
  const raw = isApps
    ? catalog?.apps?.applications || []
    : catalog?.channels?.Channel ||
      Object.entries(catalog?.channels || {}).map(([id, channel]) => ({
        ...channel,
        ccid: id,
      }));
  const items = raw.filter(
    (item) =>
      `${item.label || item.name || ""} ${item.preset || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!favoriteOnly || favorites.includes(`${type}:${item.id ?? item.ccid}`)),
  );
  function favorite(id) {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("philips-favorites", JSON.stringify(next));
  }
  return (
    <section className="library-view">
      <div className="library-toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label={`Search ${type}`}
            placeholder={`Search ${type}...`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button
          className={`button ${favoriteOnly ? "active" : ""}`}
          aria-pressed={favoriteOnly}
          onClick={() => setFavoriteOnly(!favoriteOnly)}
        >
          <Heart size={17} />
          Favorites
        </button>
        <span className="item-count">
          {items.length} {type}
        </span>
      </div>
      {!raw.length ? (
        <Empty
          icon={isApps ? Grid2X2 : ListVideo}
          title={isApps ? "No applications available" : "No channels available"}
        />
      ) : !items.length ? (
        <Empty icon={Search} title="No matches" />
      ) : (
        <div className={isApps ? "app-grid" : "channel-list"}>
          {items.map((item, index) => {
            const id = item.id ?? item.ccid;
            return (
              <div
                className={isApps ? "app-tile" : "channel-row"}
                key={`${id}-${index}`}
              >
                <button
                  className="library-item"
                  disabled={!ready}
                  onClick={() => send(isApps ? "app" : "channel", id)}
                >
                  <span className={`app-mark app-color-${index % 6}`}>
                    {isApps
                      ? item.label?.slice(0, 1) || "A"
                      : item.preset || index + 1}
                  </span>
                  <span>
                    <strong>{item.label || item.name}</strong>
                    {isApps && (
                      <small>
                        {item.intent?.component?.packageName ||
                          "TV application"}
                      </small>
                    )}
                  </span>
                  {!isApps && <Play size={17} />}
                </button>
                <IconButton
                  icon={Heart}
                  label={`${favorites.includes(`${type}:${id}`) ? "Remove" : "Add"} ${item.label || item.name} ${favorites.includes(`${type}:${id}`) ? "from" : "to"} favorites`}
                  className={
                    favorites.includes(`${type}:${id}`) ? "favorite" : ""
                  }
                  onClick={() => favorite(`${type}:${id}`)}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
function Ambilight({ ready, catalog, status, send }) {
  const [color, setColor] = useState("#68d5a3");
  const styles = catalog?.styles?.supportedStyles || [],
    current = status?.ambilight?.styleName;
  const available =
    catalog?.capabilities?.ambilightConfig ||
    catalog?.capabilities?.ambilightMode;
  const enabled = current
    ? current !== "OFF"
    : catalog?.ambilightPower?.power === "On";
  const icons = {
    FOLLOW_VIDEO: Monitor,
    FOLLOW_AUDIO: AudioLines,
    FOLLOW_COLOR: Lightbulb,
    OFF: MonitorOff,
  };
  return (
    <section className="ambilight-view">
      <div className="ambilight-header">
        <div>
          <h2>Ambilight</h2>
          <Badge connected={ready && Boolean(enabled)}>
            {available ? (enabled ? "On" : "Off") : "Unavailable"}
          </Badge>
        </div>
        <button
          className={`toggle ${enabled ? "enabled" : ""}`}
          role="switch"
          aria-checked={Boolean(enabled)}
          aria-label="Ambilight power"
          disabled={!ready || !available}
          onClick={() =>
            send(
              catalog?.capabilities?.ambilightPower ? "ambilightPower" : "key",
              catalog?.capabilities?.ambilightPower
                ? enabled
                  ? "Off"
                  : "On"
                : "AmbilightOnOff",
            )
          }
        >
          <span />
        </button>
      </div>
      <div className="ambilight-preview" style={{ "--light-color": color }}>
        <div className="ambient-tv">
          <img
            src="/landscape.jpg"
            alt="Mountain landscape Ambilight color preview"
          />
          <span>COLOR PREVIEW</span>
        </div>
      </div>
      <h3 className="subheading">Light mode</h3>
      <div className="light-modes">
        {styles
          .filter((style) => style.styleName !== "OFF")
          .map((style) => {
            const Icon = icons[style.styleName] || Lightbulb;
            return (
              <button
                className={current === style.styleName ? "selected" : ""}
                key={style.styleName}
                disabled={!ready || !catalog?.capabilities?.ambilightConfig}
                onClick={() =>
                  send("ambilight", {
                    styleName: style.styleName,
                    isExpert: false,
                    ...(style.menuSettings?.[0]
                      ? { menuSetting: style.menuSettings[0] }
                      : {}),
                  })
                }
              >
                <Icon size={22} />
                <span>
                  {style.styleName
                    .replace("FOLLOW_", "Follow ")
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </span>
                {current === style.styleName && <Check size={16} />}
              </button>
            );
          })}
      </div>
      {!available && (
        <Empty icon={Lightbulb} title="Ambilight is not available on this TV" />
      )}
      {styles.find((style) => style.styleName === current)?.menuSettings
        ?.length > 0 && (
        <div className="preset-field">
          <label htmlFor="light-preset">Preset</label>
          <select
            id="light-preset"
            value={status?.ambilight?.menuSetting || ""}
            disabled={!ready}
            onChange={(event) =>
              send("ambilight", {
                styleName: current,
                isExpert: false,
                menuSetting: event.target.value,
              })
            }
          >
            <option value="" disabled>
              Select preset
            </option>
            {styles
              .find((style) => style.styleName === current)
              .menuSettings.map((preset) => (
                <option key={preset} value={preset}>
                  {preset.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="color-section">
        <div>
          <h3>Custom color</h3>
          <span>{color.toUpperCase()}</span>
        </div>
        <div className="swatches">
          {[
            "#68d5a3",
            "#fa665d",
            "#f4c74d",
            "#58a7ef",
            "#e17ac3",
            "#ffffff",
          ].map((value) => (
            <button
              key={value}
              title={value}
              aria-label={`Select color ${value}`}
              className={color === value ? "selected" : ""}
              style={{ background: value }}
              onClick={() => setColor(value)}
            >
              {color === value && <Check size={17} />}
            </button>
          ))}
          <input
            type="color"
            aria-label="Custom Ambilight color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
          <button
            className="button primary"
            disabled={!ready || !available}
            onClick={() => send("ambilightColor", color)}
          >
            Apply
            <Check size={16} />
          </button>
        </div>
      </div>
      {catalog?.capabilities?.hue && (
        <div className="setting-row">
          <span>
            <Lightbulb size={19} />
            Ambilight + Hue
          </span>
          <button
            className="button"
            disabled={!ready}
            onClick={() =>
              send("hue", status?.hue?.power === "On" ? "Off" : "On")
            }
          >
            {status?.hue?.power === "On" ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}
    </section>
  );
}
function Settings({ ready, tv, catalog, status, send, notify }) {
  const [filter, setFilter] = useState(""),
    [node, setNode] = useState(null),
    [value, setValue] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function flatten(entry, ancestry = []) {
    if (!entry || typeof entry !== "object") return [];
    const name =
        entry.string_id ||
        entry.label ||
        entry.name ||
        `Node ${entry.node_id ?? entry.nodeid ?? ""}`,
      children = entry.nodes || entry.children || [];
    const current = {
      ...entry,
      label: name.replaceAll("_", " "),
      trail: ancestry.join(" / "),
      id: entry.node_id ?? entry.nodeid ?? entry.Nodeid,
    };
    return [
      current,
      ...children.flatMap((child) =>
        flatten(child, [...ancestry, current.label]),
      ),
    ];
  }
  const root = catalog?.settings?.node || catalog?.settings;
  const nodes = (
    Array.isArray(root) ? root.flatMap((item) => flatten(item)) : flatten(root)
  ).filter(
    (item) =>
      item.id !== undefined &&
      `${item.label} ${item.trail}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  async function openNode(item) {
    setNode(item);
    setValue("");
    setBusy(true);
    setError("");
    try {
      const result = await post(`/devices/${tv.id}/api`, {
        method: "POST",
        endpoint: "menuitems/settings/current",
        body: { nodes: [{ nodeid: Number(item.id) }] },
      });
      setValue(
        JSON.stringify(
          result.values?.[0]?.value?.data || result.values?.[0]?.data || {},
          null,
          2,
        ),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-view">
      <h2>Device</h2>
      <dl className="settings-facts">
        <div>
          <dt>Name</dt>
          <dd>{tv?.name || "--"}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{tv?.system?.model || "--"}</dd>
        </div>
        <div>
          <dt>API version</dt>
          <dd>{tv?.version || "--"}</dd>
        </div>
        <div>
          <dt>Operating system</dt>
          <dd>{tv?.system?.os_type || "--"}</dd>
        </div>
      </dl>
      <div className="setting-row">
        <span>
          <Power size={19} />
          Power
        </span>
        <div className="segmented">
          <button
            disabled={!ready}
            className={status?.power?.powerstate === "On" ? "selected" : ""}
            onClick={() => send("power", "On")}
          >
            On
          </button>
          <button
            disabled={!ready}
            className={
              status?.power?.powerstate === "Standby" ? "selected" : ""
            }
            onClick={() => send("power", "Standby")}
          >
            Standby
          </button>
        </div>
      </div>
      {catalog?.capabilities?.screen && (
        <div className="setting-row">
          <span>
            <Monitor size={19} />
            Screen
          </span>
          <button
            className={`toggle ${status?.screen?.screenstate === "On" ? "enabled" : ""}`}
            role="switch"
            aria-label="Screen power"
            aria-checked={status?.screen?.screenstate === "On"}
            disabled={!ready}
            onClick={() =>
              send(
                "screen",
                status?.screen?.screenstate === "On" ? "Off" : "On",
              )
            }
          >
            <span />
          </button>
        </div>
      )}
      <h2 className="settings-heading">Input sources</h2>
      <div className="source-list">
        {catalog?.sources && (tv?.version < 5 || tv?.demo) ? (
          Object.entries(catalog.sources).map(([id, source]) => (
            <button
              className="button"
              key={id}
              disabled={!ready}
              onClick={() => send("source", id)}
            >
              <Layers size={18} />
              {source.name || id}
            </button>
          ))
        ) : (
          <button
            className="button"
            disabled={!ready}
            onClick={() => send("key", "Source")}
          >
            <Layers size={18} />
            Open TV source menu
          </button>
        )}
      </div>
      <div className="settings-tree-header">
        <h2>TV menu</h2>
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Filter TV settings"
            placeholder="Filter settings..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>
      {nodes.length ? (
        <div className="settings-tree">
          {nodes.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              disabled={!ready}
              onClick={() => openNode(item)}
            >
              <span>
                <strong>{item.label}</strong>
                <small>{item.trail || "TV menu"}</small>
              </span>
              <span className="node-id">{item.id}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={Settings2} title="No menu settings available" />
      )}
      {node && (
        <Modal title={node.label} onClose={() => setNode(null)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const data = JSON.parse(value);
                await post(`/devices/${tv.id}/api`, {
                  method: "POST",
                  endpoint: "menuitems/settings/update",
                  body: {
                    values: [{ value: { Nodeid: Number(node.id), data } }],
                  },
                });
                notify("TV setting updated");
                setNode(null);
              } catch (failure) {
                setError(failure.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="setting-data">Setting data / JSON</label>
            <textarea
              id="setting-data"
              className="code-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={9}
              disabled={busy}
              required
            />
            <button className="button primary" disabled={busy || !value}>
              <Check size={17} />
              Apply setting
            </button>
          </form>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
function Console({ tv, ready }) {
  const [method, setMethod] = useState("GET"),
    [endpoint, setEndpoint] = useState("system"),
    [body, setBody] = useState("{}"),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [elapsed, setElapsed] = useState(0);
  return (
    <section className="console-view">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const start = performance.now();
          try {
            const data = await post(`/devices/${tv.id}/api`, {
              method,
              endpoint,
              body: method === "POST" ? JSON.parse(body) : undefined,
            });
            setResult(data);
          } catch (failure) {
            setError(failure.message);
          } finally {
            setElapsed(Math.round(performance.now() - start));
            setBusy(false);
          }
        }}
      >
        <div className="console-url">
          <select
            aria-label="Request method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option>GET</option>
            <option>POST</option>
          </select>
          <span className="api-prefix">/{tv?.version || 6}/</span>
          <input
            aria-label="JointSpace endpoint"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            required
          />
          <button className="button primary" disabled={!ready || busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Send size={17} />
            )}
            Send
          </button>
        </div>
        <div className="endpoint-picks">
          {[
            "system",
            "audio/volume",
            "powerstate",
            "ambilight/currentconfiguration",
            "menuitems/settings/structure",
            "recordings/list",
          ].map((path) => (
            <button type="button" key={path} onClick={() => setEndpoint(path)}>
              {path}
            </button>
          ))}
        </div>
        {method === "POST" && (
          <div className="request-body">
            <label htmlFor="request-body">Request body / JSON</label>
            <textarea
              id="request-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={9}
              className="code-input"
            />
          </div>
        )}
      </form>
      <div className="response-header">
        <span>Response</span>
        {result !== null && (
          <Badge connected={!error}>{error ? "Failed" : `${elapsed} ms`}</Badge>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <pre className="response-body">
        {result === null ? "No response yet." : JSON.stringify(result, null, 2)}
      </pre>
    </section>
  );
}
export default function App() {
  const [devices, setDevices] = useState([]),
    [selected, setSelected] = useState(
      () => localStorage.getItem("philips-device") || "",
    ),
    [scan, setScan] = useState({ running: false, scanned: 0, total: 0 }),
    [subnets, setSubnets] = useState([]),
    [view, setView] = useState("remote"),
    [dialog, setDialog] = useState(null),
    [status, setStatus] = useState(null),
    [catalog, setCatalog] = useState(null),
    [connectionError, setConnectionError] = useState(null),
    [loading, setLoading] = useState(false),
    [toast, setToast] = useState(null),
    [lastCommand, setLastCommand] = useState(""),
    [revision, setRevision] = useState(0);
  const queue = useRef(Promise.resolve()),
    currentId = useRef(selected),
    statusTimer = useRef(null);
  useLayoutEffect(() => {
    currentId.current = selected;
  }, [selected]);
  const tv = devices.find((device) => device.id === selected),
    ready = Boolean(
      tv &&
      status?.deviceId === tv.id &&
      status?.online &&
      !connectionError &&
      !tv.requiresPairing,
    );
  const deviceId = tv?.id || "",
    pairingRequired = Boolean(tv?.requiresPairing);
  function notify(message, error = false) {
    setToast({ message, error, id: Date.now() });
  }
  async function reload() {
    const result = await api("/devices");
    setDevices(result.devices);
    setScan(result.discovery);
    setSubnets(result.subnets);
    setSelected((previous) =>
      result.devices.some((device) => device.id === previous)
        ? previous
        : result.devices[0]?.id || "",
    );
  }
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await api("/devices");
        if (cancelled) return;
        setDevices(result.devices);
        setScan(result.discovery);
        setSubnets(result.subnets);
        setSelected((previous) =>
          result.devices.some((device) => device.id === previous)
            ? previous
            : result.devices[0]?.id || "",
        );
      } catch (failure) {
        if (!cancelled) notify(failure.message, true);
      }
    };
    load();
    post("/discovery").catch((failure) => {
      if (!cancelled) notify(failure.message, true);
    });
    const timer = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("philips-device", selected);
  }, [selected]);
  useEffect(() => {
    const abort = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || !deviceId || pairingRequired) return;
      pending = true;
      try {
        const value = await api(`/devices/${deviceId}/status`, {
          signal: abort.signal,
        });
        if (!abort.signal.aborted) {
          setStatus({ ...value, deviceId });
          setConnectionError(null);
        }
      } catch (failure) {
        if (!abort.signal.aborted) setConnectionError(failure);
      } finally {
        pending = false;
      }
    }
    async function initialize() {
      await Promise.resolve();
      if (abort.signal.aborted) return;
      setStatus(null);
      setCatalog(null);
      setConnectionError(null);
      if (!deviceId || pairingRequired) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await Promise.all([
        refresh(),
        api(`/devices/${deviceId}/catalog`, { signal: abort.signal })
          .then((value) => {
            if (!abort.signal.aborted) setCatalog(value);
          })
          .catch((failure) => {
            if (!abort.signal.aborted) setConnectionError(failure);
          }),
      ]);
      if (!abort.signal.aborted) setLoading(false);
    }
    initialize();
    const timer = setInterval(refresh, 7000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, [deviceId, pairingRequired, revision]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 6500 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => clearTimeout(statusTimer.current), []);
  async function send(type, value) {
    if (!ready) return false;
    const id = selected;
    const action = async () => {
      if (currentId.current !== id) return false;
      try {
        await post(`/devices/${id}/command`, { type, value });
        if (currentId.current !== id) return true;
        setLastCommand(type === "key" ? value : `${type} updated`);
        clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(async () => {
          if (currentId.current !== id) return;
          try {
            const next = await api(`/devices/${id}/status`);
            if (currentId.current === id) setStatus({ ...next, deviceId: id });
          } catch (failure) {
            if (currentId.current === id) {
              setConnectionError(failure);
              notify(failure.message, true);
            }
          }
        }, 350);
        return true;
      } catch (failure) {
        if (currentId.current === id) {
          notify(failure.message, true);
          if (failure.code === "OFFLINE" || failure.code === "PAIR_REQUIRED")
            setConnectionError(failure);
        }
        return false;
      }
    };
    queue.current = queue.current.catch(() => {}).then(action);
    return queue.current;
  }
  useEffect(() => {
    function keyboard(event) {
      if (
        !ready ||
        dialog ||
        view !== "remote" ||
        event.target.closest("input, textarea, select, button, a") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const key = {
        ArrowUp: "CursorUp",
        ArrowDown: "CursorDown",
        ArrowLeft: "CursorLeft",
        ArrowRight: "CursorRight",
        Enter: "Confirm",
        Backspace: "Back",
      }[event.key];
      if (key) {
        event.preventDefault();
        send("key", key);
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  });
  const needsPairing =
    tv?.requiresPairing || connectionError?.code === "PAIR_REQUIRED";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Philips Remote home">
          <span className="brand-icon">
            <Radio size={24} strokeWidth={1.6} />
          </span>
          <span>
            PHILIPS<strong>Remote</strong>
          </span>
        </a>
        <span className="sidebar-label">YOUR SPACE</span>
        <nav>
          {VIEWS.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              className={view === item.id ? "selected" : ""}
              onClick={() => setView(item.id)}
            >
              <item.icon size={20} strokeWidth={1.7} />
              <span>{item.label}</span>
              {view === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-icon">
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>Made for your network</strong>
              <span>Local. Private. Yours.</span>
            </div>
          </div>
          <button
            className="sidebar-device"
            aria-label="Network and devices"
            title="Network and devices"
            onClick={() => setDialog("devices")}
          >
            <Wifi size={17} />
            <span>
              {scan.running ? "Discovering devices" : "Network & devices"}
            </span>
            <ChevronRight size={16} />
          </button>
          <span className="version">JOINTSPACE / v1.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>My home</span>
            <ChevronRight size={13} />
            <strong>{VIEWS.find((item) => item.id === view).label}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span className="status-dot" />
              LOCAL NETWORK
            </span>
            <IconButton
              icon={RefreshCw}
              label="Refresh TV status and capabilities"
              className={loading ? "spin" : ""}
              disabled={loading}
              onClick={async () => {
                if (tv) {
                  try {
                    await api(`/devices/${tv.id}/catalog?refresh=true`);
                    setRevision((value) => value + 1);
                  } catch (failure) {
                    notify(failure.message, true);
                  }
                } else setDialog("devices");
              }}
            />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span className="status-dot" />
                PHILIPS REMOTE
              </div>
              <h1>{VIEW_TITLES[view]}</h1>
              <p>
                {tv
                  ? `${tv.name}${tv.demo ? " / Demo mode" : ` / ${tv.host}`}`
                  : "No television selected"}
              </p>
            </div>
            <button
              className="device-switch"
              onClick={() => setDialog("devices")}
            >
              <Tv size={20} />
              <span>{tv?.name || "Connect a TV"}</span>
              <ChevronDown size={16} />
            </button>
          </div>
          {(!tv || needsPairing || connectionError) && (
            <div
              className={`connection-banner ${connectionError ? "warning" : ""}`}
            >
              <span className="banner-icon">
                {needsPairing ? <Link size={22} /> : <Wifi size={22} />}
              </span>
              <div>
                <strong>
                  {needsPairing
                    ? "Pairing required"
                    : connectionError
                      ? "TV is unreachable"
                      : scan.running
                        ? "Looking for your Philips TV"
                        : "No TV connected"}
                </strong>
                <span>
                  {needsPairing
                    ? tv?.name
                    : connectionError
                      ? connectionError.message
                      : scan.running
                        ? `${scan.scanned} / ${scan.total} addresses checked`
                        : "No JointSpace device connected"}
                </span>
              </div>
              <button
                className="button"
                onClick={() => setDialog(needsPairing ? "pair" : "devices")}
              >
                {needsPairing ? "Pair TV" : "Devices"}
                <ArrowRight size={16} />
              </button>
              {!tv && (
                <button
                  className="text-button demo-link"
                  onClick={async () => {
                    try {
                      const demo = await post("/demo");
                      await reload();
                      setSelected(demo.id);
                    } catch (failure) {
                      notify(failure.message, true);
                    }
                  }}
                >
                  Try demo
                </button>
              )}
            </div>
          )}
          {tv?.demo && (
            <div className="demo-strip">
              <Disc3 size={16} />
              <span>Demo device</span>
              <span className="demo-detail">Simulated TV state</span>
              <button onClick={() => setDialog("devices")}>
                Connect your TV
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-line" role="status">
              <LoaderCircle className="spin" size={16} />
              Reading TV capabilities...
            </div>
          )}
          <div className="view-content" key={`${view}-${selected}`}>
            {view === "remote" && (
              <Remote
                ready={ready}
                send={send}
                status={status}
                catalog={catalog}
                tv={tv}
                openKeyboard={() => setDialog("keyboard")}
                openNumbers={() => setDialog("keypad")}
              />
            )}
            {(view === "apps" || view === "channels") && (
              <Library
                type={view}
                ready={ready}
                catalog={catalog}
                send={send}
              />
            )}
            {view === "ambilight" && (
              <Ambilight
                ready={ready}
                catalog={catalog}
                status={status}
                send={send}
              />
            )}
            {view === "settings" && (
              <Settings
                ready={ready}
                tv={tv}
                catalog={catalog}
                status={status}
                send={send}
                notify={notify}
              />
            )}
            {view === "api" && <Console tv={tv} ready={ready} />}
          </div>
          <footer className="page-footer">
            <span>
              <ShieldCheck size={14} />
              {tv?.demo
                ? "Demo / no TV commands sent"
                : "Direct connection / local network"}
            </span>
            <span className="last-command" aria-live="polite">
              {lastCommand && (
                <>
                  <Check size={13} />
                  {lastCommand}
                </>
              )}
            </span>
            <span>
              JointSpace{tv ? ` ${tv.version}` : ""}
              <span className="footer-dot" />
              {tv?.protocol?.toUpperCase() || "LOCAL"}
            </span>
          </footer>
        </main>
      </div>
      {dialog === "devices" && (
        <Devices
          devices={devices}
          scan={scan}
          subnets={subnets}
          selected={selected}
          onSelect={setSelected}
          onClose={() => setDialog(null)}
          reload={reload}
          notify={notify}
        />
      )}
      {dialog === "pair" && tv && (
        <Pairing
          tv={tv}
          onClose={() => setDialog(null)}
          onPaired={async () => {
            await reload();
            setRevision((value) => value + 1);
            notify("TV paired successfully");
          }}
        />
      )}
      {dialog === "keyboard" && (
        <KeyboardPanel
          ready={ready}
          send={send}
          keys={catalog?.keys}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "keypad" && (
        <Keypad ready={ready} send={send} onClose={() => setDialog(null)} />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <Info size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <IconButton
            icon={X}
            label="Dismiss notification"
            onClick={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}
