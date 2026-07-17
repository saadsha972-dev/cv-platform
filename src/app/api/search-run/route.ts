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
    let baseQuery = (body.query || 'Corporate Sales').replace(/director/gi, 'Mid Senior Level');
    
    // HARDCODED LOCATIONS: Remote & Regular as requested
    const locations = [
      'Remote USA', 'Remote UK', 'Remote Canada', 'Remote Australia', 'Remote New Zealand',
      'Qatar', 'UAE', 'Pakistan', 'Bahrain', 'Saudi Arabia', 'Oman', 'New Zealand', 'Canada'
    ];

    // Run all 13 location searches in parallel to save time
    const searchPromises = locations.map(location => {
      const searchQuery = `${baseQuery} jobs in ${location} hiring now`;
      return fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: searchQuery, num: 10, tbs: 'qdr:m' }) // Past 30 days
      }).then(res => res.json()).catch(() => null);
    });

    const results = await Promise.all(searchPromises);
    let allFilteredJobs = [];

    for (const data of results) {
      if (!data || !data.organic) continue;
      
      const filteredJobs = data.organic.filter(job => {
        const url = (job.link || '').toLowerCase();
        const title = (job.title || '').toLowerCase();
        
        if (!url) return false;
        if (BLOCKED_DOMAINS.some(domain => url.includes(domain))) return false;
        if (!TRUSTED_DOMAINS.some(domain => url.includes(domain))) return false;
        if (title.includes('director')) return false; // Block Director titles

        return true;
      });

      allFilteredJobs.push(...filteredJobs);
    }

    // Deduplicate by URL just in case
    const uniqueJobs = Array.from(new Map(allFilteredJobs.map(job => [job.link, job])).values());

    return NextResponse.json({ jobs: uniqueJobs });

  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
