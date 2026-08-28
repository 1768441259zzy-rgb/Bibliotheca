import { NextResponse } from 'next/server';
import {
  createSignedDownload,
  listCloudSessions,
} from '@/lib/reading/cloudReading';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sessionId = decodeURIComponent(id || '').trim();
    if (!sessionId) {
      return NextResponse.json({ error: '缺少会话 id' }, { status: 400 });
    }

    const sessions = await listCloudSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session?.storagePath) {
      return NextResponse.json(
        { error: '云端没有这本书的文件' },
        { status: 404 }
      );
    }

    const url = await createSignedDownload(session.storagePath, 60 * 30);
    return NextResponse.json({
      url,
      storageKind: session.storageKind,
      fileName: session.fileName,
      mimeType: session.mimeType,
      format: session.format,
      title: session.title,
    });
  } catch (error) {
    console.error('Signed download failed:', error);
    return NextResponse.json({ error: '获取下载链接失败' }, { status: 500 });
  }
}
