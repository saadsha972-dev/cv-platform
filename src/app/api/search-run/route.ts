import { NextResponse } from 'next/server';

// Only allow real, authentic job boards
const TRUSTED_DOMAINS = [
  'linkedin.com/jobs', 'indeed.com', 'bayt.com', 'rozee.pk', 
  'gulftalent.com', 'seek.co.nz', 'glassdoor.com', 'monster.com',
  'naukrigulf.com', 'workday', 'lever.co', 'greenhouse.io'
];

export async function POST(req) {
  try {
    const body = await req.json();
    const query = body.query || 'Director of Corporate Sales';
    const location = body.location || 'Worldwide';

    // Clean search query WITHOUT site: operators (which break on Serper free tier)
    const searchQuery = `${query} jobs in ${location} hiring now`;

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 20, 
        tbs: 'qdr:m' // MAGIC FILTER: Past 30 days only
      })
    });

    const data = await response.json();
    const allResults = data.organic || [];

    // STRICT FILTER: Only keep real job boards, block all social media garbage
    const filteredJobs = allResults.filter(job => {
      const url = (job.link || '').toLowerCase();
      if (!url) return false;
      
      // Block social media explicitly
      if (url.includes('facebook.') || url.includes('instagram.') || url.includes('twitter.') || url.includes('tiktok.') || url.includes('youtube.')) {
        return false;
      }
      
      // Keep ONLY trusted domains
      return TRUSTED_DOMAINS.some(domain => url.includes(domain));
    }).slice(0, 10); // Return top 10 authentic jobs

    return NextResponse.json({ jobs: filteredJobs });

  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
