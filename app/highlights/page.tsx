import { getAllHighlights } from '@/lib/highlights';
import HighlightsStudio from '@/components/HighlightsStudio';

export default async function HighlightsPage() {
  const groups = await getAllHighlights();
  return <HighlightsStudio initialGroups={groups} />;
}
