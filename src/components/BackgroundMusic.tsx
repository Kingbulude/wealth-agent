// 背景音乐播放器组件
// 功能：帮助用户思考和记录的轻音乐，支持播放控制、音量调节、循环播放
// 默认进入网站自动播放，用户可手动关闭

import { useState, useEffect, useRef } from 'react'
import { Tooltip, Slider } from 'antd'
import { SoundOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons'

const VOLUME_KEY = 'wealth_agent_bgm_volume'
const ENABLED_KEY = 'wealth_agent_bgm_enabled'

// 使用 Pixabay 免费轻音乐（可商用）
const BGM_URL = 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3'

interface BgmSettings {
  volume: number
  enabled: boolean
}

function loadSettings(): BgmSettings {
  try {
    return {
      volume: Number(localStorage.getItem(VOLUME_KEY)) || 0.3,
      enabled: localStorage.getItem(ENABLED_KEY) !== 'false' // 默认开启
    }
  } catch {
    return { volume: 0.3, enabled: true }
  }
}

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.3)
  const [showVolume, setShowVolume] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // 初始化
  useEffect(() => {
    const settings = loadSettings()
    setVolume(settings.volume)
    setIsPlaying(settings.enabled)
    setInitialized(true)
  }, [])

  // 播放控制
  useEffect(() => {
    if (!initialized || !audioRef.current) return

    const audio = audioRef.current
    audio.volume = volume

    if (isPlaying) {
      audio.play().then(() => {
        setIsPlaying(true)
      }).catch(err => {
        console.warn('[BGM] 自动播放失败:', err)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, initialized])

  // 音量变化
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    localStorage.setItem(VOLUME_KEY, String(volume))
  }, [volume])

  // 记住启用状态
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(ENABLED_KEY, String(isPlaying))
    }
  }, [isPlaying, initialized])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const handleVolumeChange = (value: number) => {
    setVolume(value / 100)
    if (value > 0 && !isPlaying) {
      setIsPlaying(true)
    }
  }

  return (
    <>
      {/* 隐藏的音频元素 */}
      <audio
        ref={audioRef}
        src={BGM_URL}
        loop
        preload="auto"
        crossOrigin="anonymous"
      />

      {/* 音乐控制浮窗 */}
      <div className="bgm-control">
        <Tooltip title={isPlaying ? '暂停背景音乐' : '播放背景音乐'} placement="left">
          <button
            className={`bgm-btn ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
          >
            {isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
          </button>
        </Tooltip>

        <div
          className="bgm-volume-wrapper"
          onMouseEnter={() => setShowVolume(true)}
          onMouseLeave={() => setShowVolume(false)}
        >
          <Tooltip title="音量调节" placement="left">
            <button className="bgm-btn">
              <SoundOutlined />
            </button>
          </Tooltip>

          {showVolume && (
            <div className="bgm-volume-panel">
              <div className="bgm-volume-label">
                <SoundOutlined style={{ fontSize: 12 }} />
                <span>背景音乐</span>
              </div>
              <Slider
                vertical
                value={volume * 100}
                onChange={handleVolumeChange}
                tooltip={{ formatter: (v) => `${v}%` }}
                className="bgm-slider"
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .bgm-control {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
        }

        .bgm-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .bgm-btn:hover {
          background: var(--brand-500);
          color: white;
          border-color: var(--brand-500);
          transform: scale(1.05);
        }

        .bgm-btn.playing {
          background: var(--brand-500);
          color: white;
          border-color: var(--brand-500);
        }

        .bgm-btn.playing:hover {
          background: var(--brand-600);
        }

        .bgm-volume-wrapper {
          position: relative;
        }

        .bgm-volume-panel {
          position: absolute;
          right: 52px;
          bottom: 0;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 10px;
          padding: 12px 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          animation: fadeIn 0.2s ease;
        }

        .bgm-volume-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-tertiary);
          white-space: nowrap;
        }

        .bgm-slider {
          height: 80px;
        }

        .bgm-slider .ant-slider-rail {
          background: var(--card-border);
        }

        .bgm-slider .ant-slider-track {
          background: var(--brand-500);
        }

        .bgm-slider .ant-slider-handle::after {
          background: var(--brand-500);
          box-shadow: 0 0 0 2px var(--brand-500);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .bgm-control {
            bottom: 16px;
            right: 16px;
          }

          .bgm-btn {
            width: 36px;
            height: 36px;
            font-size: 14px;
          }

          .bgm-volume-panel {
            right: 44px;
          }
        }
      `}</style>
    </>
  )
}
