import { NextResponse } from 'next/server';
import {
  cloudSessionToMeta,
  deleteCloudSession,
  listCloudSessions,
  patchCloudSessionProgress,
  upsertCloudSession,
} from '@/lib/reading/cloudReading';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const sessions = await listCloudSessions();
    return NextResponse.json({
      sessions: sessions.map(cloudSessionToMeta),
    });
  } catch (error) {
    console.error('List reading sessions failed:', error);
    return NextResponse.json(
      { error: '读取云端阅读记录失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      chapterIndex?: number;
      fontScale?: number;
      scrollTop?: number;
      updatedAt?: string;
    };
    const id = String(body.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: '缺少会话 id' }, { status: 400 });
    }

    const session = await patchCloudSessionProgress(id, {
      chapterIndex: body.chapterIndex,
      fontScale: body.fontScale,
      scrollTop: body.scrollTop,
      updatedAt: body.updatedAt,
    });

    if (!session) {
      return NextResponse.json({ error: '未找到该会话' }, { status: 404 });
    }

    return NextResponse.json({ session: cloudSessionToMeta(session) });
  } catch (error) {
    console.error('Patch reading session failed:', error);
    return NextResponse.json({ error: '同步进度失败' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      format?: 'txt' | 'epub' | 'pdf';
      fileName?: string;
      storagePath?: string;
      storageKind?: 'original' | 'payload';
      fileSize?: number;
      mimeType?: string;
      chapterIndex?: number;
      fontScale?: number;
      scrollTop?: number;
      pageCount?: number;
      updatedAt?: string;
    };

    const id = String(body.id ?? '').trim();
    const title = String(body.title ?? '').trim();
    const format = body.format;
    if (!id || !title || !format) {
      return NextResponse.json(
        { error: '缺少 id / title / format' },
        { status: 400 }
      );
    }

    const session = await upsertCloudSession({
      id,
      title,
      format,
      fileName: body.fileName,
      storagePath: body.storagePath,
      storageKind: body.storageKind,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      chapterIndex: body.chapterIndex,
      fontScale: body.fontScale,
      scrollTop: body.scrollTop,
      pageCount: body.pageCount,
      updatedAt: body.updatedAt,
    });

    return NextResponse.json({ session: cloudSessionToMeta(session) });
  } catch (error) {
    console.error('Upsert reading session failed:', error);
    return NextResponse.json({ error: '保存云端会话失败' }, { status: 500 });
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
      return NextResponse.json({ error: '缺少会话 id' }, { status: 400 });
    }

    const ok = await deleteCloudSession(id);
    if (!ok) {
      return NextResponse.json({ error: '未找到该会话' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete reading session failed:', error);
    return NextResponse.json({ error: '删除云端会话失败' }, { status: 500 });
  }
}
