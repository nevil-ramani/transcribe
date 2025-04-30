// import puppeteer from 'puppeteer';
// import fs from 'fs';
// import path from 'path';
// import { NextResponse } from 'next/server';

// // Helper function to sanitize filenames
// function sanitizeFilename(filename) {
//   return filename.replace(/[\\/:*?"<>|]/g, '_');
// }

// // POST handler for App Router
// export async function POST(request) {
//   try {
//     // Get YouTube URL from request body
//     const body = await request.json();
//     const { youtubeUrl } = body;

//     if (!youtubeUrl) {
//       return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
//     }

//     // Validate YouTube URL format
//     const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
//     if (!youtubeRegex.test(youtubeUrl)) {
//       return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
//     }

//     let browser = null;

//     try {
//       browser = await puppeteer.launch({
//         headless: 'new',
//         args: [
//           '--no-sandbox',
//           '--disable-setuid-sandbox',
//           '--disable-features=IsolateOrigins,site-per-process'
//         ],
//       });

//       const page = await browser.newPage();

//       // Set a realistic user agent
//       await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

//       console.log('Navigating to downloader site...');
//       await page.goto('https://www.clipto.com/media-downloader/youtube-audio-downloader', {
//         waitUntil: 'networkidle2',
//         timeout: 90000 // 90 seconds timeout
//       });

//       console.log('Entering YouTube URL...');
//       await page.waitForSelector('input[placeholder="https://www.youtube.com/watch?v="]');
//       await page.focus('input[placeholder="https://www.youtube.com/watch?v="]');
//       await page.keyboard.type(youtubeUrl);

//       console.log('Clicking download button...');
//       await page.click('button[type="button"].btn.btn-primary');

//       // Wait for download link to appear
//       console.log('Waiting for processing (this may take a while)...');
//       await page.waitForSelector('a[href*="/api/youtube/mp3"]', {
//         timeout: 180000  // 3 minutes - YouTube processing can take time
//       });

//       // Extract download information
//       const downloadLink = await page.$eval('a[href*="/api/youtube/mp3"]', el => el.href);
//       let suggestedFilename = await page.$eval('a[href*="/api/youtube/mp3"]', el => el.download || '');

//       // Sanitize the filename
//       suggestedFilename = sanitizeFilename(suggestedFilename.trim() ? suggestedFilename : 'audio.mp3');

//       console.log(`Download link obtained: ${downloadLink}`);
//       console.log(`Suggested filename: ${suggestedFilename}`);

//       // Return the direct download link instead of the file
//       return NextResponse.json({
//         success: true,
//         downloadLink,
//         filename: suggestedFilename
//       });

//     } catch (error) {
//       console.error('An error occurred:', error);
//       return NextResponse.json({
//         error: 'Failed to process audio',
//         message: error.message
//       }, { status: 500 });
//     } finally {
//       if (browser) {
//         await browser.close();
//       }
//     }
//   } catch (error) {
//     console.error('Request parsing error:', error);
//     return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
//   }
// }

import puppeteer from "puppeteer";
import { NextResponse } from "next/server";

// Browser instance cache
let browserInstance = null;
let browserLastUsed = Date.now();

// Simple cache for already processed videos
const videoCache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Helper function to sanitize filenames
function sanitizeFilename(filename) {
  return filename.replace(/[\\/:*?"<>|]/g, "_");
}

// Get or create browser instance
async function getBrowser() {
  // Close browser if it hasn't been used in 10 minutes
  if (browserInstance && Date.now() - browserLastUsed > 10 * 60 * 1000) {
    await browserInstance.close();
    browserInstance = null;
  }

  if (!browserInstance) {
    console.log("Creating new browser instance...");
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-extensions",
        "--disable-component-extensions-with-background-pages",
        "--disable-default-apps",
        "--mute-audio",
        "--no-default-browser-check",
        "--disable-translate",
        "--disable-sync",
      ],
    });
  }

  browserLastUsed = Date.now();
  return browserInstance;
}

// POST handler for App Router
export async function POST(request) {
  try {
    // Get YouTube URL from request body
    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    // Validate YouTube URL format
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Check cache first
    if (videoCache.has(youtubeUrl)) {
      const cachedData = videoCache.get(youtubeUrl);

      // Return cached data if still fresh
      if (Date.now() - cachedData.timestamp < CACHE_EXPIRY) {
        console.log("Returning cached result for:", youtubeUrl);
        return NextResponse.json({
          success: true,
          downloadLink: cachedData.downloadLink,
          filename: cachedData.filename,
          cached: true,
        });
      } else {
        // Remove expired cache entry
        videoCache.delete(youtubeUrl);
      }
    }

    let page = null;

    try {
      const browser = await getBrowser();
      page = await browser.newPage();

      // Performance optimizations
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const resourceType = req.resourceType();
        if (
          resourceType === "image" ||
          resourceType === "font" ||
          resourceType === "media"
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set a realistic user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
      );

      console.log("Navigating to downloader site...");
      await page.goto(
        "https://www.clipto.com/media-downloader/youtube-audio-downloader",
        {
          waitUntil: "domcontentloaded", // Changed from networkidle2 for faster loading
          timeout: 60000, // Reduced timeout to 60 seconds
        }
      );

      console.log("Entering YouTube URL...");
      await page.waitForSelector(
        'input[placeholder="https://www.youtube.com/watch?v="]'
      );
      await page.focus('input[placeholder="https://www.youtube.com/watch?v="]');
      await page.keyboard.type(youtubeUrl);

      console.log("Clicking download button...");
      await page.click('button[type="button"].btn.btn-primary');

      // Wait for download link to appear
      console.log("Waiting for processing (this may take a while)...");
      await page.waitForSelector('a[href*="/api/youtube/mp3"]', {
        timeout: 180000, // 3 minutes - YouTube processing can take time
      });

      // Extract download information
      const downloadLink = await page.$eval(
        'a[href*="/api/youtube/mp3"]',
        (el) => el.href
      );
      let suggestedFilename = await page.$eval(
        'a[href*="/api/youtube/mp3"]',
        (el) => el.download || ""
      );

      // Sanitize the filename
      suggestedFilename = sanitizeFilename(
        suggestedFilename.trim() ? suggestedFilename : "audio.mp3"
      );

      console.log(`Download link obtained: ${downloadLink}`);
      console.log(`Suggested filename: ${suggestedFilename}`);

      // Cache the result
      videoCache.set(youtubeUrl, {
        downloadLink,
        filename: suggestedFilename,
        timestamp: Date.now(),
      });

      // Return the direct download link
      return NextResponse.json({
        success: true,
        downloadLink,
        filename: suggestedFilename,
      });
    } catch (error) {
      console.error("An error occurred:", error);
      return NextResponse.json(
        {
          error: "Failed to process audio",
          message: error.message,
        },
        { status: 500 }
      );
    } finally {
      if (page) {
        await page.close();
      }
    }
  } catch (error) {
    console.error("Request parsing error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export const runtime = "nodejs";
