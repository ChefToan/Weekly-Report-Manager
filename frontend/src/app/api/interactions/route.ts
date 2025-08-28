import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const weekStarting = searchParams.get('weekStarting');
    const residentId = searchParams.get('residentId');

    let query = supabase
      .from('interactions')
      .select(`
        *,
        residents (
          id,
          name,
          empl_id
        )
      `)
      .order('date', { ascending: false });

    if (weekStarting) {
      query = query.eq('week_starting', weekStarting);
    }

    if (residentId) {
      query = query.eq('resident_id', residentId);
    }

    const { data: interactions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(interactions);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();

    const { data, error } = await supabase
      .from('interactions')
      .insert({
        resident_id: body.residentId,
        resident_empl_id: body.residentEmplId,
        week_starting: body.weekStarting,
        date: body.date,
        summary: body.summary,
        details: body.details,
        column: body.column || null, // Store the column number
        is_submitted: false,
      })
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