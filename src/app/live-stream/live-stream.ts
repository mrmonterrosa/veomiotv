import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Api } from '../services/api';

// Use Vime Core Web Components instead of the outdated Angular wrapper
import { defineCustomElements } from '@vime/core/loader';
defineCustomElements();

@Component({
  selector: 'app-live-stream',
  standalone: true,
  imports: [CommonModule, RouterModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './live-stream.html',
  styleUrl: './live-stream.css'
})
export class LiveStream implements OnInit {
  channelName: string = 'Loading Stream...';
  resolving: boolean = true;
  error: string | null = null;
  videoUrl: string | null = null;
  isIframe: boolean = false;
  safeIframeUrl: SafeResourceUrl | null = null;
  originalUrl: string | null = null;

  constructor(
    private route: ActivatedRoute, 
    private api: Api, 
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      if (params['id']) {
        this.fetchChannel(params['id']);
      } else if (params['url']) {
        this.channelName = params['name'] || 'Live Channel';
        await this.resolveAndPlay(params['url']);
      } else {
        this.error = 'No stream URL or ID provided.';
        this.resolving = false;
      }
    });
  }

  async fetchChannel(id: string) {
    try {
      this.resolving = true;
      this.cdr.detectChanges();
      const response = await this.api.getChannelById(id);
      if (response.success) {
        this.channelName = response.data.name;
        await this.resolveAndPlay(response.data.url);
      } else {
        this.error = 'Channel not found.';
        this.resolving = false;
        this.cdr.detectChanges();
      }
    } catch (e) {
      console.error(e);
      this.error = 'Failed to fetch channel info.';
      this.resolving = false;
      this.cdr.detectChanges();
    }
  }

  async resolveAndPlay(embedUrl: string) {
    this.originalUrl = embedUrl;
    try {
      this.resolving = true;
      this.error = null;
      this.cdr.detectChanges();

      // For IPTV streams, the browser might block CORS.
      // However, we will try to play it DIRECTLY first because the proxy might be altering headers or encoding.
      if (embedUrl.includes('.m3u8') || embedUrl.includes('.m3u') || embedUrl.includes('.mp4') || embedUrl.includes('m3u')) {
         this.videoUrl = embedUrl; // Try DIRECT URL!
         this.isIframe = false;
         return;
      }

      const response = await this.api.resolveChannel(embedUrl);
      
      if (response.status === 'success' && response.data.stream_url) {
        this.videoUrl = response.data.stream_proxy || this.api.getProxyStreamUrl(response.data.stream_url);
        this.isIframe = false;
      } else {
        this.setupIframeFallback(embedUrl);
      }
    } catch (e) {
      console.error(e);
      this.setupIframeFallback(embedUrl);
    } finally {
      this.resolving = false;
      this.cdr.detectChanges();
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
      --plyr-color-main: #10b981; /* Verde esmeralda */
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
    console.warn("Could not resolve to direct stream, falling back to iframe embed:", url);
    this.isIframe = true;
    this.safeIframeUrl = this.getSafeIframeUrl(url);
    this.error = null;
  }

  toggleIframeMode() {
    this.isIframe = !this.isIframe;
    if (this.isIframe && this.originalUrl) {
      this.safeIframeUrl = this.getSafeIframeUrl(this.originalUrl);
    }
    this.cdr.detectChanges();
  }

  onPlayerError(event: any) {
     console.error("Vime Player Error:", event);
     // Vime will throw events if it fails. We can handle fallbacks here if needed.
  }
}
