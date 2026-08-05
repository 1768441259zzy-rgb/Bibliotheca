import { getAllHighlights } from '@/lib/highlights';
import HighlightsStudio from '@/components/HighlightsStudio';

export const dynamic = 'force-dynamic';

export default async function HighlightsPage() {
  const groups = await getAllHighlights();
  return <HighlightsStudio initialGroups={groups} />;
}
