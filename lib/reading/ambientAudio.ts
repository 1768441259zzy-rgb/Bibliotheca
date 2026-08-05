/**
 * 基于静态 MP3 的环境音引擎（循环播放 + 独立音量）
 */

import {
  READING_SOUNDS,
  type AmbientSoundId,
} from '@/lib/reading/scenes';

export class AmbientEngine {
  private audios = new Map<AmbientSoundId, HTMLAudioElement>();
  private volumes: Record<AmbientSoundId, number> = {
    'jiangnan-rain': 0.4,
    'forest-birds': 0.35,
    'banana-rain': 0.4,
    'candle-moon': 0.35,
  };
  private playing: Record<AmbientSoundId, boolean> = {
    'jiangnan-rain': false,
    'forest-birds': false,
    'banana-rain': false,
    'candle-moon': false,
  };

  private getAudio(id: AmbientSoundId): HTMLAudioElement {
    let audio = this.audios.get(id);
    if (!audio) {
      const meta = READING_SOUNDS.find((s) => s.id === id);
      audio = new Audio(meta?.src);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = this.volumes[id];
      this.audios.set(id, audio);
    }
    return audio;
  }

  getVolume(id: AmbientSoundId) {
    return this.volumes[id];
  }

  isPlaying(id: AmbientSoundId) {
    return this.playing[id];
  }

  setVolume(id: AmbientSoundId, value: number) {
    this.volumes[id] = Math.min(1, Math.max(0, value));
    const audio = this.audios.get(id);
    if (audio) audio.volume = this.volumes[id];
  }

  async toggle(id: AmbientSoundId) {
    if (this.playing[id]) {
      this.stop(id);
      return false;
    }
    await this.start(id);
    return true;
  }

  async start(id: AmbientSoundId) {
    if (this.playing[id]) return;
    const audio = this.getAudio(id);
    audio.volume = this.volumes[id];
    try {
      await audio.play();
      this.playing[id] = true;
    } catch (err) {
      this.playing[id] = false;
      throw err;
    }
  }

  stop(id: AmbientSoundId) {
    const audio = this.audios.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.playing[id] = false;
  }

  stopAll() {
    READING_SOUNDS.forEach((s) => this.stop(s.id));
  }

  dispose() {
    this.stopAll();
    this.audios.forEach((audio) => {
      audio.src = '';
      audio.load();
    });
    this.audios.clear();
  }
}

export type { AmbientSoundId };
