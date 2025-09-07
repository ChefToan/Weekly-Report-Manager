import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { getCurrentUser } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Get the current authenticated user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create admin Supabase client for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const weekStarting = searchParams.get('weekStarting');

    if (!weekStarting) {
      return NextResponse.json({ error: 'Week starting date is required' }, { status: 400 });
    }

    const { data: interactions, error } = await supabase
      .from('interactions')
      .select(`
        *,
        residents (
          id,
          name,
          empl_id
        )
      `)
      .eq('week_starting', weekStarting)
      .eq('user_id', currentUser.id) // Filter by current user
      .order('date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const requiredInteractions = interactions?.slice(0, 3) || [];
    const additionalInteractions = interactions?.slice(3) || [];

    const formatInteractionForReport = (interaction: { id: string, residents?: { empl_id: string }, summary?: string, details?: string, date: string }) => ({
      id: interaction.id,
      residentId: interaction.residents?.empl_id || '',
      summary: interaction.summary || '',
      details: interaction.details || '',
      date: format(new Date(interaction.date), 'yyyy-MM-dd'),
    });

    const report = {
      weekStarting,
      requiredInteractions: requiredInteractions.map(formatInteractionForReport),
      additionalInteractions: additionalInteractions.map(formatInteractionForReport),
    };

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the current authenticated user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create admin Supabase client for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { interactionIds } = await request.json();

    if (!interactionIds || !Array.isArray(interactionIds)) {
      return NextResponse.json({ error: 'Interaction IDs array is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('interactions')
      .update({ 
        is_submitted: true,
        updated_at: new Date().toISOString()
      })
      .in('id', interactionIds)
      .eq('user_id', currentUser.id); // Ensure user can only update their own interactions

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}