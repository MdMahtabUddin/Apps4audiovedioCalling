import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room, username } = body;

    if (!room || typeof room !== "string" || !room.trim()) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        {
          error:
            "LiveKit environment variables are missing. Please set NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env.local",
        },
        { status: 500 }
      );
    }

    const cleanRoom = room.trim();
    const cleanUsername = username.trim();

    // Create a new access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: cleanUsername,
      name: cleanUsername,
    });

    at.addGrant({
      room: cleanRoom,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate token" },
      { status: 500 }
    );
  }
}
