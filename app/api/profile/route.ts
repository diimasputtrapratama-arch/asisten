import {NextResponse} from "next/server";
import {db} from "@/lib/db";
import {currentUser} from "@/lib/auth";

export async function GET() {
  const u = await currentUser();

  if (!u) {
    return NextResponse.json(
      {error:"LOGIN_REQUIRED"},
      {status:401}
    );
  }

  return NextResponse.json({
    profile:u.profile
  });
}

export async function PUT(req:Request) {
  const u = await currentUser();

  if (!u) {
    return NextResponse.json(
      {error:"LOGIN_REQUIRED"},
      {status:401}
    );
  }

  const b = await req.json();

  const p = await db.profile.update({
    where:{userId:u.id},
    data: {
  name: b.name,
  nickname: b.nickname,
  preferredAssistant: b.assistantName,
  language: b.language,
  communicationStyle: b.communicationStyle,
  favoriteGenres: b.favoriteGenres,
  storyPreferences: b.storyPreferences,
}
  });

  return NextResponse.json({
    profile:p
  });
}
