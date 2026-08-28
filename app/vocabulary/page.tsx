import { getAllVocab } from '@/lib/vocabulary';
import VocabularyStudio from '@/components/VocabularyStudio';

export const dynamic = 'force-dynamic';

export default async function VocabularyPage() {
  const entries = await getAllVocab();
  return <VocabularyStudio initialEntries={entries} />;
}
