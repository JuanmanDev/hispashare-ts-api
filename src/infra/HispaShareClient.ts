import * as cheerio from 'cheerio';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);

export interface SearchResult {
    title: string;
    year: number | null;
    url: string;
}

export interface LinkData {
    type: string;
    title: string;
    url: string;
    size: string;
    downloads: string;
    audio: string[];
    subtitles: string[];
}

export interface TitleDetails {
    title: string;
    originalTitle: string;
    posterUrl: string;
    synopsis: string;
    genres: string;
    director: string;
    actors: string;
    imdbRating: string;
    userRating: string;
    imdbId: string | null;
    comments: { author: string; date: string; text: string }[];
    related: { title: string; url: string }[];
    links: LinkData[];
}

export class HispaShareClient {
    private baseUrl = 'https://www.hispashare.org';
    
    constructor() {}

    async login(): Promise<boolean> {
        const username = process.env.HISPASHARE_USERNAME;
        const password = process.env.HISPASHARE_PASSWORD;

        if (!username || !password) {
            throw new Error('HISPASHARE_USERNAME and HISPASHARE_PASSWORD environment variables are required.');
        }

        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('login', 'Iniciar');

        const response = await fetchWithCookies(`${this.baseUrl}/`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
        });

        const html = await response.text();

        if (html.includes('logout') || html.includes('Cerrar')) {
            return true;
        }

        if (html.includes('name="login"') || html.includes('Nombre de usuario')) {
            return false;
        }

