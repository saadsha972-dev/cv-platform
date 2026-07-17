import { NextResponse } from 'next/server';

// ONLY allow these exact authentic job boards
const TRUSTED_DOMAINS = [
  'linkedin.com/jobs', 'indeed.com', 'bayt.com', 'rozee.pk', 
  'gulftalent.com', 'seek.co.nz', 'glassdoor.com', 'monster.com',
  'naukrigulf.com', 'workday', 'lever.co', 'greenhouse.io'
];

// EXPLICITLY BLOCK garbage aggregators and social media
const BLOCKED_DOMAINS = [
  'jooble.org', 'facebook.', 'instagram.', 'twitter.', 'tiktok.', 'youtube.', 'quora.', 'reddit.'
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Force Mid-Senior level and remove Director
    let query = (body.query || 'Corporate Sales').replace(/director/gi, 'Mid Senior Level');
    const location = body.location || 'Worldwide';

    const searchQuery = `${query} jobs in ${location} hiring now`;

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 20, 
        tbs: 'qdr:m' // Past 30 days only
      })
    });

    const data = await response.json();
    const allResults = data.organic || [];

    // STRICT FILTER: Block garbage, block Director titles, keep ONLY trusted domains
    const filteredJobs = allResults.filter(job => {
      const url = (job.link || '').toLowerCase();
      const title = (job.title || '').toLowerCase();
      
      if (!url) return false;
      
      // 1. Block garbage explicitly
      if (BLOCKED_DOMAINS.some(domain => url.includes(domain))) return false;
      
      // 2. Keep ONLY trusted domains
      const isTrusted = TRUSTED_DOMAINS.some(domain => url.includes(domain));
      if (!isTrusted) return false;

      // 3. Block any job that has "Director" in the title
      if (title.includes('director')) return false;

      return true;
    }).slice(0, 10);

    return NextResponse.json({ jobs: filteredJobs });

  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
