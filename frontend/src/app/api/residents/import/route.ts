import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'papaparse';
import { getCurrentUser } from '../../../../utils/auth';

interface ResidentCSVRow {
  'first name'?: string;
  'last name'?: string;
  'id'?: string;
  name?: string;
  'empl id'?: string;
  'asu id'?: string;
  'student id'?: string;
  email?: string;
  'email address'?: string;
  room?: string;
  'room number'?: string;
  roomspace?: string;
  roomspacedescription?: string;
  // Allow any additional columns
  [key: string]: string | undefined;
}

export async function POST(request: NextRequest) {
  try {
    // Resolve the current authenticated app user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key for server-side operations to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    
    // Parse without header transformation first to preserve original case
    const { data: csvData, errors, meta } = parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      // Don't transform headers - keep original case
    });

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'CSV parsing error', 
        details: errors 
      }, { status: 400 });
    }

    const residents = csvData.map((row, index) => {

      // Helper function to get value from row with case-insensitive key matching
      const getValue = (keys: string[], debugLabel = '') => {
        for (const key of keys) {
          // Try exact match first
          if (row[key]?.trim()) {
            return row[key].trim();
          }
          // Try case-insensitive match
          const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
          if (foundKey && row[foundKey]?.trim()) {
            return row[foundKey].trim();
          }
        }
        return null;
      };

      // Handle different CSV formats for names
      const firstName = getValue(['First Name', 'first name', 'firstname']);
      const lastName = getValue(['Last Name', 'last name', 'lastname']);
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : getValue(['name', 'Name']);
      
      // Handle different CSV formats for ID
      const id = getValue(['ID', 'id', 'Empl ID', 'empl id', 'ASU ID', 'asu id', 'Student ID', 'student id', 'emplId', 'empl_id']);

      // Handle different CSV formats for email
      const email = getValue(['Email', 'email', 'Email Address', 'email address']);

      // Handle room with all possible column name variations
      let roomValue = getValue([
        'RoomSpaceDescription', 
        'roomspacedescription', 
        'Room Space Description',
        'room space description',
        'RoomSpace', 
        'roomspace',
        'Room Space',
        'room space',
        'Room Number', 
        'room number',
        'Room', 
        'room'
      ], 'Room parsing');

      // If still no room found, try dynamic search for any column with room-like data
      if (!roomValue) {
        const roomKeys = Object.keys(row).filter(key => {
          const lowerKey = key.toLowerCase();
          return lowerKey.includes('room') || 
                 lowerKey.includes('space') ||
                 lowerKey.includes('residence') ||
                 lowerKey.includes('dorm');
        });
        
        
        for (const key of roomKeys) {
          if (row[key]?.trim()) {
            roomValue = row[key].trim();
            break;
          }
        }
      }
      
      const room = roomValue ? roomValue.toUpperCase() : null;
      

      return {
        user_id: user.id,
        name: fullName,
        empl_id: id,
        email: email,
        room: room || null,
      };
    }).filter(resident => resident.name && resident.empl_id);

    if (residents.length === 0) {
      return NextResponse.json({ 
        error: 'No valid residents found in CSV. Please ensure your CSV has columns for name (or First Name + Last Name) and ID (or ASU ID, Student ID, etc.)' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('residents')
      .upsert(residents, { 
        onConflict: 'user_id,empl_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      residents: data
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}