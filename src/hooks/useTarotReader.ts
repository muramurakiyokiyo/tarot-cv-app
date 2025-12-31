'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTarotReaderReturn {
  isCvLoaded: boolean;
  hasSavedImage: boolean;
  candidates: string[];
  blacklist: string[];
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  captureImage: () => void;
  deleteImage: () => void;
  addToBlacklist: (card: string) => void;
}

const STORAGE_KEY = 'tarot-captured-image';

export function useTarotReader(): UseTarotReaderReturn {
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [hasSavedImage, setHasSavedImage] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const savedImageRef = useRef<string | null>(null);
  const savedImageElementRef = useRef<HTMLImageElement | null>(null);

  // OpenCV.jsのロード
  useEffect(() => {
    // 既にロード済みかチェック
    if (window.cv) {
      setIsCvLoaded(true);
      console.log('OpenCV.js Ready');
      return;
    }

    // ScriptタグでOpenCV.jsをロード
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.onload = () => {
      // OpenCV.jsの初期化を待つ
      window.cv.onRuntimeInitialized = () => {
        setIsCvLoaded(true);
        console.log('OpenCV.js Ready');
      };
    };
    document.body.appendChild(script);

    return () => {
      // クリーンアップ
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // 保存済み画像の復元
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      savedImageRef.current = saved;
      setHasSavedImage(true);
      setCandidates(['THE SUN', 'THE FOOL', 'THE MAGICIAN']);
    }
  }, []);

  // 保存済み画像のロード
  useEffect(() => {
    if (hasSavedImage && savedImageRef.current && !savedImageElementRef.current) {
      const img = new Image();
      img.onload = () => {
        savedImageElementRef.current = img;
      };
      img.src = savedImageRef.current;
    } else if (!hasSavedImage) {
      savedImageElementRef.current = null;
    }
  }, [hasSavedImage]);

  // 描画ループ
  const drawLoop = useCallback(() => {
    if (!canvasRef.current || !isCvLoaded) {
      animationFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    if (hasSavedImage && savedImageElementRef.current) {
      // 保存済み画像を表示
      const img = savedImageElementRef.current;
      if (img.complete) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // ダミーOCR解析（ループ実行）
        // 実際のOCR処理はここに実装
      }
    } else if (videoRef.current && videoRef.current.readyState === 4) {
      // ライブプレビュー（フィルタ適用）
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        // OpenCVでフィルタ処理
        const src = window.cv.imread(video);
        const gray = new window.cv.Mat();
        
        // グレースケール変換
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
        
        // 高コントラスト処理（コントラスト調整）
        const contrast = new window.cv.Mat();
        const alpha = 1.5; // コントラスト係数
        const beta = 0; // 明るさ調整
        gray.convertTo(contrast, -1, alpha, beta);
        
        // Canvasに描画
        window.cv.imshow(canvas, contrast);
        
        // メモリ解放
        src.delete();
        gray.delete();
        contrast.delete();
      } catch (error) {
        // OpenCV処理が失敗した場合は通常描画
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }

    animationFrameRef.current = requestAnimationFrame(drawLoop);
  }, [isCvLoaded, hasSavedImage]);

  // 描画ループの開始/停止
  useEffect(() => {
    if (isCvLoaded) {
      drawLoop();
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCvLoaded, drawLoop]);

  // カメラストリームの開始
  useEffect(() => {
    if (!hasSavedImage && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((error) => {
          console.error('カメラアクセスエラー:', error);
        });
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [hasSavedImage]);

  // 画像を撮影
  const captureImage = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !isCvLoaded) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    // 現在のCanvasの内容（フィルタ適用済み）を取得
    const imageData = canvas.toDataURL('image/png');
    
    // localStorageに保存
    localStorage.setItem(STORAGE_KEY, imageData);
    savedImageRef.current = imageData;
    
    // 状態更新
    setHasSavedImage(true);
    setCandidates(['THE SUN', 'THE FOOL', 'THE MAGICIAN']);
    
    // カメラストリームを停止
    if (video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  }, [isCvLoaded]);

  // 画像を削除
  const deleteImage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    savedImageRef.current = null;
    savedImageElementRef.current = null;
    setHasSavedImage(false);
    setCandidates([]);
    setBlacklist([]);
  }, []);

  // ブラックリストに追加
  const addToBlacklist = useCallback((card: string) => {
    setBlacklist((prev) => [...prev, card]);
  }, []);

  // フィルタリングされた候補
  const filteredCandidates = candidates.filter((c) => !blacklist.includes(c));

  return {
    isCvLoaded,
    hasSavedImage,
    candidates: filteredCandidates,
    blacklist,
    videoRef,
    canvasRef,
    captureImage,
    deleteImage,
    addToBlacklist,
  };
}

