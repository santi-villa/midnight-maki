/** One speaker at a time, in the order the lines belong to a conversation. */
export interface SpeechLine {
  speaker: string;
  text: string;
  seconds: number;
  /** Lines that share an exchange stay together, ahead of unrelated lines queued while it is playing. */
  exchange?: string;
}

export class SpeechTurns {
  private waiting: SpeechLine[] = [];
  private active: (SpeechLine & { left: number }) | null = null;
  private breath = 0;

  constructor(private readonly breathSeconds = 0.28) {}

  /** @returns whether this line is now playing or waiting. A repeat counts as accepted. */
  say(line: SpeechLine, ambient = false): boolean {
    if (!line.speaker || !line.text || !(line.seconds > 0)) return false;
    if (this.active?.speaker === line.speaker && this.active.text === line.text) return true;
    if (this.waiting.some((w) => w.speaker === line.speaker && w.text === line.text && w.exchange === line.exchange)) return true;
    if (ambient) {
      if (this.active?.speaker === line.speaker) return false;
      if (this.waiting.some((w) => w.speaker === line.speaker)) return false;
      if (this.waiting.length >= 2) return false;
      // A greeting or a chat finishes before stray comments.
      if (this.active?.exchange || this.waiting.some((w) => w.exchange)) return false;
    }
    if (line.exchange) {
      let last = -1;
      for (let i = 0; i < this.waiting.length; i++) if (this.waiting[i].exchange === line.exchange) last = i;
      if (last >= 0) {
        this.waiting.splice(last + 1, 0, line);
        return true;
      }
      if (this.active?.exchange === line.exchange) {
        const at = this.waiting.findIndex((w) => w.exchange !== line.exchange);
        if (at < 0) this.waiting.push(line);
        else this.waiting.splice(at, 0, line);
        return true;
      }
    }
    this.waiting.push(line);
    return true;
  }

  /** False when a passing comment would be dropped, so callers can avoid spending a line. */
  roomFor(speaker: string): boolean {
    if (this.active?.speaker === speaker) return false;
    if (this.waiting.some((w) => w.speaker === speaker)) return false;
    if (this.waiting.length >= 2) return false;
    if (this.active?.exchange || this.waiting.some((w) => w.exchange)) return false;
    return true;
  }

  /** True while this exchange is on screen or still waiting. */
  holds(exchange: string): boolean {
    return this.active?.exchange === exchange || this.waiting.some((w) => w.exchange === exchange);
  }

  activeSpeaker(): string | null {
    return this.active?.speaker ?? null;
  }

  current(): SpeechLine | null {
    if (!this.active) return null;
    const { speaker, text, seconds, exchange } = this.active;
    return { speaker, text, seconds, exchange };
  }

  /**
   * Advance. A speaker who already left is skipped so the queue cannot stall.
   * Returns the line that should appear now.
   */
  tick(dt: number, alive: (speaker: string) => boolean): SpeechLine | null {
    if (this.active) {
      if (!alive(this.active.speaker)) {
        this.active = null;
        this.breath = 0;
      } else {
        this.active.left -= dt;
        if (this.active.left > 0) return null;
        this.active = null;
        if (this.breathSeconds > 0) {
          this.breath = this.breathSeconds;
          return null;
        }
      }
    }
    if (this.breath > 0) {
      this.breath -= dt;
      if (this.breath > 0) return null;
      this.breath = 0;
    }
    while (this.waiting.length) {
      const next = this.waiting.shift()!;
      if (!alive(next.speaker)) continue;
      this.active = { ...next, left: next.seconds };
      return { speaker: next.speaker, text: next.text, seconds: next.seconds, exchange: next.exchange };
    }
    return null;
  }

  dropExchange(exchange: string): void {
    this.waiting = this.waiting.filter((w) => w.exchange !== exchange);
    if (this.active?.exchange === exchange) {
      this.active = null;
      this.breath = 0;
    }
  }

  dropSpeaker(speaker: string): void {
    this.waiting = this.waiting.filter((w) => w.speaker !== speaker);
    if (this.active?.speaker === speaker) {
      this.active = null;
      this.breath = 0;
    }
  }

  clear(): void {
    this.waiting = [];
    this.active = null;
    this.breath = 0;
  }

  pending(): number {
    return this.waiting.length;
  }

  idle(): boolean {
    return !this.active && this.waiting.length === 0 && this.breath <= 0;
  }
}
