import { useState, useEffect, useRef, useCallback } from 'react'
import { Slider } from 'antd'
import { SoundOutlined, PauseOutlined, PlayCircleOutlined, SwapOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'

const VOLUME_KEY = 'wealth_agent_bgm_volume'
const ENABLED_KEY = 'wealth_agent_bgm_enabled'
const TRACK_KEY = 'wealth_agent_bgm_track'

interface BgmTrack {
  name: string
  desc: string
  type: 'ambient' | 'noise' | 'drone'
}

const BGM_TRACKS: BgmTrack[] = [
  {
    name: '静谧氛围',
    desc: '柔和合成器，深度专注',
    type: 'ambient'
  },
  {
    name: '粉噪音',
    desc: '自然白噪音，沉浸式专注',
    type: 'noise'
  },
  {
    name: '低频冥想',
    desc: '深沉 drone 音，放松身心',
    type: 'drone'
  },
  {
    name: '雨声模拟',
    desc: '柔和雨声，舒缓心情',
    type: 'noise'
  },
  {
    name: '清晨微风',
    desc: '清新氛围，开启思绪',
    type: 'ambient'
  }
]

interface BgmSettings {
  volume: number
  enabled: boolean
  trackIndex: number
}

function loadSettings(): BgmSettings {
  try {
    return {
      volume: Number(localStorage.getItem(VOLUME_KEY)) || 0.15,
      enabled: localStorage.getItem(ENABLED_KEY) !== 'false',
      trackIndex: Math.min(
        Math.max(Number(localStorage.getItem(TRACK_KEY)) || 0, 0),
        BGM_TRACKS.length - 1
      )
    }
  } catch {
    return { volume: 0.15, enabled: true, trackIndex: 0 }
  }
}

export default function BackgroundMusic() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const activeNodesRef = useRef<AudioNode[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.15)
  const [trackIndex, setTrackIndex] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const stopAllNodes = useCallback(() => {
    activeNodesRef.current.forEach(node => {
      try {
        node.disconnect()
      } catch (e) {
        // ignore
      }
    })
    activeNodesRef.current = []
  }, [])

  const createNoiseBuffer = useCallback((ctx: AudioContext, type: 'pink' | 'brown' = 'pink'): AudioBuffer => {
    const bufferSize = ctx.sampleRate * 2 // 2秒循环
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1

        if (type === 'pink') {
          // Pink noise approximation (Paul Kellet's method)
          b0 = 0.99886 * b0 + white * 0.0555179
          b1 = 0.99332 * b1 + white * 0.0750759
          b2 = 0.96900 * b2 + white * 0.1538520
          b3 = 0.86650 * b3 + white * 0.3104856
          b4 = 0.55000 * b4 + white * 0.5329522
          b5 = -0.7616 * b5 - white * 0.0168980
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
          b6 = white * 0.115926
        } else {
          // Brown noise
          b0 = (b0 + 0.02 * white) / 1.02
          data[i] = b0 * 3.5
        }
      }
    }

    return buffer
  }, [])

  const startAmbientSound = useCallback((ctx: AudioContext, gainNode: GainNode, variant: number) => {
    stopAllNodes()

    const baseFreq = variant === 0 ? 220 : 330 // A3 or E4
    const filterFreq = variant === 0 ? 800 : 1200

    // 多个正弦波叠加，形成和弦
    const freqs = variant === 0
      ? [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2] // Major chord + octave
      : [baseFreq, baseFreq * 1.2, baseFreq * 1.5, baseFreq * 1.8]

    const oscillators: OscillatorNode[] = []
    const oscGains: GainNode[] = []

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const oscGain = ctx.createGain()
      oscGain.gain.value = 0 // 淡入

      // 稍微 detune 让声音更自然
      osc.detune.value = (Math.random() - 0.5) * 10

      osc.connect(oscGain)
      oscGain.connect(gainNode)

      oscillators.push(osc)
      oscGains.push(oscGain)
      activeNodesRef.current.push(osc, oscGain)
    })

    // 低通滤波器，让声音更柔和
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 0.5

    // 缓慢的 LFO 调制音量，产生呼吸感
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08 // 很慢的呼吸节奏

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15 // 调制深度

    lfo.connect(lfoGain)

    // 连接所有振荡器到 filter（通过主 gain）
    const preFilterGain = ctx.createGain()
    preFilterGain.gain.value = 1 / freqs.length * 0.8

    oscillators.forEach((_, i) => {
      oscGains[i].connect(preFilterGain)
    })

    preFilterGain.connect(filter)
    filter.connect(gainNode)

    lfoGain.connect(gainNode.gain)

    activeNodesRef.current.push(filter, preFilterGain, lfo, lfoGain)

    // 淡入
    const now = ctx.currentTime
    const fadeInTime = 3

    oscGains.forEach((gain, i) => {
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + fadeInTime + i * 0.5)
    })

    // 启动
    oscillators.forEach(osc => osc.start())
    lfo.start()

    return { oscillators, lfo }
  }, [stopAllNodes])

  const startNoiseSound = useCallback((ctx: AudioContext, gainNode: GainNode, variant: number) => {
    stopAllNodes()

    const noiseType = variant === 0 ? 'pink' : 'brown'
    const buffer = createNoiseBuffer(ctx, noiseType as 'pink' | 'brown')

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    // 滤波器塑形
    const filter = ctx.createBiquadFilter()
    filter.type = variant === 0 ? 'lowpass' : 'bandpass'
    filter.frequency.value = variant === 0 ? 1500 : 800
    filter.Q.value = variant === 0 ? 0.3 : 1

    // 缓慢的音量调制
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.05

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = variant === 0 ? 0.2 : 0.3

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = variant === 0 ? 0.4 : 0.3

    source.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(gainNode)

    lfo.connect(lfoGain)
    lfoGain.connect(noiseGain.gain)

    activeNodesRef.current.push(source, filter, noiseGain, lfo, lfoGain)

    // 淡入
    const now = ctx.currentTime
    noiseGain.gain.setValueAtTime(0, now)
    noiseGain.gain.linearRampToValueAtTime(variant === 0 ? 0.4 : 0.3, now + 2)

    source.start()
    lfo.start()

    return { source, lfo }
  }, [createNoiseBuffer, stopAllNodes])

  const startDroneSound = useCallback((ctx: AudioContext, gainNode: GainNode) => {
    stopAllNodes()

    // 深沉的 drone 音
    const baseFreq = 55 // A1
    const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 2, baseFreq * 3]

    const oscillators: OscillatorNode[] = []
    const oscGains: GainNode[] = []

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? 'sine' : 'triangle'
      osc.frequency.value = freq

      const oscGain = ctx.createGain()
      oscGain.gain.value = 0

      osc.connect(oscGain)
      oscGain.connect(masterGain)

      oscillators.push(osc)
      oscGains.push(oscGain)
      activeNodesRef.current.push(osc, oscGain)
    })

    // 低通滤波
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    filter.Q.value = 0.5

    masterGain.connect(filter)
    filter.connect(gainNode)

    activeNodesRef.current.push(masterGain, filter)

    // 缓慢的滤波调制
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.03

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 100

    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)

    activeNodesRef.current.push(lfo, lfoGain)

    // 淡入
    const now = ctx.currentTime
    const fadeInTime = 5

    oscGains.forEach((gain, i) => {
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1 / (i + 1) * 0.5, now + fadeInTime + i * 1)
    })

    masterGain.gain.setValueAtTime(0, now)
    masterGain.gain.linearRampToValueAtTime(0.6, now + fadeInTime)

    oscillators.forEach(osc => osc.start())
    lfo.start()

    return { oscillators, lfo }
  }, [stopAllNodes])

  const startTrack = useCallback((index: number) => {
    if (!audioContextRef.current || !gainNodeRef.current) return

    const ctx = audioContextRef.current
    const gainNode = gainNodeRef.current
    const track = BGM_TRACKS[index]

    if (track.type === 'ambient') {
      const variant = index === 0 ? 0 : 1
      startAmbientSound(ctx, gainNode, variant)
    } else if (track.type === 'noise') {
      const variant = index === 1 ? 0 : 1
      startNoiseSound(ctx, gainNode, variant)
    } else if (track.type === 'drone') {
      startDroneSound(ctx, gainNode)
    }
  }, [startAmbientSound, startNoiseSound, startDroneSound])

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return false

      const ctx = new AudioCtx()
      const gainNode = ctx.createGain()
      gainNode.gain.value = volume
      gainNode.connect(ctx.destination)

      audioContextRef.current = ctx
      gainNodeRef.current = gainNode
    }

    // 恢复 suspended 状态
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }

    return true
  }, [volume])

  const handlePlay = useCallback(() => {
    if (!initAudio()) return

    const ctx = audioContextRef.current!
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    startTrack(trackIndex)
    setIsPlaying(true)
  }, [initAudio, startTrack, trackIndex])

  const handlePause = useCallback(() => {
    stopAllNodes()
    setIsPlaying(false)

    if (audioContextRef.current) {
      audioContextRef.current.suspend()
    }
  }, [stopAllNodes])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      handlePause()
    } else {
      handlePlay()
    }
  }, [isPlaying, handlePlay, handlePause])

  // 初始化
  useEffect(() => {
    const settings = loadSettings()
    setVolume(settings.volume)
    setIsPlaying(settings.enabled)
    setTrackIndex(settings.trackIndex)
    setInitialized(true)
  }, [])

  // 音量变化
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    }
    localStorage.setItem(VOLUME_KEY, String(volume))
  }, [volume])

  // 记住启用状态
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(ENABLED_KEY, String(isPlaying))
    }
  }, [isPlaying, initialized])

  // 记住曲目
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(TRACK_KEY, String(trackIndex))
    }
  }, [trackIndex, initialized])

  // 曲目切换时重新播放
  useEffect(() => {
    if (initialized && isPlaying) {
      handlePlay()
    }
  }, [trackIndex])

  const handleVolumeChange = (value: number) => {
    setVolume(value / 100)
    if (value > 0 && !isPlaying) {
      handlePlay()
    }
  }

  const prevTrack = () => {
    setTrackIndex(prev => (prev - 1 + BGM_TRACKS.length) % BGM_TRACKS.length)
  }

  const nextTrack = () => {
    setTrackIndex(prev => (prev + 1) % BGM_TRACKS.length)
  }

  const selectTrack = (index: number) => {
    setTrackIndex(index)
    if (!isPlaying) {
      handlePlay()
    }
  }

  // 用户首次交互时尝试自动播放
  useEffect(() => {
    if (!initialized) return

    const handleFirstInteraction = () => {
      const settings = loadSettings()
      if (settings.enabled && !isPlaying) {
        handlePlay()
      }
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction, { once: true })
    document.addEventListener('keydown', handleFirstInteraction, { once: true })

    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [initialized, isPlaying, handlePlay])

  const currentTrack = BGM_TRACKS[trackIndex]

  return (
    <>
      <div
        className="bgm-control"
        onMouseEnter={() => setShowPanel(true)}
        onMouseLeave={() => setShowPanel(false)}
      >
        {/* 主控制面板 */}
        <div className="bgm-main-panel">
          <div className="bgm-track-info">
            <div className="bgm-track-name">{currentTrack.name}</div>
            <div className="bgm-track-desc">{currentTrack.desc}</div>
          </div>

          <div className="bgm-controls">
            <button className="bgm-icon-btn" onClick={prevTrack} title="上一首">
              <LeftOutlined />
            </button>
            <button
              className={`bgm-play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
            </button>
            <button className="bgm-icon-btn" onClick={nextTrack} title="下一首">
              <RightOutlined />
            </button>
          </div>

          <div className="bgm-volume-row">
            <SoundOutlined style={{ fontSize: 12, color: 'var(--text-tertiary)' }} />
            <Slider
              value={volume * 100}
              onChange={handleVolumeChange}
              tooltip={{ formatter: (v) => `${Math.round(v ?? 0)}%` }}
              className="bgm-volume-slider"
            />
          </div>
        </div>

        {/* 曲目列表 */}
        <div className={`bgm-track-list ${showPanel ? 'show' : ''}`}>
          <div className="bgm-track-list-title">
            <SwapOutlined />
            <span>切换音乐</span>
          </div>
          {BGM_TRACKS.map((track, index) => (
            <div
              key={index}
              className={`bgm-track-item ${index === trackIndex ? 'active' : ''}`}
              onClick={() => selectTrack(index)}
            >
              <div className="bgm-track-item-name">{track.name}</div>
              <div className="bgm-track-item-desc">{track.desc}</div>
              {index === trackIndex && isPlaying && (
                <div className="bgm-playing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 悬浮按钮 */}
        <button
          className={`bgm-float-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlay}
          title={isPlaying ? '暂停背景音乐' : '播放背景音乐'}
        >
          {isPlaying ? <PauseOutlined /> : <SoundOutlined />}
        </button>
      </div>

      <style>{`
        .bgm-control {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .bgm-main-panel {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 12px 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          min-width: 200px;
          opacity: 0;
          transform: translateY(10px) scale(0.95);
          transform-origin: bottom right;
          pointer-events: none;
          transition: all 0.2s ease;
        }

        .bgm-control:hover .bgm-main-panel {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .bgm-track-info {
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--card-border);
        }

        .bgm-track-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .bgm-track-desc {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .bgm-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .bgm-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .bgm-icon-btn:hover {
          background: var(--brand-50);
          color: var(--brand-500);
        }

        .bgm-play-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--brand-500);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .bgm-play-btn:hover {
          background: var(--brand-600);
          transform: scale(1.05);
        }

        .bgm-volume-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bgm-volume-slider {
          flex: 1;
          margin: 0;
        }

        .bgm-volume-slider .ant-slider-rail {
          background: var(--card-border);
          height: 4px;
        }

        .bgm-volume-slider .ant-slider-track {
          background: var(--brand-500);
          height: 4px;
        }

        .bgm-volume-slider .ant-slider-handle::after {
          background: var(--brand-500);
          box-shadow: 0 0 0 2px var(--brand-500);
          width: 10px;
          height: 10px;
          inset-block-start: -3px;
        }

        /* 曲目列表 */
        .bgm-track-list {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          min-width: 200px;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transform: translateY(10px);
          transform-origin: bottom right;
          transition: all 0.25s ease;
        }

        .bgm-track-list.show {
          max-height: 400px;
          opacity: 1;
          transform: translateY(0);
        }

        .bgm-track-list-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-tertiary);
          padding: 6px 8px 10px;
          border-bottom: 1px solid var(--card-border);
          margin-bottom: 4px;
        }

        .bgm-track-item {
          position: relative;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .bgm-track-item:hover {
          background: var(--brand-50);
        }

        .bgm-track-item.active {
          background: var(--brand-50);
        }

        .bgm-track-item-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .bgm-track-item-desc {
          font-size: 10px;
          color: var(--text-tertiary);
        }

        .bgm-playing-indicator {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 14px;
        }

        .bgm-playing-indicator span {
          width: 2px;
          background: var(--brand-500);
          border-radius: 1px;
          animation: equalizer 1s ease-in-out infinite;
        }

        .bgm-playing-indicator span:nth-child(1) {
          animation-delay: -0.4s;
        }

        .bgm-playing-indicator span:nth-child(2) {
          animation-delay: -0.2s;
        }

        @keyframes equalizer {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }

        /* 悬浮按钮 */
        .bgm-float-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .bgm-float-btn:hover {
          background: var(--brand-500);
          color: white;
          border-color: var(--brand-500);
          transform: scale(1.05);
        }

        .bgm-float-btn.playing {
          background: var(--brand-500);
          color: white;
          border-color: var(--brand-500);
        }

        .bgm-float-btn.playing:hover {
          background: var(--brand-600);
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .bgm-control {
            bottom: 16px;
            right: 16px;
          }

          .bgm-main-panel {
            min-width: 180px;
            padding: 10px 14px;
          }

          .bgm-track-list {
            min-width: 180px;
          }

          .bgm-float-btn {
            width: 40px;
            height: 40px;
            font-size: 16px;
          }
        }
      `}</style>
    </>
  )
}
