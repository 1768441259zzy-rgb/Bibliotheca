import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { HighlightGroup } from '@/data/content';
import {
  deleteHighlightGroup,
  deleteHighlightQuote,
  getAllHighlights,
  readUserHighlights,
  updateHighlightGroup,
  updateHighlightQuote,
  writeUserHighlights,
} from '@/lib/highlights';

export const runtime = 'nodejs';

export async function GET() {
  const highlights = await getAllHighlights();
  return NextResponse.json({ highlights });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      bookTitle?: string;
      author?: string;
      quotes?: string[];
      /** 同书名时追加到已有用户划线组（Reading Space 导入） */
      mergeByTitle?: boolean;
    };

    const bookTitle = String(body.bookTitle ?? '').trim();
    const author = String(body.author ?? '').trim();
    const mergeByTitle = Boolean(body.mergeByTitle);
    const quotes = (Array.isArray(body.quotes) ? body.quotes : [])
      .map((q) => String(q ?? '').trim())
      .filter(Boolean);

    if (!bookTitle) {
      return NextResponse.json({ error: '请填写书名 / 文章标题' }, { status: 400 });
    }

    if (quotes.length === 0) {
      return NextResponse.json({ error: '请至少添加一句摘抄' }, { status: 400 });
    }

    const userHighlights = await readUserHighlights();

    if (mergeByTitle) {
      const existingIdx = userHighlights.findIndex(
        (g) => g.bookTitle === bookTitle
      );
      if (existingIdx >= 0) {
        const existing = userHighlights[existingIdx];
        const mergedQuotes = [...existing.quotes];
        for (const q of quotes) {
          if (!mergedQuotes.includes(q)) mergedQuotes.push(q);
        }
        const group: HighlightGroup = {
          ...existing,
          quotes: mergedQuotes,
          ...(author ? { author } : {}),
        };
        userHighlights[existingIdx] = group;
        await writeUserHighlights(userHighlights);
        revalidatePath('/highlights');
        return NextResponse.json({ group, merged: true });
      }
    }

    const group: HighlightGroup = {
      id: `h${Date.now()}`,
      bookTitle,
      quotes,
      ...(author ? { author } : {}),
    };

    userHighlights.push(group);
    await writeUserHighlights(userHighlights);

    revalidatePath('/highlights');

    return NextResponse.json({ group, merged: false });
  } catch (error) {
    console.error('Add highlight failed:', error);
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      bookTitle?: string;
      author?: string;
      quotes?: string[];
      quoteIndex?: number;
      quote?: string;
    };

    const id = String(body.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: '缺少摘抄 id' }, { status: 400 });
    }

    // Single quote edit
    if (typeof body.quoteIndex === 'number' && body.quote !== undefined) {
      const group = await updateHighlightQuote(
        id,
        body.quoteIndex,
        String(body.quote)
      );
      if (!group) {
        return NextResponse.json({ error: '更新失败，请检查内容' }, { status: 400 });
      }
      revalidatePath('/highlights');
      return NextResponse.json({ group });
    }

    // Full group edit
    const bookTitle = String(body.bookTitle ?? '').trim();
    const author = String(body.author ?? '').trim();
    const quotes = (Array.isArray(body.quotes) ? body.quotes : [])
      .map((q) => String(q ?? '').trim())
      .filter(Boolean);

    if (!bookTitle) {
      return NextResponse.json({ error: '请填写书名 / 文章标题' }, { status: 400 });
    }
    if (quotes.length === 0) {
      return NextResponse.json({ error: '请至少保留一句摘抄' }, { status: 400 });
    }

    const group = await updateHighlightGroup(id, {
      bookTitle,
      author,
      quotes,
    });

    if (!group) {
      return NextResponse.json({ error: '未找到该摘抄' }, { status: 404 });
    }

    revalidatePath('/highlights');
    return NextResponse.json({ group });
  } catch (error) {
    console.error('Update highlight failed:', error);
    return NextResponse.json({ error: '更新失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id')?.trim() || '';
    let quoteIndex: number | null = null;
    const quoteIndexParam = searchParams.get('quoteIndex');
    if (quoteIndexParam !== null && quoteIndexParam !== '') {
      const n = Number(quoteIndexParam);
      if (!Number.isNaN(n)) quoteIndex = n;
    }

    if (!id) {
      try {
        const body = (await request.json()) as {
          id?: string;
          quoteIndex?: number;
        };
        id = String(body.id ?? '').trim();
        if (typeof body.quoteIndex === 'number') quoteIndex = body.quoteIndex;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: '缺少摘抄 id' }, { status: 400 });
    }

    if (quoteIndex !== null) {
      const result = await deleteHighlightQuote(id, quoteIndex);
      if (!result) {
        return NextResponse.json({ error: '未找到该句子' }, { status: 404 });
      }
      revalidatePath('/highlights');
      return NextResponse.json({
        ok: true,
        deletedGroup: result.deletedGroup,
        group: result.group,
      });
    }

    const ok = await deleteHighlightGroup(id);
    if (!ok) {
      return NextResponse.json({ error: '未找到该摘抄' }, { status: 404 });
    }

    revalidatePath('/highlights');
    return NextResponse.json({ ok: true, deletedGroup: true });
  } catch (error) {
    console.error('Delete highlight failed:', error);
    return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
  }
}
