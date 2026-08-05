/**
 * 抵消 root layout 的 main 内边距，避免空页面被撑出浏览器滚动条。
 */
export default function ReadingSpaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-6 -mb-32 -mt-24 min-h-0 md:-mx-10 md:-mt-28">
      {children}
    </div>
  );
}
