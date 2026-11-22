import { NextResponse } from 'next/server';
import { getSystemConfig } from '@/lib/admin/system-config';

export async function GET() {
  try {
    const config = await getSystemConfig();
    return NextResponse.json(
      {
        maintenanceMode: Boolean(config.maintenanceMode),
        globalAnnouncement: config.globalAnnouncement || '',
        updatedAt: config.updatedAt,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch {
    return NextResponse.json({
      maintenanceMode: false,
      globalAnnouncement: '',
    });
  }
}
