/* ============================================================
   BridgeTalk v6 — Sentence Builder + TTS
   ============================================================
   Maintains an ordered list of recognized tokens, applies
   light grammar (capitalization, period, basic articles),
   exposes undo/clear/copy/speak.

   v6 additions:
   - onCommit callback fires when the sentence is finalized
     (Speak / Copy / Clear) so a history store can record it.
   - autoCapitalize / autoPunctuate toggles for users who want
     raw transcripts.
   - Question detection covers leading question words too.
   - TextSpeaker accepts runtime rate/pitch override and emits
     onStart/onEnd events for UI.
   ============================================================ */

const QUESTION_WORDS = ['who', 'what', 'when', 'where', 'why', 'how', 'which'];

export class SentenceBuilder {
  constructor(opts = {}) {
    this.tokens = [];
    this.maxTokens = opts.maxTokens ?? 50;
    this.onChange = opts.onChange || (() => {});
    this.onCommit = opts.onCommit || (() => {});
    this.autoCapitalize = opts.autoCapitalize ?? true;
    this.autoPunctuate = opts.autoPunctuate ?? true;
  }

  configure(opts = {}) {
    if (opts.autoCapitalize != null) this.autoCapitalize = opts.autoCapitalize;
    if (opts.autoPunctuate != null) this.autoPunctuate = opts.autoPunctuate;
    this.fire();
  }

  add(token) {
    // Merge consecutive letters into a fingerspelled word
    if (token.isLetter) {
      const last = this.tokens[this.tokens.length - 1];
      if (last && last.kind === 'fingerspell') {
        last.word += token.word;
        last.t = token.t;
        this.fire();
        return;
      }
      this.tokens.push({
        word: token.word,
        kind: 'fingerspell',
        confidence: token.confidence,
        t: token.t,
      });
    } else {
      this.tokens.push({
        word: token.gloss || token.word,
        kind: token.kind,
        confidence: token.confidence,
        t: token.t,
      });
    }
    if (this.tokens.length > this.maxTokens) this.tokens.shift();
    this.fire();
  }

  undo() {
    this.tokens.pop();
    this.fire();
  }

  clear() {
    const finalText = this.toText();
    if (finalText) this.onCommit({ text: finalText, tokens: this.tokens.slice(), reason: 'clear' });
    this.tokens.length = 0;
    this.fire();
  }

  commit(reason = 'manual') {
    const text = this.toText();
    if (text) this.onCommit({ text, tokens: this.tokens.slice(), reason });
    return text;
  }

  /** Render the sentence with light grammar polish. */
  toText() {
    if (!this.tokens.length) return '';
    const words = this.tokens.map(t => {
      if (t.kind === 'fingerspell') return t.word.toUpperCase();
      return t.word;
    });

    let s = words.join(' ');

    if (this.autoCapitalize) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
      // Standalone 'i' → 'I'
      s = s.replace(/(^|\s)i(\s|$)/g, '$1I$2');
      // Capitalize after period+space
      s = s.replace(/([.!?]\s+)([a-z])/g, (_m, p, ch) => p + ch.toUpperCase());
    }

    if (this.autoPunctuate) {
      const lower = s.toLowerCase();
      const firstWord = this.tokens[0]?.word?.toLowerCase();
      const startsWithQuestion = QUESTION_WORDS.includes(firstWord);
      const containsQuestion = QUESTION_WORDS.some(q => lower.includes(' ' + q + ' ') || lower.startsWith(q + ' '));
      const isQuestion = startsWithQuestion || containsQuestion;
      s = s.trim();
      if (!s.endsWith('.') && !s.endsWith('?') && !s.endsWith('!')) {
        s += isQuestion ? '?' : '.';
      }
    }
    return s;
  }

  fire() {
    this.onChange({
      tokens: this.tokens.slice(),
      text: this.toText(),
    });
  }
}

// ============================================================
// Text-to-Speech
// ============================================================

export class TextSpeaker {
  constructor(opts = {}) {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voice = null;
    this.rate = opts.rate ?? 0.95;
    this.pitch = opts.pitch ?? 1.0;
    this.onStart = opts.onStart || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    if (this.synth) {
      this.synth.onvoiceschanged = () => this.pickVoice();
      this.pickVoice();
    }
  }

  configure(opts = {}) {
    if (opts.rate != null) this.rate = opts.rate;
    if (opts.pitch != null) this.pitch = opts.pitch;
  }

  pickVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices.length) return;
    this.voice =
      voices.find(v => /en[-_]US/i.test(v.lang) && /natural|neural|google|samantha/i.test(v.name)) ||
      voices.find(v => /en[-_]US/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) ||
      voices[0];
  }

  available() {
    return !!this.synth;
  }

  speak(text) {
    if (!this.synth || !text) return;
    this.synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    if (this.voice) utt.voice = this.voice;
    utt.rate = this.rate;
    utt.pitch = this.pitch;
    utt.onstart = () => this.onStart();
    utt.onend = () => this.onEnd();
    utt.onerror = () => this.onEnd();
    this.synth.speak(utt);
  }

  stop() {
    this.synth?.cancel();
    this.onEnd();
  }
}
