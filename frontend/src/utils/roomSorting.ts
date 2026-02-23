// Utility functions for room-based sorting

export interface ResidentWithRoom {
  id: string;
  empl_id: string;
  room?: string | null;
  name: string;
  [key: string]: string | number | boolean | null | undefined;
}

// Extract room components for sorting
export function parseRoom(room: string | null | undefined): {
  building: string;
  floor: string;
  unit: string;
  originalRoom: string;
} {
  if (!room || typeof room !== 'string') {
    return {
      building: 'zzz', // Sort rooms without building to end
      floor: '999',
      unit: '999',
      originalRoom: room || ''
    };
  }

  const upperRoom = room.toUpperCase().trim();
  
  // Match pattern like TKRA-0123-A1, TKRB-0456-B2, etc.
  const match = upperRoom.match(/^([A-Z]+)-?(\d+)-?([A-Z]\d*)?$/);
  
  if (match) {
    const [, building, floor, unit] = match;
    return {
      building: building || 'zzz',
      floor: floor || '999',
      unit: unit || '999',
      originalRoom: upperRoom
    };
  }
  
  // Handle other formats or fallback
  return {
    building: upperRoom.substring(0, 4) || 'zzz',
    floor: '999',
    unit: '999',
    originalRoom: upperRoom
  };
}

// Compare two room strings for sorting
export function compareRooms(roomA: string | null | undefined, roomB: string | null | undefined): number {
  const parsedA = parseRoom(roomA);
  const parsedB = parseRoom(roomB);
  
  // First sort by building (tkra, tkrb, tkrc, etc.)
  if (parsedA.building !== parsedB.building) {
    return parsedA.building.localeCompare(parsedB.building);
  }
  
  // Then sort by floor number
  const floorA = parseInt(parsedA.floor, 10);
  const floorB = parseInt(parsedB.floor, 10);
  if (floorA !== floorB) {
    return floorA - floorB;
  }
  
  // Finally sort by unit
  return parsedA.unit.localeCompare(parsedB.unit);
}

// Sort residents by room
export function sortResidentsByRoom<T extends ResidentWithRoom>(residents: T[]): T[] {
  return [...residents].sort((a, b) => compareRooms(a.room, b.room));
}

// Sort residents needing attention by room
export function sortResidentsNeedingAttentionByRoom(
  residentsData: { [key: string]: { name: string; room: string } },
  interactionsPerResident: { [key: string]: number }
): Array<[string, number, { name: string; room: string }]> {
  return Object.entries(interactionsPerResident)
    .filter(([, count]) => count < 3)
    .map(([emplId, count]) => [emplId, count, residentsData[emplId]] as [string, number, { name: string; room: string }])
    .sort(([, , a], [, , b]) => compareRooms(a?.room, b?.room));
}