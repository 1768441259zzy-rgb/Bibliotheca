import ReadingSpace from '@/components/reading-space/ReadingSpace';

export default function ReadingSpacePage() {
  // 不占高度：阅读层是 fixed portal，避免 main 被撑出第二条滚动轴
  return <ReadingSpace />;
}
