import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Api } from '../services/api';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import Hls from 'hls.js';
import { defineCustomElements } from '@vime/core/loader';

defineCustomElements();
import videojs from 'video.js';
declare var Clappr: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoJSPlayer') videoJSPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('clapprPlayerContainer') clapprPlayerContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('sportsCategoriesScrollContainer') sportsCategoriesScrollContainer!: ElementRef<HTMLDivElement>;
  private hlsInstance: Hls | null = null;
  private videoJSPlayerInstance: any = null;
  private clapprPlayerInstance: any = null;

  // Player mode selector
  playerMode: 'native' | 'vime' | 'videojs' | 'clappr' | 'iframe' = 'native';
  // Channel list variables
  channels: any[] = [];
  loading = true;
  loadingMore = false;
  currentPage = 1;
  currentSearch = '';
  hasMore = true;

  // Web layout / Player variables
  selectedChannel: any | null = null;
  resolving = false;
  error: string | null = null;
  videoUrl: string | null = null;
  isIframe = false;
  safeIframeUrl: SafeResourceUrl | null = null;
  originalUrl: string | null = null;

  // Sidebar / UI state variables
  isSidebarCollapsed = false;
  showDisclaimer = false;
  private disclaimerTimer: any = null;
  private searchDebounceTimer: any = null;
  private queryParamsSub!: Subscription;
  private initialChannelLoaded = false;

  // Sports Tab variables
  activeTab: 'tv' | 'sports' = 'tv';
  sportsCategories: any[] = [];
  selectedSportsCategory = '';
  sportsEvents: any[] = [];
  loadingSports = false;

  constructor(
    private api: Api,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    // Escuchar cambios de parámetros para restaurar o seleccionar canal
    this.queryParamsSub = this.route.queryParams.subscribe(async params => {
      const targetId = params['id'];
      
      // Si el buscador viene en la URL
      const search = params['search'] || '';
      if (search !== this.currentSearch) {
        this.currentSearch = search;
        this.currentPage = 1;
        this.channels = [];
        this.hasMore = true;
        await this.loadChannels(search, 1, targetId);
      } else if (this.channels.length === 0) {
        await this.loadChannels(search, 1, targetId);
      } else if (targetId && (!this.selectedChannel || this.selectedChannel.id !== targetId)) {
        const found = this.channels.find(c => c.id === targetId);
        if (found) {
          this.selectChannel(found, false);
        } else {
          // Si no está en la primera página cargada, intentar obtener por API
          this.fetchAndSelectChannelById(targetId);
        }
      }
    });
  }

  ngOnDestroy() {
    this.destroyHls();
    this.destroyVideoJS();
    this.destroyClappr();
    if (this.queryParamsSub) {
      this.queryParamsSub.unsubscribe();
    }
    if (this.disclaimerTimer) {
      clearTimeout(this.disclaimerTimer);
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  onSidebarScroll(event: any) {
    const element = event.target;
    if (this.loading || this.loadingMore || !this.hasMore) return;
    
    // Si estamos cerca del final de la barra lateral (scrollbar vertical)
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 300) {
      this.loadMore();
    }
  }

  async loadChannels(search: string, page: number, targetIdToSelect?: string) {
    try {
      if (page === 1) {
        this.loading = true;
      } else {
        this.loadingMore = true;
      }
      this.cdr.detectChanges();

      const response = await this.api.getLiveChannels(page, '', search);
      if (response.success) {
        if (!response.data || response.data.length === 0) {
          this.hasMore = false;
        } else {
          if (page === 1) {
            this.channels = response.data;
            // Selección automática inicial
            if (!this.initialChannelLoaded) {
              this.initialChannelLoaded = true;
              let channelToSelect = this.channels[0];
              if (targetIdToSelect) {
                const found = this.channels.find(c => c.id === targetIdToSelect);
                if (found) channelToSelect = found;
              }
              if (channelToSelect) {
                this.selectChannel(channelToSelect, false);
              }
            }
          } else {
            this.channels = [...this.channels, ...response.data];
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
      this.loadingMore = false;
      this.cdr.detectChanges();
    }
  }

  loadMore() {
    this.currentPage++;
    this.loadChannels(this.currentSearch, this.currentPage);
  }

  triggerSearch(query: string) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { search: query || null },
        queryParamsHandling: 'merge'
      });
    }, 500);
  }

  clearSearch() {
    this.currentSearch = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: null },
      queryParamsHandling: 'merge'
    });
  }

  async fetchAndSelectChannelById(id: string) {
    try {
      this.resolving = true;
      this.cdr.detectChanges();
      const response = await this.api.getChannelById(id);
      if (response.success) {
        this.selectChannel(response.data, false);
      } else {
        this.error = 'Canal no encontrado.';
        this.resolving = false;
        this.cdr.detectChanges();
      }
    } catch (e) {
      console.error(e);
      this.error = 'Error al cargar información del canal.';
      this.resolving = false;
      this.cdr.detectChanges();
    }
  }

  selectChannel(channel: any, updateUrl = true) {
    if (this.selectedChannel?.id === channel.id && this.videoUrl) {
      return; // Ya está cargado
    }

    this.selectedChannel = channel;
    this.startDisclaimerTimer();

    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { id: channel.id },
        queryParamsHandling: 'merge'
      });
    }

    this.resolveAndPlay(channel.url);
  }

  private shouldProxy(url: string): boolean {
    if (!url) return false;
    if (url.startsWith('http://')) return true;
    const lower = url.toLowerCase();
    const protectedDomains = [
      'vimeos', 'goodstream', 'streamfort', 'streamwish', 'wishonly', 
      'hlswish', 'jwplayerhls', 'formaturamaxi', 'shadow-ran', 
      'roxiestreams', 'aapmains', 'hereisman', 'thetvapp', 'paradilux', 'tedesco'
    ];
    return protectedDomains.some(domain => lower.includes(domain));
  }

  async resolveAndPlay(embedUrl: string) {
    this.originalUrl = embedUrl;
    this.destroyHls();
    try {
      this.resolving = true;
      this.error = null;
      this.videoUrl = null;
      this.safeIframeUrl = null;
      this.cdr.detectChanges();

      // If it is a sports stream, resolve using our new sports resolve endpoint
      if (embedUrl.includes('roxiestreams.su') || embedUrl.includes('thetvappv2.com') || embedUrl.includes('thetvapp.to')) {
        const response = await this.api.resolveSportsStream(embedUrl);
        console.log('RESOLVED SPORTS RESPONSE:', response);
        if (response && response.success && response.url) {
          if (this.selectedChannel) {
            // Solo actualizar la lista de alternativas si la respuesta provee una no vacía
            if (response.alternatives && response.alternatives.length > 0) {
              this.selectedChannel.alternatives = response.alternatives;
            }
            this.cdr.detectChanges();
          }
          
          // Obtener el referer devuelto por la API o deducirlo basándose en la URL de origen
          const referer = response.headers?.Referer || response.headers?.referer || (embedUrl.includes('roxiestreams') ? 'https://roxiestreams.su/' : 'https://gooz.aapmains.net/');
          
          if (this.shouldProxy(response.url)) {
            this.videoUrl = this.api.getProxyStreamUrl(response.url, referer);
          } else {
            this.videoUrl = response.url;
          }
          
          this.applyPlayerMode();
          return;
        } else {
          this.setupIframeFallback(embedUrl);
          return;
        }
      }

      // Validar si la URL de origen ya indica que la cuenta o canal ha vencido
      if (embedUrl.toLowerCase().includes('vencido')) {
        this.error = 'La transmisión ha vencido o no está disponible.';
        this.resolving = false;
        this.cdr.detectChanges();
        return;
      }

      // Para URLs HLS o directas, reproducimos utilizando el proxy si son HTTP o pertenecen a dominios protegidos para evitar CORS/Cierre de Referer
      if (embedUrl.includes('.m3u8') || embedUrl.includes('.m3u') || embedUrl.includes('.mp4') || embedUrl.includes('m3u')) {
        if (this.shouldProxy(embedUrl)) {
          let referer = '';
          const lowerUrl = embedUrl.toLowerCase();
          if (lowerUrl.includes('roxiestreams') || lowerUrl.includes('paradilux') || lowerUrl.includes('tedesco') || lowerUrl.includes('formaturamaxi') || lowerUrl.includes('shadow-ran')) {
            referer = 'https://roxiestreams.su/';
          } else if (lowerUrl.includes('thetvapp') || lowerUrl.includes('aapmains') || lowerUrl.includes('hereisman')) {
            referer = 'https://gooz.aapmains.net/';
          }
          this.videoUrl = this.api.getProxyStreamUrl(embedUrl, referer);
        } else {
          this.videoUrl = embedUrl;
        }
        this.applyPlayerMode();
        return;
      }

      // Si no es directa, resolvemos con la API
      const response = await this.api.resolveChannel(embedUrl);
      if (response.status === 'success' && response.data.stream_url) {
        const streamUrl = response.data.stream_url;
        
        // Validar si la URL resuelta indica que la cuenta o canal ha vencido
        if (streamUrl.toLowerCase().includes('vencido')) {
          this.error = 'La transmisión ha vencido o no está disponible.';
          this.resolving = false;
          this.cdr.detectChanges();
          return;
        }

        let finalUrl = streamUrl;
        if (this.shouldProxy(streamUrl)) {
          let referer = '';
          const lowerUrl = streamUrl.toLowerCase();
          if (lowerUrl.includes('roxiestreams') || lowerUrl.includes('paradilux') || lowerUrl.includes('tedesco') || lowerUrl.includes('formaturamaxi') || lowerUrl.includes('shadow-ran')) {
            referer = 'https://roxiestreams.su/';
          } else if (lowerUrl.includes('thetvapp') || lowerUrl.includes('aapmains') || lowerUrl.includes('hereisman')) {
            referer = 'https://gooz.aapmains.net/';
          }
          
          let proxyUrl = response.data.stream_proxy || this.api.getProxyStreamUrl(streamUrl, referer);
          
          // Si la página es HTTPS, asegurar que la URL del proxy también lo sea
          const isHttpsPage = window.location.protocol === 'https:';
          if (isHttpsPage && proxyUrl.startsWith('http://') && !proxyUrl.includes('localhost') && !proxyUrl.includes('127.0.0.1')) {
            proxyUrl = proxyUrl.replace('http://', 'https://');
          }
          finalUrl = proxyUrl;
        }

        this.videoUrl = finalUrl;
        this.applyPlayerMode();
      } else {
        this.setupIframeFallback(embedUrl);
      }
    } catch (e) {
      console.error(e);
      this.setupIframeFallback(embedUrl);
    } finally {
      if (this.playerMode === 'iframe' || this.playerMode === 'vime' || this.error) {
        this.resolving = false;
        this.cdr.detectChanges();
      }
    }
  }

  getSafeIframeUrl(url: string): SafeResourceUrl {
    const isM3u8 = url.includes('.m3u8') || 
                   url.includes('.m3u') || 
                   url.includes('/stream?url=') || 
                   url.includes('stream?url=');
    
    if (isM3u8) {
      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Veomio HLS Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css" />
  <script src="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; outline: none; object-fit: contain; }
    :root {
      --plyr-color-main: #00daf3; /* Color cian de Veomio */
      --plyr-video-background: #000000;
      --plyr-menu-background: rgba(15, 22, 42, 0.95);
      --plyr-menu-color: #ffffff;
    }
    .plyr { width: 100%; height: 100%; }
    .plyr__progress, .plyr__time { display: none !important; }
  </style>
</head>
<body>
  <video id="video" playsinline controls></video>
  <script>
    var video = document.getElementById('video');
    var videoSrc = '${url}';
    var plyrOptions = {
      controls: ['play-large', 'play', 'mute', 'volume', 'settings', 'fullscreen'],
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: false },
      live: { fallback: true }
    };
    var player = new Plyr(video, plyrOptions);
    if (Hls.isSupported()) {
      var hls = new Hls({
        maxMaxBufferLength: 30,
        enableWorker: true,
        lowLatencyMode: true
      });
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(function (e) {
          console.log("Autoplay prevented:", e);
        });
      });
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoSrc;
      video.addEventListener('loadedmetadata', function () {
        video.play().catch(function (e) {
          console.log("Autoplay prevented:", e);
        });
      });
    }
  </script>
