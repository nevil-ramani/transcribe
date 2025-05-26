export async function POST(req) {
    const { audioBase64 } = await req.json();
  
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/6249093c1957771d4de3cead3717c597/ai/run/@cf/openai/whisper-large-v3-turbo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer JryPPq1j34CwLTZLbYGT3mfjdrCNeFIP4vMmwiVU`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio: audioBase64,
          response_format: "json",
          output: {
            type: "text",
            format: "json",
          },
          translate: true,
          language: "en",
        }),
      }
    );
  
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  


  
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// const URL = "https://pub-dbcf9f0bd3af47ca9d40971179ee62de.r2.dev/02f6edc0-1f7b-4272-bd17-f05335104725/audio.mp3";
// const MODEL = "@cf/openai/whisper-large-v3-turbo";
// const ACCOUNT_ID = "6249093c1957771d4de3cead3717c597";
// const API_TOKEN = "JryPPq1j34CwLTZLbYGT3mfjdrCNeFIP4vMmwiVU";

// async function run(model, input) {
//   console.log("Calling Cloudflare AI API...");
//   const response = await fetch(
//     `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${API_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(input),
//     }
//   );
  
//   if (!response.ok) {
//     console.error(`API error: ${response.status}`);
//     const text = await response.text();
//     console.error(text);
//     throw new Error(`API returned ${response.status}`);
//   }
  
//   const result = await response.json();
//   return result;
// }

// async function main() {
//   try {
//     console.log("Starting transcription process...");
//     console.log("Fetching audio file...");
    
//     const mp3 = await fetch(URL);
//     if (!mp3.ok) {
//       console.error(`Failed to fetch MP3: ${mp3.status}`);
//       return { error: `Failed to fetch MP3: ${mp3.status}` };
//     }

//     console.log("Audio file fetched, converting to base64...");
//     const mp3Buffer = await mp3.arrayBuffer();
//     const base64 = Buffer.from(mp3Buffer).toString("base64");
//     console.log(`Converted ${mp3Buffer.byteLength} bytes to base64`);

//     console.log("Sending to Cloudflare AI for transcription with English translation...");
//     // Add language and translation options
//     const result = await run(MODEL, { 
//       audio: base64,
//       // The important part - request transcription in English regardless of input language
//       response_format: "json",
//       output: {
//         type: "text",
//         format: "json"
//       },
//       translate: true,  // Enable translation to English
//       language: "en"    // Target language is English
//     });
//     console.log("Transcription result:", result);
    
//     if (!result || result.error) {
//       console.error("Transcription failed:", result?.error || "No result");
//       return { error: "Failed to process audio" };
//     }

//     console.log("Transcription successful!");
//     return result;
//   } catch (e) {
//     console.error("Error in transcription process:", e);
//     return { error: "An unexpected error occurred" };
//   }
// }

// // Execute the main function
// main().then(result => {
//   console.log("Final result:", result);
// }).catch(error => {
//   console.error("Unhandled error:", error);
// });