import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface Message {
  id: string;
  name: string;
  contact?: string;
  content: string;
  stamp?: string;
  createdAt: string;
}

interface GuestMessageRow {
  id: string;
  name: string;
  contact: string | null;
  content: string;
  stamp: string | null;
  created_at: string;
}

function rowToMessage(row: GuestMessageRow): Message {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.created_at,
    ...(row.contact ? { contact: row.contact } : {}),
    ...(row.stamp ? { stamp: row.stamp } : {}),
  };
}

export async function readMessages(): Promise<Message[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('guest_messages')
    .select('id, name, contact, content, stamp, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('readMessages failed:', error);
    throw new Error(error.message);
  }

  return (data as GuestMessageRow[] | null)?.map(rowToMessage) ?? [];
}

export async function insertMessage(message: Message): Promise<Message> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('guest_messages')
    .insert({
      id: message.id,
      name: message.name,
      contact: message.contact ?? null,
      content: message.content,
      stamp: message.stamp ?? null,
      created_at: message.createdAt,
    })
    .select('id, name, contact, content, stamp, created_at')
    .single();

  if (error) {
    console.error('insertMessage failed:', error);
    throw new Error(error.message);
  }

  return rowToMessage(data as GuestMessageRow);
}

export async function deleteMessageById(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('guest_messages')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('deleteMessageById failed:', error);
    throw new Error(error.message);
  }

  return Array.isArray(data) && data.length > 0;
}

/** @deprecated 已改为单条 insert；保留空实现避免误用整表覆盖 */
export async function writeMessages(_messages: Message[]): Promise<void> {
  throw new Error('writeMessages 已停用，请使用 insertMessage');
}