        return true;
    }

    async search(query: string, params: Record<string, string> = {}): Promise<SearchResult[]> {
        const queryParams = new URLSearchParams({
            view: 'advsearch',
            advsrch: '1',
            advtit: query,
        });

        if (params.imdb_min) queryParams.append('advscomin', params.imdb_min);
        if (params.imdb_max) queryParams.append('advscomax', params.imdb_max);
        if (params.duration_min) queryParams.append('advdurmin', params.duration_min);
        if (params.duration_max) queryParams.append('advdurmax', params.duration_max);
        if (params.year_min) queryParams.append('advdatmin', params.year_min);
        if (params.year_max) queryParams.append('advdatmax', params.year_max);

        const url = `${this.baseUrl}/?${queryParams.toString()}`;
        
        let html = await this._request(url);

        if (html.includes('name="login"')) {
            const loggedIn = await this.login();
            if (loggedIn) {
                html = await this._request(url);
            } else {
                return [];
            }
        }

        const $ = cheerio.load(html);
        const results: SearchResult[] = [];

        $('a[href^="?view=title&id="]').each((_, element) => {
            const el = $(element);
            if (el.find('small').length > 0) {
                const fullTitle = el.text().trim();
                const rawHref = el.attr('href');
                if (!rawHref) return;
                
                const href = `${this.baseUrl}/${rawHref}`;

                let year: number | null = null;
                const yearMatch = fullTitle.match(/\(.*?\b(\d{4})\)$/);
                if (yearMatch && yearMatch[1]) {
                    year = parseInt(yearMatch[1], 10);
                }

                results.push({
                    title: fullTitle,
                    year,
                    url: href,
                });
            }
        });

        return results;
    }

    async getTitleDetails(url: string): Promise<TitleDetails> {
        let html = await this._request(url);

        if (html.includes('name="login"')) {
            const loggedIn = await this.login();
            if (loggedIn) {
                html = await this._request(url);
            } else {
                throw new Error('Login failed or not logged in.');
            }
        }

        const $ = cheerio.load(html);
        const links: LinkData[] = [];

        // Scrape Metadata
        const title = $('meta[property="og:title"]').attr('content') || '';
        const posterUrl = $('meta[property="og:image"]').attr('content') || '';
        const synopsis = $('meta[name="description"]').attr('content') || '';
        
        let imdbRating = '';
        let userRating = '';
        let originalTitle = '';
        let genres = '';
        let director = '';
        let actors = '';
        
        // Find text content in the document for specifics
        $('td, div, span').each((_, el) => {
            const text = $(el).text().trim();
            if (text.startsWith('Puntuación IMDB') && !imdbRating) {
                imdbRating = $(el).next().text().trim() || text.split('Puntuación IMDB')[1]?.trim() || '';
            }
            if (text.startsWith('Puntuación usuarios') && !userRating) {
                userRating = $(el).next().text().trim() || text.split('Puntuación usuarios')[1]?.trim() || '';
            }
            if (text.startsWith('Título original:') && !originalTitle) {
                originalTitle = text.replace('Título original:', '').trim();
            }
            if (text.startsWith('Género:') && !genres) {
                genres = text.replace('Género:', '').trim();
            }
            if (text.startsWith('Director:') && !director) {
                director = text.replace('Director:', '').trim();
            }
            if (text.startsWith('Actores:') && !actors) {
                actors = text.replace('Actores:', '').trim();
            }
        });

        // Parse comments
        const comments: { author: string; date: string; text: string }[] = [];
        const commentSections = $('.comentario_izq');
        commentSections.each((_, el) => {
            const container = $(el).parent();
            const author = container.find('.comentario_izq b').text().trim();
            const dateMatch = container.find('.comentario_izq').text().match(/\(([^)]+)\)/);
            const date = dateMatch ? (dateMatch[1] || '') : '';
            const text = container.find('.comentario_der').text().trim();
            if (author && text) {
                comments.push({ author, date, text });
            }
        });
        
        // As a fallback for comments if classes differ
        if (comments.length === 0) {
            let inComments = false;
            let currentAuthor = '';
            $('table, div').each((_, el) => {
                const text = $(el).text();
                if (text.includes('Comentarios (')) inComments = true;
                if (inComments && $(el).find('b').length > 0) {
                    // Try to parse raw comment table
                }
            });
        }

        // Related titles
        const related: { title: string; url: string }[] = [];
        let inRelated = false;
        $('table').each((_, table) => {
            const text = $(table).text();
            if (text.includes('Otros títulos relacionados')) {
                inRelated = true;
            } else if (text.includes('Otros títulos dirigidos')) {
                inRelated = false;
            } else if (inRelated) {
                $(table).find('a[href^="?view=title"]').each((_, a) => {
                    related.push({
                        title: $(a).text().trim(),
                        url: `${this.baseUrl}/${$(a).attr('href')}`
                    });
                });
            }
        });

        let imdbId: string | null = null;
        const imdbLink = $('a[href*="imdb.com/title/"]');
        if (imdbLink.length > 0) {
            const href = imdbLink.attr('href');
            const match = href?.match(/tt\d+/);
            if (match) {
                imdbId = match[0];
            }
        }

        const rows = $('table.T2 tr').filter((_, tr) => $(tr).find('td.ICON').length > 0);

        for (const row of rows.toArray()) {
            const $row = $(row);
            let size = '';
            let downloads = '';
            
            const sizeNodes = $row.find('td.SIZE');
            if (sizeNodes.length >= 1) size = $(sizeNodes[0]).text().trim();
            if (sizeNodes.length >= 2) downloads = $(sizeNodes[1]).text().trim();

            const anchor = $row.find('a[href^="javascript:Download"]');
            if (anchor.length === 0) continue;

            const href = anchor.attr('href') || '';
            const downloadMatch = href.match(/javascript:Download\((\d+)\s*,\s*['"](\d+)['"]\)/i);
            
            if (downloadMatch) {
                const id = downloadMatch[1];
                const code = downloadMatch[2];

                const audio: string[] = [];
                const subtitles: string[] = [];

                const t2Div = $row.closest('div').has('table.T2');
                if (t2Div.length > 0) {
                    let nextDiv = t2Div.nextAll('div').first();
                    if (nextDiv.length > 0) {
                        nextDiv.find('table.T3 img.FLAG').each((_, flag) => {
                            const alt = ($(flag).attr('alt') || '').toLowerCase();
                            if (alt.includes('sub') || alt.includes('for')) {
                                subtitles.push(alt);
                            } else {
                                audio.push(alt);
                            }
                        });
                    }
                }

                const ajaxUrl = `${this.baseUrl}/ajax/download.php?id=${id}&code=${code}&nocache=${Math.random()}`;
                const ajaxContent = await this._request(ajaxUrl);

                const ed2kRegex = /ed2k:\/\/\|file\|[^|]+\|\d+\|\w+\|(?:\/|h=\w+\|(?:\/)?)/gi;
                const matches = ajaxContent.match(ed2kRegex) || [];

                for (const ed2k of matches) {
                    const parts = ed2k.split('|');
                    const title = parts[2] ? decodeURIComponent(parts[2]) : 'Unknown';

                    const isDupe = links.some(l => l.url === ed2k);
                    if (!isDupe) {
                        links.push({
                            type: 'ed2k',
                            title,
                            url: ed2k,
                            size,
                            downloads,
                            audio,
                            subtitles
                        });
                    }
                }
            }
        }

        return {
            title,
            originalTitle,
            posterUrl,
            synopsis,
            genres,
            director,
            actors,
            imdbRating,
            userRating,
            imdbId,
            comments,
            related,
            links
        };
    }

    private async _request(url: string, method: string = 'GET', data?: any): Promise<string> {
        const options: RequestInit = {
            method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
        };

        if (method === 'POST' && data) {
            options.body = new URLSearchParams(data);
            options.headers = {
                ...options.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
            };
        }

        const response = await fetchWithCookies(url, options);
        return await response.text();
    }
}
