"use client";

import React, { useRef, useEffect, useState } from "react";

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}
import Groq from "groq-sdk";
import { Moon, Play, SunDim, RotateCcw, Pause, Copy } from "lucide-react";
import { useCallback, useMemo } from "react";

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [sentences, setSentences] = useState<
    { text: string; start: number; end: number }[]
  >([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const loopTimeout = useRef<NodeJS.Timeout | null>(null);
  const [videoPosition, setVideoPosition] = useState(0);
  const [playerState, setPlayerState] = useState(-1);
  const sentenceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const playerInstanceRef = useRef<YT.Player | null>(null);

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
            onStateChange: (event: YT.OnStateChangeEvent) => {
              console.log("Player state changed:", event.data);
              setPlayerState(event.data);
            },
            onError: (event: YT.OnErrorEvent) => {
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

  const getYouTubeId = useCallback((url: string | null): string | null => {
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

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setYoutubeUrl(event.target.value);
  };

  const audioURL = useMemo(() => {
    if (!audioFile) return "";
    const url = URL.createObjectURL(audioFile);
    return url;
  }, [audioFile]);

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

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
    let intervalId: NodeJS.Timeout | null = null;

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setError("");
    setTranscription("");
    setSentences([]);
    await sendAudioForTranscription(file);
  };

  const sendAudioForTranscription = async (file: File) => {
    const groq = new Groq({
      apiKey: "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",
      dangerouslyAllowBrowser: true,
    });

    try {
      setLoading(true);
      const trans = await groq.audio.translations.create({
        file,
        model: "whisper-large-v3",
        response_format: "verbose_json",
        temperature: 0.0,
      });

      if (
        (trans as { segments?: { text: string; start: number; end: number }[] })
          ?.segments
      ) {
        if ("segments" in trans && Array.isArray(trans.segments)) {
          setSentences(trans.segments);
        } else {
          console.error("Unexpected response format:", trans);
          setError("Unexpected response format. Please try again.");
        }
      }
      if ("segments" in trans && Array.isArray(trans.segments)) {
        console.log("Transcription:", trans.segments);
      } else {
        console.error("Unexpected response format:", trans);
      }
    } catch (error) {
      console.error("Error during transcription:", error);
      setError("Error during transcription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index?: number) => {
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

  const scrollToTime = (time: number) => {
    const targetIndex = sentences.findIndex(
      (sentence) => sentence.start >= time
    );

    if (targetIndex === -1) return;
    const previousSentence = sentences[targetIndex - 1];
    const currentSentence = sentences[targetIndex];

    let target: HTMLDivElement | null;
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
    scrollToTime(videoPosition);
  }, [videoPosition, sentences]);

  return (
    <div className="min-h-screen">
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
                    {/* File Upload Section */}
                    <div
                      className={`mb-6 p-3 sm:p-6 border-2 border-dashed rounded-lg text-center ${
                        darkMode
                          ? "border-gray-600 hover:border-blue-500"
                          : "border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      <p
                        className={`mb-2 sm:mb-4 text-sm sm:text-base font-medium ${
                          darkMode ? "text-zinc-500" : "text-gray-600"
                        }`}
                      >
                        Upload your audio file to transcribe
                      </p>
                      <label
                        className={`cursor-pointer inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-all duration-300 ${
                          darkMode
                            ? "bg-zinc-900 hover:bg-blue-700 text-zinc-400"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                        }`}
                      >
                        <span>Select Audio File</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

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
                    {loading && (
                      <div className="flex justify-center my-6">
                        <div
                          className={`animate-pulse text-center ${
                            darkMode ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          <svg
                            className="w-8 h-8 sm:w-12 sm:h-12 mx-auto animate-spin"
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
                          <p className="mt-2 text-sm sm:text-base font-medium">
                            Transcribing your audio...
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
                    {sentences.length > 0 && (
                      <>
                        <div
                          className={`mb-4 sm:mb-6 ${
                            darkMode ? "text-slate-400" : "text-gray-800"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl sm:text-2xl font-semibold">
                              Transcription
                            </h2>
                            <button
                              onClick={() => copyToClipboard(transcription)}
                              className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg flex items-center text-base sm:text-base font-medium transition-all duration-300 ${
                                darkMode
                                  ? "bg-zinc-900 hover:bg-gray-600"
                                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                              }`}
                            >
                              {allCopied ? "Copied!" : "Copy All"}
                            </button>
                          </div>

                          <div className="space-y-3">
                            {sentences.map((sentence, index) => (
                              <div
                                key={index}
                                ref={(el) => {
                                  if (el)
                                    sentenceRefs.current[
                                      Math.floor(sentence.start)
                                    ] = el;
                                }}
                                className={`p-3 sm:p-4 rounded-lg flex justify-between items-start group transition-all duration-300 ${
                                  darkMode
                                    ? "bg-black hover:bg-black"
                                    : "bg-gray-100 hover:bg-gray-200"
                                }`}
                              >
                                <p
                                  onDoubleClick={() => {
                                    setEndTime(sentence.end);
                                  }}
                                  onClick={() => {
                                    setStartTime(sentence.start);
                                    setEndTime(loop ? sentence.end : null);
                                  }}
                                  className="flex-1 mr-2 sm:mr-4 text-base sm:text-base"
                                >
                                  {sentence.text}
                                </p>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-sm sm:text-sm font-medium pr-1 ${
                                      darkMode
                                        ? "text-zinc-500"
                                        : "text-gray-500"
                                    } ${
                                      copiedIndex === index
                                        ? "inline-block"
                                        : "hidden"
                                    }`}
                                  >
                                    {index + 1}
                                  </span>

                                  <button
                                    onClick={() => {
                                      copyToClipboard(sentence.text, index);

                                      if (loop) {
                                        setEndTime(sentence.end);
                                      } else {
                                        setEndTime(null);
                                      }
                                    }}
                                    className={`rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                                      darkMode
                                        ? "bg-zinc-900 text-zinc-500"
                                        : "bg-gray-200 text-gray-700"
                                    }`}
                                  >
                                    <Copy size={18} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
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
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-all ${
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
              {loop ? "On" : "Off"}
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

          <button
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
          </button>
        </div>
      </div>
    </div>
  );
}
