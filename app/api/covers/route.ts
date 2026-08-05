import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { BookCover } from '@/data/content';
import {
  deleteCoverById,
  getAllCovers,
  insertUserCover,
  saveCoverOrder,
  updateCoverMeta,
  uploadCoverImage,
} from '@/lib/covers';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function extForFile(file: File): string {
  return (
    EXT_BY_TYPE[file.type] ||
    (file.name.includes('.')
      ? `.${file.name.split('.').pop()!.toLowerCase()}`
      : '.jpg')
  );
}

export async function GET() {
  try {
    const covers = await getAllCovers();
    return NextResponse.json({ covers });
  } catch (error) {
    console.error('List covers failed:', error);
    return NextResponse.json({ error: '读取封面失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('image');
    const title = String(form.get('title') ?? '').trim();
    const designer = String(form.get('designer') ?? '').trim();
    const tagsRaw = String(form.get('tags') ?? '').trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: '请选择要上传的封面图片' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: '仅支持 JPG / PNG / WEBP / GIF 图片' },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: '图片请控制在 8MB 以内' }, { status: 400 });
    }

    const id = `u${Date.now()}`;
    const ext = extForFile(file);
    const objectPath = `cover-${id}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await uploadCoverImage(objectPath, buffer, file.type);

    const tags = tagsRaw
      ? tagsRaw
          .split(/[,，、]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    const cover: BookCover = {
      id,
      imageUrl,
      ...(title ? { title } : {}),
      ...(designer ? { designer } : {}),
      ...(tags && tags.length ? { tags } : {}),
    };

    const saved = await insertUserCover(cover);

    revalidatePath('/cover-art');

    return NextResponse.json({ cover: saved });
  } catch (error) {
    console.error('Upload cover failed:', error);
    return NextResponse.json({ error: '上传失败，请稍后重试' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: '缺少封面 id' }, { status: 400 });
    }

    const title = String(form.get('title') ?? '').trim();
    const designer = String(form.get('designer') ?? '').trim();
    const tagsRaw = String(form.get('tags') ?? '').trim();
    const file = form.get('image');

    const tags = tagsRaw
      ? tagsRaw
          .split(/[,，、]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    let imageUrl: string | undefined;

    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: '仅支持 JPG / PNG / WEBP / GIF 图片' },
          { status: 400 }
        );
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: '图片请控制在 8MB 以内' }, { status: 400 });
      }

      const ext = extForFile(file);
      const objectPath = `cover-${id}-${Date.now()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      imageUrl = await uploadCoverImage(objectPath, buffer, file.type);
    }

    const cover = await updateCoverMeta(id, {
      title,
      designer,
      tags,
      imageUrl,
    });

    if (!cover) {
      return NextResponse.json({ error: '未找到该封面' }, { status: 404 });
    }

    revalidatePath('/cover-art');
    return NextResponse.json({ cover });
  } catch (error) {
    console.error('Update cover failed:', error);
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
      return NextResponse.json({ error: '缺少封面 id' }, { status: 400 });
    }

    const ok = await deleteCoverById(id);
    if (!ok) {
      return NextResponse.json({ error: '未找到该封面' }, { status: 404 });
    }

    revalidatePath('/cover-art');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete cover failed:', error);
    return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
  }
}

/** 保存封面展示顺序 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id) => String(id ?? '').trim()).filter(Boolean)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: '排序列表不能为空' }, { status: 400 });
    }

    const existing = await getAllCovers();
    const existingIds = new Set(existing.map((c) => c.id));
    const unknown = ids.filter((id) => !existingIds.has(id));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `含未知封面 id：${unknown.join(', ')}` },
        { status: 400 }
      );
    }

    // 把未出现在 ids 里的封面接到末尾，避免漏掉
    const ordered = [
      ...ids,
      ...existing.map((c) => c.id).filter((id) => !ids.includes(id)),
    ];

    const saved = await saveCoverOrder(ordered);
    revalidatePath('/cover-art');
    return NextResponse.json({ ok: true, ids: saved });
  } catch (error) {
    console.error('Reorder covers failed:', error);
    return NextResponse.json({ error: '保存排序失败，请稍后重试' }, { status: 500 });
  }
}
