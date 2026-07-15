import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Api {
  private baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000/api/v1'
    : 'https://api-veomio.mrmonterrosa.com/api/v1';

  private getHeaders(): HeadersInit {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const dayNum = now.getDate();
    const phrase = dayNum % 2 === 0 ? 'veomio_api' : 'api_veomio';
    
    const rawToken = `${year}-${month}-${day}:${phrase}`;
    const token = btoa(rawToken);
    
    return {
      'X-API-Key': token,
      'Accept': 'application/json'
    };
  }

  private getToken(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const dayNum = now.getDate();
    const phrase = dayNum % 2 === 0 ? 'veomio_api' : 'api_veomio';
    
    const rawToken = `${year}-${month}-${day}:${phrase}`;
    return btoa(rawToken);
  }

  async getLiveChannels(page: number = 1, source: string = '', search: string = '') {
    const url = new URL(`${this.baseUrl}/live/channels`);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('per_page', '20');
    url.searchParams.append('platform', 'web');
    if (source) url.searchParams.append('source', source);
    if (search) url.searchParams.append('search', search);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async resolveChannel(channelUrl: string) {
    const url = new URL(`${this.baseUrl}/resolve`);
    url.searchParams.append('url', channelUrl);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async getChannelById(id: string) {
    const response = await fetch(`${this.baseUrl}/live/channels/${id}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async getSportsCategories() {
    const response = await fetch(`${this.baseUrl}/live/sports/categories`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async getSportsEvents(category: string) {
    const response = await fetch(`${this.baseUrl}/live/sports/events/${category}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async resolveSportsStream(streamUrl: string) {
    const url = new URL(`${this.baseUrl}/live/sports/resolve`);
    url.searchParams.append('url', streamUrl);
    const response = await fetch(url.toString(), {
      headers: this.getHeaders()
    });
    return response.json();
  }

  getProxyStreamUrl(streamUrl: string, referer: string = '') {
    let url = `${this.baseUrl}/stream?url=${encodeURIComponent(streamUrl)}&token=${encodeURIComponent(this.getToken())}`;
    if (referer) {
      url += `&referer=${encodeURIComponent(referer)}`;
    }
    return url;
  }
}
