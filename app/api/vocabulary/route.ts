import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  deleteVocab,
  getAllVocab,
  insertVocab,
  updateVocab,
  upsertVocabByEnglish,
} from '@/lib/vocabulary';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const entries = await getAllVocab();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('List vocab failed:', error);
    return NextResponse.json({ error: '读取词汇失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      english?: string;
      chinese?: string;
      source?: string;
      mergeByEnglish?: boolean;
    };

    const english = String(body.english ?? '').trim();
    const chinese = String(body.chinese ?? '').trim();
    const source = String(body.source ?? '').trim();

    if (!english) {
      return NextResponse.json({ error: '请填写英文' }, { status: 400 });
    }

    if (body.mergeByEnglish) {
      const result = await upsertVocabByEnglish({
        english,
        chinese,
        source: source || undefined,
      });
      revalidatePath('/vocabulary');
      return NextResponse.json({
        entry: result.entry,
        merged: result.merged,
      });
    }

    const entry = await insertVocab({
      english,
      chinese,
      source: source || undefined,
    });
    revalidatePath('/vocabulary');
    return NextResponse.json({ entry, merged: false });
  } catch (error) {
    console.error('Add vocab failed:', error);
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      english?: string;
      chinese?: string;
      source?: string;
    };
    const id = String(body.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: '缺少词汇 id' }, { status: 400 });
    }

    const entry = await updateVocab(id, {
      english: body.english,
      chinese: body.chinese,
      source: body.source,
    });

    if (!entry) {
      return NextResponse.json({ error: '未找到该词汇' }, { status: 404 });
    }

    revalidatePath('/vocabulary');
    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Update vocab failed:', error);
    return NextResponse.json({ error: '更新失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id')?.trim() || '';

    if (!id) {
      try {
        const body = (await request.json()) as { id?: string };
        id = String(body.id ?? '').trim();
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: '缺少词汇 id' }, { status: 400 });
    }

    const ok = await deleteVocab(id);
    if (!ok) {
      return NextResponse.json({ error: '未找到该词汇' }, { status: 404 });
    }

    revalidatePath('/vocabulary');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete vocab failed:', error);
    return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
  }
}
