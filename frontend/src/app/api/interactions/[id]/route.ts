import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { id } = await params;

    const { data, error } = await supabase
      .from('interactions')
      .update({
        ...body,
        week_starting: body.weekStarting,
        resident_id: body.residentId,
        resident_empl_id: body.residentEmplId,
        is_submitted: body.isSubmitted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        residents (
          id,
          name,
          empl_id
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const { id } = await params;

    const { error } = await supabase
      .from('interactions')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}