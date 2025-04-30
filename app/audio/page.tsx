"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Groq from "groq-sdk";
import { Moon, Play, SunDim, RotateCcw, Pause, Copy } from "lucide-react";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // const youtubeRef = useRef<HTMLIFrameElement | null>(null); // New Ref for Youtube Iframe
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [playTrigger, setPlayTrigger] = useState(false);
  // const loopTimeout = useRef(null);
  const [videoPosition, setVideoPosition] = useState(0);
  const sentenceRefs = useRef<Record<number, HTMLDivElement | null>>({});

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

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      const currentTime = e.currentTarget.currentTime;
      setVideoPosition(currentTime); // <- still safe now
    },
    []
  );

  // Toggle play state
  const togglePlay = () => {
    // setPlayTrigger(!playTrigger);
    if (!loop) {
      setStartTime(videoPosition);
      setEndTime(null);
      setPlayTrigger((prev) => !prev);
    } else {
      setPlayTrigger((prev) => !prev);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playTrigger) return;

    audio.currentTime = startTime;
    audio.loop = false;
    audio.play();

    const onTimeUpdate = () => {
      if (endTime !== null && audio.currentTime >= endTime) {
        if (loop) {
          audio.currentTime = startTime;
        } else {
          audio.pause();
        }
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [playTrigger, startTime, endTime, loop]);

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

      const typedTrans = trans as {
        segments?: { text: string; start: number; end: number }[];
      };
      if (typedTrans?.segments) {
        setSentences(typedTrans.segments);
      }
      console.log("Transcription:", typedTrans?.segments);
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

  const scrollToTime = (startTime: number) => {
    const target = sentenceRefs.current[startTime];
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  useEffect(() => {
    scrollToTime(Math.floor(videoPosition));
  }, [videoPosition]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playTrigger) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Playback failed", error);
        });
      }
    } else {
      audio.pause();
    }
  }, [playTrigger]);

  return (
    <div className={`min-h-screen ${darkMode ? "bg-black" : "bg-gray-100"}`}>
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

          {/* Main Content */}
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

            {/* Audio Player */}
            {audioFile && (
              <div
                className={`mb-6 p-3 sm:p-4 rounded-lg ${
                  darkMode ? "bg-black" : "bg-gray-100"
                }`}
              >
                <p
                  className={`mb-2 text-sm sm:text-base font-medium truncate ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {audioFile.name}
                </p>

                <audio
                  ref={audioRef}
                  controls
                  src={audioURL}
                  className="w-full"
                  onPlay={() => setPlayTrigger(true)}
                  onPause={() => setPlayTrigger(false)}
                  // onPause={togglePlay}
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
            )}

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
                <p className="text-sm sm:text-base font-medium">{error}</p>
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
                    <h2 className="text-lg sm:text-2xl font-semibold">
                      Transcription
                    </h2>
                    <button
                      onClick={() => copyToClipboard(transcription)}
                      className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg flex items-center text-sm sm:text-base font-medium transition-all duration-300 ${
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
                            sentenceRefs.current[Math.floor(sentence.start)] =
                              el;
                        }}
                        className={`p-2 sm:p-4 rounded-lg flex justify-between items-start group transition-all duration-300 ${
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
                            // setPlayTrigger((prev) => !prev);
                          }}
                          className="flex-1 mr-2 sm:mr-4 text-sm sm:text-base"
                        >
                          {sentence.text}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs sm:text-sm font-medium pr-1 ${
                              darkMode ? "text-zinc-500" : "text-gray-500"
                            } ${
                              copiedIndex === index ? "inline-block" : "hidden"
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
                            <Copy size={16} />
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
              onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
              className={`w-16 px-2 py-1 text-sm rounded ${
                darkMode
                  ? "bg-zinc-950 border-zinc-800"
                  : "bg-gray-50 border-gray-300"
              } border`}
            />
          </div>

          <div className="flex items-center gap-2">
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
            onClick={togglePlay}
            className={`flex items-center justify-center rounded-full w-10 h-10 ${
              darkMode
                ? "bg-zinc-900 hover:bg-zinc-800"
                : "bg-blue-500 hover:bg-blue-600"
            } text-zinc-400 transition-colors`}
            aria-label={playTrigger ? "Pause" : "Play"}
          >
            {playTrigger ? (
              <Pause size={18} />
            ) : (
              <Play size={18} className="ml-1" />
            )}
          </button>

          <button
            onClick={() => {
              setStartTime(0);
              setEndTime(null);
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
