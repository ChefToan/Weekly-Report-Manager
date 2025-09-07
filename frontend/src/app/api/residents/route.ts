import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/utils/auth';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: residents, error } = await supabase
      .from('residents')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(residents);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();

    const payload = {
      user_id: currentUser.id,
      name: body.name,
      empl_id: body.empl_id,
      email: body.email ?? null,
      room: body.room ?? null,
    };

    const { data, error } = await supabase
      .from('residents')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// OPTIMIZED: Batch delete endpoint to handle multiple residents at once
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty ids array' }, { status: 400 });
    }

    // Delete related interactions first (only current user's)
    const { error: interactionsError } = await supabase
      .from('interactions')
      .delete()
      .in('resident_id', ids)
      .eq('user_id', currentUser.id);

    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError);
      // Continue with residents deletion even if interactions fail
    }

    // Delete residents that belong to the current user
    const { data, error } = await supabase
      .from('residents')
      .delete()
      .in('id', ids)
      .eq('user_id', currentUser.id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Successfully deleted ${data?.length || 0} residents`,
      deletedIds: (data || []).map(r => r.id)
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}