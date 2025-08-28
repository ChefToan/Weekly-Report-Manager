import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [residentsResult, interactionsResult] = await Promise.all([
      supabase.from('residents').select('id, empl_id, name, room'),
      supabase.from('interactions').select('resident_id, resident_empl_id')
    ]);

    if (residentsResult.error) {
      return NextResponse.json({ error: residentsResult.error.message }, { status: 500 });
    }

    if (interactionsResult.error) {
      return NextResponse.json({ error: interactionsResult.error.message }, { status: 500 });
    }

    const residents = residentsResult.data || [];
    const interactions = interactionsResult.data || [];

    const totalResidents = residents.length;
    const totalInteractions = interactions.length;
    const requiredInteractions = totalResidents * 3;

    const interactionsPerResident: { [key: string]: number } = {};
    const residentsData: { [key: string]: { name: string; room: string } } = {};
    
    residents.forEach(resident => {
      interactionsPerResident[resident.empl_id] = 0;
      residentsData[resident.empl_id] = {
        name: resident.name,
        room: resident.room || ''
      };
    });

    interactions.forEach(interaction => {
      const emplId = interaction.resident_empl_id;
      if (emplId && interactionsPerResident[emplId] !== undefined) {
        interactionsPerResident[emplId]++;
      }
    });

    const completionPercentage = requiredInteractions > 0 
      ? Math.round((totalInteractions / requiredInteractions) * 100) 
      : 0;

    const stats = {
      totalResidents,
      totalInteractions,
      requiredInteractions,
      completionPercentage,
      interactionsPerResident,
      residentsData,
    };

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}