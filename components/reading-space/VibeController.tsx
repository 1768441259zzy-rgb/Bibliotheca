'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AmbientEngine } from '@/lib/reading/ambientAudio';
import {
  READING_SCENES,
  READING_SOUNDS,
  type AmbientSoundId,
  type ReadingScene,
} from '@/lib/reading/scenes';
import {
  buildMusicPlaylist,
  importLocalMusicFile,
  loadLocalMusicBlob,
  patchPrefs,
  readPrefs,
  removeLocalMusicItem,
  removeNeteaseLibraryItem,
  renameLocalMusicItem,
  renameNeteaseLibraryItem,
  upsertNeteaseLibraryItem,
  type MusicPlayMode,
  type PlaylistTrack,
  type ReadingBgKind,
  type ReadingPageTheme,
  type SavedLocalMusicMeta,
  type SavedNeteaseItem,
} from '@/lib/reading/readingStore';
import {
  buildNeteasePlayerSrc,
  parseNeteaseUrl,
  playerFrameSize,
  type NeteaseEmbed,
} from '@/lib/reading/neteaseEmbed';

interface VibeControllerProps {
  scene: ReadingScene;
  bgKind: ReadingBgKind;
  solidBgColor: string;
  customBgName: string | null;
  pageTheme: ReadingPageTheme;
  pageSolidColor: string;
  onSceneChange: (scene: ReadingScene) => void;
  onBgKindChange: (kind: ReadingBgKind) => void;
  onSolidBgColorChange: (color: string) => void;
  onCustomBgImport: (file: File) => Promise<void>;
  onClearCustomBg: () => Promise<void>;
  onPageThemeChange: (theme: ReadingPageTheme) => void;
  onPageSolidColorChange: (color: string) => void;
}

const POS_KEY = 'bibliotheca-vibe-pos';

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function defaultPos() {
  if (typeof window === 'undefined') return { x: 24, y: 120 };
  return {
    x: Math.max(16, window.innerWidth - 100),
    y: 120,
  };
}

