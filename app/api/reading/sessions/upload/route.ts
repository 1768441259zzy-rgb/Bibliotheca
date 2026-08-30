import { NextResponse } from 'next/server';
import type { EbookFormat } from '@/lib/reading/parseEbook';
import {
  READING_CLOUD_MAX_BYTES,
  createSignedUpload,
  upsertCloudSession,
  cloudSessionToMeta,
  type StorageKind,
} from '@/lib/reading/cloudReading';

export const runtime = 'nodejs';

/** 申请签名上传地址（文件直传 Storage，避开 Vercel body 限制） */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      format?: EbookFormat;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      storageKind?: StorageKind;
      chapterIndex?: number;
      fontScale?: number;
      scrollTop?: number;
      pageCount?: number;
    };

    const id = String(body.id ?? '').trim();
    const title = String(body.title ?? '').trim();
    const format = body.format;
    const fileName = String(body.fileName ?? 'book.bin').trim() || 'book.bin';
    const fileSize = Number(body.fileSize ?? 0);
    const storageKind: StorageKind = body.storageKind === 'payload' ? 'payload' : 'original';

    if (!id || !title || !format) {
      return NextResponse.json(
        { error: '缺少 id / title / format' },
        { status: 400 }
      );
    }
    if (fileSize > READING_CLOUD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `文件超过云端上限（${Math.floor(READING_CLOUD_MAX_BYTES / (1024 * 1024))}MB）`,
        },
        { status: 400 }
      );
    }

    const safeName = fileName.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 80);
    const storagePath = `${id}/${storageKind}-${safeName}`;

    const signed = await createSignedUpload(storagePath);

    const session = await upsertCloudSession({
      id,
      title,
      format,
      fileName,
      storagePath,
      storageKind,
      fileSize: fileSize || undefined,
      mimeType: body.mimeType,
      chapterIndex: body.chapterIndex,
      fontScale: body.fontScale,
      scrollTop: body.scrollTop,
      pageCount: body.pageCount,
    });

    return NextResponse.json({
      session: cloudSessionToMeta(session),
      upload: signed,
      storagePath,
    });
  } catch (error) {
    console.error('Prepare reading upload failed:', error);
    const message =
      error instanceof Error ? error.message : '准备上传失败';
    return NextResponse.json(
      {
        error: message.includes('Bucket')
          ? '请先在 Supabase 创建 reading-books 存储桶并执行 reading-sync.sql'
          : '准备上传失败',
      },
      { status: 500 }
    );
  }
}
