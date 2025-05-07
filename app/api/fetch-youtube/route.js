import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    const response = await fetch("https://www.clipto.com/api/youtube", {
      headers: {
        accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(body), // forward the URL from frontend
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Upstream API error" }, { status: response.status });
    }

    const data = await response.json();
    // if (!data.medias || data.medias.length === 0) {
    //   return NextResponse.json({ error: "No media found" }, { status: 404 });
    // }
    // const lastMedia = data.medias[data.medias.length - 1];
    // const mediaUrl = lastMedia.url;
    return NextResponse.json({"url" : data}, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
