/**
 * 网易云官方外链播放器：解析分享链接 → iframe src
 * type: 0 歌单 · 1 专辑 · 2 单曲
 */

export type NeteaseMediaType = 0 | 1 | 2;

export interface NeteaseEmbed {
  type: NeteaseMediaType;
  id: string;
  label: '歌单' | '专辑' | '单曲';
  sourceUrl: string;
}

const TYPE_LABEL: Record<NeteaseMediaType, NeteaseEmbed['label']> = {
  0: '歌单',
  1: '专辑',
  2: '单曲',
};

export function parseNeteaseUrl(input: string): NeteaseEmbed | null {
  const raw = input.trim();
  if (!raw) return null;

  // 已是外链播放器
  const outchain = raw.match(
    /music\.163\.com\/outchain\/player[^?\s]*\?([^#\s]+)/i
  );
  if (outchain) {
    const params = new URLSearchParams(outchain[1]);
    const id = params.get('id');
    const type = Number(params.get('type'));
    if (id && (type === 0 || type === 1 || type === 2)) {
      return {
        type: type as NeteaseMediaType,
        id,
        label: TYPE_LABEL[type as NeteaseMediaType],
        sourceUrl: raw,
      };
    }
  }

  let url: URL;
  try {
    const normalized = raw.startsWith('http')
      ? raw.replace('://music.163.com/#/', '://music.163.com/')
      : `https://${raw.replace(/^\/\//, '').replace('music.163.com/#/', 'music.163.com/')}`;
    url = new URL(normalized.replace('/#/', '/'));
  } catch {
    // 纯数字当作歌单 id
    if (/^\d{5,}$/.test(raw)) {
      return {
        type: 0,
        id: raw,
        label: '歌单',
        sourceUrl: `https://music.163.com/playlist?id=${raw}`,
      };
    }
    return null;
  }

  const host = url.hostname;
  if (!host.includes('163.com') && !host.includes('music.163')) {
    return null;
  }

  const path = url.pathname.toLowerCase();
  const id =
    url.searchParams.get('id') ||
    path.match(/\/(playlist|song|album)\/(\d+)/)?.[2] ||
    '';

  if (!id) return null;

  let type: NeteaseMediaType = 0;
  if (path.includes('song') || url.hash.includes('song')) type = 2;
  else if (path.includes('album') || url.hash.includes('album')) type = 1;
  else type = 0;

  // hash 路由：#/playlist?id=
  const hash = url.hash || '';
  const hashId = hash.match(/[?&]id=(\d+)/)?.[1];
  const finalId = hashId || id;
  if (hash.includes('song')) type = 2;
  else if (hash.includes('album')) type = 1;
  else if (hash.includes('playlist')) type = 0;

  return {
    type,
    id: finalId,
    label: TYPE_LABEL[type],
    sourceUrl: `https://music.163.com/${type === 2 ? 'song' : type === 1 ? 'album' : 'playlist'}?id=${finalId}`,
  };
}

export function buildNeteasePlayerSrc(
  embed: NeteaseEmbed,
  opts?: { auto?: boolean; height?: number }
): string {
  const auto = opts?.auto ? 1 : 0;
  const height = opts?.height ?? 66;
  return `https://music.163.com/outchain/player?type=${embed.type}&id=${embed.id}&auto=${auto}&height=${height}`;
}

export function playerFrameSize(height: number): { width: number; height: number } {
  // 官方约定：height=66 中型无列表；其它为大列表样式
  if (height <= 32) return { width: 280, height: 52 };
  if (height <= 66) return { width: 280, height: 86 };
  return { width: 280, height: Math.min(450, height + 20) };
}
