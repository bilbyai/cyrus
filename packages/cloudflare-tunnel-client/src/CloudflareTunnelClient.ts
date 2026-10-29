import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { bin, install, Tunnel } from "cloudflared";
import type {
	CloudflareTunnelClientEvents,
	CloudflareTunnelRecoveryOptions,
} from "./types.js";

export declare interface CloudflareTunnelClient {
	on<K extends keyof CloudflareTunnelClientEvents>(
		event: K,
		listener: CloudflareTunnelClientEvents[K],
	): this;
	emit<K extends keyof CloudflareTunnelClientEvents>(
		event: K,
		...args: Parameters<CloudflareTunnelClientEvents[K]>
	): boolean;
}

/**
 * Default recovery policy for a cloudflared child that exits after it had
 * connected. Delays double from 1s up to a 60s cap; after 10 consecutive
 * failed restarts the client stops retrying and stays disconnected.
 */
export const DEFAULT_TUNNEL_RECOVERY_OPTIONS: Required<CloudflareTunnelRecoveryOptions> =
	{
		// 120s: slow DNS resolvers (e.g. dead IPv6 nameservers ahead of the
		// working one) can delay the first connection past 30s
		connectTimeoutMs: 120000,
		initialRestartDelayMs: 1000,
		maxRestartDelayMs: 60000,
		maxRestartAttempts: 10,
		// A child that stayed connected this long counts as healthy, so its exit
		// starts a fresh retry budget instead of continuing the previous one
		stableConnectionMs: 60000,
		// Grace period after SIGINT before SIGKILL on deliberate shutdown
		killGraceMs: 5000,
	};

type ClientState =
	| "idle"
	| "starting"
	| "running"
	| "recovering"
	| "stopped"
	| "failed";

/**
 * Cloudflare tunnel client for establishing tunnels to local services
 * Handles ONLY tunnel establishment - HTTP handling is done by SharedApplicationServer
 *
 * The client is the single owner of the cloudflared child process. If a child
 * that had connected exits unexpectedly while the client is still running, the
 * client respawns it with bounded exponential backoff. Startup failures and
 * deliberate disconnects never trigger a respawn.
 */
export class CloudflareTunnelClient extends EventEmitter {
	private tunnel: Tunnel | null = null;
	/** Incremented per spawned child; callbacks from older children are ignored */
	private generation = 0;
	/** The single pending timer: either a connect timeout or a restart backoff */
	private timer: NodeJS.Timeout | null = null;
	private state: ClientState = "idle";
	private startup: {
		resolve: () => void;
		reject: (error: Error) => void;
	} | null = null;
	private restartAttempts = 0;
	private connectedAt = 0;
	private tunnelUrl: string | null = null;
	private connected = false;
	private connectionCount = 0;
	private cloudflareToken: string;
	private localPort: number;
	private options: Required<CloudflareTunnelRecoveryOptions>;

	constructor(
		cloudflareToken: string,
		localPort: number,
		onReady?: (tunnelUrl: string) => void,
		options: CloudflareTunnelRecoveryOptions = {},
	) {
		super();
		this.cloudflareToken = cloudflareToken;
		this.localPort = localPort;
		this.options = { ...DEFAULT_TUNNEL_RECOVERY_OPTIONS, ...options };

		// Set up onReady callback if provided
		if (onReady) {
			this.on("ready", onReady);
		}
	}

	/**
	 * Start the Cloudflare tunnel. Resolves once the first connection is
	 * established; rejects if the child exits, fails to spawn, the connect
	 * timeout elapses, or disconnect() is called first. Can only be called once.
	 */
	async startTunnel(): Promise<void> {
		if (this.state !== "idle") {
			throw new Error(
				`Cloudflare tunnel already started (state: ${this.state})`,
			);
		}
		this.state = "starting";

		try {
			// Ensure cloudflared binary is installed
			if (!existsSync(bin)) {
				await install(bin);
			}
			if (this.state !== "starting") {
				throw new Error("Cloudflare tunnel disconnected during startup");
			}

			console.log(`Starting tunnel to localhost:${this.localPort}`);

			await new Promise<void>((resolve, reject) => {
				this.startup = { resolve, reject };
				this.spawnChild();
			});
		} catch (error) {
			// Re-read state: disconnect() or a child loss may have changed it
			const state = this.state as ClientState;
			if (state === "starting") {
				this.state = "failed";
				this.clearTimer();
				this.stopChild(true);
			}
			// A deliberate disconnect during startup is not an error condition
			if (state !== "stopped") {
				this.emit("error", error as Error);
			}
			throw error;
		}
	}

