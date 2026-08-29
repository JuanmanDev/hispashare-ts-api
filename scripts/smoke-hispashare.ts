import { HispaShareClient } from '../src/infra/HispaShareClient.js';

async function test() {
  console.log('Testing HispaShareClient...');
  const client = new HispaShareClient();

  console.log('1. Attempting login...');
  const loggedIn = await client.login();
  console.log('Login success:', loggedIn);

  if (!loggedIn) {
    console.error('Failed to login, aborting.');
    process.exit(1);
  }

  console.log('\n2. Searching for "matrix"...');
  const results = await client.search('matrix');
  console.log(`Found ${results.length} results.`);
  
  if (results.length > 0) {
    console.log('First result:', results[0]);

    console.log(`\n3. Getting title details for ${results[0].title}...`);
    // HACK: get html
    const fs = await import('fs');
    const html = await (client as any)._request(results[0].url);
    fs.writeFileSync('real-matrix.html', html);
    const details = await client.getTitleDetails(results[0].url);
    console.log(`Found ${details.links.length} links.`);
    console.log('Metadata:', {
      posterUrl: details.posterUrl,
      imdbRating: details.imdbRating,
      actors: details.actors,
    });
    if (details.links.length > 0) {
      console.log('First link details:', details.links[0]);
    }
  } else {
    console.log('No results to fetch links from.');
  }
}

test().catch(console.error);
