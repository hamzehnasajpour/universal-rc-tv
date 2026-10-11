# Universal RC TV

**Currently Philips-only, not a universal TV remote.** This version implements the Philips JointSpace API. Samsung, LG, Sony, Roku and other TV brands/protocols are not supported. The repository name reflects a possible future direction, not current multi-brand compatibility. Not every Philips TV supports JointSpace, and available controls vary by model and firmware.

**Experimental / known safety issue:** a Philips TV repeatedly restarted during live discovery and read-only API probing in development. The restarts stopped after the app was stopped; causality is not confirmed. The current app automatically discovers devices and polls a selected TV. Opt-in discovery/polling and additional firmware-safety work are still pending. Use demo mode for evaluation, and stop the server immediately if your TV becomes unstable. Do not treat this release as validated for unattended use.

A self-hosted remote for Philips TVs with JointSpace: automatic LAN discovery, PIN pairing, navigation/playback, volume, installed apps, channels, Ambilight, TV settings and an advanced API console. React frontend and Node/Express backend. Fonts and preview imagery are bundled locally.

## Docker

Start Docker Desktop with Linux containers, then set your actual TV subnet:

```powershell
$env:TV_SUBNETS = "192.168.1.0/24"
docker compose up -d --build
```

Open **http://localhost:3000**. You can also configure `TV_SUBNETS` and `WEB_PORT` in `.env` using `.env.example`. Pairing credentials persist in the `tv-data` volume.

On native Linux, host networking supports SSDP and automatic scanning of the host's private interfaces:

```sh
docker compose -f compose.host.yaml up -d --build
```

Use one Compose file, not both. Docker Desktop bridge interfaces belong to its VM, not your LAN: specify `TV_SUBNETS`, enter a network range in Devices, or add the TV by IP. Discovery from bridge networking relies on unicast scanning; multicast availability depends on your host/network setup.

## Connect

1. Turn the TV on. Connect it to a LAN reachable from the server and enable network remote control / JointSpace if needed.
2. The page automatically scans. Open **Devices** to scan a specific private subnet or add a TV by IPv4 address.
3. For secured models, choose **Pair TV**, request a PIN, and enter the code displayed on the television.
4. Select your TV. Apps, channels, Ambilight modes and settings are read from that device.

**Try demo** adds an explicitly simulated TV. It is not persisted, and demo commands do not reach real TVs. The landscape is a demo/color-preview image, not your actual TV screen.

## Controls

- Navigation, OK, Home, Back, Source, Options, Info, volume, mute and channel stepping.
- Number keypad, color keys, subtitles, TV guide/Find, teletext, picture format, record and playback.
- Text entry, browser URL launch, searchable installed apps/channels and browser-local favorites.
- Reported Ambilight modes/presets, custom RGB color, Ambilight power and Hue where available.
- Power/screen state, legacy input sources and menu-setting nodes with read/write JSON data.
- GET/POST console for JointSpace endpoint families, including recordings and model-specific options.
- Keyboard arrows, Enter and Backspace when focus is outside a form/control.

## Compatibility

Discovery probes HTTP `1925` and HTTPS `1926`, checks API versions `6`, `1`, `5`, `7`, `2`, `3`, `4`, and follows `/system`'s reported version and transport. HTTPS pairing uses a PIN, SHA1 HMAC and HTTP Digest authentication. Capabilities are checked individually. Real-hardware compatibility must be verified on your TV.

Philips firmware varies. Newer TVs commonly do not support direct `/sources/current` switching; use the Source key and navigation for HDMI. Separate Play and Pause are provided because some TVs handle PlayPause differently. Some Ambilight firmwares ignore otherwise successful requests or omit presets; the API console allows model-specific commands. Menu node schemas differ: edit only known, controllable settings. Text/URL input and recording depend on firmware and the active TV screen. This app does not guarantee every function on every model.

Deep standby can stop the API. Network power-on works only while the TV accepts requests; wake-from-deep-sleep is not guaranteed. Enable network standby if available. VLANs, Wi-Fi client isolation, firewall rules or changed DHCP addresses can prevent discovery. A DHCP reservation is recommended.

Scans accept private IPv4 ranges `/22` to `/32`, use 32 workers and short socket timeouts. Default scanning uses a `/24` around up to four private interfaces. For larger networks, specify ranges. Comma-separated `TV_SUBNETS` are supported: `192.168.1.0/24,10.0.0.0/24`. No internet scanning or IPv6 discovery.

## Security

Use on a **trusted LAN only**. There is no web login: anyone reaching the server can control paired TVs. Do not expose its port to the internet. Use an authenticated reverse proxy/VPN for remote access. Cross-origin browser writes are rejected, but this is not a substitute for authentication or a firewall. Reverse proxies must preserve the host and scheme used for origin checks.

Pairing credentials stay server-side in `data/devices.json` (Docker: named volume), written atomically with owner-only permissions on Linux. They are stored in plaintext for TV authentication; protect the host and volume. Private data/configuration is excluded from Git and the Docker build context. Certificate validation is disabled **only for local TV requests**, since Philips TVs commonly use self-signed certificates, not globally.

## Development

Requires Node **22.12+** and npm. PowerShell users can use `npm.cmd` if execution policy blocks `npm.ps1`:

```powershell
npm.cmd install
npm.cmd run dev
```

Frontend: **http://localhost:5173** (or Vite's next free port). Backend: `3001`; Vite proxies `/api`. Production without Docker:

```powershell
npm.cmd run build
npm.cmd start
```

Open **http://localhost:3001**. Server variables: `PORT`, `HOST` (default `0.0.0.0`), `DATA_DIR` (default `./data`), `TV_SUBNETS`.

## Verification

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
docker compose config --quiet
```

Tests cover address/path validation, bounded subnets, discovery, digest transport, pairing/expiry/persistence, commands, demo status and cross-origin rejection. Docker builds run tests and compile the frontend. The runtime is non-root with a read-only root filesystem and writable credential volume.

API behavior references: [Pylips](https://github.com/eslavnov/pylips/tree/master/docs) and [ha-philipsjs](https://github.com/danielperna84/ha-philipsjs). These are community references, not official compatibility guarantees. Not affiliated with Philips. Preview photo: [Unsplash image CDN](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b). Icons: Lucide. Fonts: Manrope and Space Grotesk via Fontsource.
