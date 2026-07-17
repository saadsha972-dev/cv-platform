import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const region = body.region || 'Worldwide';

    // Strict query: Targets authentic job boards, blocks social media garbage
    const query = `"Director of Corporate Sales" jobs in ${region} hiring now (site:linkedin.com/jobs OR site:indeed.com OR site:bayt.com OR site:rozee.pk OR site:gulftalent.com OR site:seek.co.nz OR site:ca.indeed.com) -site:facebook.com -site:instagram.com -site:twitter.com`;

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        tbs: 'qdr:m' // THIS IS THE MAGIC FILTER: Past 30 days only
      })
    });

    const data = await response.json();
    return NextResponse.json({ jobs: data.organic || [] });
    
  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
}