</body>
</html>
      `;
      const base64 = btoa(unescape(encodeURIComponent(htmlContent)));
      return this.sanitizer.bypassSecurityTrustResourceUrl('data:text/html;charset=utf-8;base64,' + base64);
    }
    
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  setupIframeFallback(url: string) {
    console.warn("Falling back to iframe embed:", url);
    this.playerMode = 'iframe';
    this.isIframe = true;
    this.safeIframeUrl = this.getSafeIframeUrl(url);
    this.error = null;
  }

  onPlayerModeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.playerMode = select.value as 'native' | 'vime' | 'videojs' | 'clappr' | 'iframe';
    
    if ((this.error || !this.videoUrl) && this.originalUrl) {
      this.error = null;
      this.resolveAndPlay(this.originalUrl);
    } else {
      this.applyPlayerMode();
    }
  }

  applyPlayerMode() {
    this.destroyHls();
    this.destroyVideoJS();
    this.destroyClappr();
    this.isIframe = (this.playerMode === 'iframe');

    if (this.playerMode === 'native') {
      this.loadNativeVideoAfterDelay();
    } else if (this.playerMode === 'vime') {
      this.resolving = false;
      this.cdr.detectChanges();
    } else if (this.playerMode === 'videojs') {
      this.initVideoJS();
    } else if (this.playerMode === 'clappr') {
      this.initClappr();
    } else if (this.playerMode === 'iframe') {
      if (this.originalUrl) {
        this.safeIframeUrl = this.getSafeIframeUrl(this.originalUrl);
      } else if (this.videoUrl) {
        this.safeIframeUrl = this.getSafeIframeUrl(this.videoUrl);
      }
      this.resolving = false;
      this.cdr.detectChanges();
    }
  }

  initClappr() {
    this.destroyClappr();
    const currentUrl = this.videoUrl;
    if (!currentUrl) return;
    this.resolving = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      if (!this.clapprPlayerContainer) return;
      const containerElement = this.clapprPlayerContainer.nativeElement;
      try {
        this.clapprPlayerInstance = new Clappr.Player({
          source: currentUrl,
          parentId: '#clappr-player-container',
          autoPlay: true,
          width: '100%',
          height: '100%',
          events: {
            onReady: () => {
              this.resolving = false;
              this.cdr.detectChanges();
            },
            onError: (err: any) => {
              console.error("Clappr player error:", err);
            }
          }
        });
      } catch (e) {
        console.error("Error initializing Clappr:", e);
      }
    }, 100);
  }

  destroyClappr() {
    if (this.clapprPlayerInstance) {
      try {
        this.clapprPlayerInstance.destroy();
      } catch (e) {
        console.error("Error destroying Clappr player:", e);
      }
      this.clapprPlayerInstance = null;
    }
  }

  initVideoJS() {
    this.destroyVideoJS();
    const currentUrl = this.videoUrl;
    if (!currentUrl) return;
    this.resolving = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      if (!this.videoJSPlayer) return;
      const videoElement = this.videoJSPlayer.nativeElement;
      try {
        this.videoJSPlayerInstance = videojs(videoElement, {
          autoplay: true,
          controls: true,
          html5: {
            vhs: {
              overrideNative: true
            }
          },
          sources: [{
            src: currentUrl,
            type: currentUrl.includes('.mp4') ? 'video/mp4' : 'application/vnd.apple.mpegurl'
          }],
          fluid: false,
          liveui: true
        });

        this.videoJSPlayerInstance.ready(() => {
          this.resolving = false;
          this.cdr.detectChanges();
          this.videoJSPlayerInstance.play().catch((err: any) => console.log('Video.js autoplay blocked:', err));
        });

        this.videoJSPlayerInstance.on('error', (err: any) => {
          console.error("Video.js player error:", err);
        });
      } catch (e) {
        console.error("Error initializing Video.js:", e);
      }
    }, 100);
  }

  destroyVideoJS() {
    if (this.videoJSPlayerInstance) {
      try {
        this.videoJSPlayerInstance.dispose();
      } catch (e) {
        console.error("Error disposing Video.js player:", e);
      }
      this.videoJSPlayerInstance = null;
    }
  }

  toggleIframeMode() {
    if (this.playerMode === 'iframe') {
      this.playerMode = 'native';
    } else {
      this.playerMode = 'iframe';
    }
    this.applyPlayerMode();
  }

  onPlayerError(event: any) {
    console.error("Vime Player Error:", event);
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  startDisclaimerTimer() {
    if (this.disclaimerTimer) {
      clearTimeout(this.disclaimerTimer);
    }
    this.showDisclaimer = true;
    this.disclaimerTimer = setTimeout(() => {
      this.showDisclaimer = false;
      this.cdr.detectChanges();
    }, 10000);
  }

  closeDisclaimer() {
    this.showDisclaimer = false;
  }

  destroyHls() {
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
  }

  loadNativeVideoAfterDelay() {
    this.cdr.detectChanges();
    setTimeout(() => {
      this.loadNativeVideo();
    }, 100);
  }

  loadNativeVideo() {
    this.destroyHls();
    if (!this.videoPlayer || !this.videoUrl) return;

    const video = this.videoPlayer.nativeElement;
    const url = this.videoUrl;

    const isHls = url.includes('.m3u8') || url.includes('.m3u') || url.includes('stream?url=') || url.includes('/stream?url=');

    if (isHls) {
      if (Hls.isSupported()) {
        this.hlsInstance = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true,
          lowLatencyMode: true
        });
        this.hlsInstance.loadSource(url);
        this.hlsInstance.attachMedia(video);
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          this.resolving = false;
          this.cdr.detectChanges();
          video.play().catch(err => console.log('Autoplay blocked:', err));
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          this.resolving = false;
          this.cdr.detectChanges();
          video.play().catch(err => console.log('Autoplay blocked:', err));
        });
      } else {
        video.src = url;
        this.resolving = false;
        this.cdr.detectChanges();
      }
    } else {
      // Soporte para MP4, WebM, Ogg, etc.
      video.src = url;
      video.load();
      video.addEventListener('loadeddata', () => {
        this.resolving = false;
        this.cdr.detectChanges();
      });
      video.play().catch(err => console.log('Autoplay blocked:', err));
    }
  }

  async switchTab(tab: 'tv' | 'sports') {
    this.activeTab = tab;
    if (tab === 'sports' && this.sportsCategories.length === 0) {
      await this.loadSportsCategories();
    }
  }

  async loadSportsCategories() {
    try {
      this.loadingSports = true;
      this.cdr.detectChanges();
      const response = await this.api.getSportsCategories();
      this.sportsCategories = response;
      if (this.sportsCategories.length > 0) {
        await this.selectSportsCategory(this.sportsCategories[0].id);
      }
    } catch (e) {
      console.error('Error loading sports categories', e);
    } finally {
      this.loadingSports = false;
      this.cdr.detectChanges();
    }
  }

  async selectSportsCategory(categoryId: string) {
    this.selectedSportsCategory = categoryId;
    await this.loadSportsEvents(categoryId);
  }

  async loadSportsEvents(categoryId: string) {
    try {
      this.loadingSports = true;
      this.sportsEvents = [];
      this.cdr.detectChanges();
      const response = await this.api.getSportsEvents(categoryId);
      this.sportsEvents = response;
    } catch (e) {
      console.error('Error loading sports events', e);
    } finally {
      this.loadingSports = false;
      this.cdr.detectChanges();
    }
  }

  selectSportsEvent(event: any) {
    const pseudoChannel = {
      id: 'sport-' + md5(event.url),
      name: event.title,
      url: event.url,
      source: event.source || 'Deportes',
      category: this.sportsCategories.find(c => c.id === this.selectedSportsCategory)?.name || 'Deporte',
      isSport: true,
      alternatives: []
    };
    
    this.selectedChannel = pseudoChannel;
    this.startDisclaimerTimer();
    this.resolveAndPlay(event.url);
  }

  selectSportsAlternative(url: string) {
    if (url) {
      this.resolveAndPlay(url);
    }
  }

  getMd5(str: string): string {
    return md5(str);
  }

  scrollSportsCategories(offset: number) {
    if (this.sportsCategoriesScrollContainer) {
      this.sportsCategoriesScrollContainer.nativeElement.scrollBy({ left: offset, behavior: 'smooth' });
    }
  }
}

// Simple hash helper
function md5(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}
