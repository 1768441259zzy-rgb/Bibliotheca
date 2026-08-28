import { NextResponse } from 'next/server';
import {
  deleteCloudAnnotation,
  deleteCloudAnnotationsByBook,
  listCloudAnnotations,
  upsertCloudAnnotations,
} from '@/lib/reading/cloudReading';
import type { ReadingAnnotation } from '@/lib/reading/annotations';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const annotations = await listCloudAnnotations();
    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('List reading annotations failed:', error);
    return NextResponse.json({ error: '读取云端感悟失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      annotations?: ReadingAnnotation[];
      annotation?: ReadingAnnotation;
    };

    const items = Array.isArray(body.annotations)
      ? body.annotations
      : body.annotation
        ? [body.annotation]
        : [];

    if (items.length === 0) {
      return NextResponse.json({ error: '没有可同步的感悟' }, { status: 400 });
    }

    const annotations = await upsertCloudAnnotations(items);
    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Upsert reading annotations failed:', error);
    return NextResponse.json({ error: '同步感悟失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';
    const bookTitle = searchParams.get('bookTitle')?.trim() || '';

    if (bookTitle) {
      const count = await deleteCloudAnnotationsByBook(bookTitle);
      return NextResponse.json({ ok: true, count });
    }
    if (!id) {
      return NextResponse.json({ error: '缺少 id 或 bookTitle' }, { status: 400 });
    }
    const ok = await deleteCloudAnnotation(id);
    if (!ok) {
      return NextResponse.json({ error: '未找到该感悟' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete reading annotation failed:', error);
    return NextResponse.json({ error: '删除云端感悟失败' }, { status: 500 });
  }
}
