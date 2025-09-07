import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/utils/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the current authenticated user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();
    const { id } = await params;

    // Build update object with only the provided fields
    const updateData: {
      details?: string;
      date?: string;
      summary?: string;
      is_submitted?: boolean;
      week_starting?: string;
      resident_id?: string;
      resident_empl_id?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (body.details !== undefined) {
      updateData.details = body.details;
    }
    if (body.date !== undefined) {
      updateData.date = body.date;
    }
    if (body.summary !== undefined) {
      updateData.summary = body.summary;
    }
    if (body.isSubmitted !== undefined) {
      updateData.is_submitted = body.isSubmitted;
    }
    if (body.weekStarting !== undefined) {
      updateData.week_starting = body.weekStarting;
    }
    if (body.residentId !== undefined) {
      updateData.resident_id = body.residentId;
    }
    if (body.residentEmplId !== undefined) {
      updateData.resident_empl_id = body.residentEmplId;
    }

    const { data, error } = await supabase
      .from('interactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', currentUser.id) // Ensure user can only update their own interactions
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the current authenticated user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();
    const { id } = await params;

    // First, get the current interaction to preserve submission status
    const { data: currentInteraction, error: fetchError } = await supabase
      .from('interactions')
      .select('is_submitted')
      .eq('id', id)
      .eq('user_id', currentUser.id) // Ensure user can only access their own interactions
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Update only the provided fields while preserving submission status
    const updateData: {
      updated_at: string;
      details?: string;
      date?: string;
      summary?: string;
      is_submitted: boolean;
    } = {
      updated_at: new Date().toISOString(),
      is_submitted: currentInteraction.is_submitted,
    };

    if (body.details !== undefined) {
      updateData.details = body.details;
    }
    if (body.date !== undefined) {
      updateData.date = body.date;
    }
    if (body.summary !== undefined) {
      updateData.summary = body.summary;
    }

    const { data, error } = await supabase
      .from('interactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', currentUser.id) // Ensure user can only update their own interactions
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
    // Get the current authenticated user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await params;

    const { error } = await supabase
      .from('interactions')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id); // Ensure user can only delete their own interactions

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}