function clampPos(x: number, y: number, w = 88, h = 64) {
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

export type { ReadingScene };

export default function VibeController({
  scene,
  bgKind,
  solidBgColor,
  customBgName,
  pageTheme,
  pageSolidColor,
  onSceneChange,
  onBgKindChange,
  onSolidBgColorChange,
  onCustomBgImport,
  onClearCustomBg,
  onPageThemeChange,
  onPageSolidColorChange,
}: VibeControllerProps) {
  const engineRef = useRef<AmbientEngine | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    ox: number;
    oy: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(defaultPos);
  const [ambientOn, setAmbientOn] = useState<Record<AmbientSoundId, boolean>>({
    'jiangnan-rain': false,
    'forest-birds': false,
    'banana-rain': false,
    'candle-moon': false,
  });
  const [ambientVol, setAmbientVol] = useState<Record<AmbientSoundId, number>>({
    'jiangnan-rain': 0.4,
    'forest-birds': 0.35,
    'banana-rain': 0.4,
    'candle-moon': 0.35,
  });
  const [error, setError] = useState('');
  const [musicInput, setMusicInput] = useState('');
  const [musicEmbed, setMusicEmbed] = useState<NeteaseEmbed | null>(null);
  const [musicHeight, setMusicHeight] = useState(66);
  const [musicError, setMusicError] = useState('');
  const [neteaseLibrary, setNeteaseLibrary] = useState<SavedNeteaseItem[]>([]);
  const [localLibrary, setLocalLibrary] = useState<SavedLocalMusicMeta[]>([]);
  const [playMode, setPlayMode] = useState<MusicPlayMode>('order');
  const [currentKey, setCurrentKey] = useState('');
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [localMeta, setLocalMeta] = useState<SavedLocalMusicMeta | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [bgBusy, setBgBusy] = useState(false);
  const [bgMsg, setBgMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bgFileRef = useRef<HTMLInputElement | null>(null);
  const localUrlRef = useRef<string | null>(null);
  const playlistRef = useRef<PlaylistTrack[]>([]);
  const playModeRef = useRef<MusicPlayMode>('order');
  const currentKeyRef = useRef('');
  const localAutoplayRef = useRef(false);

  const playlist = buildMusicPlaylist(neteaseLibrary, localLibrary);
  playlistRef.current = playlist;
  playModeRef.current = playMode;
  currentKeyRef.current = currentKey;

  function revokeLocalUrl() {
    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
    }
  }

  useEffect(() => {
    engineRef.current = new AmbientEngine();
    const prefs = readPrefs();
    setAmbientVol(prefs.ambientVol);
    setPlayMode(prefs.musicPlayMode);
    setNeteaseLibrary(prefs.neteaseLibrary);
    setLocalLibrary(prefs.localMusicLibrary);
    setMusicHeight(prefs.neteasePlayerHeight);
    (Object.keys(prefs.ambientVol) as AmbientSoundId[]).forEach((id) => {
      engineRef.current?.setVolume(id, prefs.ambientVol[id]);
    });

    const tracks = buildMusicPlaylist(
      prefs.neteaseLibrary,
      prefs.localMusicLibrary
    );
    let key = prefs.currentMusicKey;
    if (!key || !tracks.some((t) => t.key === key)) {
      if (prefs.neteaseUrl) {
        const parsed = parseNeteaseUrl(prefs.neteaseUrl);
        if (parsed) {
          key = `${parsed.type}-${parsed.id}`;
          if (
            !prefs.neteaseLibrary.some((x) => x.key === key)
          ) {
            const item: SavedNeteaseItem = {
              key,
              type: parsed.type,
              id: parsed.id,
              label: parsed.label,
              url: prefs.neteaseUrl,
              title: `${parsed.label} · ${parsed.id}`,
              savedAt: new Date().toISOString(),
            };
            setNeteaseLibrary(upsertNeteaseLibraryItem(item));
          }
        }
      }
      if (!key) key = tracks[0]?.key ?? '';
    }
    setCurrentKey(key);
    if (key.startsWith('local-')) {
      const meta = prefs.localMusicLibrary.find((x) => x.key === key);
      if (meta) void activateLocal(meta, false);
    } else if (key) {
      const item =
        prefs.neteaseLibrary.find((x) => x.key === key) ??
        (prefs.neteaseUrl
          ? (() => {
              const p = parseNeteaseUrl(prefs.neteaseUrl);
              return p
                ? ({
                    key: `${p.type}-${p.id}`,
                    type: p.type,
                    id: p.id,
                    label: p.label,
                    url: prefs.neteaseUrl,
                    title: `${p.label} · ${p.id}`,
                    savedAt: new Date().toISOString(),
                  } satisfies SavedNeteaseItem)
                : null;
            })()
          : null);
      if (item) {
        setMusicInput(item.url);
        setMusicEmbed({
          type: item.type,
          id: item.id,
          label: item.label,
          sourceUrl: item.url,
        });
      }
    }

    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPos(clampPos(parsed.x, parsed.y));
        }
      }
    } catch {
      // ignore
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      if (localUrlRef.current) {
        URL.revokeObjectURL(localUrlRef.current);
        localUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setPos(clampPos(drag.ox + dx, drag.oy + dy));
  }, []);

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.active = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    setPos((p) => {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(p));
      } catch {
        // ignore
      }
      return p;
    });
  }, [onPointerMove]);

  function startDrag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      active: true,
      moved: false,
      ox: pos.x,
      oy: pos.y,
      startX: e.clientX,
      startY: e.clientY,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function onTabClick() {
    if (dragRef.current?.moved) {
      dragRef.current.moved = false;
      return;
    }
    setOpen(true);
  }

  async function toggleAmbient(id: AmbientSoundId) {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      setError('');
      const playing = await engine.toggle(id);
      setAmbientOn((prev) => ({ ...prev, [id]: playing }));
    } catch {
      setError('音频播放失败，请再点一次');
    }
  }

  function changeAmbientVolume(id: AmbientSoundId, value: number) {
    setAmbientVol((prev) => {
      const next = { ...prev, [id]: value };
      patchPrefs({ ambientVol: next });
      return next;
    });
    engineRef.current?.setVolume(id, value);
  }

  async function activateLocal(
    item: SavedLocalMusicMeta,
    autoplay: boolean
  ) {
    setMusicError('');
    setMusicEmbed(null);
    setMusicInput('');
    setCurrentKey(item.key);
    setLocalMeta(item);
    patchPrefs({ currentMusicKey: item.key, neteaseUrl: '' });

    const blob = await loadLocalMusicBlob(item.id);
    if (!blob) {
      setMusicError('本地音频丢失，请重新导入');
      setLocalSrc(null);
      return;
    }
    revokeLocalUrl();
    const url = URL.createObjectURL(blob);
    localUrlRef.current = url;
    localAutoplayRef.current = autoplay;
    setLocalSrc(url);
  }

  useEffect(() => {
    if (!localSrc || !localAutoplayRef.current) return;
    localAutoplayRef.current = false;
    const el = document.getElementById(
      'vibe-local-audio'
    ) as HTMLAudioElement | null;
    void el?.play().catch(() => undefined);
  }, [localSrc]);

  function activateNetease(item: SavedNeteaseItem) {
    setMusicError('');
    revokeLocalUrl();
    setLocalSrc(null);
    setLocalMeta(null);
    setMusicInput(item.url);
    setMusicEmbed({
      type: item.type,
      id: item.id,
      label: item.label,
      sourceUrl: item.url,
    });
    setCurrentKey(item.key);
    patchPrefs({ neteaseUrl: item.url, currentMusicKey: item.key });
  }

  function applyMusicLink() {
    const parsed = parseNeteaseUrl(musicInput);
    if (!parsed) {
      setMusicError('请粘贴网易云歌单 / 单曲 / 专辑链接');
      return;
    }
    setMusicError('');
    revokeLocalUrl();
    setLocalSrc(null);
    setLocalMeta(null);
    setMusicEmbed(parsed);
    const key = `${parsed.type}-${parsed.id}`;
    const existing = neteaseLibrary.find((x) => x.key === key);
    const item: SavedNeteaseItem = {
      key,
      type: parsed.type,
      id: parsed.id,
      label: parsed.label,
      url: musicInput.trim(),
      title: existing?.title || `${parsed.label} · ${parsed.id}`,
      savedAt: new Date().toISOString(),
    };
    setNeteaseLibrary(upsertNeteaseLibraryItem(item));
    setMusicInput(item.url);
    setCurrentKey(item.key);
  }

  async function onPickLocalFiles(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true);
    setMusicError('');
    try {
      let last: SavedLocalMusicMeta | null = null;
      for (const file of Array.from(files)) {
        last = await importLocalMusicFile(file);
        setLocalLibrary(readPrefs().localMusicLibrary);
      }
      if (last) await activateLocal(last, true);
    } catch (e) {
      setMusicError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function playTrack(track: PlaylistTrack) {
    if (track.kind === 'netease') activateNetease(track.item);
    else void activateLocal(track.item, true);
  }

  function changePlayMode(mode: MusicPlayMode) {
    setPlayMode(mode);
    patchPrefs({ musicPlayMode: mode });
  }

  function skipLibrary(dir: 1 | -1) {
    const list = playlistRef.current;
    if (list.length === 0) return;
    const idx = list.findIndex((x) => x.key === currentKeyRef.current);
    const mode = playModeRef.current;

    if (mode === 'random') {
      if (list.length === 1) {
        playTrack(list[0]);
        return;
      }
      let nextIdx = Math.floor(Math.random() * list.length);
      let guard = 0;
      while (nextIdx === idx && guard < 8) {
        nextIdx = Math.floor(Math.random() * list.length);
        guard += 1;
      }
      playTrack(list[nextIdx]);
      return;
    }

    const base = idx >= 0 ? idx : 0;
    const nextIdx = (base + dir + list.length) % list.length;
    playTrack(list[nextIdx]);
  }

  async function removeTrack(track: PlaylistTrack) {
    if (track.kind === 'netease') {
      const next = removeNeteaseLibraryItem(track.key);
      setNeteaseLibrary(next);
    } else {
      const next = await removeLocalMusicItem(track.key);
      setLocalLibrary(next);
    }
    const prefs = readPrefs();
    setCurrentKey(prefs.currentMusicKey);
    if (currentKey === track.key || currentKeyRef.current === track.key) {
      const refreshed = buildMusicPlaylist(
        prefs.neteaseLibrary,
        prefs.localMusicLibrary
      );
      const nextTrack = refreshed.find((t) => t.key === prefs.currentMusicKey);
      if (nextTrack) playTrack(nextTrack);
      else {
        setMusicEmbed(null);
        setMusicInput('');
        revokeLocalUrl();
        setLocalSrc(null);
        setLocalMeta(null);
      }
    }
    if (editingKey === track.key) {
      setEditingKey(null);
      setEditingTitle('');
    }
  }

  function saveTitleEdit() {
    if (!editingKey) return;
    const title = editingTitle.trim();
    if (!title) return;
    if (editingKey.startsWith('local-')) {
      setLocalLibrary(renameLocalMusicItem(editingKey, title));
    } else {
      setNeteaseLibrary(renameNeteaseLibraryItem(editingKey, title));
    }
    setEditingKey(null);
    setEditingTitle('');
  }

  function clearMusic() {
    setMusicEmbed(null);
    setMusicInput('');
    setMusicError('');
    revokeLocalUrl();
    setLocalSrc(null);
    setLocalMeta(null);
    setCurrentKey('');
    patchPrefs({ neteaseUrl: '', currentMusicKey: '' });
  }

  function changePlayerHeight(h: number) {
    setMusicHeight(h);
    patchPrefs({ neteasePlayerHeight: h });
  }

  function onLocalEnded() {
    if (playlistRef.current.length <= 1) return;
    skipLibrary(1);
  }

  const frame = playerFrameSize(musicHeight);
  const playerSrc = musicEmbed
    ? buildNeteasePlayerSrc(musicEmbed, { auto: false, height: musicHeight })
    : '';

  const panelStyle =
    open && typeof window !== 'undefined'
      ? {
          left: Math.max(8, Math.min(pos.x, window.innerWidth - 340)),
          top: Math.max(8, Math.min(pos.y, window.innerHeight - 160)),
        }
      : undefined;

  return (
    <>
      <button
        type="button"
        onPointerDown={startDrag}
        onClick={onTabClick}
        aria-expanded={open}
        aria-controls="vibe-panel"
        title="按住拖动 · 单击展开"
        className={`vibe-tab pointer-events-auto fixed z-[55] cursor-grab touch-none border border-[#8c6d58]/30 bg-[#fdfbf7]/45 px-3.5 py-3 text-[#4a3728] shadow-[0_8px_28px_rgba(61,47,42,0.14)] backdrop-blur-md transition-[opacity,background-color] duration-300 hover:bg-[#fdfbf7]/65 active:cursor-grabbing ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ left: pos.x, top: pos.y, right: 'auto' }}
      >
        <span className="block font-display text-[13px] leading-none tracking-[0.18em] text-[#4a3728]">
          氛围
        </span>
        <span className="mt-1.5 block font-serif text-[9px] tracking-[0.28em] text-[#4a3728]/75">
          VIBE
        </span>
      </button>

      <aside
        id="vibe-panel"
        className={`vibe-console pointer-events-auto fixed z-[55] flex max-h-[min(40rem,calc(100dvh-5rem))] w-[min(20.5rem,calc(100vw-2rem))] flex-col border border-[#8c6d58]/30 bg-[#fdfbf7]/50 shadow-[0_16px_48px_rgba(61,47,42,0.18)] backdrop-blur-md transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={panelStyle}
        aria-hidden={!open}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-[#8c6d58]/15 px-4 py-3 active:cursor-grabbing"
          onPointerDown={startDrag}
        >
          <div>
            <p className="font-display text-sm tracking-[0.22em] text-[#6b4f3f]">
              VIBE
            </p>
            <p className="mt-0.5 font-serif text-[10px] tracking-[0.16em] text-[#8c6d58]/90">
              场景 · 环境音 · 音乐
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="border border-[#8c6d58]/25 px-2.5 py-1 font-serif text-[10px] tracking-widest text-[#8c6d58] transition hover:border-[#8c6d58]/45 hover:text-[#6b4f3f]"
          >
            收起
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]">
              背景音乐
            </p>
            <div className="space-y-2 border border-[#8c6d58]/18 bg-[#f7efe4]/35 px-3 py-2.5">
              <input
                type="url"
                value={musicInput}
                onChange={(e) => setMusicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyMusicLink();
                }}
                placeholder="粘贴网易云歌单 / 单曲 / 专辑链接"
                className="w-full border border-[#8c6d58]/25 bg-[#fdfbf7]/90 px-2.5 py-1.5 font-serif text-[11px] text-[#5c4033] outline-none placeholder:text-[#8c6d58]/55 focus:border-[#8c6d58]/45"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={applyMusicLink}
                  className="border border-[#c9a84c]/55 bg-[#c9a84c]/15 px-2.5 py-1 font-serif text-[10px] tracking-widest text-[#5c4033]"
                >
                  嵌入
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="border border-[#c9a84c]/55 bg-[#c9a84c]/15 px-2.5 py-1 font-serif text-[10px] tracking-widest text-[#5c4033] disabled:opacity-50"
                >
                  {importing ? '导入中…' : '本地文件'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
                  multiple
                  className="hidden"
                  onChange={(e) => void onPickLocalFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => changePlayerHeight(66)}
                  className={`border px-2 py-1 font-serif text-[10px] tracking-wider ${
                    musicHeight === 66
                      ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                      : 'border-[#8c6d58]/25 text-[#6b4f3f]'
                  }`}
                >
                  紧凑
                </button>
                <button
                  type="button"
                  onClick={() => changePlayerHeight(430)}
                  className={`border px-2 py-1 font-serif text-[10px] tracking-wider ${
                    musicHeight === 430
                      ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                      : 'border-[#8c6d58]/25 text-[#6b4f3f]'
                  }`}
                >
                  列表
                </button>
                {(musicEmbed || localMeta) && (
                  <button
                    type="button"
                    onClick={clearMusic}
                    className="border border-[#8c6d58]/20 px-2 py-1 font-serif text-[10px] tracking-wider text-[#a07060]"
                  >
                    清除
                  </button>
                )}
              </div>
              {musicError && (
                <p className="font-serif text-[11px] text-[#a07060]">{musicError}</p>
              )}
              {musicEmbed && (
                <p className="font-serif text-[10px] tracking-wider text-[#8c6d58]">
                  已识别{musicEmbed.label} · ID {musicEmbed.id}
                </p>
              )}
              {musicEmbed && (
                <div className="overflow-hidden rounded-sm border border-[#8c6d58]/15 bg-[#fdfbf7]/70">
                  <iframe
                    title="网易云外链播放器"
                    frameBorder={0}
                    marginWidth={0}
                    marginHeight={0}
                    width="100%"
                    height={frame.height}
                    src={playerSrc}
                    className="block max-w-full"
                    allow="autoplay; encrypted-media"
                  />
                </div>
              )}
              {localMeta && localSrc && (
                <div className="space-y-1.5 border border-[#8c6d58]/15 bg-[#fdfbf7]/70 px-2 py-2">
                  <p className="truncate font-display text-[12px] text-[#5c4033]">
                    {localMeta.title}
                  </p>
                  <p className="font-serif text-[9px] tracking-wider text-[#8c6d58]">
                    本地 · {formatBytes(localMeta.size)} · {localMeta.fileName}
                  </p>
                  <audio
                    id="vibe-local-audio"
                    key={localSrc}
                    controls
                    src={localSrc}
                    className="w-full"
                    onEnded={onLocalEnded}
                  />
                </div>
              )}

              {/* 统一播放栏 */}
              <div className="border border-[#8c6d58]/15 bg-[#fdfbf7]/40 px-2 py-2">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <p className="font-serif text-[9px] tracking-[0.18em] text-[#8c6d58]">
                    播放栏 · {playlist.length}
                  </p>
                  {playlist.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => changePlayMode('order')}
                        className={`border px-1.5 py-0.5 font-serif text-[9px] tracking-wider ${
                          playMode === 'order'
                            ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                            : 'border-[#8c6d58]/20 text-[#6b4f3f]'
                        }`}
                      >
                        顺序
                      </button>
                      <button
                        type="button"
                        onClick={() => changePlayMode('random')}
                        className={`border px-1.5 py-0.5 font-serif text-[9px] tracking-wider ${
                          playMode === 'random'
                            ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                            : 'border-[#8c6d58]/20 text-[#6b4f3f]'
                        }`}
                      >
                        随机
                      </button>
                      <button
                        type="button"
                        title="上一首"
                        onClick={() => skipLibrary(-1)}
                        className="border border-[#8c6d58]/20 px-1.5 py-0.5 font-serif text-[9px] text-[#6b4f3f]"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        title={playMode === 'random' ? '随机下一首' : '下一首'}
                        onClick={() => skipLibrary(1)}
                        className="border border-[#8c6d58]/20 px-1.5 py-0.5 font-serif text-[9px] text-[#6b4f3f]"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
                {playlist.length === 0 ? (
                  <p className="font-serif text-[10px] text-[#8c6d58]/80">
                    网易云链接或本地音频导入后会出现在这里。
                  </p>
                ) : (
                  <ul className="max-h-36 space-y-1 overflow-y-auto">
                    {playlist.map((track) => {
                      const active = currentKey === track.key;
                      const badge =
                        track.kind === 'netease' ? track.item.label : '本地';
                      return (
                        <li
                          key={track.key}
                          className={`flex items-center gap-1.5 border px-1.5 py-1 ${
                            active
                              ? 'border-[#8b3a2a]/40 bg-[#8b3a2a]/08'
                              : 'border-[#8c6d58]/12 bg-[#fdfbf7]/55'
                          }`}
                        >
                          {editingKey === track.key ? (
                            <>
                              <input
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveTitleEdit();
                                  if (e.key === 'Escape') {
                                    setEditingKey(null);
                                    setEditingTitle('');
                                  }
                                }}
                                className="min-w-0 flex-1 border border-[#8c6d58]/25 bg-[#fdfbf7] px-1.5 py-0.5 font-serif text-[11px] text-[#5c4033] outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={saveTitleEdit}
                                className="shrink-0 border border-[#c9a84c]/45 px-1.5 py-0.5 font-serif text-[9px] text-[#5c4033]"
                              >
                                存
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => playTrack(track)}
                                className="min-w-0 flex-1 truncate text-left font-display text-[11px] text-[#5c4033]"
                                title={
                                  track.kind === 'netease'
                                    ? track.item.url
                                    : track.item.fileName
                                }
                              >
                                <span className="text-[9px] tracking-wider text-[#8c6d58]">
                                  {badge}
                                </span>{' '}
                                {track.title}
                              </button>
                              <button
                                type="button"
                                title="改名"
                                onClick={() => {
                                  setEditingKey(track.key);
                                  setEditingTitle(track.title);
                                }}
                                className="shrink-0 border border-[#8c6d58]/20 px-1 py-0.5 font-serif text-[9px] text-[#6b4f3f]"
                              >
                                名
                              </button>
                              <button
                                type="button"
                                title="从播放栏移除"
                                onClick={() => void removeTrack(track)}
                                className="shrink-0 border border-[#8c6d58]/20 px-1 py-0.5 font-serif text-[9px] text-[#a07060]"
                              >
                                删
                              </button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <p className="font-serif text-[9px] leading-relaxed text-[#8c6d58]/80">
                本地文件存在本机浏览器中（单首≤200MB）。顺序 / 随机作用于整栏；本地播完会按模式切下一首。网易云歌单内部仍由其外链播放器控制。
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]">
              背景场景
            </p>
            <div className="grid grid-cols-1 gap-2">
              {READING_SCENES.map((item) => {
                const active = bgKind === 'scene' && scene === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSceneChange(item.id)}
                    className={`border px-3 py-2.5 text-left transition-all duration-500 ${
                      active
                        ? 'border-[#8b3a2a]/50 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                        : 'border-[#8c6d58]/25 bg-[#f7efe4]/40 text-[#6b4f3f] hover:border-[#8c6d58]/45'
                    }`}
                  >
                    <span className="block font-display text-[12px] tracking-wide">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block font-serif text-[9px] tracking-[0.14em] opacity-70">
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 space-y-2 border border-[#8c6d58]/18 bg-[#f7efe4]/30 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (customBgName) onBgKindChange('custom');
                    else bgFileRef.current?.click();
                  }}
                  className={`border px-2.5 py-1 font-serif text-[10px] tracking-widest transition-colors ${
                    bgKind === 'custom'
                      ? 'border-[#8b3a2a]/45 bg-[#8b3a2a]/12 text-[#8b3a2a]'
                      : 'border-[#8c6d58]/30 text-[#6b4f3f]'
                  }`}
                >
                  自由背景
                </button>
                <button
                  type="button"
                  disabled={bgBusy}
                  onClick={() => bgFileRef.current?.click()}
                  className="font-serif text-[9px] tracking-widest text-[#8c6d58] underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {customBgName ? '更换' : '上传'}
                </button>
              </div>
              {customBgName && (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-serif text-[10px] text-[#6b4f3f]">
                    {customBgName}
                  </p>
                  <button
                    type="button"
                    disabled={bgBusy}
                    onClick={() => {
                      void onClearCustomBg().catch((err) =>
                        setBgMsg(err instanceof Error ? err.message : '清除失败')
                      );
                    }}
                    className="shrink-0 font-serif text-[9px] text-[#a07060]"
                  >
                    清除
                  </button>
                </div>
              )}
              <input
                ref={bgFileRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  setBgBusy(true);
                  setBgMsg('');
                  void onCustomBgImport(file)
                    .then(() => setBgMsg('已套用自由背景'))
                    .catch((err) =>
                      setBgMsg(err instanceof Error ? err.message : '上传失败')
                    )
                    .finally(() => {
                      setBgBusy(false);
                      if (bgFileRef.current) bgFileRef.current.value = '';
                      window.setTimeout(() => setBgMsg(''), 2200);
                    });
                }}
              />

              <div className="flex items-center justify-between gap-2 border-t border-[#8c6d58]/12 pt-2">
                <button
                  type="button"
                  onClick={() => onBgKindChange('solid')}
                  className={`border px-2.5 py-1 font-serif text-[10px] tracking-widest transition-colors ${
                    bgKind === 'solid'
                      ? 'border-[#8b3a2a]/45 bg-[#8b3a2a]/12 text-[#8b3a2a]'
                      : 'border-[#8c6d58]/30 text-[#6b4f3f]'
                  }`}
                >
                  纯色背景
                </button>
                <label className="flex items-center gap-1.5 font-serif text-[9px] tracking-wider text-[#8c6d58]">
                  色
                  <input
                    type="color"
                    value={solidBgColor}
                    onChange={(e) => onSolidBgColorChange(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-[#8c6d58]/25 bg-transparent p-0"
                    aria-label="背景纯色"
                  />
                </label>
              </div>
              {bgMsg && (
                <p className="font-serif text-[10px] text-[#8c6d58]">{bgMsg}</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]">
              纸感模式
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'default', label: '默认', hint: '羊皮玻璃' },
                  { id: 'eyecare', label: '护眼', hint: '柔绿低刺激' },
                  { id: 'kraft', label: '牛皮纸', hint: '暖褐纸感' },
                  { id: 'solid', label: '纯色纸', hint: '自选纸色' },
                ] as const
              ).map((item) => {
                const active = pageTheme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPageThemeChange(item.id)}
                    className={`border px-2.5 py-2 text-left transition-all duration-300 ${
                      active
                        ? 'border-[#8b3a2a]/50 bg-[#8b3a2a]/10 text-[#8b3a2a]'
                        : 'border-[#8c6d58]/25 bg-[#f7efe4]/40 text-[#6b4f3f] hover:border-[#8c6d58]/45'
                    }`}
                  >
                    <span className="block font-display text-[11px] tracking-wide">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block font-serif text-[9px] opacity-70">
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {pageTheme === 'solid' && (
              <label className="mt-2 flex items-center justify-between gap-2 border border-[#8c6d58]/18 bg-[#f7efe4]/30 px-3 py-2 font-serif text-[10px] tracking-wider text-[#6b4f3f]">
                纸面颜色
                <input
                  type="color"
                  value={pageSolidColor}
                  onChange={(e) => onPageSolidColorChange(e.target.value)}
                  className="h-6 w-8 cursor-pointer border border-[#8c6d58]/25 bg-transparent p-0"
                  aria-label="纸面纯色"
                />
              </label>
            )}
          </div>

          <div>
            <p className="mb-2 font-serif text-[10px] tracking-[0.2em] text-[#8c6d58]">
              环境音效
            </p>
            <div className="space-y-2.5">
              {READING_SOUNDS.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#8c6d58]/18 bg-[#f7efe4]/35 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => void toggleAmbient(item.id)}
                      className={`shrink-0 border px-2 py-1 font-serif text-[10px] tracking-widest transition-colors ${
                        ambientOn[item.id]
                          ? 'border-[#8b3a2a]/45 bg-[#8b3a2a]/12 text-[#8b3a2a]'
                          : 'border-[#8c6d58]/30 text-[#6b4f3f]'
                      }`}
                    >
                      {ambientOn[item.id] ? '暂停' : '播放'}
                    </button>
                    <span className="min-w-0 flex-1 truncate font-display text-[12px] text-[#5c4033]">
                      {item.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-serif text-[9px] tracking-widest text-[#8c6d58]">
                      音量
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={ambientVol[item.id]}
                      onChange={(e) =>
                        changeAmbientVolume(item.id, Number(e.target.value))
                      }
                      className="vibe-slider min-w-0 flex-1"
                      aria-label={`${item.label}音量`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {error && (
              <p className="mt-2 font-serif text-[11px] text-[#a07060]">{error}</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
