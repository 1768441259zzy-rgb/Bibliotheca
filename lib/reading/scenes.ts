export type ReadingScene = 'candle' | 'sunroom' | 'rainhall';

export type AmbientSoundId =
  | 'jiangnan-rain'
  | 'forest-birds'
  | 'banana-rain'
  | 'candle-moon';

export const READING_SCENES: {
  id: ReadingScene;
  label: string;
  hint: string;
  background: string;
}[] = [
  {
    id: 'sunroom',
    label: '暖阳书房',
    hint: 'Sunlit Study',
    background: `/assets/decorations/${encodeURIComponent('暖阳书房.png')}`,
  },
  {
    id: 'rainhall',
    label: '听雨闲阁',
    hint: 'Rain Pavilion',
    background: `/assets/decorations/${encodeURIComponent('听雨闲阁.png')}`,
  },
  {
    id: 'candle',
    label: '烛光夜读',
    hint: 'Candlelight',
    background: `/assets/decorations/${encodeURIComponent('烛光夜读.png')}`,
  },
];

export const READING_SOUNDS: {
  id: AmbientSoundId;
  label: string;
  src: string;
}[] = [
  {
    id: 'jiangnan-rain',
    label: '江南雷雨',
    src: `/assets/sound/${encodeURIComponent('江南雷雨.mp3')}`,
  },
  {
    id: 'forest-birds',
    label: '林啸鸟啼',
    src: `/assets/sound/${encodeURIComponent('林啸鸟啼.mp3')}`,
  },
  {
    id: 'banana-rain',
    label: '雨打芭蕉',
    src: `/assets/sound/${encodeURIComponent('雨打芭蕉.mp3')}`,
  },
  {
    id: 'candle-moon',
    label: '烛火月夜',
    src: `/assets/sound/${encodeURIComponent('烛火月夜.mp3')}`,
  },
];

export function getSceneBackground(scene: ReadingScene): string {
  return (
    READING_SCENES.find((s) => s.id === scene)?.background ??
    READING_SCENES[0].background
  );
}
