import { NextResponse } from 'next/server';
import type { Message } from '@/lib/messages';
import {
  deleteMessageById,
  insertMessage,
  readMessages,
} from '@/lib/messages';
import { sendMessageNotification } from '@/lib/email';

export const runtime = 'nodejs';

const ALLOWED_STAMPS = new Set(['✒', '✦', '☙', '☽', '❖']);

/** 公开展示用：不返回联系方式 */
function toPublicNote(message: Message) {
  return {
    id: message.id,
    name: message.name,
    content: message.content,
    stamp: message.stamp || '❖',
    createdAt: message.createdAt,
  };
}

export async function GET() {
  try {
    const messages = await readMessages();
    return NextResponse.json({
      messages: messages.map(toPublicNote),
    });
  } catch (error) {
    console.error('Read messages failed:', error);
    return NextResponse.json({ error: '读取留言失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      contact?: string;
      content?: string;
      stamp?: string;
    };

    const name = String(body.name ?? '').trim();
    const contact = String(body.contact ?? '').trim();
    const content = String(body.content ?? '').trim();
    const stamp = String(body.stamp ?? '').trim();

    if (!name) {
      return NextResponse.json({ error: '请留下你的名字' }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: '请填写留言内容' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '留言请控制在 2000 字以内' }, { status: 400 });
    }
    if (!stamp || !ALLOWED_STAMPS.has(stamp)) {
      return NextResponse.json({ error: '请选择一枚藏书印' }, { status: 400 });
    }

    const message: Message = {
      id: `m${Date.now()}`,
      name,
      content,
      stamp,
      createdAt: new Date().toISOString(),
      ...(contact ? { contact } : {}),
    };

    await insertMessage(message);

    try {
      const result = await sendMessageNotification(message);
      if (!result.sent) {
        console.warn('Message saved, email skipped:', result.reason);
      }
    } catch (mailError) {
      console.error('Message saved, but email failed:', mailError);
    }

    return NextResponse.json({
      ok: true,
      stamp: message.stamp,
      note: toPublicNote(message),
    });
  } catch (error) {
    console.error('Save message failed:', error);
    return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 });
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
      return NextResponse.json({ error: '缺少留言 id' }, { status: 400 });
    }

    const ok = await deleteMessageById(id);
    if (!ok) {
      return NextResponse.json({ error: '未找到该留言' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete message failed:', error);
    return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 });
  }
}
