"use client";

import React, { useRef, useEffect, useState } from "react";
import Groq from "groq-sdk";
import { Moon, Play, SunDim, Pause, GalleryHorizontal } from "lucide-react";
import { useCallback } from "react";
import { BarLoader, PuffLoader } from "react-spinners";
// import { auto } from "groq-sdk/_shims/registry.mjs";
// import puppeteer from 'puppeteer';
// import { chromium } from 'playwright';
// import fs from 'fs';

export default function Home() {
  const [transcription] = useState("");
  const [sentences, setSentences] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  // const [copiedIndex, setCopiedIndex] = useState(null);
  const [allCopied, setAllCopied] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(null);
  const [loop, setLoop] = useState(false);
  const loopTimeout = useRef(null);
  const [videoPosition, setVideoPosition] = useState(0);
  const [playerState, setPlayerState] = useState(-1);
  const sentenceRefs = useRef({});
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState(null);
  const containerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const playerInstanceRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!videoId) {
      return;
    }
    console.log("YouTubePlayer mounting with videoId:", videoId);

    const initPlayer = () => {
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy();
      }

      if (containerRef.current && window.YT) {
        console.log("Creating new YT.Player with videoId:", videoId);

        playerInstanceRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            // controls: 0,
          },
          events: {
            onReady: () => {
              console.log("Player ready for videoId:", videoId);
              setPlayerReady(true);
            },
            onStateChange: (event) => {
              console.log("Player state changed:", event.data);
              setPlayerState(event.data);
            },
            onError: (event) => {
              console.error("YouTube player error:", event.data);
            },
          },
        });
      }
    };

    if (!window.YT) {
      console.log("Loading YouTube iFrame API...");
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";

      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube iFrame API is ready");
        initPlayer();
      };

      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    } else {
      initPlayer();
    }

    return () => {
      console.log("Cleaning up YouTube player");
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  }, [videoId]);

  const handlePlayPause = () => {
    if (!playerInstanceRef.current) return;

    if (playerState === window.YT?.PlayerState?.PLAYING) {
      playerInstanceRef.current.pauseVideo();
    } else {
      if (loop) {
        playerInstanceRef.current.seekTo(startTime, true);
        playerInstanceRef.current.playVideo();
      } else {
        handleGetCurrentTime();
        playerInstanceRef.current.seekTo(startTime, true);
        playerInstanceRef.current.playVideo();
      }
    }
  };

  useEffect(() => {
    if (playerInstanceRef.current) {
      playerInstanceRef.current.seekTo(startTime, true);
    }
  }, [startTime]);

  const handleGetCurrentTime = () => {
    if (!playerInstanceRef.current) return;

    const time = playerInstanceRef.current.getCurrentTime();
    setStartTime(time);
  };

  const getYouTubeId = useCallback((url) => {
    if (!url) return null;
    try {
      const regex =
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch (error) {
      console.error("Error parsing YouTube URL:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    setVideoId(getYouTubeId(youtubeUrl));
  }, [youtubeUrl, getYouTubeId]);

  const handleUrlChange = (event) => {
    setYoutubeUrl(event.target.value);
  };

  const handleTimeUpdate = useCallback(() => {
    if (!playerInstanceRef.current) return;
    const time = playerInstanceRef.current.getCurrentTime();
    setVideoPosition(time);
  }, []);

  useEffect(() => {
    return () => {
      const timeoutId = loopTimeout.current;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    let intervalId = null;

    if (loop && playerInstanceRef.current && playerReady) {
      const player = playerInstanceRef.current;

      player.seekTo(startTime, true);
      player.playVideo();

      intervalId = setInterval(() => {
        const currentTime = player.getCurrentTime();
        if (endTime !== null && currentTime >= endTime) {
          player.seekTo(startTime, true);
          player.playVideo();
        }
      }, 100);
    }

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [loop, endTime, startTime, playerReady]);

  useEffect(() => {
    if (transcription) {
      const sentenceArray = transcription
        .split(/(?<=[.!?])\s+|(?<=[.!?])$/)
        .filter((sentence) => sentence.trim() !== "");
      setSentences(
        sentenceArray.map((sentence) => ({
          text: sentence,
          start: 0,
          end: 0,
        }))
      );
    } else {
      setSentences([]);
    }
  }, [transcription]);

  const getAudioUrl = async (url) => {
    setLoading(1);
    const response = await fetch("/api/fetch-csrf", {
      method: "GET",
    });

    // const response = await downloadYoutubeAudio(url);

    if (!response.ok) {
      throw new Error("Failed to fetch audio URL");
    }
    const data = await response.json();
    console.log("Audio URL data:", data);

    if (data || data.csrfToken) {
      console.log("CSRF Token:", data.csrfToken);
      console.log("URL:", url);

      const baseUrl = "https://www.clipto.com/api/youtube/mp3";
      const audioUrl = new URL(baseUrl);
      audioUrl.searchParams.append("url", url);
      audioUrl.searchParams.append("csrfToken", data.csrfToken);

      console.log("audioURL", audioUrl);
      setLoading(0);

      sendAudioFileForTranscriptionBrowser(audioUrl);
      // return url.toString();
    }

    // setLoading(0);
    if (data.error) {
      setLoading(0);
      throw new Error(data.error);
    }
    // return data.audioUrl;
    // sendAudioForTranscription(data.audioUrl);
    // sendAudioForTranscription(data.downloadLink);
    // sendAudioFileForTranscriptionBrowser(data.downloadLink);
    // sendAudioFileForTranscriptionBrowser(data.csrfToken, url);
  };

  const sendAudioFileForTranscriptionBrowser = async (audioUrl) => {
    const groq = new Groq({
      apiKey: "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",
      dangerouslyAllowBrowser: true,
    });

    try {
      setLoading(2);

      // 1. Download the audio file using fetch
      const audioBlob = await downloadAudioBrowser(audioUrl);

      // 2. Create a File object (if needed, otherwise use the Blob directly)
      const audioFile = new File([audioBlob], "audio.mp3", {
        type: "audio/mp3",
      }); // Adjust filename and type

      setLoading(3);

      // 3. Send the audio file to Groq
      const trans = await groq.audio.transcriptions.create({
        file: audioFile, // Or audioBlob if the API accepts Blobs directly
        model: "whisper-large-v3",
        response_format: "verbose_json",
        temperature: 0.0,
        language: "en",
      });

      const typedTrans = trans;
      if (typedTrans?.segments) {
        setSentences(typedTrans.segments);
      }
      console.log("Transcription:", typedTrans?.segments);
    } catch (error) {
      console.error("Error during transcription:", error);
      setError("Error during transcription. Please try again.");
    } finally {
      setLoading(0);
    }
  };

  const downloadAudioBrowser = async (audioUrl) => {
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob(); // Get the response as a Blob
      return blob;
    } catch (error) {
      console.error("Error downloading audio:", error);
      throw new Error("Failed to download audio file.");
    }
  };

  useEffect(() => {
    if (youtubeUrl) {
      console.log("YouTube URL changed:", youtubeUrl);
      getAudioUrl(youtubeUrl);
    }
  }, [youtubeUrl]);

  const copyToClipboard = (text, index) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (index !== undefined) {
          setCopiedIndex(index);
          setTimeout(() => setCopiedIndex(null), 1000);
        } else {
          setAllCopied(true);
          setTimeout(() => setAllCopied(false), 1000);
        }
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const scrollToTime = (time) => {
    const targetIndex = sentences.findIndex(
      (sentence) => sentence.start >= time
    );

    if (targetIndex === -1) return;
    const previousSentence = sentences[targetIndex - 1];
    const currentSentence = sentences[targetIndex];

    let target;
    if (
      previousSentence &&
      time - previousSentence.start < currentSentence.start - time
    ) {
      target = sentenceRefs.current[Math.floor(previousSentence.start)];
    } else {
      target = sentenceRefs.current[Math.floor(currentSentence.start)];
    }

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  useEffect(() => {
    if (videoId && playerReady && sentences.length > 0) {
      const intervalId = setInterval(() => {
        if (
          playerInstanceRef.current &&
          playerInstanceRef.current.getPlayerState() === 1
        ) {
          handleTimeUpdate();
        }
      }, 250);

      return () => clearInterval(intervalId);
    }
  }, [videoId, playerReady, sentences, handleTimeUpdate]);

  useEffect(() => {
    if (autoScroll) {
      scrollToTime(videoPosition);
    }
  }, [videoPosition, sentences]);

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto">
        {/* Main container */}
        <div className="flex flex-col md:flex-row h-screen">
          {/* First div - fixed content */}
          <div
            className={`w-full md:w-1/2 rounded-lg shadow-md ${
              darkMode ? "bg-black" : "bg-gray-100"
            }`}
          >
            {videoId ? (
              <div className="youtube-player">
                <div
                  ref={containerRef}
                  className="w-full aspect-video bg-black rounded-lg"
                ></div>
              </div>
            ) : (
              <div
                className={`flex flex-col items-center justify-center h-full p-4 rounded-lg shadow-lg ${
                  darkMode
                    ? "bg-black/30 backdrop-blur-md text-zinc-400"
                    : "bg-white/70 backdrop-blur-md text-gray-800"
                }`}
              >
                <p className="text-sm opacity-80">
                  Paste a YouTube link to get started!
                </p>
              </div>
            )}
          </div>

          {/* Second div - scrollable content */}
          <div className="w-full md:w-1/2 rounded-lg shadow-md overflow-y-auto">
            <div
              className={`min-h-screen ${
                darkMode ? "bg-black" : "bg-gray-100"
              }`}
            >
              <div className="container mx-auto sm:px-1 py-15 sm:py-15">
                <div
                  className={`w-full mx-auto rounded-lg sm:rounded-xl overflow-hidden shadow-xl ${
                    darkMode ? "bg-black" : "bg-white shadow-gray-300"
                  }`}
                >
                  {/* Header with Dark Mode Toggle */}
                  <div
                    className={`p-3 sm:p-6 flex justify-between items-center border-b ${
                      darkMode ? "border-zinc-700" : "border-gray-200"
                    }`}
                  >
                    <h1
                      className={`text-xl sm:text-3xl font-bold ${
                        darkMode ? "text-zinc-400" : "text-blue-600"
                      }`}
                    >
                      Vocal Transcribe
                    </h1>
                    <button
                      onClick={toggleDarkMode}
                      className={`p-2 rounded-full ${
                        darkMode
                          ? "bg-zinc-900 text-zinc-500"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {darkMode ? <SunDim /> : <Moon />}
                    </button>
                  </div>

                  {/* SIde Main Content */}
                  <div className="p-4 sm:p-8">
                    <div className="mb-4">
                      <label
                        htmlFor="youtubeUrl"
                        className="block mb-2 text-zinc-500"
                      >
                        YouTube URL:
                      </label>
                      <input
                        type="url"
                        id="youtubeUrl"
                        value={youtubeUrl}
                        onChange={handleUrlChange}
                        className={`w-full p-2 border rounded ${
                          darkMode
                            ? "bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-800"
                            : "bg-white border-gray-300 text-zinc-600"
                        }`}
                      />
                    </div>
                    {/* Loading Indicator */}
                    {loading === 1 && (
                      <div className="flex flex-col items-center justify-center my-6">
                        <div
                          className={`animate-pulse text-center ${
                            darkMode ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          {/* Waveform Animation */}
                          <div className="flex justify-center items-center h-16">
                            <PuffLoader
                              color={darkMode ? "#60A5FA" : "#3B82F6"}
                              loading={true}
                              width={150}
                              height={4}
                            />

                            {/* <PuffLoader /> */}
                          </div>
                          {/* <BarLoader /> */}
                          <p className=" text-sm sm:text-base font-medium">
                            Retrieving audio...
                          </p>
                        </div>
                      </div>
                    )}

                    {loading === 2 && (
                      <div className="flex flex-col items-center justify-center my-6">
                        <div
                          className={`animate-pulse text-center ${
                            darkMode ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          {/* Waveform Animation */}
                          <div className="flex justify-center items-center h-16">
                            <BarLoader
                              color={darkMode ? "#60A5FA" : "#3B82F6"}
                              loading={true}
                              width={150}
                              height={4}
                            />
                          </div>
                          {/* <BarLoader /> */}
                          <p className=" text-sm sm:text-base font-medium">
                            Downloading audio...
                          </p>
                        </div>
                      </div>
                    )}

                    {loading === 3 && (
                      <div className="flex flex-col items-center justify-center my-6">
                        <div
                          className={`animate-pulse text-center ${
                            darkMode ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          <svg
                            className="w-10 h-10 sm:w-12 sm:h-12 mx-auto animate-spin"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <p className="mt-3 text-sm sm:text-base font-medium">
                            Transcribing audio...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div
                        className={`p-3 sm:p-4 mb-6 rounded-lg bg-red-100 text-red-700 ${
                          darkMode ? "bg-opacity-20" : ""
                        }`}
                      >
                        <p className="text-sm sm:text-base font-medium">
                          {error}
                        </p>
                      </div>
                    )}

                    {/* Transcription Results */}
                    {/* {sentences.length > 0 && (
                      <div className={`mb-5 sm:mb-8 ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                        <div className="flex justify-between items-center mb-5">
                          <h2 className="text-2xl sm:text-3xl font-semibold">Transcription</h2>
                          <button
                            onClick={() => copyToClipboard(transcription)}
                            className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg flex items-center text-lg sm:text-lg font-medium transition-all duration-300 ${
                              darkMode
                                ? "bg-zinc-800 hover:bg-gray-700 text-slate-200"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                            }`}
                          >
                            {allCopied ? "Copied!" : "Copy All"}
                          </button>
                        </div>

                        <div className="space-y-4 pb-10">
                          {sentences.map((sentence, index) => (
                            <div
                              key={index}
                              ref={(el) => {
                                if (el) sentenceRefs.current[Math.floor(sentence.start)] = el;
                              }}
                              className={`relative p-4 sm:p-5 rounded-lg group transition-all duration-10 ${
                                darkMode ? "bg-zinc-900 hover:bg-zinc-900" : "bg-gray-50 hover:bg-gray-50"
                              }`}
                            >
                              <p
                                onDoubleClick={() => setEndTime(sentence.end)}
                                onClick={() => {
                                  setStartTime(sentence.start);
                                  setEndTime(loop ? sentence.end : null);
                                }}
                                className="text-lg sm:text-xl leading-relaxed"
                              >
                                {sentence.text}
                                
                                {/* Copy button overlay */}
                    {/* <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the parent onClick
                                    copyToClipboard(sentence.text, index);
                                    
                                    if (loop) {
                                      setEndTime(sentence.end);
                                    } else {
                                      setEndTime(null);
                                    }
                                  }}
                                  className={`ml-2 inline-flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 align-middle ${
                                    darkMode
                                      ? "text-zinc-400 hover:text-zinc-300"
                                      : "text-gray-500 hover:text-gray-700"
                                  }`}
                                >
                                  <Copy size={16} />
                                  {copiedIndex === index && (
                                    <span className="ml-1 text-xs font-medium">
                                      {index + 1}
                                    </span>
                                  )}
                                </button>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}

                    {/* Transcription Results */}
                    {sentences.length > 0 && (
                      <div
                        className={`mb-5 sm:mb-8 ${
                          darkMode ? "text-slate-300" : "text-gray-700"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-5">
                          <h2 className="text-2xl sm:text-3xl font-semibold">
                            Transcription
                          </h2>
                          <button
                            onClick={() => copyToClipboard(transcription)}
                            className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg flex items-center text-lg sm:text-lg font-medium transition-all duration-300 ${
                              darkMode
                                ? "bg-zinc-800 hover:bg-gray-700 text-slate-200"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                            }`}
                          >
                            {allCopied ? "Copied!" : "Copy All"}
                          </button>
                        </div>

                        <div className="space-y-4 pb-10">
                          {sentences.map((sentence, index) => (
                            <div
                              key={index}
                              ref={(el) => {
                                if (el)
                                  sentenceRefs.current[
                                    Math.floor(sentence.start)
                                  ] = el;
                              }}
                              className={`relative p-4 sm:p-5 rounded-lg group transition-all duration-10 ${
                                darkMode
                                  ? "bg-zinc-900 hover:bg-zinc-900"
                                  : "bg-gray-50 hover:bg-gray-50"
                              }`}
                            >
                              <span
                                onDoubleClick={() => setEndTime(sentence.end)}
                                onClick={() => {
                                  setStartTime(sentence.start);
                                  setEndTime(loop ? sentence.end : null);
                                  handlePlayPause();
                                }}
                                className="text-lg sm:text-xl leading-relaxed inline-block whitespace-normal"
                              >
                                {sentence.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 z-50 w-full flex justify-center">
        <div
          className={`rounded-xl px-4 py-2 shadow-lg backdrop-blur-md ${
            darkMode ? "bg-zinc-950 text-zinc-400" : "bg-white/90 text-gray-800"
          } border ${
            darkMode ? "border-zinc-900" : "border-gray-200"
          } flex items-center gap-3`}
        >
          <div className="flex items-center">
            <button
              onClick={() => setLoop((prev) => !prev)}
              className={`flex items-center justify-center rounded-full w-8 h-8 ${
                loop
                  ? darkMode
                    ? "bg-zinc-950 text-zinc-400"
                    : "bg-blue-500 text-white"
                  : darkMode
                  ? "bg-zinc-900 text-zinc-500"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-infinity"
              >
                <path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8" />
              </svg>
              {/* {loop ? "On" : "Off"} */}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium"></label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={startTime}
              // onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
              className={`w-16 px-2 py-1 text-sm rounded ${
                darkMode
                  ? "bg-zinc-950 border-zinc-800"
                  : "bg-gray-50 border-gray-300"
              } border`}
            />
          </div>

          <div className="flex items-center           gap-2">
            <label className="text-sm font-medium">to </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={endTime ?? ""}
              onChange={(e) =>
                setEndTime(e.target.value ? parseFloat(e.target.value) : null)
              }
              placeholder=" - "
              className={`w-16 px-2 py-1 text-sm rounded ${
                darkMode
                  ? "bg-zinc-950 border-zinc-800"
                  : "bg-gray-50 border-gray-300"
              } border`}
            />
          </div>

          <button
            onClick={handlePlayPause}
            disabled={!playerReady}
            className={`flex items-center justify-center rounded-full w-10 h-10 ${
              darkMode
                ? "bg-zinc-900 hover:bg-zinc-800"
                : "bg-blue-500 hover:bg-blue-600"
            } text-zinc-400 transition-colors`}
            aria-label={playerState === 1 ? "Pause" : "Play"}
          >
            {playerState === 1 ? (
              <Pause size={18} />
            ) : (
              <Play size={18} className="ml-1" />
            )}
          </button>

          {/* <button
            onClick={() => {
              setStartTime(0);
              setEndTime(null);
              setLoop(false);
            }}
            className={`flex items-center justify-center rounded-full w-8 h-8 ${
              darkMode
                ? "bg-zinc-950 hover:bg-zinc-900"
                : "bg-gray-200 hover:bg-gray-300"
            } transition-colors`}
            aria-label="Reset"
          >
            <RotateCcw size={16} />
          </button> */}

          <div className="flex items-center">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center justify-center rounded-full w-8 h-8 ${
                autoScroll
                  ? darkMode
                    ? "bg-zinc-950 text-zinc-400"
                    : "bg-blue-500 text-white"
                  : darkMode
                  ? "bg-zinc-900 text-zinc-500"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {/* <RotateCcw size={16} /> */}
              <GalleryHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