	/**
	 * Spawn a cloudflared child owned by this client and arm its connect timeout
	 */
	private spawnChild(): void {
		const generation = ++this.generation;
		const isCurrent = () =>
			generation === this.generation &&
			(this.state === "starting" ||
				this.state === "recovering" ||
				this.state === "running");

		this.connectionCount = 0;
		// Create tunnel with token-based authentication (no URL needed for remotely-managed tunnels)
		const tunnel = Tunnel.withToken(this.cloudflareToken);
		this.tunnel = tunnel;

		// Listen for URL event (from ConfigHandler for token-based tunnels)
		tunnel.on("url", (url: string) => {
			if (!isCurrent()) return;
			// Ensure URL has protocol for token-based tunnels
			if (!url.startsWith("http")) {
				url = `https://${url}`;
			}
			if (!this.tunnelUrl) {
				this.tunnelUrl = url;
				this.emit("ready", this.tunnelUrl);
			}
		});

		// Listen for connection event (Cloudflare establishes 4 connections per tunnel)
		tunnel.on("connected", (connection: any) => {
			if (!isCurrent()) return;
			this.connectionCount++;
			console.log(
				`Cloudflare tunnel connection ${this.connectionCount}/4 established:`,
				connection,
			);

			// Emit 'connected' event for each connection (for external listeners)
			this.emit("connected", connection);

			// Mark as connected on first connection, but log all 4
			if (!this.connected) {
				this.handleFirstConnection();
			}
		});

		// Listen for error event. Errors are informational unless the child
		// never spawned (no pid), in which case no 'exit' will follow.
		tunnel.on("error", (error: Error) => {
			if (generation !== this.generation) return;
			this.emit("error", error);
			if (tunnel.process.pid === undefined && isCurrent()) {
				this.handleChildLoss(
					`Tunnel process failed to start: ${error.message}`,
				);
			}
		});

		// Listen for exit event
		tunnel.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
			if (!isCurrent()) return;
			this.handleChildLoss(
				`Tunnel process exited with code ${code}${signal ? ` (signal ${signal})` : ""}`,
			);
		});

		this.setTimer(() => {
			this.handleChildLoss(
				`Timeout waiting for tunnel to connect after ${this.options.connectTimeoutMs}ms`,
			);
		}, this.options.connectTimeoutMs);
	}

	private handleFirstConnection(): void {
		this.clearTimer();
		this.connected = true;
		this.connectedAt = Date.now();
		const recovered = this.state === "recovering";
		this.state = "running";

		if (recovered) {
			console.log(
				`Cloudflare tunnel recovered after ${this.restartAttempts} restart attempt(s)`,
			);
		}
		this.emit("connect");

		if (this.startup) {
			const { resolve } = this.startup;
			this.startup = null;
			resolve();
		}
	}

	/**
	 * The current child is gone (exited, failed to spawn, or timed out before
	 * connecting). During startup this fails startTunnel(); afterwards it
	 * schedules a bounded restart.
	 */
	private handleChildLoss(reason: string): void {
		this.clearTimer();
		// Fence any remaining callbacks from the lost child before killing it
		this.generation++;
		this.stopChild(true);
		const wasConnected = this.connected;
		this.connected = false;
		this.connectionCount = 0; // Reset count on disconnect for fresh reconnection logs

		if (this.state === "starting") {
			this.state = "failed";
			const startup = this.startup;
			this.startup = null;
			startup?.reject(
				new Error(`Cloudflare tunnel failed to start: ${reason}`),
			);
			return;
		}

		if (wasConnected) {
			this.emit("disconnect", reason);
			if (Date.now() - this.connectedAt >= this.options.stableConnectionMs) {
				this.restartAttempts = 0;
			}
		}
		this.state = "recovering";

		if (this.restartAttempts >= this.options.maxRestartAttempts) {
			this.state = "failed";
			const message = `Cloudflare tunnel recovery gave up after ${this.restartAttempts} consecutive failed restart attempts (${reason}); restart Cyrus to restore the tunnel`;
			console.error(message);
			this.emit("error", new Error(message));
			return;
		}

		this.restartAttempts++;
		const delay = Math.min(
			this.options.initialRestartDelayMs * 2 ** (this.restartAttempts - 1),
			this.options.maxRestartDelayMs,
		);
		console.warn(
			`${reason}; restarting Cloudflare tunnel in ${delay}ms (attempt ${this.restartAttempts}/${this.options.maxRestartAttempts})`,
		);
		this.setTimer(() => this.spawnChild(), delay);
	}

	private setTimer(callback: () => void, delay: number): void {
		this.clearTimer();
		this.timer = setTimeout(() => {
			this.timer = null;
			callback();
		}, delay);
	}

	private clearTimer(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	/**
	 * Kill the owned child (if still alive) and release it. Failed children are
	 * killed immediately; deliberate shutdowns get a graceful SIGINT first.
	 */
	private stopChild(force: boolean): void {
		const tunnel = this.tunnel;
		this.tunnel = null;
		if (!tunnel) return;

		const child = tunnel.process;
		if (child.exitCode !== null || child.signalCode !== null || !child.pid) {
			return;
		}
		if (force) {
			child.kill("SIGKILL");
			return;
		}
		tunnel.stop();
		const escalation = setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL");
			}
		}, this.options.killGraceMs);
		escalation.unref();
		child.once("exit", () => clearTimeout(escalation));
	}

	/**
	 * Get the tunnel URL
	 */
	getTunnelUrl(): string | null {
		return this.tunnelUrl;
	}

	/**
	 * Check if client is connected
	 */
	isConnected(): boolean {
		return this.connected;
	}

	/**
	 * Disconnect and cleanup. Cancels any pending restart or startup and kills
	 * the owned child; the client will not respawn afterwards.
	 */
	disconnect(): void {
		const previousState = this.state;
		this.state = "stopped";
		this.generation++;
		this.clearTimer();
		this.stopChild(false);

		if (this.startup) {
			const { reject } = this.startup;
			this.startup = null;
			reject(new Error("Cloudflare tunnel disconnected during startup"));
		}

		this.connected = false;
		this.connectionCount = 0; // Reset count on disconnect for fresh reconnection logs
		if (previousState !== "stopped") {
			this.emit("disconnect", "Client disconnected");
		}
	}
}
