import { getAllCovers } from '@/lib/covers';
import CoverArtStudio from '@/components/CoverArtStudio';

export default async function CoverArtPage() {
  const covers = await getAllCovers();
  return <CoverArtStudio initialCovers={covers} />;
}
